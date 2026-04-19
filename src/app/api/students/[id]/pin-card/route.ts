/**
 * Керування PIN-карткою учня (портал). АДМІН-ТІЛЬКИ.
 *
 *   GET    /api/students/[id]/pin-card — статус: чи є активна картка (без PIN!)
 *   POST   /api/students/[id]/pin-card — згенерувати нову (+ відкликати стару)
 *                                        Відповідь: { code, pin } — pin у plaintext ОДИН РАЗ
 *   DELETE /api/students/[id]/pin-card — відкликати активну картку
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized } from '@/lib/api-utils';
import {
  issuePinCard,
  revokePinCard,
  getPinCardStatus,
} from '@/lib/student-credentials';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs'; // bcrypt

function parseStudentId(raw: string): number | null {
  const n = parseInt(raw, 10);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const studentId = parseStudentId(params.id);
  if (studentId === null) {
    return NextResponse.json({ error: 'Невірний ID учня' }, { status: 400 });
  }

  try {
    const status = await getPinCardStatus(studentId);
    return NextResponse.json(status);
  } catch (error) {
    console.error('[pin-card GET] error:', error);
    return NextResponse.json({ error: 'Внутрішня помилка сервера' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const studentId = parseStudentId(params.id);
  if (studentId === null) {
    return NextResponse.json({ error: 'Невірний ID учня' }, { status: 400 });
  }

  try {
    const card = await issuePinCard(studentId, user.id);
    // ⚠️ PIN у plaintext — повертається ОДИН РАЗ. Клієнт має одразу показати або
    // надіслати в /pdf для друку. У БД зберігається тільки bcrypt-хеш.
    return NextResponse.json({
      code: card.code,
      pin: card.pin,
      student_id: card.studentId,
      full_name: card.fullName,
    });
  } catch (error: any) {
    console.error('[pin-card POST] error:', error);
    const msg = error instanceof Error ? error.message : 'Внутрішня помилка сервера';
    const status =
      msg.includes('не знайдено') ? 404 :
      msg.includes('неактивний') ? 409 :
      500;
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const studentId = parseStudentId(params.id);
  if (studentId === null) {
    return NextResponse.json({ error: 'Невірний ID учня' }, { status: 400 });
  }

  try {
    await revokePinCard(studentId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[pin-card DELETE] error:', error);
    return NextResponse.json({ error: 'Внутрішня помилка сервера' }, { status: 500 });
  }
}
