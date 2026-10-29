import { api, db } from 'sdk';
import { and, eq, gte, lt } from 'sdk/db';
import { transaction } from '../schema.js';
import {
  LANGUAGES,
  DEFAULT_LANGUAGE,
  t,
  categoryLabel,
  currencyLabel,
  typeLabel,
} from './i18n.js';

// Categories offered when adding an expense.
export const EXPENSE_CATEGORIES = [
  'Food',
  'Transport',
  'Shopping',
  'Bills',
  'Study',
  'Entertainment',
  'Health',
  'Other',
];

// Income only has one category.
export const INCOME_CATEGORIES = ['Salary'];

// Every category that can exist (old income records may still use the
// expense ones, so they stay valid for reports and labels).
export const CATEGORIES = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES];

export const categoriesForType = (type) =>
  type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

export const CURRENCIES = ['USD', 'KHR'];
export const TYPES = ['expense', 'income'];

// Keeps reports under Telegram's 4096-character message limit.
const MAX_NOTE_LENGTH = 100;

// How many message IDs (counting back from the newest) are swept on cleanup.
const CLEANUP_WINDOW = 200;

const KHMER_DIGITS = '០១២៣៤៥៦៧៨៩';

/* -------------------------------------------------------------------------- */
/*  Chat cleanup                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Deletes every message in the chat with an ID <= lastMessageId
 * (looking back CLEANUP_WINDOW IDs). Bots cannot read chat history, but
 * message IDs in a private chat are sequential, so we simply try to delete
 * the whole range. IDs that do not exist or are too old (> 48h) are skipped.
 *
 * This function never throws: cleanup is best-effort.
 */
export async function clearChat(chatId, lastMessageId) {
  const last = Number(lastMessageId);

  if (!chatId || !Number.isSafeInteger(last) || last <= 0) return;

  const ids = [];
  for (let id = last; id > 0 && ids.length < CLEANUP_WINDOW; id--) {
    ids.push(id);
  }

  const batches = [];
  for (let i = 0; i < ids.length; i += 100) {
    batches.push(ids.slice(i, i + 100));
  }

  await Promise.all(
    batches.map(async (batch) => {
      try {
        await api.deleteMessages({ chat_id: chatId, message_ids: batch });
      } catch (error) {
        // Fallback if bulk delete is unavailable: delete the newest ones one by one.
        await Promise.allSettled(
          batch.slice(0, 30).map((id) =>
            api.deleteMessage({ chat_id: chatId, message_id: id }),
          ),
        );
      }
    }),
  );
}

/* -------------------------------------------------------------------------- */
/*  Menus and keyboards                                                       */
/* -------------------------------------------------------------------------- */

export function menuText(lang = DEFAULT_LANGUAGE) {
  return [
    t(lang, 'menu_title'),
    '',
    t(lang, 'menu_subtitle'),
    '',
    t(lang, 'menu_choose'),
    '',
    t(lang, 'cmd_today'),
    t(lang, 'cmd_week'),
    t(lang, 'cmd_month'),
    t(lang, 'cmd_menu'),
    t(lang, 'cmd_language'),
  ].join('\n');
}

/**
 * Adds the language to every button (e.g. "menu~km"). The handler reads it back,
 * so the chosen language sticks on every press even if the saved setting
 * cannot be read. The "~xx" part is stripped before the button is processed.
 */
export function tagKeyboard(markup, lang) {
  return {
    ...markup,
    inline_keyboard: markup.inline_keyboard.map((row) =>
      row.map((button) =>
        button.callback_data
          ? { ...button, callback_data: `${button.callback_data}~${lang}` }
          : button,
      ),
    ),
  };
}

export const menuKeyboard = (lang = DEFAULT_LANGUAGE) =>
  tagKeyboard(buildMenuKeyboard(lang), lang);

function buildMenuKeyboard(lang = DEFAULT_LANGUAGE) {
  return {
    inline_keyboard: [
      [
        { text: t(lang, 'btn_add_expense'), callback_data: 'new:expense' },
        { text: t(lang, 'btn_add_income'), callback_data: 'new:income' },
      ],
      [
        { text: t(lang, 'btn_today'), callback_data: 'report:today' },
        { text: t(lang, 'btn_week'), callback_data: 'report:week' },
        { text: t(lang, 'btn_month'), callback_data: 'report:month' },
      ],
      [
        { text: t(lang, 'btn_delete'), callback_data: 'delete:list' },
      ],
      [
        { text: t(lang, 'btn_help'), callback_data: 'help' },
        { text: t(lang, 'btn_language'), callback_data: 'lang:menu' },
      ],
    ],
  };
}

