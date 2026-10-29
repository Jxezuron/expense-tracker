import { table, integer, text } from 'sdk/db';

export const transaction = table('transaction', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull(),
  type: text('type').notNull(),
  amount: integer('amount').notNull(),
  currency: text('currency').notNull(),
  category: text('category').notNull(),
  note: text('note'),
  createdAt: integer('created_at').notNull(),
});

// Stores each user's chosen language ('en' or 'km').
export const userSetting = table('user_setting', {
  userId: integer('user_id').primaryKey(),
  language: text('language').notNull(),
});