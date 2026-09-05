// Savings-goal math: "put this much aside each month" → "the money is there on
// this date", and the reverse, "I want it by this date" → "this much a month".
//
// Everything here is pure and works on YYYY-MM-DD strings, like payoff.ts.
// Contributions land once a month on the day-of-month of the goal's start date
// (clamped for short months), which is the same rhythm a monthly expense keeps,
// so the linked Savings expense and this projection agree on every date.

import { Expense, InstanceOverride, SavingsGoal } from './types';

const parse = (dateStr: string): Date => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
};

const format = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

// The n-th month after `start`, keeping start's day-of-month where the month
// has it and using the last day where it doesn't (Jan 31 → Feb 28 → Mar 31).
const addMonthsClamped = (start: Date, n: number): Date => {
  const y = start.getFullYear();
  const m = start.getMonth() + n;
  const lastDay = new Date(y, m + 1, 0).getDate();
  return new Date(y, m, Math.min(start.getDate(), lastDay), 12, 0, 0);
};

// Nothing is saved for longer than this. Keeps every loop below finite.
const MAX_CONTRIBUTIONS = 600; // 50 years

const isSkipped = (goal: SavingsGoal, dateStr: string) => !!goal.skippedDates?.includes(dateStr);

// How many contributions fall strictly after `afterStr` and on or before
// `throughStr`. The half-open window is what makes "as of" dates work: the
// contribution dated on the as-of day is already inside savedSoFar. Skipped
// months don't count — that's the whole point of skipping one.
export const countContributions = (goal: SavingsGoal, afterStr: string, throughStr: string): number => {
  if (throughStr <= afterStr) return 0;
  const start = parse(goal.startDate);
  let count = 0;
  for (let n = 0; n < MAX_CONTRIBUTIONS; n++) {
    const d = format(addMonthsClamped(start, n));
    if (d > throughStr) break;
    if (d > afterStr && !isSkipped(goal, d)) count++;
  }
  return count;
};

// The k-th contribution date strictly after `afterStr` (k = 1 is the next one),
// skipped months excluded.
export const nthContributionAfter = (goal: SavingsGoal, afterStr: string, k: number): string | null => {
  if (k < 1) return null;
  const start = parse(goal.startDate);
  let seen = 0;
  for (let n = 0; n < MAX_CONTRIBUTIONS; n++) {
    const d = format(addMonthsClamped(start, n));
    if (d > afterStr && !isSkipped(goal, d) && ++seen === k) return d;
  }
  return null;
};

// The next `limit` scheduled months after `afterStr`, skipped ones included and
// flagged — this is the list you pick from when deciding which month to sit out.
export const upcomingContributions = (
  goal: SavingsGoal,
  afterStr: string,
  limit: number
): { date: string; skipped: boolean }[] => {
  const start = parse(goal.startDate);
  const out: { date: string; skipped: boolean }[] = [];
  for (let n = 0; n < MAX_CONTRIBUTIONS && out.length < limit; n++) {
    const d = format(addMonthsClamped(start, n));
    if (d > afterStr) out.push({ date: d, skipped: isSkipped(goal, d) });
  }
  return out;
};

export interface GoalOutlook {
  savedToday: number; // savedSoFar plus every planned contribution between the as-of date and today
  remaining: number; // still to put aside
  isFunded: boolean;
  contributionsLeft: number; // future contributions needed; -1 when the monthly amount is 0
  readyDate: string | null; // the contribution that tips it over the line
  monthsAway: number; // whole months from today to readyDate
  lastContribution: number; // the final (often partial) contribution
  progress: number; // 0..1
  // Only when the goal carries a target date:
  onTrack: boolean | null; // readyDate lands on or before the target date
  requiredMonthly: number | null; // what it would take per month from today to make the target date; null = no contribution dates left before it
}

// Where a goal stands as of `todayStr`, given the monthly amount it carries.
export const projectGoal = (goal: SavingsGoal, todayStr: string): GoalOutlook => {
  const monthly = Math.max(0, goal.monthlyAmount || 0);
  const elapsed = countContributions(goal, goal.savedAsOfDate, todayStr);
  const savedToday = Math.min(goal.targetAmount, (goal.savedSoFar || 0) + monthly * elapsed);
  const remaining = Math.max(0, goal.targetAmount - savedToday);
  const isFunded = remaining <= 0.005;
  const progress = goal.targetAmount > 0 ? Math.min(1, savedToday / goal.targetAmount) : 0;

  const requiredMonthly = goal.targetDate ? requiredMonthlyFor(goal, goal.targetDate, todayStr) : null;

  if (isFunded) {
    return { savedToday, remaining: 0, isFunded, contributionsLeft: 0, readyDate: null, monthsAway: 0, lastContribution: 0, progress: 1, onTrack: goal.targetDate ? true : null, requiredMonthly };
  }
  if (monthly <= 0) {
    return { savedToday, remaining, isFunded, contributionsLeft: -1, readyDate: null, monthsAway: -1, lastContribution: 0, progress, onTrack: goal.targetDate ? false : null, requiredMonthly };
  }

  const contributionsLeft = Math.ceil(remaining / monthly - 1e-9);
  const readyDate = nthContributionAfter(goal, todayStr, contributionsLeft);
  const lastContribution = remaining - monthly * (contributionsLeft - 1);
  const today = parse(todayStr);
  const ready = readyDate ? parse(readyDate) : null;
  const monthsAway = ready
    ? Math.max(0, (ready.getFullYear() - today.getFullYear()) * 12 + (ready.getMonth() - today.getMonth()))
    : -1;

  return {
    savedToday,
    remaining,
    isFunded,
    contributionsLeft,
    readyDate,
    monthsAway,
    lastContribution,
    progress,
    onTrack: goal.targetDate ? !!readyDate && readyDate <= goal.targetDate : null,
    requiredMonthly,
  };
};

