import { api } from 'sdk';

import {
  CURRENCIES,
  TYPES,
  buildReport,
  categoriesForType,
  categoryKeyboard,
  clearChat,
  currencyKeyboard,
  formatTransaction,
  getTransaction,
  languageKeyboard,
  languageText,
  listRecentTransactions,
  menuKeyboard,
  menuText,
  removeTransaction,
  sendEntryPrompt,
  tagKeyboard,
} from '../lib/expense.js';
import {
  LANGUAGES,
  categoryLabel,
  getLanguage,
  setLanguage,
  t,
} from '../lib/i18n.js';

const PERIODS = ['today', 'week', 'month'];

function isNotModified(error) {
  return String(error?.message ?? error)
    .toLowerCase()
    .includes('not modified');
}

function truncate(text, max) {
  const chars = Array.from(text);
  return chars.length > max ? `${chars.slice(0, max - 1).join('')}…` : text;
}

export default async function (query) {
  const chatId = query.message?.chat?.id;
  const messageId = query.message?.message_id;
  const userId = query.from?.id;
  // Buttons look like "menu~km": the part after "~" is the language.
  const [data, taggedLang] = String(query.data ?? '').split('~');

  // Stop the loading spinner on the button. A failure here must not block the rest.
  try {
    await api.answerCallbackQuery({ callback_query_id: query.id });
  } catch (error) {
    console.error('Answer callback error:', error);
  }

  if (
    !chatId ||
    !messageId ||
    !userId ||
    query.message?.chat?.type !== 'private'
  ) {
    return;
  }

  // The user's saved language (falls back to their Telegram app language).
  // The language on the pressed button wins, then the saved setting.
  let lang = LANGUAGES.includes(taggedLang)
    ? taggedLang
    : await getLanguage(userId, query.from?.language_code);

  // Edit the button's message in place. Pressing a button that would show
  // identical content makes Telegram throw "message is not modified" - ignore it.
  const editScreen = async (text, replyMarkup) => {
    try {
      await api.editMessageText({
        chat_id: chatId,
        message_id: messageId,
        text,
        reply_markup: replyMarkup,
      });
    } catch (error) {
      if (!isNotModified(error)) throw error;
    }
  };

  // Show a new screen: wipe every older message in the chat and turn the
  // pressed message into the new screen, so the chat always stays clean.
  const showScreen = async (text, replyMarkup) => {
    await Promise.all([
      clearChat(chatId, messageId - 1),
      editScreen(text, replyMarkup),
    ]);
  };

  try {
    if (data === 'menu' || data === 'help') {
      await showScreen(menuText(lang), menuKeyboard(lang));
      return;
    }

    // Language picker
    if (data === 'lang:menu') {
      await showScreen(languageText(lang), languageKeyboard(lang));
      return;
    }

    // Switch language (works at any time, from any screen with the button)
    if (data.startsWith('lang:')) {
      const chosen = data.split(':')[1];

      if (!LANGUAGES.includes(chosen)) {
        return;
      }

      lang = chosen;

      try {
        await setLanguage(userId, chosen);
      } catch (error) {
        // Usually means the user_setting table has not been created yet.
        console.error('Save language error (is the schema deployed?):', error);
      }

      await showScreen(menuText(lang), menuKeyboard(lang));
      return;
    }

    // Income has a single category (Salary), so skip the category screen.
    if (data === 'new:income') {
      await showScreen(
        t(lang, 'category_choose_currency', {
          category: categoryLabel(lang, 'Salary'),
        }),
        currencyKeyboard('income', 'Salary', lang),
      );
      return;
    }

    if (data === 'new:expense') {
      await showScreen(
        t(lang, 'choose_category_expense'),
        categoryKeyboard('expense', lang),
      );
      return;
    }

    if (data.startsWith('cat:')) {
      const [, type, category] = data.split(':');

      if (!TYPES.includes(type) || !categoriesForType(type).includes(category)) {
        return;
      }

      await showScreen(
        t(lang, 'category_choose_currency', {
          category: categoryLabel(lang, category),
        }),
        currencyKeyboard(type, category, lang),
      );
      return;
    }

    if (data.startsWith('cur:')) {
      const [, type, category, currency] = data.split(':');

      if (
        !TYPES.includes(type) ||
        !categoriesForType(type).includes(category) ||
        !CURRENCIES.includes(currency)
      ) {
        return;
      }

      // A force-reply prompt must be a NEW message (it cannot be added by editing),
      // so send it first, then remove the old menu and everything before it.
      await sendEntryPrompt(chatId, { type, category, currency }, undefined, lang);
      await clearChat(chatId, messageId);
      return;
    }

    if (data.startsWith('report:')) {
      const period = data.split(':')[1];

      if (!PERIODS.includes(period)) {
        return;
      }

      const report = await buildReport(userId, period, lang);
      await showScreen(report, menuKeyboard(lang));
      return;
    }

    if (data === 'delete:list') {
      const items = await listRecentTransactions(userId);

      if (items.length === 0) {
        await showScreen(t(lang, 'delete_none'), menuKeyboard(lang));
        return;
      }

      await showScreen(t(lang, 'delete_choose'), tagKeyboard({
        inline_keyboard: [
          ...items.map((item) => [
            {
              text: truncate(formatTransaction(item, lang), 60),
              callback_data: `delete:confirm:${item.id}`,
            },
          ]),
          [
            { text: t(lang, 'btn_back_menu'), callback_data: 'menu' },
          ],
        ],
      }, lang));
      return;
    }

    if (data.startsWith('delete:confirm:')) {
      const transactionId = Number(data.split(':')[2]);

      if (!Number.isSafeInteger(transactionId) || transactionId <= 0) {
        return;
      }

      const item = await getTransaction(userId, transactionId);

      if (!item) {
        await showScreen(t(lang, 'delete_not_found'), menuKeyboard(lang));
        return;
      }

      await showScreen(
        [
          t(lang, 'delete_confirm_title'),
          '',
          formatTransaction(item, lang), // already includes the note
          '',
          t(lang, 'delete_confirm_body'),
        ].join('\n'),
        tagKeyboard({
          inline_keyboard: [
            [
              {
                text: t(lang, 'btn_yes_delete'),
                callback_data: `delete:execute:${transactionId}`,
              },
            ],
            [
              { text: t(lang, 'btn_cancel'), callback_data: 'delete:list' },
            ],
          ],
        }, lang),
      );
      return;
    }

    if (data.startsWith('delete:execute:')) {
      const transactionId = Number(data.split(':')[2]);

      if (!Number.isSafeInteger(transactionId) || transactionId <= 0) {
        return;
      }

      const deleted = await removeTransaction(userId, transactionId);

      await showScreen(
        deleted ? t(lang, 'delete_done') : t(lang, 'delete_not_found'),
        menuKeyboard(lang),
      );
      return;
    }
  } catch (error) {
    console.error('Button handler error:', error);

    try {
      await api.sendMessage({
        chat_id: chatId,
        text: t(lang, 'error_button'),
        reply_markup: menuKeyboard(lang),
      });
    } catch (sendError) {
      console.error('Error message failed:', sendError);
    }
  }
}