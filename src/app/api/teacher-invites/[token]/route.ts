import { NextResponse } from 'next/server';
import { validateTeacherInviteToken } from '@/lib/teacher-invites';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const result = await validateTeacherInviteToken(token);

    if (!result.valid) {
      return NextResponse.json(
        { valid: false, reason: result.reason },
        { status: 400 }
      );
    }

    return NextResponse.json({ valid: true, tokenData: result.tokenData });
  } catch (error) {
    console.error('Error validating teacher invite token:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
