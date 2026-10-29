import { db } from 'sdk';
import { eq } from 'sdk/db';
import { userSetting } from '../schema.js';

export const LANGUAGES = ['en', 'km'];
export const DEFAULT_LANGUAGE = 'en';

/* -------------------------------------------------------------------------- */
/*  Translations                                                              */
/*  Internal values (category / type / currency keys) always stay in English  */
/*  because they are stored in the database and in button callback data.      */
/*  Only what the user SEES is translated.                                    */
/* -------------------------------------------------------------------------- */

const STRINGS = {
  en: {
    // Menu
    menu_title: 'EXPENSE TRACKER',
    menu_subtitle: 'Manage your personal money here.',
    menu_choose: 'Choose an action below:',
    cmd_today: "/today - Today's report",
    cmd_week: "/week - This week's report",
    cmd_month: "/month - This month's report",
    cmd_menu: '/menu - Open the menu',
    cmd_language: '/language - Change language',

    // Buttons
    btn_add_expense: 'Add Expense',
    btn_add_income: 'Add Income',
    btn_today: 'Today',
    btn_week: 'This Week',
    btn_month: 'This Month',
    btn_delete: 'Delete Transaction',
    btn_help: 'Help',
    btn_language: '🌐 Language',
    btn_back_menu: 'Back to Menu',
    btn_cancel: 'Cancel',
    btn_yes_delete: 'Yes, delete',

    // Language picker
    choose_language: 'Choose your language:',
    lang_name_en: 'English',
    lang_name_km: 'ភាសាខ្មែរ',

    // Currencies
    cur_USD: 'USD',
    cur_KHR: 'KHR',

    // Types
    type_expense: 'Expense',
    type_income: 'Income',
    new_expense: 'New expense',
    new_income: 'New income',

    // Categories
    cat_Food: 'Food',
    cat_Transport: 'Transport',
    cat_Shopping: 'Shopping',
    cat_Bills: 'Bills',
    cat_Study: 'Study',
    cat_Entertainment: 'Entertainment',
    cat_Health: 'Health',
    cat_Other: 'Other',
    cat_Salary: 'Salary',

    // Flow
    choose_category_expense: 'Choose a category for your expense:',
    choose_category_income: 'Choose a category for your income:',
    category_choose_currency: 'Category: {category}\n\nChoose your currency:',
    prompt_reply: 'Reply to this message with the amount and optional note.',
    examples_usd: 'Examples: 2.50 Lunch with friends\nOr: 5 Coffee',
    examples_khr: 'Examples: 5000 Noodles\nOr: 10000 Transport',
    prompt_reply_income:
      'Reply to this message with your salary amount and optional note.',
    examples_income_usd: 'Examples: 500 October salary\nOr: 50 Overtime bonus',
    examples_income_khr:
      'Examples: 2000000 October salary\nOr: 200000 Overtime bonus',
    prompt_cancel: 'Type /menu if you want to cancel.',

    // Saving
    err_invalid_details:
      'Invalid transaction details. Please start again with /menu.',
    err_amount_usd: 'Invalid amount. Try: 2.50 Lunch with friends',
    err_amount_khr: 'Invalid amount. Try: 5000 Noodles',
    err_amount_income_usd: 'Invalid amount. Try: 500 October salary',
    err_amount_income_khr: 'Invalid amount. Try: 2000000 October salary',
    err_amount_zero: 'The amount must be greater than zero. Please try again.',
    err_khr_whole: 'KHR amounts must be whole numbers. Please try again.',
    err_amount_large:
      'That amount is too large or invalid. Please try again.',
    err_save_failed: 'Could not save this transaction. Please try again.',
    saved_title: 'Transaction saved',
    saved_category: 'Category: {category}',
    saved_note: 'Note: {note}',
    saved_amount: '{type}: {amount}',

    // Reports
    report_today: 'TODAY REPORT',
    report_week: 'WEEK REPORT',
    report_month: 'MONTH REPORT',
    report_invalid: 'Invalid report period.',
    report_failed: 'Could not load the report. Please try again.',
    report_empty: 'No transactions recorded for this period.',
    report_count: 'Transactions: {count}',
    report_income: 'Income: {amount}',
    report_expenses: 'Expenses: {amount}',
    report_balance: 'Balance: {amount}',
    report_recent: 'Recent transactions:',

    // Delete
    delete_none: 'You have no transactions to delete.',
    delete_choose: 'Choose the transaction you want to delete:',
    delete_not_found:
      'Transaction not found. It may have already been deleted.',
    delete_confirm_title: 'Confirm transaction deletion',
    delete_confirm_body:
      'This action cannot be undone. Delete this transaction?',
    delete_done: 'Transaction deleted successfully.',

    // Misc
    private_only: 'Please use this bot in a private chat.',
    unknown_command: 'Unknown command. Send /menu to see the buttons.',
    error_button: 'Something went wrong. Please send /menu and try again.',
    error_message: 'Something went wrong. Please try again using /menu.',
  },

  km: {
    // Menu
    menu_title: 'កម្មវិធីតាមដានចំណាយ',
    menu_subtitle: 'គ្រប់គ្រងលុយផ្ទាល់ខ្លួនរបស់អ្នកនៅទីនេះ។',
    menu_choose: 'សូមជ្រើសរើសសកម្មភាពខាងក្រោម៖',
    cmd_today: '/today - របាយការណ៍ថ្ងៃនេះ',
    cmd_week: '/week - របាយការណ៍សប្តាហ៍នេះ',
    cmd_month: '/month - របាយការណ៍ខែនេះ',
    cmd_menu: '/menu - បើកម៉ឺនុយ',
    cmd_language: '/language - ប្តូរភាសា',

    // Buttons
    btn_add_expense: 'បន្ថែមចំណាយ',
    btn_add_income: 'បន្ថែមចំណូល',
    btn_today: 'ថ្ងៃនេះ',
    btn_week: 'សប្តាហ៍នេះ',
    btn_month: 'ខែនេះ',
    btn_delete: 'លុបប្រតិបត្តិការ',
    btn_help: 'ជំនួយ',
    btn_language: '🌐 ភាសា',
    btn_back_menu: 'ត្រឡប់ទៅម៉ឺនុយ',
    btn_cancel: 'បោះបង់',
    btn_yes_delete: 'បាទ/ចាស លុប',

    // Language picker
    choose_language: 'សូមជ្រើសរើសភាសារបស់អ្នក៖',
    lang_name_en: 'English',
    lang_name_km: 'ភាសាខ្មែរ',

    // Currencies
    cur_USD: 'ដុល្លារ (USD)',
    cur_KHR: 'រៀល (KHR)',

    // Types
    type_expense: 'ចំណាយ',
    type_income: 'ចំណូល',
    new_expense: 'ចំណាយថ្មី',
    new_income: 'ចំណូលថ្មី',

    // Categories
    cat_Food: 'អាហារ',
    cat_Transport: 'ការធ្វើដំណើរ',
    cat_Shopping: 'ទិញឥវ៉ាន់',
    cat_Bills: 'វិក្កយបត្រ',
    cat_Study: 'ការសិក្សា',
    cat_Entertainment: 'ការកម្សាន្ត',
    cat_Health: 'សុខភាព',
    cat_Other: 'ផ្សេងៗ',
    cat_Salary: 'ប្រាក់ខែ',

    // Flow
    choose_category_expense: 'សូមជ្រើសរើសប្រភេទសម្រាប់ចំណាយរបស់អ្នក៖',
    choose_category_income: 'សូមជ្រើសរើសប្រភេទសម្រាប់ចំណូលរបស់អ្នក៖',
    category_choose_currency:
      'ប្រភេទ៖ {category}\n\nសូមជ្រើសរើសរូបិយប័ណ្ណ៖',
    prompt_reply:
      'សូមឆ្លើយតបសារនេះជាមួយចំនួនទឹកប្រាក់ និងកំណត់ចំណាំ (ជាជម្រើស)។',
    examples_usd: 'ឧទាហរណ៍៖ 2.50 អាហារថ្ងៃត្រង់\nឬ៖ 5 កាហ្វេ',
    examples_khr: 'ឧទាហរណ៍៖ 5000 មី\nឬ៖ 10000 ធ្វើដំណើរ',
    prompt_reply_income:
      'សូមឆ្លើយតបសារនេះជាមួយចំនួនប្រាក់ខែរបស់អ្នក និងកំណត់ចំណាំ (ជាជម្រើស)។',
    examples_income_usd: 'ឧទាហរណ៍៖ 500 ប្រាក់ខែខែតុលា\nឬ៖ 50 ប្រាក់រង្វាន់ថែមម៉ោង',
    examples_income_khr:
      'ឧទាហរណ៍៖ 2000000 ប្រាក់ខែខែតុលា\nឬ៖ 200000 ប្រាក់រង្វាន់ថែមម៉ោង',
    prompt_cancel: 'វាយ /menu ប្រសិនបើអ្នកចង់បោះបង់។',

    // Saving
    err_invalid_details:
      'ព័ត៌មានប្រតិបត្តិការមិនត្រឹមត្រូវ។ សូមចាប់ផ្តើមម្តងទៀតដោយប្រើ /menu។',
    err_amount_usd: 'ចំនួនទឹកប្រាក់មិនត្រឹមត្រូវ។ សូមសាកល្បង៖ 2.50 អាហារថ្ងៃត្រង់',
    err_amount_khr: 'ចំនួនទឹកប្រាក់មិនត្រឹមត្រូវ។ សូមសាកល្បង៖ 5000 មី',
    err_amount_income_usd:
      'ចំនួនទឹកប្រាក់មិនត្រឹមត្រូវ។ សូមសាកល្បង៖ 500 ប្រាក់ខែខែតុលា',
    err_amount_income_khr:
      'ចំនួនទឹកប្រាក់មិនត្រឹមត្រូវ។ សូមសាកល្បង៖ 2000000 ប្រាក់ខែខែតុលា',
    err_amount_zero: 'ចំនួនទឹកប្រាក់ត្រូវតែធំជាងសូន្យ។ សូមព្យាយាមម្តងទៀត។',
    err_khr_whole:
      'ចំនួនទឹកប្រាក់រៀលត្រូវតែជាចំនួនគត់។ សូមព្យាយាមម្តងទៀត។',
    err_amount_large:
      'ចំនួនទឹកប្រាក់ធំពេក ឬមិនត្រឹមត្រូវ។ សូមព្យាយាមម្តងទៀត។',
    err_save_failed:
      'មិនអាចរក្សាទុកប្រតិបត្តិការនេះបានទេ។ សូមព្យាយាមម្តងទៀត។',
    saved_title: 'បានរក្សាទុកប្រតិបត្តិការ',
    saved_category: 'ប្រភេទ៖ {category}',
    saved_note: 'កំណត់ចំណាំ៖ {note}',
    saved_amount: '{type}៖ {amount}',

    // Reports
    report_today: 'របាយការណ៍ថ្ងៃនេះ',
    report_week: 'របាយការណ៍សប្តាហ៍នេះ',
    report_month: 'របាយការណ៍ខែនេះ',
    report_invalid: 'រយៈពេលរបាយការណ៍មិនត្រឹមត្រូវ។',
    report_failed: 'មិនអាចផ្ទុករបាយការណ៍បានទេ។ សូមព្យាយាមម្តងទៀត។',
    report_empty: 'មិនមានប្រតិបត្តិការត្រូវបានកត់ត្រាក្នុងអំឡុងពេលនេះទេ។',
    report_count: 'ចំនួនប្រតិបត្តិការ៖ {count}',
    report_income: 'ចំណូល៖ {amount}',
    report_expenses: 'ចំណាយ៖ {amount}',
    report_balance: 'សមតុល្យ៖ {amount}',
    report_recent: 'ប្រតិបត្តិការថ្មីៗ៖',

    // Delete
    delete_none: 'អ្នកមិនមានប្រតិបត្តិការដើម្បីលុបទេ។',
    delete_choose: 'សូមជ្រើសរើសប្រតិបត្តិការដែលអ្នកចង់លុប៖',
    delete_not_found:
      'រកមិនឃើញប្រតិបត្តិការទេ។ វាប្រហែលជាត្រូវបានលុបរួចហើយ។',
    delete_confirm_title: 'បញ្ជាក់ការលុបប្រតិបត្តិការ',
    delete_confirm_body:
      'សកម្មភាពនេះមិនអាចត្រឡប់វិញបានទេ។ លុបប្រតិបត្តិការនេះមែនទេ?',
    delete_done: 'បានលុបប្រតិបត្តិការដោយជោគជ័យ។',

    // Misc
    private_only: 'សូមប្រើបូតនេះក្នុងការជជែកឯកជន។',
    unknown_command: 'ពាក្យបញ្ជាមិនស្គាល់។ សូមផ្ញើ /menu ដើម្បីមើលប៊ូតុង។',
    error_button: 'មានបញ្ហាអ្វីមួយ។ សូមផ្ញើ /menu ហើយព្យាយាមម្តងទៀត។',
    error_message: 'មានបញ្ហាអ្វីមួយ។ សូមព្យាយាមម្តងទៀតដោយប្រើ /menu។',
  },
};

