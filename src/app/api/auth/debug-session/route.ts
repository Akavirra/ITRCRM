import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

function maskSessionId(sessionId: string | undefined): string | null {
  if (!sessionId) {
    return null;
  }

  if (sessionId.length <= 8) {
    return sessionId;
  }

  return `${sessionId.slice(0, 4)}...${sessionId.slice(-4)}`;
}

export async function GET(request: NextRequest) {
  const sessionId = request.cookies.get('session_id')?.value;
  const session = sessionId ? await getSession(sessionId) : null;

  return NextResponse.json({
    ok: true,
    now: new Date().toISOString(),
    request: {
      host: request.headers.get('host'),
      origin: request.headers.get('origin'),
      referer: request.headers.get('referer'),
      userAgent: request.headers.get('user-agent'),
    },
    cookie: {
      hasSessionCookie: Boolean(sessionId),
      sessionIdPreview: maskSessionId(sessionId),
    },
    session: {
      found: Boolean(session),
      expiresAt: session?.expires_at ?? null,
      userId: session?.user_id ?? null,
      createdAt: session?.created_at ?? null,
    },
  });
}