// Monthly amount needed, from today, to have the target amount on or before
// `targetDateStr`. Null when no contribution date falls before the target —
// the date is too soon for a monthly plan to reach it.
export const requiredMonthlyFor = (goal: SavingsGoal, targetDateStr: string, todayStr: string): number | null => {
  const elapsed = countContributions(goal, goal.savedAsOfDate, todayStr);
  const savedToday = (goal.savedSoFar || 0) + Math.max(0, goal.monthlyAmount || 0) * elapsed;
  const remaining = Math.max(0, goal.targetAmount - savedToday);
  if (remaining <= 0.005) return 0;
  const slots = countContributions(goal, todayStr, targetDateStr);
  if (slots === 0) return null;
  // Round up to the cent so the last contribution never comes up a penny short.
  return Math.ceil((remaining / slots) * 100) / 100;
};

// The monthly Savings expense that carries a goal's contributions through the
// cash flow. Starts with the first contribution not yet inside savedSoFar and
// stops on the ready date; the final contribution is trimmed to what's actually
// still needed via a per-instance override, the same way any other instance
// gets adjusted. Null when there's nothing left to contribute.
export const buildGoalExpense = (goal: SavingsGoal, outlook: GoalOutlook): Omit<Expense, 'id'> | null => {
  if (outlook.isFunded || outlook.contributionsLeft <= 0 || !outlook.readyDate) return null;

  // The first contribution the expense should show: after the as-of date (those
  // are already saved), but never before the goal's own start.
  const firstUncounted = nthContributionAfter(goal, goal.savedAsOfDate, 1);
  const startDate = firstUncounted && firstUncounted >= goal.startDate ? firstUncounted : goal.startDate;

  // Skipped months become skipped instances, so the calendar shows the gap and
  // the cash flow keeps the money that month.
  const overrides: InstanceOverride[] = (goal.skippedDates || [])
    .filter(d => d >= startDate && d <= outlook.readyDate!)
    .sort()
    .map(d => ({ originalDate: d, newDate: 'SKIPPED', note: `Skipped contribution toward ${goal.name}` }));
  if (outlook.lastContribution < goal.monthlyAmount - 0.005) {
    overrides.push({
      originalDate: outlook.readyDate,
      newDate: outlook.readyDate,
      newAmount: Math.round(outlook.lastContribution * 100) / 100,
      note: `Last contribution toward ${goal.name}`,
    });
  }

  return {
    name: `Saving: ${goal.name}`,
    amount: goal.monthlyAmount,
    frequency: 'monthly',
    startDate,
    endDate: outlook.readyDate,
    category: 'savings',
    goalId: goal.id,
    goalRole: 'contribution',
    overrides: overrides.length ? overrides : undefined,
  };
};

// The loan behind a financed purchase: what's borrowed once the down payment
// (the goal) is met, and the level monthly payment that clears it over the term.
export interface FinancingTerms {
  financed: number;
  payment: number;
  apr: number;
  termMonths: number;
}

export const financingTerms = (goal: SavingsGoal): FinancingTerms | null => {
  const f = goal.financing;
  if (!f || !(f.termMonths > 0)) return null;
  const financed = Math.max(0, (f.totalPrice || 0) - goal.targetAmount);
  if (financed <= 0) return null;
  const r = (f.apr || 0) / 100 / 12;
  const raw = r > 0
    ? financed * r / (1 - Math.pow(1 + r, -f.termMonths))
    : financed / f.termMonths;
  return { financed, payment: Math.ceil(raw * 100) / 100, apr: f.apr || 0, termMonths: f.termMonths };
};

// When the purchase happens: the day the last contribution lands, or — if the
// down payment is already there — the date the goal was last saved from.
export const purchaseDateFor = (goal: SavingsGoal, outlook: GoalOutlook, todayStr: string): string =>
  outlook.readyDate ?? (goal.savedAsOfDate > todayStr ? goal.savedAsOfDate : todayStr);

// The loan payment as a balance-tracked loan expense, first payment one month
// after the purchase. Carries a balance block so the debt planner amortizes it
// like any other loan. `keepStart` holds an existing expense's start date once
// the goal is funded, so the schedule doesn't drift day by day.
export const buildGoalPaymentExpense = (
  goal: SavingsGoal,
  outlook: GoalOutlook,
  todayStr: string,
  keepStart?: string
): Omit<Expense, 'id'> | null => {
  const terms = financingTerms(goal);
  if (!terms) return null;
  const purchase = purchaseDateFor(goal, outlook, todayStr);
  const startDate = outlook.isFunded && keepStart ? keepStart : format(addMonthsClamped(parse(purchase), 1));
  const asOf = format(addMonthsClamped(parse(startDate), -1));
  return {
    name: `${goal.name} payment`,
    amount: terms.payment,
    frequency: 'monthly',
    startDate,
    category: 'loan',
    goalId: goal.id,
    goalRole: 'payment',
    creditCard: {
      totalDebt: terms.financed,
      currentBalance: terms.financed,
      balanceAsOfDate: asOf,
      apr: terms.apr,
      minimumPayment: terms.payment,
      interestMethod: 'periodic',
    },
  };
};