export function languageText(lang = DEFAULT_LANGUAGE) {
  return t(lang, 'choose_language');
}

export const languageKeyboard = (lang = DEFAULT_LANGUAGE) =>
  tagKeyboard(buildLanguageKeyboard(lang), lang);

function buildLanguageKeyboard(lang = DEFAULT_LANGUAGE) {
  return {
    inline_keyboard: [
      LANGUAGES.map((code) => ({
        text: `${code === lang ? '✅ ' : ''}${t(code, `lang_name_${code}`)}`,
        callback_data: `lang:${code}`,
      })),
      [
        { text: t(lang, 'btn_back_menu'), callback_data: 'menu' },
      ],
    ],
  };
}

export const categoryKeyboard = (type, lang = DEFAULT_LANGUAGE) =>
  tagKeyboard(buildCategoryKeyboard(type, lang), lang);

function buildCategoryKeyboard(type, lang = DEFAULT_LANGUAGE) {
  const rows = [];
  const categories = categoriesForType(type);

  for (let i = 0; i < categories.length; i += 2) {
    rows.push(
      categories.slice(i, i + 2).map((category) => ({
        text: categoryLabel(lang, category),
        callback_data: `cat:${type}:${category}`,
      })),
    );
  }

  rows.push([
    { text: t(lang, 'btn_cancel'), callback_data: 'menu' },
  ]);

  return { inline_keyboard: rows };
}

export const currencyKeyboard = (type, category, lang = DEFAULT_LANGUAGE) =>
  tagKeyboard(buildCurrencyKeyboard(type, category, lang), lang);

function buildCurrencyKeyboard(type, category, lang = DEFAULT_LANGUAGE) {
  return {
    inline_keyboard: [
      CURRENCIES.map((currency) => ({
        text: currencyLabel(lang, currency),
        callback_data: `cur:${type}:${category}:${currency}`,
      })),
      [
        { text: t(lang, 'btn_back_menu'), callback_data: 'menu' },
      ],
    ],
  };
}

/* -------------------------------------------------------------------------- */
/*  Amount prompt (the "reply with the amount" message)                       */
/* -------------------------------------------------------------------------- */

// The first line of the prompt is parsed later by parseEntryPrompt.
// It is translated, so the parser accepts the first line in EVERY language
// (a user may switch language and then reply to an older prompt).
function entryFirstLine(lang, { type, category, currency }) {
  return `${t(lang, `new_${type}`)}: ${categoryLabel(lang, category)} (${currency})`;
}

export function entryPromptText(
  { type, category, currency },
  errorText,
  lang = DEFAULT_LANGUAGE,
) {
  const isIncome = type === 'income';
  const examples = t(
    lang,
    `${isIncome ? 'examples_income' : 'examples'}_${currency.toLowerCase()}`,
  );

  return [
    entryFirstLine(lang, { type, category, currency }),
    '',
    errorText || null,
    errorText ? '' : null,
    t(lang, isIncome ? 'prompt_reply_income' : 'prompt_reply'),
    '',
    examples,
    '',
    t(lang, 'prompt_cancel'),
  ].filter((line) => line !== null).join('\n');
}

export async function sendEntryPrompt(
  chatId,
  entry,
  errorText,
  lang = DEFAULT_LANGUAGE,
) {
  await api.sendMessage({
    chat_id: chatId,
    text: entryPromptText(entry, errorText, lang),
    reply_markup: {
      force_reply: true,
      selective: true,
    },
  });
}

export function parseEntryPrompt(promptText = '') {
  // The prompt is a multi-line message; only the first line holds the details.
  const firstLine = String(promptText).split('\n')[0].trim();

  for (const lang of LANGUAGES) {
    for (const type of TYPES) {
      for (const category of CATEGORIES) {
        for (const currency of CURRENCIES) {
          if (
            firstLine === entryFirstLine(lang, { type, category, currency })
          ) {
            return { type, category, currency, lang };
          }
        }
      }
    }
  }

  return null;
}

/* -------------------------------------------------------------------------- */
/*  Formatting                                                                */
/* -------------------------------------------------------------------------- */

export function formatAmount(amount, currency, lang = DEFAULT_LANGUAGE) {
  if (currency === 'USD') {
    return `$${(amount / 100).toFixed(2)}`;
  }

  const number = amount.toLocaleString('en-US');

  return lang === 'km' ? `${number} ៛` : `${number} KHR`;
}

