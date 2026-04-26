/**
 * Утиліти для teacher-API endpoint'ів.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getTeacherFromRequest, type CurrentTeacher } from '@/lib/teacher-auth';
import { TeacherAccessError } from '@/lib/teacher-data';
import { ShortcutValidationError } from '@/lib/lesson-shortcuts-shared';

/**
 * Викликати на початку API: повертає або викладача, або вже готову Response (401).
 *
 * Patern (як у getStudentFromRequest, але без admin-подібного боксу):
 *   const teacher = await requireTeacher(request);
 *   if (teacher instanceof NextResponse) return teacher;
 *   // ... використовуємо teacher.id
 */
export async function requireTeacher(
  request: NextRequest,
): Promise<CurrentTeacher | NextResponse> {
  const teacher = await getTeacherFromRequest(request);
  if (!teacher) {
    return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });
  }
  return teacher;
}

/**
 * Мапить TeacherAccessError + ShortcutValidationError на стандартні HTTP-відповіді.
 * Решту помилок прокидає далі.
 */
export function handleTeacherApiError(error: unknown): NextResponse | null {
  if (error instanceof TeacherAccessError) {
    if (error.code === 'invalid_input') {
      return NextResponse.json({ error: error.message, reason: error.code }, { status: 400 });
    }
    return NextResponse.json({ error: error.message, reason: error.code }, { status: 403 });
  }
  if (error instanceof ShortcutValidationError) {
    return NextResponse.json(
      { error: error.message, field: error.field },
      { status: 400 },
    );
  }
  return null;
}

/** Парсить число з URL-параметра, повертає null якщо не валідне. */
export function parsePositiveInt(raw: string | undefined): number | null {
  if (!raw) return null;
  const n = parseInt(raw, 10);
  return Number.isInteger(n) && n > 0 ? n : null;
}
