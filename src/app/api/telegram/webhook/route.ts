import { NextRequest, NextResponse } from 'next/server';
import { neon, neonConfig } from '@neondatabase/serverless';

// Configure Neon to not cache responses
neonConfig.fetchFunction = (url: any, init: any) => {
  return fetch(url, { ...init, cache: 'no-store' });
};

const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// POST /api/telegram/webhook - Set up Telegram webhook
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url } = body;
    
    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }
    
    if (!TELEGRAM_BOT_TOKEN) {
      return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN not configured' }, { status: 500 });
    }
    
    // Set the webhook
    const webhookUrl = `${url}/api/telegram/callback`;
    const response = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: webhookUrl,
          allowed_updates: ['callback_query', 'message']
        })
      }
    );
    
    const data = await response.json();
    
    if (data.ok) {
      return NextResponse.json({ 
        success: true, 
        webhook: webhookUrl,
        result: data.result 
      });
    } else {
      return NextResponse.json({ 
        error: 'Failed to set webhook', 
        details: data.description 
      }, { status: 500 });
    }
  } catch (error) {
    console.error('[Telegram Webhook Setup Error]', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// GET - Get current webhook info
export async function GET() {
  if (!TELEGRAM_BOT_TOKEN) {
    return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN not configured' }, { status: 500 });
  }
  
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo`
    );
    const data = await response.json();
    
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to get webhook info' }, { status: 500 });
  }
}

// DELETE - Remove webhook
export async function DELETE() {
  if (!TELEGRAM_BOT_TOKEN) {
    return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN not configured' }, { status: 500 });
  }
  
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/deleteWebhook`
    );
    const data = await response.json();
    
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete webhook' }, { status: 500 });
  }
}
