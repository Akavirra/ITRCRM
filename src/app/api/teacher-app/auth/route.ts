import { NextRequest, NextResponse } from 'next/server';
import { queryOne } from '@/db/neon';
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

// Verify Telegram Mini App initData using HMAC-SHA256
function verifyInitData(initData: string): { valid: boolean; user?: TelegramUser } {
  if (!TELEGRAM_BOT_TOKEN) {
    console.error('TELEGRAM_BOT_TOKEN is not configured');
    return { valid: false };
  }

  try {
    // Parse initData
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    
    if (!hash) {
      return { valid: false };
    }

    // Remove hash from params for validation
    params.delete('hash');

    // Sort params alphabetically and create data check string
    const paramsArray = Array.from(params.entries());
    paramsArray.sort(([a], [b]) => a.localeCompare(b));
    const dataCheckString = paramsArray
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    // Create secret key from bot token
    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(TELEGRAM_BOT_TOKEN)
      .digest();

    // Calculate HMAC
    const calculatedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    // Verify hash
    if (calculatedHash !== hash) {
      return { valid: false };
    }

    // Parse user data
    const userJson = params.get('user');
    if (!userJson) {
      return { valid: false };
    }

    const user: TelegramUser = JSON.parse(userJson);
    
    // Check auth_date to prevent replay attacks (max 24 hours old)
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

// POST /api/teacher-app/auth
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { initData } = body;

    if (!initData) {
      return NextResponse.json(
        { error: 'initData is required' },
        { status: 400 }
      );
    }

    // Verify initData
    const verification = verifyInitData(initData);
    
    if (!verification.valid || !verification.user) {
      return NextResponse.json(
        { error: 'Invalid initData' },
        { status: 401 }
      );
    }

    const telegramId = verification.user.id.toString();

    // Find teacher in database
    const teacher = await queryOne(
      `SELECT id, name, telegram_id, role 
       FROM users 
       WHERE telegram_id = $1 
       AND is_active = TRUE
       LIMIT 1`,
      [telegramId]
    );

    if (!teacher) {
      return NextResponse.json(
        { error: 'Teacher not found. Please contact administrator.' },
        { status: 401 }
      );
    }

    // Return teacher data
    return NextResponse.json({
      teacher: {
        id: teacher.id,
        name: teacher.name,
        telegram_id: teacher.telegram_id,
        role: teacher.role
      }
    });

  } catch (error) {
    console.error('Auth error:', error);
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 500 }
    );
  }
}
