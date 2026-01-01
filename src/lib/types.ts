export interface InstanceOverride {
  originalDate: string; // The date this instance would normally occur (YYYY-MM-DD)
  newDate?: string; // Move to this date (YYYY-MM-DD), "SKIPPED" = skipped
  newAmount?: number; // Override amount for this instance
  note?: string;
  // Split this instance into two payments
  split?: {
    firstAmount: number;
    secondAmount: number;
    secondDate: string; // Date for second payment (YYYY-MM-DD)
  };
}

// Helper to check if an override means skipped
export const isSkippedOverride = (override: InstanceOverride): boolean => 
  override.newDate === 'SKIPPED' || !override.newDate;

// Split payment configuration for expenses with 'split' frequency
export interface SplitConfig {
  firstDay: number; // Day of month for first payment (1-28)
  firstAmount: number;
  secondDay: number; // Day of month for second payment (1-28)
  secondAmount: number;
}

export interface Income {
  id: string;
  name: string;
  amount: number;
  frequency: 'once' | 'weekly' | 'biweekly' | 'semimonthly' | 'monthly';
  startDate?: string;
  date?: string;
  overrides?: InstanceOverride[];
}

export interface CreditCard {
  totalDebt: number; // Original total debt (for reference)
  currentBalance: number; // Balance as of balanceAsOfDate
  balanceAsOfDate: string; // YYYY-MM-DD - date the currentBalance was recorded
  apr: number;
  minimumPayment: number;
}

export interface PaymentPlan {
  totalDebt: number;
  paymentCount: number;
  frequency: 'weekly' | 'biweekly' | 'monthly' | 'bimonthly' | 'semimonthly';
  secondDay?: number; // For semimonthly: the second day of the month (first day comes from startDate)
}

export interface Expense {
  id: string;
  name: string;
  amount: number; // Total amount (for split: firstAmount + secondAmount)
  frequency: 'once' | 'weekly' | 'biweekly' | 'semimonthly' | 'monthly' | 'bimonthly' | 'quarterly' | 'payment_plan' | 'split';
  startDate?: string;
  date?: string;
  category: string;
  creditCard?: CreditCard;
  paymentPlan?: PaymentPlan;
  splitConfig?: SplitConfig; // Required when frequency is 'split'
  overrides?: InstanceOverride[];
}

export interface CashFlowData {
  id?: string;
  user_id?: string;
  startingBalance: number;
  startingDate: string; // YYYY-MM-DD format
  warningThreshold: number;
  floorThreshold: number;
  incomes: Income[];
  expenses: Expense[];
  categoryColors?: Record<string, string>; // category value -> color key
}

// Available colors for categories
export const categoryColorOptions = [
  { key: 'orange', label: 'Orange', bg: 'bg-orange-500/20', text: 'text-orange-400', hoverBg: 'hover:bg-orange-500/30' },
  { key: 'purple', label: 'Purple', bg: 'bg-purple-500/20', text: 'text-purple-400', hoverBg: 'hover:bg-purple-500/30' },
  { key: 'blue', label: 'Blue', bg: 'bg-blue-500/20', text: 'text-blue-400', hoverBg: 'hover:bg-blue-500/30' },
  { key: 'teal', label: 'Teal', bg: 'bg-teal-500/20', text: 'text-teal-400', hoverBg: 'hover:bg-teal-500/30' },
  { key: 'pink', label: 'Pink', bg: 'bg-pink-500/20', text: 'text-pink-400', hoverBg: 'hover:bg-pink-500/30' },
  { key: 'yellow', label: 'Yellow', bg: 'bg-yellow-500/20', text: 'text-yellow-400', hoverBg: 'hover:bg-yellow-500/30' },
  { key: 'red', label: 'Red', bg: 'bg-red-500/20', text: 'text-red-400', hoverBg: 'hover:bg-red-500/30' },
  { key: 'indigo', label: 'Indigo', bg: 'bg-indigo-500/20', text: 'text-indigo-400', hoverBg: 'hover:bg-indigo-500/30' },
  { key: 'cyan', label: 'Cyan', bg: 'bg-cyan-500/20', text: 'text-cyan-400', hoverBg: 'hover:bg-cyan-500/30' },
  { key: 'lime', label: 'Lime', bg: 'bg-lime-500/20', text: 'text-lime-400', hoverBg: 'hover:bg-lime-500/30' },
  { key: 'amber', label: 'Amber', bg: 'bg-amber-500/20', text: 'text-amber-400', hoverBg: 'hover:bg-amber-500/30' },
  { key: 'rose', label: 'Rose', bg: 'bg-rose-500/20', text: 'text-rose-400', hoverBg: 'hover:bg-rose-500/30' },
] as const;

export type CategoryColorKey = typeof categoryColorOptions[number]['key'];

// Default colors for built-in categories
export const defaultCategoryColors: Record<string, CategoryColorKey> = {
  credit_card: 'purple',
  loan: 'teal',
};

export interface DayEvent {
  type: 'income' | 'expense';
  name: string;
  amount: number;
  id: string;
  category?: string;
  isOverride?: boolean;
  isSkipped?: boolean;
  isSplit?: boolean;
  splitPart?: 1 | 2; // Which part of a split payment (1 = first, 2 = second)
  originalDate?: string;
  instanceDate: string; // The actual date of this instance (YYYY-MM-DD)
}

export interface DayData {
  day: number;
  events: DayEvent[];
  change: number;
  balance: number;
}
