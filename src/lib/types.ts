export type EntryType = 'bill' | 'income';

export const BillCategories = [
  "rent",
  "vehicles",
  "utilities",
  "groceries",
  "credit cards",
  "subscriptions",
  "loans",
  "necessities",
  "other",
] as const;

export type BillCategory = (typeof BillCategories)[number];

export type RecurrenceInterval =
  | 'none'
  | 'weekly'
  | 'monthly'
  | 'bimonthly'
  | '3months'
  | '6months'
  | '12months';

export type Entry = {
  id: string;
  date: string; // YYYY-MM-DD
  name: string;
  amount: number;
  type: EntryType;
  recurrence?: RecurrenceInterval;
  category?: BillCategory;
};

export type RolloverPreference = 'carryover' | 'reset';

export type MonthlyLeftovers = {
  [key: string]: number; // e.g. '2024-07': 250.75
};
