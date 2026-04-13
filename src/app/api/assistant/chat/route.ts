import { NextRequest, NextResponse } from 'next/server';
import { createOpenAI } from '@ai-sdk/openai';
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  stepCountIs,
  streamText,
  type UIMessage,
} from 'ai';

import { badRequest, getAuthUser, unauthorized } from '@/lib/api-utils';
import {
  ASSISTANT_SYSTEM_PROMPT,
  ASSISTANT_USER_ERROR_MESSAGE,
} from '@/lib/assistant/constants';
import { getAssistantGuardrailReply } from '@/lib/assistant/guardrails';
import { getAssistantQuickReply } from '@/lib/assistant/quick-replies';
import { createAssistantTools } from '@/lib/assistant/tools';

export const dynamic = 'force-dynamic';

const groq = createOpenAI({
  baseURL: 'https://api.groq.com/openai/v1',
  apiKey: process.env.GROQ_API_KEY,
});

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

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json(
      { error: 'AI помічник не налаштований. Додайте GROQ_API_KEY.' },
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
      const stream = createUIMessageStream({
        originalMessages: body.messages as UIMessage[],
        execute: ({ writer }) => {
          const textPartId = 'assistant-guardrail-reply';

          writer.write({ type: 'start' });
          writer.write({ type: 'text-start', id: textPartId });
          writer.write({ type: 'text-delta', id: textPartId, delta: guardrailReply });
          writer.write({ type: 'text-end', id: textPartId });
          writer.write({ type: 'finish', finishReason: 'stop' });
        },
      });

      return createUIMessageStreamResponse({ stream });
    }

    const quickReply = latestUserText
      ? await getAssistantQuickReply({ text: latestUserText })
      : null;

    if (quickReply) {
      const stream = createUIMessageStream({
        originalMessages: body.messages as UIMessage[],
        execute: ({ writer }) => {
          const textPartId = 'assistant-quick-reply';

          writer.write({ type: 'start' });
          writer.write({ type: 'text-start', id: textPartId });
          writer.write({ type: 'text-delta', id: textPartId, delta: quickReply });
          writer.write({ type: 'text-end', id: textPartId });
          writer.write({ type: 'finish', finishReason: 'stop' });
        },
      });

      return createUIMessageStreamResponse({ stream });
    }

    const modelMessages = await convertToModelMessages(
      body.messages.map(({ id: _id, ...message }) => message),
    );

    const result = streamText({
      model: groq(process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'),
      system: ASSISTANT_SYSTEM_PROMPT,
      messages: modelMessages,
      temperature: 0,
      stopWhen: stepCountIs(5),
      tools: createAssistantTools(),
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error('Assistant error:', error);
    return NextResponse.json(
      { error: ASSISTANT_USER_ERROR_MESSAGE },
      { status: 500 },
    );
  }
}
