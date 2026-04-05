import { NextRequest, NextResponse } from 'next/server';
import { get } from '@/db';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ user: null });
    }

    const user = await get<{ name: string; photo_url: string | null }>(
      `SELECT name, photo_url FROM users WHERE email = $1 AND role = 'admin' AND is_active = true`,
      [email.trim().toLowerCase()]
    );

    if (!user) {
      return NextResponse.json({ user: null });
    }

    return NextResponse.json({
      user: {
        name: user.name,
        photo_url: user.photo_url || null,
      },
    });
  } catch {
    return NextResponse.json({ user: null });
  }
}
