/**
 * Telegram Bot API utilities
 * Uses native fetch to be compatible with Vercel serverless functions
 */

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

interface TelegramInlineKeyboardButton {
  text: string;
  url?: string;
  callback_data?: string;
}

interface TelegramInlineKeyboard {
  inline_keyboard: TelegramInlineKeyboardButton[][];
}

interface SendMessageOptions {
  parseMode?: 'HTML' | 'Markdown';
  replyMarkup?: TelegramInlineKeyboard;
}

/**
 * Send a message to a Telegram user
 * @param telegramId - The Telegram user ID
 * @param text - The message text to send
 * @returns true if successful, false if telegram_id not found or error
 */
export async function sendMessage(telegramId: string, text: string, options?: SendMessageOptions): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN) {
    console.error('TELEGRAM_BOT_TOKEN is not configured');
    return false;
  }

  if (!telegramId) {
    console.error('Telegram ID is required');
    return false;
  }

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: telegramId,
          text: text,
          parse_mode: options?.parseMode || 'HTML',
          reply_markup: options?.replyMarkup || null,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok || !data.ok) {
      if (data.description === 'Bad Request: chat not found') {
        console.log(`Telegram user not found: ${telegramId}`);
        return false;
      }
      console.error('Telegram API error:', data.description);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Failed to send Telegram message:', error);
    return false;
  }
}

/**
 * Answer a callback query from Telegram
 * @param callbackQueryId - The callback query ID
 * @param text - The text to show
 */
export async function answerCallbackQuery(callbackQueryId: string, text: string): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN) {
    console.error('TELEGRAM_BOT_TOKEN is not configured');
    return false;
  }

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          callback_query_id: callbackQueryId,
          text: text,
        }),
      }
    );

    const data = await response.json();
    return data.ok || false;
  } catch (error) {
    console.error('Failed to answer callback query:', error);
    return false;
  }
}
