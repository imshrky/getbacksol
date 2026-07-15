import "server-only";

/**
 * Sends a message to an arbitrary Telegram chat as the bot identified by
 * TELEGRAM_BOT_TOKEN. Unlike X, the Telegram Bot API has no per-message
 * cost or paid tier — sendMessage is free regardless of volume.
 */
export async function sendTelegramMessage(
  chatId: string | number,
  text: string
): Promise<{ messageId: number }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN is not configured.");
  }

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: false,
    }),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`Telegram API error (${res.status}): ${errBody}`);
  }

  const json = await res.json();
  return { messageId: json?.result?.message_id };
}

/** Posts to the GetBackSOL channel specifically (see /api/cron/telegram-post). */
export async function postToTelegram(text: string): Promise<{ messageId: number }> {
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!chatId) {
    throw new Error("TELEGRAM_CHAT_ID is not configured.");
  }
  return sendTelegramMessage(chatId, text);
}
