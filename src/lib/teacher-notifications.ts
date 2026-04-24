import { all, get, run } from '@/db';
import { sendMessage } from '@/lib/telegram';
import { getTeacherAppVersionSeed } from '@/lib/teacher-app-version';
import { formatDateKyiv } from '@/lib/date-utils';

interface TeacherNotificationSystemSettings {
  teacher_daily_reminders_enabled: string;
  teacher_daily_reminders_time: string;
  teacher_hourly_reminders_enabled: string;
  teacher_hourly_reminders_before_minutes: string;
  teacher_new_lesson_notify_enabled: string;
}

export async function getTeacherNotificationSettings(): Promise<TeacherNotificationSystemSettings> {
  const rows = await all<{ key: string; value: string }>(
    `SELECT key, value FROM system_settings WHERE key LIKE 'teacher_%'`
  );
  const settings: Record<string, string> = {};
  for (const row of rows) {
    settings[row.key] = row.value;
  }
  return {
    teacher_daily_reminders_enabled: settings.teacher_daily_reminders_enabled ?? '1',
    teacher_daily_reminders_time: settings.teacher_daily_reminders_time ?? '09:00',
    teacher_hourly_reminders_enabled: settings.teacher_hourly_reminders_enabled ?? '1',
    teacher_hourly_reminders_before_minutes: settings.teacher_hourly_reminders_before_minutes ?? '60',
    teacher_new_lesson_notify_enabled: settings.teacher_new_lesson_notify_enabled ?? '1',
  };
}

interface TeacherLesson {
  id: number;
  group_id: number | null;
  lesson_date: string;
  start_datetime: string;
  end_datetime: string;
  status: string;
  is_makeup: boolean;
  is_trial: boolean;
  start_time: string;
  end_time: string;
  group_title: string | null;
  course_title: string | null;
  teacher_id: number;
  teacher_name: string | null;
  teacher_telegram_id: string | null;
  replacement_teacher_id: number | null;
  replacement_teacher_name: string | null;
  replacement_teacher_telegram_id: string | null;
}

interface ReminderResult {
  sent: number;
  skipped: number;
  errors: string[];
}

function buildMiniAppUrl(): string {
  const WEB_APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || '';
  const teacherAppVersion = `${getTeacherAppVersionSeed()}-${Date.now().toString(36)}`;
  return `${WEB_APP_URL}/tg-app?v=${encodeURIComponent(teacherAppVersion)}`;
}

function buildKeyboard() {
  return {
    inline_keyboard: [
      [
        {
          text: '📱 Відкрити кабінет',
          web_app: { url: buildMiniAppUrl() },
        },
      ],
    ],
  };
}

export async function wasReminderSent(
  lessonId: number,
  teacherId: number,
  reminderType: string
): Promise<boolean> {
  const row = await get<{ count: number }>(
    `SELECT COUNT(*) as count FROM teacher_reminder_logs
     WHERE lesson_id = $1 AND teacher_id = $2 AND reminder_type = $3`,
    [lessonId, teacherId, reminderType]
  );
  return (row?.count ?? 0) > 0;
}

export async function logReminderSent(
  lessonId: number,
  teacherId: number,
  reminderType: string,
  telegramId: string | null,
  success: boolean,
  errorMessage?: string
): Promise<void> {
  await run(
    `INSERT INTO teacher_reminder_logs (lesson_id, teacher_id, reminder_type, telegram_id, success, error_message)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (lesson_id, teacher_id, reminder_type) DO UPDATE SET
       sent_at = NOW(),
       telegram_id = EXCLUDED.telegram_id,
       success = EXCLUDED.success,
       error_message = EXCLUDED.error_message`,
    [lessonId, teacherId, reminderType, telegramId, success, errorMessage || null]
  );
}

