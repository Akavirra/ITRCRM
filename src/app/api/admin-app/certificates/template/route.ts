import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, isAdmin, forbidden } from '@/lib/api-utils';
import { uploadBuffer } from '@/lib/cloudinary';
import { run } from '@/db';

export const dynamic = 'force-dynamic';

const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();
  if (!isAdmin(user)) return forbidden();

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'Файл не обрано' }, { status: 400 });
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Дозволяються лише файли PNG та JPEG' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'Файл занадто великий (макс. 10MB)' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    // Upload to Cloudinary
    const uploadResult = await uploadBuffer(buffer, 'certificates', 'template');

    // Update system settings
    await run(
      `INSERT INTO system_settings (key, value, updated_at) 
       VALUES ('certificate_template_url', $1, NOW()) 
       ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
      [uploadResult.url]
    );

    return NextResponse.json({
      success: true,
      url: uploadResult.url
    });
  } catch (error: any) {
    console.error('Template upload error:', error);
    return NextResponse.json({ error: error.message || 'Помилка при завантаженні шаблону' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  try {
    const res = await run("SELECT value FROM system_settings WHERE key = 'certificate_template_url'");
    const url = Array.isArray(res) && res.length > 0 ? res[0].value : null;
    return NextResponse.json({ url });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
