'use client';

import { useState } from 'react';
import { CreditCard, Expense } from '@/lib/types';
import { projectPayoff, paymentCadenceLabel, getPeriodRate } from '@/lib/payoff';

const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

interface BalanceUpdateFormProps {
  expense: Expense;
  // What the projection currently expects the balance to be on the as-of date.
  // Shown for comparison — the gap is usually new charges.
  projectedBalance: (asOfDate: string) => number;
  onSave: (creditCard: CreditCard) => void;
  onStopTracking: () => void;
  onClose: () => void;
}

// Record a real balance on an expense — either attaching one for the first time
// (a mortgage, a business card, a loan) or re-recording it later.
//
// Balances move for reasons the payment schedule can't see: new charges, interest,
// an extra payment. So this is a measurement, not a change to the expense — it
// applies in place and never forks a new version of the item.
export default function BalanceUpdateForm({ expense, projectedBalance, onSave, onStopTracking, onClose }: BalanceUpdateFormProps) {
  const cc = expense.creditCard;
  const isNew = !cc;

  const [balance, setBalance] = useState(cc?.currentBalance?.toString() ?? '');
  const [apr, setApr] = useState(cc?.apr?.toString() ?? '0');
  const [asOfDate, setAsOfDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });

  const parsed = parseFloat(balance);
  const isValid = !isNaN(parsed) && parsed > 0 && !!asOfDate;
  const projected = isNew ? 0 : projectedBalance(asOfDate);
  const drift = isValid ? parsed - projected : 0;

  // Payoff outlook at this balance and the expense's existing payment.
  const cycle = expense.frequency === 'split' && expense.splitConfig
    ? [expense.splitConfig.firstAmount, expense.splitConfig.secondAmount]
    : [expense.amount];
  const aprValue = parseFloat(apr) || 0;
  const payoff = isValid ? projectPayoff(parsed, cycle, aprValue, expense.frequency) : null;

  // Interest this balance accrues per payment period, so a rate can be sanity
  // checked against the payment before saving it.
  const periodInterest = isValid ? parsed * getPeriodRate(aprValue, expense.frequency) : 0;
  const aprChanged = !isNew && aprValue !== (cc?.apr ?? 0);

  const handleSave = () => {
    if (!isValid) return;
    onSave({
      // Keep the original debt as the progress benchmark; only set it when this
      // balance is being attached for the first time.
      totalDebt: cc?.totalDebt || parsed,
      currentBalance: parsed,
      balanceAsOfDate: asOfDate,
      apr: parseFloat(apr) || 0,
      minimumPayment: cc?.minimumPayment ?? expense.amount
    });
  };

  return (
    <div>
      <div className="p-4 space-y-4">
        <div className="text-sm text-gray-400">
          {isNew
            ? `Track what's still owed on this expense. The ${formatCurrency(expense.amount)} payment
               is applied ${paymentCadenceLabel(expense.frequency)} until the balance reaches $0.`
            : `Enter the balance from your statement or app. The payment schedule stays exactly
               as it is — only the balance and its interest rate change.`}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 uppercase block mb-1">Balance</label>
            <input
              type="number"
              value={balance}
              onChange={e => setBalance(e.target.value)}
              className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white font-mono"
              placeholder="0.00"
              step="0.01"
              min="0"
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 uppercase block mb-1">As of Date</label>
            <input
              type="date"
              value={asOfDate}
              onChange={e => setAsOfDate(e.target.value)}
              className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white"
            />
          </div>
        </div>

        {/* Interest rate. Editable whenever, not just on the first balance — a
            promo rate expires, a variable rate moves, a card gets repriced. */}
        <div>
          <label className="text-xs text-gray-500 uppercase block mb-1">
            Interest Rate — APR % (0 if none)
          </label>
          <input
            type="number"
            value={apr}
            onChange={e => setApr(e.target.value)}
            className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white font-mono"
            step="0.01"
            min="0"
          />
          {isValid && aprValue > 0 && (
            <p className="text-xs text-gray-500 mt-1">
              Adds about <span className="font-mono text-yellow-400/90">{formatCurrency(periodInterest)}</span>
              {' '}per payment at this balance, against a {formatCurrency(expense.amount)} payment
              {' '}{paymentCadenceLabel(expense.frequency)}.
            </p>
          )}
          {aprChanged && (
            <p className="text-xs text-purple-300/80 mt-1">
              Rate changed from {cc?.apr ?? 0}% — applies from the as-of date forward. Interest already
              charged in past months stays as it was.
            </p>
          )}
        </div>

        {!isNew && (
          <div className="p-3 bg-gray-800 rounded-lg space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Projected for that date</span>
              <span className="font-mono text-gray-300">{formatCurrency(projected)}</span>
            </div>
            {isValid && Math.abs(drift) >= 0.01 && (
              <div className="flex justify-between">
                <span className="text-gray-500">{drift > 0 ? 'Higher than projected' : 'Lower than projected'}</span>
                <span className={`font-mono ${drift > 0 ? 'text-yellow-400' : 'text-green-400'}`}>
                  {drift > 0 ? '+' : '−'}{formatCurrency(Math.abs(drift))}
                </span>
              </div>
            )}
            {isValid && drift > 0.01 && (
              <div className="text-xs text-gray-500 pt-1">
                Usually new charges. Payments now run from this balance, so the payoff date moves out.
              </div>
            )}
          </div>
        )}

        {/* Payoff outlook. A balance that outlives the 50-year horizon is still
            worth tracking — say so rather than treating it as invalid. */}
        {payoff && (
          <div className={`p-3 rounded-lg border ${payoff.months < 0 ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-purple-500/10 border-purple-500/30'}`}>
            {payoff.months < 0 ? (
              <div className="text-sm text-yellow-300">
                <div className="font-semibold">No payoff date in the next 50 years</div>
                <div className="text-xs text-yellow-400/70 mt-1">
                  At {formatCurrency(expense.amount)} {paymentCadenceLabel(expense.frequency)} the interest
                  eats most of the payment. The balance is still tracked and drawn down — there&apos;s just no
                  payoff date to show.
                </div>
              </div>
            ) : (
              <div className="flex justify-between items-center">
                <div>
                  <div className="text-xs text-purple-400 uppercase">Payoff Time</div>
                  <div className="font-mono text-xl font-bold text-purple-300">{payoff.months} mo</div>
                  <div className="text-xs text-purple-400/70">({Math.floor(payoff.months / 12)}y {payoff.months % 12}m)</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-purple-400 uppercase">Total Cost</div>
                  <div className="font-mono text-lg font-semibold text-purple-300">{formatCurrency(payoff.totalPaid)}</div>
                  {payoff.totalInterest > 0 && (
                    <div className="text-xs text-purple-400/70">incl. {formatCurrency(payoff.totalInterest)} interest</div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="text-xs text-gray-500">
          {isNew
            ? 'Payments already made stay exactly as they are — this only affects the projection from the as-of date forward.'
            : `Payments on or before ${new Date(asOfDate + 'T12:00:00').toLocaleDateString()} keep the amounts they already had — history stays intact.`}
        </div>

        {!isNew && (
          <button
            type="button"
            onClick={onStopTracking}
            className="text-xs text-gray-500 hover:text-red-400 underline"
          >
            Stop tracking a balance on this expense
          </button>
        )}
      </div>

      <div className="flex justify-end gap-3 p-4 border-t border-gray-800">
        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-800 text-white rounded-lg">Cancel</button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!isValid}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg font-medium disabled:opacity-50"
        >
          {isNew ? 'Track Balance' : 'Update Balance'}
        </button>
      </div>
    </div>
  );
}
