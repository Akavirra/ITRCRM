import { NextRequest, NextResponse } from 'next/server';
import { createOpenAI } from '@ai-sdk/openai';
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateText,
  stepCountIs,
  type UIMessage,
} from 'ai';

import { badRequest, getAuthUser, unauthorized } from '@/lib/api-utils';
import {
  ASSISTANT_RATE_LIMIT_MESSAGE,
  ASSISTANT_SYSTEM_PROMPT,
  ASSISTANT_USER_ERROR_MESSAGE,
} from '@/lib/assistant/constants';
import { getAssistantToday, getAssistantCurrentMonth } from '@/lib/assistant/date-utils';
import { getAssistantGuardrailReply } from '@/lib/assistant/guardrails';
import {
  getAssistantApiKeysFromEnv,
  getAvailableAssistantApiKeys,
  isAssistantQuotaError,
  markAssistantKeyRateLimited,
} from '@/lib/assistant/provider-failover';
import { getAssistantQuickReply } from '@/lib/assistant/quick-replies';
import { formatAssistantToolResults } from '@/lib/assistant/tool-result-fallback';
import { createAssistantTools } from '@/lib/assistant/tools';

export const dynamic = 'force-dynamic';

interface AssistantChatRequestBody {
  messages: Array<Omit<UIMessage, 'id'> & { id?: string }>;
}

function extractLatestUserText(messages: AssistantChatRequestBody['messages']) {
  const latestUserMessage = [...messages]
    .reverse()
    .find((message) => message.role === 'user');

  if (!latestUserMessage) {
    return '';
  }

  return latestUserMessage.parts
    .filter(
      (
        part,
      ): part is {
        type: 'text';
        text: string;
      } => part.type === 'text' && typeof part.text === 'string',
    )
    .map((part) => part.text)
    .join(' ')
    .trim();
}

function createAssistantTextResponse(
  messages: AssistantChatRequestBody['messages'],
  text: string,
  textPartId: string,
) {
  const stream = createUIMessageStream({
    originalMessages: messages as UIMessage[],
    execute: ({ writer }) => {
      writer.write({ type: 'start' });
      writer.write({ type: 'text-start', id: textPartId });
      writer.write({ type: 'text-delta', id: textPartId, delta: text });
      writer.write({ type: 'text-end', id: textPartId });
      writer.write({ type: 'finish', finishReason: 'stop' });
    },
  });

  return createUIMessageStreamResponse({ stream });
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const assistantApiKeys = getAssistantApiKeysFromEnv();

  if (assistantApiKeys.length === 0) {
    return NextResponse.json(
      { error: 'AI помічник не налаштований. Додайте GROQ_API_KEY або GROQ_API_KEYS.' },
      { status: 503 },
    );
  }

  let body: AssistantChatRequestBody;
  try {
    body = (await request.json()) as AssistantChatRequestBody;
  } catch {
    return badRequest('Невірний формат запиту');
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return badRequest("Повідомлення обов'язкові");
  }

  try {
    const latestUserText = extractLatestUserText(body.messages);
    const guardrailReply = latestUserText
      ? getAssistantGuardrailReply(latestUserText)
      : null;

    if (guardrailReply) {
      return createAssistantTextResponse(
        body.messages,
        guardrailReply,
        'assistant-guardrail-reply',
      );
    }

    const quickReply = latestUserText
      ? await getAssistantQuickReply({ text: latestUserText })
      : null;

    if (quickReply) {
      return createAssistantTextResponse(
        body.messages,
        quickReply,
        'assistant-quick-reply',
      );
    }

    const recentMessages = body.messages.slice(-10);
    const sanitizedMessages = recentMessages.map(({ id: _id, ...message }) => ({
      ...message,
      parts: message.parts.filter(
        (part: { type: string }) => part.type === 'text',
      ),
    }));

    const modelMessages = await convertToModelMessages(sanitizedMessages);
    const availableAssistantApiKeys = getAvailableAssistantApiKeys(assistantApiKeys);

    if (availableAssistantApiKeys.length === 0) {
      return createAssistantTextResponse(
        body.messages,
        ASSISTANT_RATE_LIMIT_MESSAGE,
        'assistant-rate-limit-reply',
      );
    }

    let lastQuotaError: unknown = null;

    for (const apiKey of availableAssistantApiKeys) {
      const groq = createOpenAI({
        baseURL: 'https://api.groq.com/openai/v1',
        apiKey,
      });

      try {
        const result = await generateText({
          model: groq(process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'),
          system: `${ASSISTANT_SYSTEM_PROMPT}\nДата: ${getAssistantToday()}. Місяць: ${getAssistantCurrentMonth()}.`,
          messages: modelMessages,
          maxOutputTokens: 1024,
          temperature: 0,
          stopWhen: stepCountIs(3),
          tools: createAssistantTools(),
        });

        const responseText =
          result.text?.trim() ||
          formatAssistantToolResults(result.toolResults as Array<{ toolName?: string; output?: unknown }>) ||
          'Не вдалося сформувати текстову відповідь. Спробуйте уточнити запит.';

        return createAssistantTextResponse(
          body.messages,
          responseText,
          'assistant-model-reply',
        );
      } catch (error) {
        if (isAssistantQuotaError(error)) {
          markAssistantKeyRateLimited(apiKey);
          lastQuotaError = error;
          continue;
        }

        throw error;
      }
    }

    if (lastQuotaError) {
      return createAssistantTextResponse(
        body.messages,
        ASSISTANT_RATE_LIMIT_MESSAGE,
        'assistant-rate-limit-reply',
      );
    }

    throw new Error(ASSISTANT_USER_ERROR_MESSAGE);
  } catch (error) {
    console.error('Assistant error:', error);
    return NextResponse.json(
      { error: ASSISTANT_USER_ERROR_MESSAGE },
      { status: 500 },
    );
  }
}
