const { generateText, stepCountIs, convertToModelMessages } = require('ai');
const { createOpenAI } = require('@ai-sdk/openai');
const { z } = require('zod');
require('dotenv').config({ path: '.env.local' });

async function main() {
  try {
    const groq = createOpenAI({
      baseURL: 'https://api.groq.com/openai/v1',
      apiKey: process.env.GROQ_API_KEY,
    });

    const modelMessages = [
      { role: 'user', content: [{ type: 'text', text: 'чи є проблемні учні?' }] }
    ];

    console.log('Sending request...');
    const result = await generateText({
      model: groq('llama-3.3-70b-versatile'),
      system: 'You are a test assistant.',
      messages: modelMessages,
      maxOutputTokens: 1024,
      temperature: 0,
      stopWhen: stepCountIs(3),
      tools: {
        test_tool: {
          description: 'A test tool.',
          parameters: z.object({}),
          execute: async () => { return { status: 'ok' }; }
        }
      }
    });

    console.log('Success:', result.text);
  } catch (error) {
    console.error('FAILED!', error);
  }
}

main();
