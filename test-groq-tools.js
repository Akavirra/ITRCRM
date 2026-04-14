const { generateText, convertToModelMessages } = require('ai');
const { createOpenAI } = require('@ai-sdk/openai');
require('dotenv').config({ path: '.env.local' });
// polyfill next/server to avoid errors in tools.ts if any
global.NextResponse = {};

async function main() {
  const { createAssistantTools } = require('./src/lib/assistant/tools');

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
      tools: createAssistantTools(),
    });

    console.log('Success:', result.text);
    console.log('Tool calls:', result.toolCalls);
    console.log('Tool results:', result.toolResults);
  } catch (error) {
    console.error('FAILED!', error);
  }
}

main();
