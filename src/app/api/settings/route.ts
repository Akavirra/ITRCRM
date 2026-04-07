import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized } from '@/lib/api-utils';
import { run, get } from '@/db';
import { clearServerCache, getOrSetServerCache } from '@/lib/server-cache';

export const dynamic = 'force-dynamic';

const ERROR_MESSAGES = {
  notAuthenticated: 'Необхідна авторизація',
  updateFailed: 'Не вдалося оновити налаштування',
};

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);

  if (!user) {
    return unauthorized();
  }

  try {
    const settings = await getOrSetServerCache(
      `settings:${user.id}`,
      60 * 1000,
      () => get(
        `SELECT
          u.name,
          u.email,
          up.phone,
          up.language,
          up.timezone,
          up.date_format,
          up.currency,
          up.email_notifications,
          up.push_notifications,
          up.lesson_reminders,
          up.payment_alerts,
          up.weekly_report,
          up.weather_city
        FROM users u
        LEFT JOIN user_settings up ON u.id = up.user_id
        WHERE u.id = $1`,
        [user.id]
      )
    );

    if (!settings) {
      return NextResponse.json({
        settings: {
          displayName: user.name,
          email: user.email,
          phone: '',
          language: 'uk',
          timezone: 'Europe/Kyiv',
          dateFormat: 'DD.MM.YYYY',
          currency: 'UAH',
          emailNotifications: true,
          pushNotifications: true,
          lessonReminders: true,
          paymentAlerts: true,
          weeklyReport: true,
          weatherCity: 'Kyiv',
        },
      });
    }

    const s = settings as any;
    return NextResponse.json({
      settings: {
        displayName: s.name || user.name,
        email: s.email || user.email,
        phone: s.phone || '',
        language: s.language || 'uk',
        timezone: s.timezone || 'Europe/Kyiv',
        dateFormat: s.date_format || 'DD.MM.YYYY',
        currency: s.currency || 'UAH',
        emailNotifications: Boolean(s.email_notifications),
        pushNotifications: Boolean(s.push_notifications),
        lessonReminders: Boolean(s.lesson_reminders),
        paymentAlerts: Boolean(s.payment_alerts),
        weeklyReport: Boolean(s.weekly_report),
        weatherCity: s.weather_city || 'Kyiv',
      },
    });
  } catch (error) {
    console.error('Get settings error:', error);
    return NextResponse.json(
      { error: ERROR_MESSAGES.updateFailed },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const user = await getAuthUser(request);

  if (!user) {
    return unauthorized();
  }

  try {
    const body = await request.json();
    const {
      displayName,
      phone,
      language,
      timezone,
      dateFormat,
      currency,
      emailNotifications,
      pushNotifications,
      lessonReminders,
      paymentAlerts,
      weeklyReport,
      weatherCity,
    } = body;

    if (displayName !== undefined) {
      await run(`UPDATE users SET name = $1 WHERE id = $2`, [displayName, user.id]);
    }

    const existingSettings = await get(`SELECT user_id FROM user_settings WHERE user_id = $1`, [user.id]);

    if (existingSettings) {
      await run(
        `UPDATE user_settings SET
          phone = $1,
          language = $2,
          timezone = $3,
          date_format = $4,
          currency = $5,
          email_notifications = $6,
          push_notifications = $7,
          lesson_reminders = $8,
          payment_alerts = $9,
          weekly_report = $10,
          weather_city = $11
        WHERE user_id = $12`,
        [
          phone || '',
          language || 'uk',
          timezone || 'Europe/Kyiv',
          dateFormat || 'DD.MM.YYYY',
          currency || 'UAH',
          emailNotifications ? 1 : 0,
          pushNotifications ? 1 : 0,
          lessonReminders ? 1 : 0,
          paymentAlerts ? 1 : 0,
          weeklyReport ? 1 : 0,
          weatherCity || 'Kyiv',
          user.id
        ]
      );
    } else {
      await run(
        `INSERT INTO user_settings (
          user_id,
          phone,
          language,
          timezone,
          date_format,
          currency,
          email_notifications,
          push_notifications,
          lesson_reminders,
          payment_alerts,
          weekly_report,
          weather_city
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          user.id,
          phone || '',
          language || 'uk',
          timezone || 'Europe/Kyiv',
          dateFormat || 'DD.MM.YYYY',
          currency || 'UAH',
          emailNotifications ? 1 : 0,
          pushNotifications ? 1 : 0,
          lessonReminders ? 1 : 0,
          paymentAlerts ? 1 : 0,
          weeklyReport ? 1 : 0,
          weatherCity || 'Kyiv',
        ]
      );
    }

    clearServerCache(`settings:${user.id}`);

    return NextResponse.json({
      message: 'Налаштування успішно збережено',
    });
  } catch (error) {
    console.error('Update settings error:', error);
    return NextResponse.json(
      { error: ERROR_MESSAGES.updateFailed },
      { status: 500 }
    );
  }
}