export function formatTransaction(item, lang = DEFAULT_LANGUAGE) {
  const sign = item.type === 'expense' ? '-' : '+';
  const date = new Date(item.createdAt * 1000).toLocaleString('en-GB', {
    timeZone: 'Asia/Phnom_Penh',
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  });

  const note = item.note ? ` | ${item.note}` : '';

  return `${sign}${formatAmount(item.amount, item.currency, lang)} | ${categoryLabel(lang, item.category)}${note} | ${date}`;
}

/* -------------------------------------------------------------------------- */
/*  Saving                                                                    */
/* -------------------------------------------------------------------------- */

function normalizeDigits(text) {
  // Accept Khmer numerals (e.g. ៥០០០) as well as 0-9.
  return text.replace(/[០-៩]/g, (digit) => String(KHMER_DIGITS.indexOf(digit)));
}

/**
 * Returns { ok: boolean, text: string }.
 * ok === false means nothing was saved and `text` explains why.
 */
export async function saveTransaction(
  userId,
  type,
  category,
  currency,
  input,
  lang = DEFAULT_LANGUAGE,
) {
  if (
    !Number.isSafeInteger(Number(userId)) ||
    !TYPES.includes(type) ||
    !CATEGORIES.includes(category) ||
    !CURRENCIES.includes(currency)
  ) {
    return {
      ok: false,
      text: t(lang, 'err_invalid_details'),
    };
  }

  const raw = normalizeDigits(String(input ?? '').trim());

  // Optional "$" prefix, thousands separators allowed (5,000), 2 decimals max.
  const match = raw.match(/^\$?(\d[\d,]*(?:\.\d{1,2})?)(?:\s+([\s\S]*))?$/);

  if (!match) {
    return {
      ok: false,
      text: t(
        lang,
        `${type === 'income' ? 'err_amount_income' : 'err_amount'}_${currency.toLowerCase()}`,
      ),
    };
  }

  const numericAmount = Number(match[1].replace(/,/g, ''));
  const note = Array.from((match[2] || '').trim())
    .slice(0, MAX_NOTE_LENGTH)
    .join('');

  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    return {
      ok: false,
      text: t(lang, 'err_amount_zero'),
    };
  }

  if (currency === 'KHR' && !Number.isInteger(numericAmount)) {
    return {
      ok: false,
      text: t(lang, 'err_khr_whole'),
    };
  }

  const amount = currency === 'USD'
    ? Math.round(numericAmount * 100)
    : numericAmount;

  if (!Number.isSafeInteger(amount) || amount <= 0) {
    return {
      ok: false,
      text: t(lang, 'err_amount_large'),
    };
  }

  try {
    await db.insert(transaction).values({
      userId: Number(userId),
      type,
      amount,
      currency,
      category,
      note: note || null,
      createdAt: Math.floor(Date.now() / 1000),
    }).run();
  } catch (error) {
    console.error('Save transaction error:', error);
    return {
      ok: false,
      text: t(lang, 'err_save_failed'),
    };
  }

  return {
    ok: true,
    text: [
      t(lang, 'saved_title'),
      '',
      t(lang, 'saved_amount', {
        type: typeLabel(lang, type),
        amount: formatAmount(amount, currency, lang),
      }),
      t(lang, 'saved_category', { category: categoryLabel(lang, category) }),
      note ? t(lang, 'saved_note', { note }) : null,
    ].filter((line) => line !== null).join('\n'),
  };
}

/* -------------------------------------------------------------------------- */
/*  Reports                                                                   */
/* -------------------------------------------------------------------------- */

function getPeriodRange(period) {
  const now = new Date();

  // Use Cambodia time (UTC+7) for report boundaries.
  const offsetMs = 7 * 60 * 60 * 1000;
  const localNow = new Date(now.getTime() + offsetMs);

  const year = localNow.getUTCFullYear();
  const month = localNow.getUTCMonth();
  const day = localNow.getUTCDate();

  let startDate;
  let endDate;

  if (period === 'today') {
    startDate = new Date(Date.UTC(year, month, day));
    endDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000);
  } else if (period === 'week') {
    const weekday = localNow.getUTCDay();
    const daysSinceMonday = (weekday + 6) % 7;

    startDate = new Date(Date.UTC(year, month, day - daysSinceMonday));
    endDate = new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000);
  } else {
    startDate = new Date(Date.UTC(year, month, 1));
    endDate = new Date(Date.UTC(year, month + 1, 1));
  }

  return {
    start: Math.floor((startDate.getTime() - offsetMs) / 1000),
    end: Math.floor((endDate.getTime() - offsetMs) / 1000),
  };
}

