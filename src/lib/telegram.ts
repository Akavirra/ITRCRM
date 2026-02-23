/**
 * Telegram Bot API utilities
 * Uses native fetch to be compatible with Vercel serverless functions
 */

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

/**
 * Send a message to a Telegram user
 * @param telegramId - The Telegram user ID
 * @param text - The message text to send
 * @returns true if successful, false if telegram_id not found or error
 */
export async function sendMessage(telegramId: string, text: string): Promise<boolean> {
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
          parse_mode: 'HTML',
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
