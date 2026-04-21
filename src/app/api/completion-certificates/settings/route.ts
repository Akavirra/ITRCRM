import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, isAdmin, forbidden } from '@/lib/api-utils';
import { run, get } from '@/db';

export const dynamic = 'force-dynamic';

const DEFAULT_SETTINGS = {
  templateUrl: null as string | null,
  courseBlockOverrides: {} as Record<string, {
    key: string;
    weight: 'normal' | 'bold';
    style: 'normal' | 'italic';
    wrap: boolean;
    size: number;
    xPercent: number;
    yPercent: number;
    color: string;
    align: 'left' | 'center' | 'right';
  }>,
  blocks: [
    { key: 'student_name', weight: 'normal', style: 'normal', wrap: false, size: 42, xPercent: 50, yPercent: 45, color: '#1a237e', align: 'center' as const },
    { key: 'verb', weight: 'normal', style: 'normal', wrap: true, size: 18, xPercent: 50, yPercent: 38, color: '#1a237e', align: 'center' as const },
    { key: 'course_name', weight: 'bold', style: 'normal', wrap: true, size: 20, xPercent: 50, yPercent: 28, color: '#1565c0', align: 'center' as const },
    { key: 'issue_date', weight: 'normal', style: 'normal', wrap: false, size: 14, xPercent: 80, yPercent: 8, color: '#1a237e', align: 'left' as const },
  ]
};

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  try {
    const res = await get<{ value: string }>(
      "SELECT value FROM system_settings WHERE key = 'completion_certificate_settings'"
    );
    const parsedSettings = res?.value ? JSON.parse(res.value) : DEFAULT_SETTINGS;
    const settings = {
      ...DEFAULT_SETTINGS,
      ...parsedSettings,
      blocks: Array.isArray(parsedSettings?.blocks) ? parsedSettings.blocks : DEFAULT_SETTINGS.blocks,
      courseBlockOverrides:
        parsedSettings?.courseBlockOverrides && typeof parsedSettings.courseBlockOverrides === 'object'
          ? parsedSettings.courseBlockOverrides
          : {},
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

    if (!Array.isArray(settings.blocks)) {
      return NextResponse.json({ error: 'Invalid settings format: blocks must be an array' }, { status: 400 });
    }

    const normalizedSettings = {
      ...DEFAULT_SETTINGS,
      ...settings,
      courseBlockOverrides:
        settings.courseBlockOverrides && typeof settings.courseBlockOverrides === 'object'
          ? Object.fromEntries(
              Object.entries(settings.courseBlockOverrides)
                .filter(([, block]) => block && typeof block === 'object')
            )
          : {},
    };

    await run(
      `INSERT INTO system_settings (key, value, updated_at)
       VALUES ('completion_certificate_settings', $1, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
      [JSON.stringify(normalizedSettings)]
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Completion certificate settings save error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
