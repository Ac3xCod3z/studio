
// src/lib/types.ts
import { z } from 'zod';

export type EntryType = 'bill' | 'income';

export const BillCategories = [
  "rent",
  "utilities",
  "phone bill",
  "vehicles",
  "loans",
  "credit cards",
  "groceries",
  "day care",
  "subscriptions",
  "recreations",
  "necessities",
  "vices",
  "personal maintenance",
  "other",
] as const;

export const CategoryEmojis: Record<BillCategory, string> = {
  rent: "🏠",
  utilities: "💡",
  "phone bill": "📱",
  vehicles: "🚗",
  loans: "💰",
  "credit cards": "💳",
  groceries: "🛒",
  "day care": "👶",
  subscriptions: "🔄",
  recreations: "🎭",
  necessities: "🛍️",
  vices: "🍸",
  "personal maintenance": "💇‍♀️",
  other: "📦",
};


export type BillCategory = (typeof BillCategories)[number];

export const RecurrenceOptions = [
  'none',
  'weekly',
  'bi-weekly',
  'monthly',
  'bimonthly',
  '3months',
  '6months',
  '12months'
] as const;

export type RecurrenceInterval = typeof RecurrenceOptions[number];
export type CategoryDisplayPreference = 'text' | 'emoji';

export const EntrySchema = z.object({
  id: z.string(),
  date: z.string(), // YYYY-MM-DD
  name: z.string(),
  amount: z.number(),
  type: z.enum(['bill', 'income']),
  recurrence: z.enum(RecurrenceOptions),
  category: z.enum(BillCategories).optional(),
  order: z.number().optional(),
  isPaid: z.boolean().optional(),
  isAutoPay: z.boolean().optional(),
  // For recurring entries, this can track exceptions like specific dates being paid or moved.
  exceptions: z.record(z.object({ 
    isPaid: z.boolean().optional(),
    movedTo: z.string().optional(), // YYYY-MM-DD
    order: z.number().optional(),
  })).optional(),
});

export type Entry = z.infer<typeof EntrySchema>;

export type SelectedInstance = {
  instanceId: string;
  masterId: string;
  date: string;
}

export type RolloverPreference = 'carryover' | 'reset';

export type MonthlyLeftovers = {
  [key: string]: number; // e.g., '2024-07': 250.75
};

export type WeeklyBalances = {
  // Key is the start date of the week 'YYYY-MM-DD'
  [key: string]: {
    start: number;
    end: number;
  }
}

export type BudgetScore = {
    score: number;
    date: string; // YYYY-MM-DD
    commentary: string;
}

export type Rank = {
    title: string;
    icon: React.ReactNode;
}