/**
 * Translate a key. Falls back to English, then to the key itself.
 * Placeholders look like {name} and are filled from `params`.
 */
export function t(lang, key, params = {}) {
  const template = STRINGS[lang]?.[key] ?? STRINGS.en[key] ?? key;

  return template.replace(/\{(\w+)\}/g, (match, name) =>
    params[name] !== undefined ? String(params[name]) : match,
  );
}

export function categoryLabel(lang, category) {
  return t(lang, `cat_${category}`);
}

export function currencyLabel(lang, currency) {
  return t(lang, `cur_${currency}`);
}

export function typeLabel(lang, type) {
  return t(lang, `type_${type}`);
}

/* -------------------------------------------------------------------------- */
/*  Per-user language storage                                                 */
/* -------------------------------------------------------------------------- */

// Used for people who have never picked a language: follow their Telegram app.
export function detectLanguage(languageCode) {
  return String(languageCode ?? '').toLowerCase().startsWith('km')
    ? 'km'
    : DEFAULT_LANGUAGE;
}

/** Never throws. Returns 'en' or 'km'. */
export async function getLanguage(userId, languageCode) {
  try {
    const rows = await db
      .select()
      .from(userSetting)
      .where(eq(userSetting.userId, Number(userId)))
      .all();

    const saved = rows[0]?.language;

    if (LANGUAGES.includes(saved)) return saved;
  } catch (error) {
    console.error('Get language error:', error);
  }

  return detectLanguage(languageCode);
}

export async function setLanguage(userId, language) {
  if (!LANGUAGES.includes(language)) return false;

  const id = Number(userId);

  // Delete + insert works as a simple "upsert".
  await db.delete(userSetting).where(eq(userSetting.userId, id)).run();
  await db.insert(userSetting).values({ userId: id, language }).run();

  return true;
}