function getEffectiveTeacher(lesson: TeacherLesson): {
  teacherId: number;
  teacherName: string | null;
  teacherTelegramId: string | null;
  isReplacement: boolean;
} {
  if (lesson.replacement_teacher_id && lesson.replacement_teacher_telegram_id) {
    return {
      teacherId: lesson.replacement_teacher_id,
      teacherName: lesson.replacement_teacher_name,
      teacherTelegramId: lesson.replacement_teacher_telegram_id,
      isReplacement: true,
    };
  }
  return {
    teacherId: lesson.teacher_id,
    teacherName: lesson.teacher_name,
    teacherTelegramId: lesson.teacher_telegram_id,
    isReplacement: false,
  };
}

export async function getTodaysLessonsForTeachers(): Promise<TeacherLesson[]> {
  return all<TeacherLesson>(
    `SELECT
      l.id, l.group_id, l.lesson_date, l.start_datetime, l.end_datetime, l.status,
      l.is_makeup, l.is_trial,
      TO_CHAR(l.start_datetime AT TIME ZONE COALESCE(g.timezone, 'Europe/Kyiv'), 'HH24:MI') as start_time,
      TO_CHAR(l.end_datetime AT TIME ZONE COALESCE(g.timezone, 'Europe/Kyiv'), 'HH24:MI') as end_time,
      g.title as group_title, c.title as course_title,
      COALESCE(l.teacher_id, g.teacher_id) as teacher_id,
      COALESCE(t.name, gt.name) as teacher_name,
      COALESCE(t.telegram_id, gt.telegram_id) as teacher_telegram_id,
      ltr.replacement_teacher_id,
      ru.name as replacement_teacher_name,
      ru.telegram_id as replacement_teacher_telegram_id
    FROM lessons l
    LEFT JOIN groups g ON l.group_id = g.id
    LEFT JOIN courses c ON COALESCE(l.course_id, g.course_id) = c.id
    LEFT JOIN users t ON l.teacher_id = t.id
    LEFT JOIN users gt ON g.teacher_id = gt.id
    LEFT JOIN lesson_teacher_replacements ltr ON l.id = ltr.lesson_id
    LEFT JOIN users ru ON ltr.replacement_teacher_id = ru.id
    WHERE l.lesson_date = CURRENT_DATE
      AND l.status = 'scheduled'
    ORDER BY l.start_datetime ASC`
  );
}

export async function sendDailyReminders(): Promise<ReminderResult> {
  const sysSettings = await getTeacherNotificationSettings();
  if (sysSettings.teacher_daily_reminders_enabled === '0') {
    return { sent: 0, skipped: 0, errors: ['Daily reminders disabled in settings'] };
  }

  const lessons = await getTodaysLessonsForTeachers();
  const result: ReminderResult = { sent: 0, skipped: 0, errors: [] };

  if (lessons.length === 0) {
    return result;
  }

  // Group lessons by effective teacher telegram id
  const byTeacher = new Map<string, { telegramId: string; name: string; lessons: TeacherLesson[] }>();

  for (const lesson of lessons) {
    const effective = getEffectiveTeacher(lesson);
    if (!effective.teacherTelegramId) continue;

    const key = effective.teacherTelegramId;
    if (!byTeacher.has(key)) {
      byTeacher.set(key, {
        telegramId: key,
        name: effective.teacherName || 'Викладач',
        lessons: [],
      });
    }
    byTeacher.get(key)!.lessons.push(lesson);
  }

  const todayLabel = formatDateKyiv(new Date().toISOString());

  for (const entry of Array.from(byTeacher.values())) {
    let messageText = `📅 <b>Добрий ранок, ${entry.name}!</b>\n\n`;
    messageText += `Сьогодні (${todayLabel}) у вас ${entry.lessons.length} занятт${entry.lessons.length === 1 ? 'я' : entry.lessons.length < 5 ? 'я' : 'ь'}:\n\n`;

    for (let i = 0; i < entry.lessons.length; i++) {
      const lesson = entry.lessons[i];
      const effective = getEffectiveTeacher(lesson);
      const prefix = `${i + 1}️⃣`;
      const typeBadge = lesson.is_makeup
        ? ' 🔁 Відпрацювання'
        : lesson.is_trial
        ? ' 🎯 Пробне'
        : lesson.group_id
        ? ''
        : ' 👤 Індивідуальне';
      const replacementBadge = effective.isReplacement ? ' 🔄 Заміна' : '';

      messageText += `${prefix} <b>${lesson.start_time}${lesson.end_time ? ` – ${lesson.end_time}` : ''}</b>`;
      messageText += ` · ${lesson.course_title || 'Заняття'}`;
      if (lesson.group_title) {
        messageText += ` · ${lesson.group_title}`;
      }
      messageText += `${typeBadge}${replacementBadge}\n`;
    }

    messageText += `\nДеталі — у веб-додатку 👇`;

    const success = await sendMessage(entry.telegramId, messageText, {
      parseMode: 'HTML',
      replyMarkup: buildKeyboard(),
    });

    for (const lesson of entry.lessons) {
      const effective = getEffectiveTeacher(lesson);
      if (success) {
        result.sent++;
      } else {
        result.skipped++;
        result.errors.push(`Failed to send daily reminder for lesson ${lesson.id} to ${entry.name}`);
      }
      // Log attempt (even if failed to avoid infinite retries for today)
      await logReminderSent(
        lesson.id,
        effective.teacherId,
        'daily_summary',
        entry.telegramId,
        success
      );
    }
  }

  return result;
}

