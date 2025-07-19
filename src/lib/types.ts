export type EntryType = 'bill' | 'income';

export type Entry = {
  id: string;
  date: string; // YYYY-MM-DD
  name: string;
  amount: number;
  type: EntryType;
};

export type RolloverPreference = 'carryover' | 'reset';

export type MonthlyLeftovers = {
  [key: string]: number; // e.g. '2024-07': 250.75
};
