import { NextRequest, NextResponse } from 'next/server';
import { validateTeacherInviteToken, submitTeacherInvite } from '@/lib/teacher-invites';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

function verifyInitData(initData: string): { valid: boolean; user?: TelegramUser } {
  if (!TELEGRAM_BOT_TOKEN) {
    console.error('TELEGRAM_BOT_TOKEN is not configured');
    return { valid: false };
  }

  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return { valid: false };

    params.delete('hash');
    const paramsArray = Array.from(params.entries());
    paramsArray.sort(([a], [b]) => a.localeCompare(b));
    const dataCheckString = paramsArray.map(([k, v]) => `${k}=${v}`).join('\n');

    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(TELEGRAM_BOT_TOKEN)
      .digest();

    const calculatedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    if (calculatedHash !== hash) {
      return { valid: false };
    }

    const userJson = params.get('user');
    if (!userJson) return { valid: false };

    const user: TelegramUser = JSON.parse(userJson);
    const authDate = parseInt(params.get('auth_date') || '0', 10);
    const now = Math.floor(Date.now() / 1000);
    if (now - authDate > 86400) {
      return { valid: false };
    }

    return { valid: true, user };
  } catch (error) {
    console.error('Error verifying initData:', error);
    return { valid: false };
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const validation = await validateTeacherInviteToken(token);

    if (!validation.valid || !validation.tokenData) {
      const statusCode = validation.reason === 'not_found' ? 404 : 400;
      return NextResponse.json(
        { error: 'Посилання недійсне або прострочене', reason: validation.reason },
        { status: statusCode }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { initData, teacher_name, teacher_email, teacher_phone, notes } = body;

    if (!initData) {
      return NextResponse.json(
        { error: 'Параметр initData обов\'язковий' },
        { status: 400 }
      );
    }

    const verification = verifyInitData(initData);
    if (!verification.valid || !verification.user) {
      return NextResponse.json(
        { error: 'Невірний initData. Відкрийте посилання через Telegram.' },
        { status: 401 }
      );
    }

    if (!teacher_name?.trim() || !teacher_email?.trim()) {
      return NextResponse.json(
        { error: 'Ім\'я та email обов\'язкові' },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(teacher_email.trim())) {
      return NextResponse.json(
        { error: 'Вкажіть коректний email' },
        { status: 400 }
      );
    }

    const telegramId = verification.user.id.toString();
    const telegramUsername = verification.user.username || null;

    await submitTeacherInvite(validation.tokenData.id, {
      teacher_name: teacher_name.trim(),
      teacher_email: teacher_email.trim().toLowerCase(),
      teacher_phone: teacher_phone || undefined,
      telegram_id: telegramId,
      telegram_username: telegramUsername || undefined,
      notes: notes || undefined,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error submitting teacher invite:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
