import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

// POST — register the media bot webhook with Telegram
export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const botToken = process.env.MEDIA_BOT_TOKEN;
  const secret = process.env.MEDIA_BOT_SECRET;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL;

  if (!botToken || !secret || !appUrl) {
    return NextResponse.json({ error: 'Missing MEDIA_BOT_TOKEN, MEDIA_BOT_SECRET, or APP_URL' }, { status: 500 });
  }

  const webhookUrl = `${appUrl}/api/telegram/media-webhook`;

  const res = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: webhookUrl,
      secret_token: secret,
      allowed_updates: ['message'],
    }),
  });

  const data = await res.json();
  return NextResponse.json(data);
}

// GET — check current webhook info
export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const botToken = process.env.MEDIA_BOT_TOKEN;
  if (!botToken) return NextResponse.json({ error: 'MEDIA_BOT_TOKEN not set' }, { status: 500 });

  const res = await fetch(`https://api.telegram.org/bot${botToken}/getWebhookInfo`);
  const data = await res.json();
  return NextResponse.json(data);
}