export async function getUpcomingLessonsForHourlyReminders(
  beforeMinutes: number = 60
): Promise<TeacherLesson[]> {
  const lower = Math.max(5, beforeMinutes - 5);
  const upper = beforeMinutes + 5;
  return all<TeacherLesson>(
    `SELECT
      l.id, l.group_id, l.lesson_date, l.start_datetime, l.end_datetime, l.status,
      l.is_makeup, l.is_trial,
      TO_CHAR(l.start_datetime AT TIME ZONE COALESCE(g.timezone, 'Europe/Kyiv'), 'HH24:MI') as start_time,
      TO_CHAR(l.end_datetime AT TIME ZONE COALESCE(g.timezone, 'Europe/Kyiv'), 'HH24:MI') as end_time,
      g.title as group_title, c.title as course_title,
      COALESCE(l.teacher_id, g.teacher_id) as teacher_id,
      COALESCE(t.name, gt.name) as teacher_name,
      COALESCE(t.telegram_id, gt.telegram_id) as teacher_telegram_id,
      ltr.replacement_teacher_id,
      ru.name as replacement_teacher_name,
      ru.telegram_id as replacement_teacher_telegram_id
    FROM lessons l
    LEFT JOIN groups g ON l.group_id = g.id
    LEFT JOIN courses c ON COALESCE(l.course_id, g.course_id) = c.id
    LEFT JOIN users t ON l.teacher_id = t.id
    LEFT JOIN users gt ON g.teacher_id = gt.id
    LEFT JOIN lesson_teacher_replacements ltr ON l.id = ltr.lesson_id
    LEFT JOIN users ru ON ltr.replacement_teacher_id = ru.id
    WHERE l.start_datetime BETWEEN (NOW() + interval '${lower} minutes') AND (NOW() + interval '${upper} minutes')
      AND l.status = 'scheduled'
    ORDER BY l.start_datetime ASC`
  );
}

