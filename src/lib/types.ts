export type EntryType = 'bill' | 'income';

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
};

export type RolloverPreference = 'carryover' | 'reset';

export type MonthlyLeftovers = {
  [key: string]: number; // e.g. '2024-07': 250.75
};
