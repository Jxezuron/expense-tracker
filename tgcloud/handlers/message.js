import { api } from 'sdk';

import {
  buildReport,
  clearChat,
  languageKeyboard,
  languageText,
  menuKeyboard,
  menuText,
  parseEntryPrompt,
  saveTransaction,
  sendEntryPrompt,
} from '../lib/expense.js';
import { getLanguage, t } from '../lib/i18n.js';

export default async function (message) {
  const chatId = message.chat?.id;
  const userId = message.from?.id;
  const messageId = message.message_id;
  const text = message.text?.trim();

  if (!chatId || !userId || !text) return;

  // The user's saved language (falls back to their Telegram app language).
  let lang = await getLanguage(userId, message.from?.language_code);

  if (message.chat.type !== 'private') {
    if (text.startsWith('/')) {
      await api.sendMessage({
        chat_id: chatId,
        text: t(lang, 'private_only'),
      });
    }
    return;
  }

  const command = text
    .split(/\s+/)[0]
    .split('@')[0]
    .toLowerCase();

  // Send the new screen first (so the chat is never empty), then delete the
  // user's message and everything before it. The new screen has a higher
  // message ID, so it is never deleted.
  const reply = async (replyText, replyMarkup = menuKeyboard(lang)) => {
    await api.sendMessage({
      chat_id: chatId,
      text: replyText,
      reply_markup: replyMarkup,
    });
    await clearChat(chatId, messageId);
  };

  try {
    if (['/start', '/menu', '/help'].includes(command)) {
      await reply(menuText(lang));
      return;
    }

    if (command === '/language' || command === '/lang') {
      await reply(languageText(lang), languageKeyboard(lang));
      return;
    }

    if (['/today', '/week', '/month'].includes(command)) {
      const period = command.slice(1);
      await reply(await buildReport(userId, period, lang));
      return;
    }

    // The user replied to an "amount" prompt from the bot.
    const prompt = message.reply_to_message;

    if (prompt?.from?.is_bot) {
      const entry = parseEntryPrompt(prompt.text);

      if (entry) {
        // Keep the language the prompt was written in, so the reply matches it.
        lang = entry.lang;

        const result = await saveTransaction(
          userId,
          entry.type,
          entry.category,
          entry.currency,
          text,
          lang,
        );

        if (result.ok) {
          await reply(result.text);
        } else {
          // Ask again with the error shown; the old prompt and the user's
          // wrong message are removed by the cleanup.
          await sendEntryPrompt(chatId, entry, result.text, lang);
          await clearChat(chatId, messageId);
        }
        return;
      }
    }

    await reply(t(lang, 'unknown_command'));
  } catch (error) {
    console.error('Message handler error:', error);

    try {
      await api.sendMessage({
        chat_id: chatId,
        text: t(lang, 'error_message'),
        reply_markup: menuKeyboard(lang),
      });
    } catch (sendError) {
      console.error('Error message failed:', sendError);
    }
  }
}