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

// Scheduled gig payment
export interface ScheduledPayment {
  id: string;           // Unique ID for this payment
  date: string;         // YYYY-MM-DD
  amount: number;
  note?: string;        // e.g., "Tuesday shift", "Weekend delivery"
}

export interface Income {
  id: string;
  // Versions of the same real-world item share a seriesId. When something changes
  // for real (a raise, a restructure), the old version is capped with an endDate
  // and a new version takes over — so past months keep the amounts that actually
  // happened instead of being recalculated from today's numbers.
  seriesId?: string;
  name: string;
  amount: number;
  frequency: 'once' | 'weekly' | 'biweekly' | 'semimonthly' | 'monthly' | 'gig';
  startDate?: string;
  date?: string;
  endDate?: string; // YYYY-MM-DD. Last date this recurring item still occurs. History before this date stays visible; nothing projects after.
  overrides?: InstanceOverride[];

  // Gig-specific fields:
  payoutDay?: 'sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday';
  scheduledPayments?: ScheduledPayment[];
}

// Balance tracking for an expense. Named for its original credit-card use, but
// any recurring expense can carry one: the balance is amortized across that
// expense's own payment schedule, whatever its frequency.
export interface CreditCard {
  totalDebt: number; // Original total debt (for reference)
  currentBalance: number; // Balance as of balanceAsOfDate
  balanceAsOfDate: string; // YYYY-MM-DD - date the currentBalance was recorded
  apr: number;
  minimumPayment: number;
  // How interest is applied. Credit cards compound daily on the balance, so the
  // gap between payments matters; mortgages and most loans accrue once per
  // scheduled payment on the outstanding principal. Absent = decided by category
  // (see resolveInterestMethod), so data saved before this existed still works.
  interestMethod?: 'daily' | 'periodic';
  // The slice of each payment that never reaches the balance — escrow, property
  // tax, insurance, PMI. Cash flow still shows the whole payment; only the
  // balance is drawn down by the remainder. Absent or 0 = all principal.
  escrowPortion?: number;
}

export interface PaymentPlan {
  totalDebt: number;
  paymentCount: number;
  frequency: 'weekly' | 'biweekly' | 'monthly' | 'bimonthly' | 'semimonthly';
  secondDay?: number; // For semimonthly: the second day of the month (first day comes from startDate)
}

export interface Expense {
  id: string;
  seriesId?: string; // See Income.seriesId — versions of one real-world expense
  name: string;
  amount: number; // Total amount (for split: firstAmount + secondAmount)
  frequency: 'once' | 'weekly' | 'biweekly' | 'semimonthly' | 'monthly' | 'bimonthly' | 'quarterly' | 'payment_plan' | 'split';
  startDate?: string;
  date?: string;
  endDate?: string; // YYYY-MM-DD. Last date this recurring item still occurs. History before this date stays visible; nothing projects after.
  category: string;
  creditCard?: CreditCard; // Optional balance to pay down — works on any frequency, not just credit cards
  paymentPlan?: PaymentPlan;
  splitConfig?: SplitConfig; // Required when frequency is 'split'
  overrides?: InstanceOverride[];
}

// A real bank balance recorded on a real date. Projections re-anchor to the most
// recent checkpoint, and comparing each one against what the projection predicted
// is how the app measures whether the budget matches reality.
export interface BalanceCheckpoint {
  id: string;
  date: string; // YYYY-MM-DD
  actualBalance: number;
  note?: string;
}

// A sandbox fork of the budget. Only incomes and expenses are copied — the
// starting balance and recorded checkpoints are facts about reality, so every
// scenario branches from the same factual starting point.
export interface Scenario {
  id: string;
  name: string;
  createdAt: string; // YYYY-MM-DD
  incomes: Income[];
  expenses: Expense[];
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
  checkpoints?: BalanceCheckpoint[];
  scenarios?: Scenario[];
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
  runningBalance?: number; // Balance immediately after this transaction
}

export interface DayData {
  day: number;
  events: DayEvent[];
  change: number;
  balance: number;
}
