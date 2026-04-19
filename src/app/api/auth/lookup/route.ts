import { NextRequest, NextResponse } from 'next/server';
import { get } from '@/db';

export const dynamic = 'force-dynamic';

// NOTE: This endpoint is intentionally unauthenticated — it's called from the login page
// to show user avatar before login. It returns minimal info (photo only, no name).
// For a public-facing app, add rate limiting to prevent email enumeration.
export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ user: null });
    }

    const user = await get<{ photo_url: string | null; avatar_seed: string | null }>(
      `SELECT photo_url, avatar_seed FROM users WHERE email = $1 AND role = 'admin' AND is_active = true`,
      [email.trim().toLowerCase()]
    );

    if (!user) {
      return NextResponse.json({ user: null });
    }

    return NextResponse.json({
      user: {
        photo_url: user.photo_url || null,
        avatar_seed: user.avatar_seed || null,
      },
    });
  } catch {
    return NextResponse.json({ user: null });
  }
}
