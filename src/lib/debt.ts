// Whole-portfolio debt math.
//
// The projection already amortizes each balance-tracked expense on its own. What
// this adds is the view across all of them at once, and the question that only
// makes sense across all of them: given a spare $500, which debt should it go to?
//
// Everything here is pure. Schedules are passed in rather than built, so this
// stays testable and can't drift from the projection the dashboard draws.

import { Expense, InstanceOverride } from './types';

// The slice of a BalanceSchedule this module needs. Structural, so the app's
// richer schedule satisfies it without importing anything back.
export interface ScheduleLike {
  ledger: { date: string; payment: number; interest: number; principal: number; balanceAfter: number }[];
  startBalance: number;
  paidOffDate: string | null;
  neverPaysOff: boolean;
}

export interface DebtSummary {
  id: string;
  name: string;
  balance: number; // still owed as of the schedule's anchor
  apr: number;
  payment: number; // the scheduled payment amount
  payoffDate: string | null; // null when it never clears inside the horizon
  paymentsRemaining: number;
  interestRemaining: number;
  neverPaysOff: boolean;
}

export interface PortfolioSummary {
  debts: DebtSummary[];
  totalBalance: number;
  totalInterest: number;
  // Latest payoff across every debt — when you'd actually be debt-free.
  debtFreeDate: string | null;
  anyNeverPaysOff: boolean;
}

// Interest still to come, and when this debt clears.
export const summarizeDebt = (expense: Expense, schedule: ScheduleLike): DebtSummary => {
  const cc = expense.creditCard;
  return {
    id: expense.id,
    name: expense.name,
    balance: schedule.startBalance,
    apr: cc?.apr || 0,
    payment: expense.amount,
    payoffDate: schedule.paidOffDate,
    paymentsRemaining: schedule.ledger.length,
    interestRemaining: schedule.ledger.reduce((sum, e) => sum + e.interest, 0),
    neverPaysOff: schedule.neverPaysOff
  };
};

export const summarizePortfolio = (debts: DebtSummary[]): PortfolioSummary => {
  const anyNeverPaysOff = debts.some(d => d.neverPaysOff);
  // One debt that never clears means there is no debt-free date, however tidy
  // the others look.
  const debtFreeDate = anyNeverPaysOff || debts.length === 0
    ? null
    : debts.reduce<string | null>((latest, d) =>
        !d.payoffDate ? latest : (!latest || d.payoffDate > latest ? d.payoffDate : latest), null);

  return {
    debts,
    totalBalance: debts.reduce((sum, d) => sum + d.balance, 0),
    totalInterest: debts.reduce((sum, d) => sum + d.interestRemaining, 0),
    debtFreeDate,
    anyNeverPaysOff
  };
};

export type ExtraPaymentMode = 'once' | 'ongoing';

// A copy of the expense with the extra money applied, ready to be re-amortized.
//
// 'once' overrides the single instance on or after `fromDate`, which is exactly
// how a one-off "I got paid, here's $500" behaves. 'ongoing' raises the payment
// itself from that date forward. Returns null when there's no occurrence to
// attach a one-time payment to.
export const withExtraPayment = (
  expense: Expense,
  targetDate: string,
  extra: number,
  mode: ExtraPaymentMode
): Expense | null => {
  if (extra <= 0) return null;

  if (mode === 'ongoing') {
    return { ...expense, amount: expense.amount + extra };
  }

  // Keep any other edits to this instance (a moved date, a note) and only lift
  // the amount. An existing override's amount wins as the base, since that's
  // what the projection is currently paying.
  const existing = (expense.overrides || []).find(o => o.originalDate === targetDate);
  const base = existing?.newAmount ?? expense.amount;
  const bumped: InstanceOverride = {
    ...(existing || { originalDate: targetDate }),
    newDate: existing?.newDate ?? targetDate,
    newAmount: base + extra
  };

  return {
    ...expense,
    overrides: [...(expense.overrides || []).filter(o => o.originalDate !== targetDate), bumped]
  };
};

export interface TargetComparison {
  debtId: string;
  debtName: string;
  // Portfolio-wide outcome of putting the money here
  totalInterest: number;
  debtFreeDate: string | null;
  // Against doing nothing
  interestSaved: number;
  monthsSaved: number;
  isBest: boolean;
}

// Whole months between two YYYY-MM-DD dates, for "X months sooner".
export const monthsBetween = (fromStr: string, toStr: string): number => {
  const [fy, fm] = fromStr.split('-').map(Number);
  const [ty, tm] = toStr.split('-').map(Number);
  return (ty - fy) * 12 + (tm - fm);
};

// Rank every candidate debt by what the same money does to the whole portfolio.
// `simulate` re-amortizes with the payment applied to one debt and hands back the
// resulting portfolio; this only decides what the numbers mean.
export const compareTargets = (
  baseline: PortfolioSummary,
  candidates: { debtId: string; debtName: string; result: PortfolioSummary }[]
): TargetComparison[] => {
  const rows = candidates.map(({ debtId, debtName, result }) => ({
    debtId,
    debtName,
    totalInterest: result.totalInterest,
    debtFreeDate: result.debtFreeDate,
    interestSaved: baseline.totalInterest - result.totalInterest,
    monthsSaved: baseline.debtFreeDate && result.debtFreeDate
      ? monthsBetween(result.debtFreeDate, baseline.debtFreeDate)
      : 0,
    isBest: false
  }));

  // Most interest saved wins; a tie goes to the earlier debt-free date. Interest
  // is the primary measure because it's the money actually kept.
  const best = rows.reduce<TargetComparison | null>((winner, row) => {
    if (!winner) return row;
    if (row.interestSaved > winner.interestSaved + 0.005) return row;
    if (Math.abs(row.interestSaved - winner.interestSaved) <= 0.005
        && row.debtFreeDate && winner.debtFreeDate && row.debtFreeDate < winner.debtFreeDate) return row;
    return winner;
  }, null);

  return rows
    .map(row => ({ ...row, isBest: !!best && row.debtId === best.debtId }))
    .sort((a, b) => b.interestSaved - a.interestSaved);
};
