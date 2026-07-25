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
export const projectPayoff = (
  balance: number,
  payments: number[],
  apr: number,
  frequency: string
): PayoffProjection | null => {
  const paymentsPerYear = getPaymentsPerYear(frequency);
  const cycle = payments.filter(p => p > 0);
  if (balance <= 0 || cycle.length === 0) return null;

  const rate = getPeriodRate(apr, frequency);
  const maxPeriods = paymentsPerYear * 50; // 50-year cap

  let remaining = balance;
  let periods = 0;
  let totalPaid = 0;
  let lastPayment = 0;

  while (remaining > 0.01 && periods < maxPeriods) {
    remaining += remaining * rate;
    const payment = Math.min(cycle[periods % cycle.length], remaining);
    remaining -= payment;
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
    totalInterest: totalPaid - balance,
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
