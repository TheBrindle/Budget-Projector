// Shared payoff math for balance-tracked expenses.
//
// Any expense (not just a credit card) can carry a `creditCard` block — a
// balance, an APR and an as-of date. These helpers turn that into a payoff
// projection using the expense's own payment frequency.

// How many payments each frequency produces per year. Used to turn an annual
// APR into a per-payment interest rate. Monthly stays APR/12, so existing
// credit-card projections are unchanged.
export const PAYMENTS_PER_YEAR: Record<string, number> = {
  weekly: 52,
  biweekly: 26,
  semimonthly: 24,
  split: 24, // two payments a month, different amounts
  monthly: 12,
  bimonthly: 6,
  quarterly: 4,
  payment_plan: 12,
  once: 12,
};

export const getPaymentsPerYear = (frequency: string) => PAYMENTS_PER_YEAR[frequency] ?? 12;

// Interest charged per payment period.
export const getPeriodRate = (apr: number, frequency: string) =>
  (apr || 0) / 100 / getPaymentsPerYear(frequency);

// Interest charged per day, for balances that compound daily.
export const getDailyRate = (apr: number) => (apr || 0) / 100 / 365;

export type InterestMethod = 'daily' | 'periodic';

// Which accrual model applies. Credit cards compound daily on the balance;
// mortgages and most loans accrue once per scheduled payment on the principal —
// which is what makes a mortgage projection match a lender's amortization table.
// An expense that never chose gets the sensible default for its category.
export const resolveInterestMethod = (
  method: InterestMethod | undefined,
  category: string | undefined
): InterestMethod => method ?? (category === 'credit_card' ? 'daily' : 'periodic');

// Whole days from one YYYY-MM-DD to another (never negative).
export const daysBetween = (fromStr: string, toStr: string): number => {
  const from = new Date(fromStr + 'T12:00:00').getTime();
  const to = new Date(toStr + 'T12:00:00').getTime();
  return Math.max(0, Math.round((to - from) / 86400000));
};

export interface PayoffProjection {
  periods: number; // number of payments needed; -1 = never pays off
  months: number; // that many payments expressed in months
  totalPaid: number;
  totalInterest: number;
  paymentsPerYear: number;
  lastPayment: number; // final (often partial) payment
}

// Amortize `balance` against a repeating cycle of payments. `payments` holds one
// entry per payment in a cycle — a single amount for most frequencies, two for
// split monthly (e.g. $300 on the 1st, $200 on the 15th).
//
// `method` picks the accrual model: 'periodic' charges APR/payments-per-year once
// per payment (mortgages, loans), 'daily' compounds APR/365 across the days in a
// period (credit cards). `escrow` is the part of each payment that doesn't reach
// the balance. This is the preview twin of buildBalanceSchedule, which uses real
// occurrence dates rather than an even period length.
export const projectPayoff = (
  balance: number,
  payments: number[],
  apr: number,
  frequency: string,
  opts: { method?: InterestMethod; escrow?: number } = {}
): PayoffProjection | null => {
  const paymentsPerYear = getPaymentsPerYear(frequency);
  const escrow = Math.max(0, opts.escrow || 0);
  // Only the principal share pays the balance down.
  const cycle = payments.map(p => p - escrow).filter(p => p > 0);
  if (balance <= 0 || cycle.length === 0) return null;

  const rate = getPeriodRate(apr, frequency);
  const daysPerPeriod = 365 / paymentsPerYear;
  const dailyRate = getDailyRate(apr);
  const accrue = (b: number) => opts.method === 'daily'
    ? b * Math.pow(1 + dailyRate, daysPerPeriod)
    : b + b * rate;
  const maxPeriods = paymentsPerYear * 50; // 50-year cap

  let remaining = balance;
  let periods = 0;
  let totalPaid = 0;
  let lastPayment = 0;

  while (remaining > 0.01 && periods < maxPeriods) {
    remaining = accrue(remaining);
    const principal = Math.min(cycle[periods % cycle.length], remaining);
    remaining -= principal;
    // Escrow is money out of pocket even though it never touches the balance.
    const payment = principal + escrow;
    totalPaid += payment;
    lastPayment = payment;
    periods++;
  }

  if (remaining > 0.01) {
    return { periods: -1, months: -1, totalPaid: 0, totalInterest: 0, paymentsPerYear, lastPayment: 0 };
  }

  return {
    periods,
    months: Math.max(1, Math.ceil((periods / paymentsPerYear) * 12)),
    totalPaid,
    // Escrow is part of what you pay but it isn't interest — counting it here
    // would report a mortgage's tax bill as a finance charge.
    totalInterest: totalPaid - escrow * periods - balance,
    paymentsPerYear,
    lastPayment,
  };
};

// "12 payments (every 2 weeks)" style summary of how often payments land.
export const paymentCadenceLabel = (frequency: string): string => {
  const labels: Record<string, string> = {
    weekly: 'weekly',
    biweekly: 'every 2 weeks',
    semimonthly: 'twice a month',
    split: 'twice a month',
    monthly: 'monthly',
    bimonthly: 'every 2 months',
    quarterly: 'quarterly',
  };
  return labels[frequency] || 'monthly';
};
