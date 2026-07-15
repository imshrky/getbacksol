import "server-only";

/**
 * Posts a message to the GetBackSOL Telegram channel as the bot identified
 * by TELEGRAM_BOT_TOKEN. Unlike X, the Telegram Bot API has no per-message
 * cost or paid tier — sendMessage is free regardless of volume.
 */
export async function postToTelegram(text: string): Promise<{ messageId: number }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    throw new Error("TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID are not configured.");
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
