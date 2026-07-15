import "server-only";

export type InlineKeyboardButton = { text: string; url?: string; callback_data?: string };
export type InlineKeyboard = InlineKeyboardButton[][];

function botApiUrl(method: string): string {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not configured.");
  return `https://api.telegram.org/bot${token}/${method}`;
}

async function callTelegram(method: string, body: Record<string, unknown>) {
  const res = await fetch(botApiUrl(method), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`Telegram API error (${res.status}): ${errBody}`);
  }
  return res.json();
}

/**
 * Sends a message to an arbitrary Telegram chat as the bot identified by
 * TELEGRAM_BOT_TOKEN. Unlike X, the Telegram Bot API has no per-message
 * cost or paid tier — sendMessage is free regardless of volume. Pass
 * `inlineKeyboard` to attach tappable buttons (url or callback_data).
 */
export async function sendTelegramMessage(
  chatId: string | number,
  text: string,
  inlineKeyboard?: InlineKeyboard
): Promise<{ messageId: number }> {
  const json = await callTelegram("sendMessage", {
    chat_id: chatId,
    text,
    disable_web_page_preview: false,
    ...(inlineKeyboard ? { reply_markup: { inline_keyboard: inlineKeyboard } } : {}),
  });
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

/**
 * Must be called after every callback_query update (inline keyboard button
 * tap) — otherwise the tapped button shows a loading spinner until Telegram
 * times it out client-side. `text` (optional) shows as a small toast.
 */
export async function answerCallbackQuery(callbackQueryId: string, text?: string): Promise<void> {
  await callTelegram("answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    ...(text ? { text } : {}),
  });
}
