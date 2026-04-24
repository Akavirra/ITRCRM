/**
 * GET  /api/student/works/[id]/content — потоковий проксі файлу з Google Drive.
 * HEAD /api/student/works/[id]/content — те саме без body.
 *
 * Критично: учень НЕ отримує URL-ів Google Drive — доступ до файлу завжди
 * проходить через цей route, який:
 *   1. Перевіряє cookie student_session (через getStudentFromRequest)
 *   2. Перевіряє, що student_works.id належить цьому студенту (не видалена)
 *   3. Тільки після цього стрімить байти з Drive з коректним Range
 *
 * Query:
 *   ?download=1 — примушує браузер скачати файл (Content-Disposition: attachment)
 *
 * Використовуємо admin OAuth до Drive (інакше не маємо доступу — файли приватні),
 * але запитати може лише власник роботи. @/lib/google-drive викликається після
 * перевірки ownership через neon-student.
 */

import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getStudentFromRequest } from '@/lib/student-auth';
import { getStudentWorkForStudent } from '@/lib/student-works';
import { fetchDriveFileContent } from '@/lib/google-drive';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Навмисне НЕ передаємо content-length: Next.js/Node можуть по-своєму
// перекодувати body (chunked) і некоректний content-length ламає браузер.
const PASSTHROUGH_HEADERS = [
  'accept-ranges',
  'content-encoding',
  'content-range',
  'content-type',
  'etag',
  'last-modified',
];

function sanitizeHeaderFilename(name: string): string {
  // Content-Disposition filename* квотуємо окремо (RFC 5987), але для простоти
  // вирізаємо символи, які ламають header
  return name.replace(/[\\"\r\n]/g, '').slice(0, 200);
}

/**
 * filename="..." у Content-Disposition має бути ASCII-only (RFC 6266).
 * Не-ASCII символи (Cyrillic тощо) йдуть тільки в filename*=UTF-8''...
 * Інакше Node.js кидає ERR_INVALID_CHAR при встановленні header-а.
 */
function asciiFallbackFilename(name: string): string {
  // Замінюємо все не-ASCII на '_', обрізаємо до 200 символів
  const ascii = name.replace(/[^\x20-\x7E]/g, '_').replace(/[\\"\r\n]/g, '').trim();
  return ascii.slice(0, 200) || 'student-work';
}

function buildHeaders(
  sourceHeaders: Headers,
  opts: { fileName: string; mimeType: string | null; forceDownload: boolean }
): Headers {
  const headers = new Headers();

  for (const headerName of PASSTHROUGH_HEADERS) {
    const value = sourceHeaders.get(headerName);
    if (value) {
      headers.set(headerName, value);
    }
  }

  if (!headers.has('accept-ranges')) {
    headers.set('accept-ranges', 'bytes');
  }

  // Перезаписуємо content-type з БД, якщо Drive повернув щось generic
  if (opts.mimeType && !headers.has('content-type')) {
    headers.set('content-type', opts.mimeType);
  }

  const disposition = opts.forceDownload ? 'attachment' : 'inline';
  const rawName = sanitizeHeaderFilename(opts.fileName) || 'student-work';
  const asciiName = asciiFallbackFilename(rawName);
  // filename="..." — лише ASCII (fallback для старих клієнтів),
  // filename*=UTF-8''... — реальна Unicode-назва (RFC 5987).
  headers.set(
    'content-disposition',
    `${disposition}; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(rawName)}`
  );

  // Приватний контент — не кешуємо на CDN
  headers.set('cache-control', 'private, no-store');
  headers.set('x-content-type-options', 'nosniff');
  headers.set('referrer-policy', 'no-referrer');

  return headers;
}

async function resolveAndStream(request: NextRequest, workId: number, method: 'GET' | 'HEAD') {
  const student = await getStudentFromRequest(request);
  if (!student) {
    return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });
  }

  const work = await getStudentWorkForStudent(workId, student.id);
  if (!work) {
    return NextResponse.json({ error: 'Роботу не знайдено' }, { status: 404 });
  }

  if (work.storage_kind !== 'gdrive' || !work.storage_url) {
    return NextResponse.json({ error: 'Storage backend not supported' }, { status: 415 });
  }

  const range = request.headers.get('range');
  const driveResponse = await fetchDriveFileContent(work.storage_url, range);

  if (!driveResponse.ok && driveResponse.status !== 206) {
    return NextResponse.json({ error: 'Файл недоступний' }, { status: 502 });
  }

  const forceDownload = request.nextUrl.searchParams.get('download') === '1';
  const headers = buildHeaders(driveResponse.headers, {
    fileName: work.title || `work-${work.id}`,
    mimeType: work.mime_type,
    forceDownload,
  });

  if (method === 'HEAD') {
    return new NextResponse(null, { status: driveResponse.status, headers });
  }

  return new NextResponse(driveResponse.body, { status: driveResponse.status, headers });
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const workId = parseInt(params.id, 10);
  if (!Number.isFinite(workId) || workId <= 0) {
    return NextResponse.json({ error: 'Invalid work id' }, { status: 400 });
  }
  try {
    return await resolveAndStream(request, workId, 'GET');
  } catch (error) {
    console.error('[student-works] stream error:', error);
    return NextResponse.json(
      { error: 'Stream failed', detail: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function HEAD(request: NextRequest, { params }: { params: { id: string } }) {
  const workId = parseInt(params.id, 10);
  if (!Number.isFinite(workId) || workId <= 0) {
    return NextResponse.json({ error: 'Invalid work id' }, { status: 400 });
  }
  try {
    return await resolveAndStream(request, workId, 'HEAD');
  } catch (error) {
    console.error('[student-works] HEAD error:', error);
    return NextResponse.json(
      { error: 'Stream failed', detail: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
