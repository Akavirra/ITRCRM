import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized } from '@/lib/api-utils';
import { all, run } from '@/db';
import { createUserNotification } from '@/lib/notifications';

export const dynamic = 'force-dynamic';

interface NoteReminder {
  id: number;
  user_id: number;
  title: string;
  type: string;
}

// POST /api/notes/check-reminders — fire due reminders for current user
export async function POST(request: NextRequest) {
  const currentUser = await getAuthUser(request);
  if (!currentUser) return unauthorized();

  const due = await all<NoteReminder>(
    `SELECT id, user_id, title, type FROM notes
     WHERE user_id = $1
       AND remind_at IS NOT NULL
       AND remind_at <= NOW()
       AND reminded = FALSE
       AND is_archived = FALSE`,
    [currentUser.id]
  );

  for (const note of due) {
    await createUserNotification(
      note.user_id,
      'note_reminder',
      '🔔 Нагадування',
      note.title || (note.type === 'todo' ? 'Список задач' : 'Нотатка'),
      null,
      `note-reminder-${note.id}`
    );
    await run(`UPDATE notes SET reminded = TRUE WHERE id = $1`, [note.id]);
  }

  return NextResponse.json({ fired: due.length });
}
