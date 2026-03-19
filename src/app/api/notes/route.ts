import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized } from '@/lib/api-utils';
import { all, run } from '@/db';

export const dynamic = 'force-dynamic';

// GET /api/notes — list current user's notes
export async function GET(request: NextRequest) {
  const currentUser = await getAuthUser(request);
  if (!currentUser) return unauthorized();

  const notes = await all(
    `SELECT id, type, title, content, tasks, color, is_pinned, tags, created_at, updated_at
     FROM notes
     WHERE user_id = $1
     ORDER BY is_pinned DESC, updated_at DESC`,
    [currentUser.id]
  );

  return NextResponse.json({ notes });
}

// POST /api/notes — create a new note
export async function POST(request: NextRequest) {
  const currentUser = await getAuthUser(request);
  if (!currentUser) return unauthorized();

  const body = await request.json();
  const type = body.type === 'todo' ? 'todo' : 'note';

  const result = await all<{ id: number; type: string; title: string; content: string; tasks: unknown[]; color: string | null; is_pinned: boolean; created_at: string; updated_at: string }>(
    `INSERT INTO notes (user_id, type, title, content, tasks, color, is_pinned, tags)
     VALUES ($1, $2, '', '', '[]', NULL, FALSE, '{}')
     RETURNING id, type, title, content, tasks, color, is_pinned, tags, created_at, updated_at`,
    [currentUser.id, type]
  );

  return NextResponse.json({ note: result[0] }, { status: 201 });
}