export async function buildReport(
  userId,
  period = 'today',
  lang = DEFAULT_LANGUAGE,
) {
  const validPeriods = ['today', 'week', 'month'];

  if (!validPeriods.includes(period)) {
    return t(lang, 'report_invalid');
  }

  const { start, end } = getPeriodRange(period);
  const title = t(lang, `report_${period}`);

  try {
    const rows = await db
      .select()
      .from(transaction)
      .where(
        and(
          eq(transaction.userId, Number(userId)),
          gte(transaction.createdAt, start),
          lt(transaction.createdAt, end),
        ),
      )
      .all();

    if (rows.length === 0) {
      return [
        title,
        '',
        t(lang, 'report_empty'),
      ].join('\n');
    }

    const totals = {
      USD: { income: 0, expense: 0 },
      KHR: { income: 0, expense: 0 },
    };

    for (const item of rows) {
      if (
        CURRENCIES.includes(item.currency) &&
        TYPES.includes(item.type)
      ) {
        totals[item.currency][item.type] += item.amount;
      }
    }

    const fmt = (amount, currency) => formatAmount(amount, currency, lang);

    const lines = [
      title,
      '',
      t(lang, 'report_count', { count: rows.length }),
      '',
      currencyLabel(lang, 'USD'),
      t(lang, 'report_income', { amount: fmt(totals.USD.income, 'USD') }),
      t(lang, 'report_expenses', { amount: fmt(totals.USD.expense, 'USD') }),
      t(lang, 'report_balance', {
        amount: fmt(totals.USD.income - totals.USD.expense, 'USD'),
      }),
      '',
      currencyLabel(lang, 'KHR'),
      t(lang, 'report_income', { amount: fmt(totals.KHR.income, 'KHR') }),
      t(lang, 'report_expenses', { amount: fmt(totals.KHR.expense, 'KHR') }),
      t(lang, 'report_balance', {
        amount: fmt(totals.KHR.income - totals.KHR.expense, 'KHR'),
      }),
      '',
      t(lang, 'report_recent'),
    ];

    const recent = [...rows]
      .sort((a, b) => b.createdAt - a.createdAt || b.id - a.id)
      .slice(0, 10);

    for (const item of recent) {
      const sign = item.type === 'expense' ? '-' : '+';
      const date = new Date(item.createdAt * 1000)
        .toLocaleString('en-GB', {
          timeZone: 'Asia/Phnom_Penh',
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hourCycle: 'h23', // hour12:false can print "24:05" instead of "00:05"
        });

      lines.push(
        `${sign}${fmt(item.amount, item.currency)} | ${categoryLabel(lang, item.category)} | ${date}`,
      );

      if (item.note) {
        lines.push(`  ${item.note}`);
      }
    }

    return lines.join('\n');
  } catch (error) {
    console.error('Build report error:', error);
    return t(lang, 'report_failed');
  }
}

/* -------------------------------------------------------------------------- */
/*  Listing and deleting                                                      */
/* -------------------------------------------------------------------------- */

export async function listRecentTransactions(userId) {
  const rows = await db
    .select()
    .from(transaction)
    .where(eq(transaction.userId, Number(userId)))
    .all();

  return [...rows]
    .sort((a, b) => b.createdAt - a.createdAt || b.id - a.id)
    .slice(0, 10);
}

export async function getTransaction(userId, transactionId) {
  const ownerId = Number(userId);
  const id = Number(transactionId);

  if (
    !Number.isSafeInteger(ownerId) ||
    !Number.isSafeInteger(id) ||
    ownerId <= 0 ||
    id <= 0
  ) {
    return null;
  }

  const rows = await db
    .select()
    .from(transaction)
    .where(
      and(
        eq(transaction.id, id),
        eq(transaction.userId, ownerId),
      ),
    )
    .all();

  return rows[0] ?? null;
}

export async function removeTransaction(userId, transactionId) {
  const existing = await getTransaction(userId, transactionId);

  if (!existing) {
    return false;
  }

  await db
    .delete(transaction)
    .where(
      and(
        eq(transaction.id, existing.id),
        eq(transaction.userId, existing.userId),
      ),
    )
    .run();

  return true;
}