export async function sendHourlyReminders(): Promise<ReminderResult> {
  const sysSettings = await getTeacherNotificationSettings();
  if (sysSettings.teacher_hourly_reminders_enabled === '0') {
    return { sent: 0, skipped: 0, errors: ['Hourly reminders disabled in settings'] };
  }

  const beforeMinutes = parseInt(sysSettings.teacher_hourly_reminders_before_minutes, 10) || 60;
  const lessons = await getUpcomingLessonsForHourlyReminders(beforeMinutes);
  const result: ReminderResult = { sent: 0, skipped: 0, errors: [] };

  for (const lesson of lessons) {
    const effective = getEffectiveTeacher(lesson);

    if (!effective.teacherTelegramId) {
      result.skipped++;
      result.errors.push(`No telegram_id for teacher ${effective.teacherName}`);
      continue;
    }

    if (await wasReminderSent(lesson.id, effective.teacherId, 'hourly')) {
      result.skipped++;
      continue;
    }

    const typeBadge = lesson.is_makeup
      ? '🔁 Відпрацювання'
      : lesson.is_trial
      ? '🎯 Пробне заняття'
      : lesson.group_id
      ? 'Групове заняття'
      : '👤 Індивідуальне заняття';

    const replacementBadge = effective.isReplacement ? ' (🔄 заміна)' : '';

    let messageText = `⏰ <b>Нагадування: заняття через годину</b>\n\n`;
    messageText += `<b>Час:</b> ${lesson.start_time}${lesson.end_time ? ` – ${lesson.end_time}` : ''}\n`;
    messageText += `<b>Курс:</b> ${lesson.course_title || '—'}\n`;
    if (lesson.group_title) {
      messageText += `<b>Група:</b> ${lesson.group_title}\n`;
    }
    messageText += `<b>Тип:</b> ${typeBadge}${replacementBadge}\n\n`;
    messageText += `Відкрийте веб-додаток для деталей 👇`;

    const success = await sendMessage(effective.teacherTelegramId, messageText, {
      parseMode: 'HTML',
      replyMarkup: buildKeyboard(),
    });

    await logReminderSent(
      lesson.id,
      effective.teacherId,
      'hourly',
      effective.teacherTelegramId,
      success
    );

    if (success) {
      result.sent++;
    } else {
      result.skipped++;
      result.errors.push(`Failed to send hourly reminder for lesson ${lesson.id}`);
    }
  }

  return result;
}

export async function notifyTeacherAboutNewLesson(
  lessonId: number,
  teacherId: number,
  lessonDate: string,
  startTime: string,
  groupTitle: string | null,
  courseTitle: string | null,
  isMakeup: boolean,
  isTrial: boolean
): Promise<boolean> {
  const sysSettings = await getTeacherNotificationSettings();
  if (sysSettings.teacher_new_lesson_notify_enabled === '0') {
    return false;
  }

  const teacher = await get<{ name: string; telegram_id: string | null }>(
    `SELECT name, telegram_id FROM users WHERE id = $1 AND role = 'teacher'`,
    [teacherId]
  );

  if (!teacher?.telegram_id) {
    return false;
  }

  const typeBadge = isMakeup
    ? '🔁 Відпрацювання'
    : isTrial
    ? '🎯 Пробне заняття'
    : groupTitle
    ? 'Групове заняття'
    : '👤 Індивідуальне заняття';

  let messageText = `🆕 <b>Нове заняття заплановано</b>\n\n`;
  messageText += `<b>Дата:</b> ${formatDateKyiv(lessonDate)}\n`;
  messageText += `<b>Час:</b> ${startTime}\n`;
  messageText += `<b>Тип:</b> ${typeBadge}\n`;
  if (courseTitle) {
    messageText += `<b>Курс:</b> ${courseTitle}\n`;
  }
  if (groupTitle) {
    messageText += `<b>Група:</b> ${groupTitle}\n`;
  }
  messageText += `\nДеталі — у веб-додатку 👇`;

  const success = await sendMessage(teacher.telegram_id, messageText, {
    parseMode: 'HTML',
    replyMarkup: buildKeyboard(),
  });

  await logReminderSent(
    lessonId,
    teacherId,
    'new_lesson',
    teacher.telegram_id,
    success
  );

  return success;
}
