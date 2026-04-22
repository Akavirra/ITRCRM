import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, isAdmin, forbidden } from '@/lib/api-utils';
import { run, get } from '@/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  try {
    const res = await get<{ value: string }>(
      "SELECT value FROM system_settings WHERE key = 'certificate_id_settings'"
    );
    const settings = res?.value ? JSON.parse(res.value) : {
      // ID settings
      fontSize: 36,
      xPercent: 50,
      yPercent: 12,
      color: '#000000',
      idLetterSpacing: 1.5,
      idWeight: 'normal',
      idStyle: 'normal',
      // Amount settings
      amountFontSize: 48,
      amountXPercent: 78,
      amountYPercent: 28,
      amountColor: '#FFFFFF',
      amountRotation: -28,
      amountWeight: 'normal',
      amountStyle: 'normal'
    };
    return NextResponse.json(settings);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();
  if (!isAdmin(user)) return forbidden();

  try {
    const settings = await request.json();
    
    // Basic validation
    if (typeof settings.fontSize !== 'number' || typeof settings.xPercent !== 'number' || typeof settings.yPercent !== 'number') {
      return NextResponse.json({ error: 'Invalid settings format' }, { status: 400 });
    }

    await run(
      `INSERT INTO system_settings (key, value, updated_at) 
       VALUES ('certificate_id_settings', $1, NOW()) 
       ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
      [JSON.stringify(settings)]
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Settings save error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
