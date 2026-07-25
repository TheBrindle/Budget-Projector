'use client';

import { useState } from 'react';
import { CreditCard, Expense } from '@/lib/types';

const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

interface BalanceUpdateFormProps {
  expense: Expense;
  // What the projection currently expects the balance to be on the as-of date.
  // Shown for comparison — the gap is usually new charges.
  projectedBalance: (asOfDate: string) => number;
  onSave: (creditCard: CreditCard) => void;
  onClose: () => void;
}

// Re-record a real balance without touching the payment schedule. Balances move
// for reasons the schedule can't see (new charges, interest, a big one-off
// payment), so this is a measurement, not a change to the expense — it applies
// in place and never forks a new version of the item.
export default function BalanceUpdateForm({ expense, projectedBalance, onSave, onClose }: BalanceUpdateFormProps) {
  const cc = expense.creditCard!;
  const [balance, setBalance] = useState(cc.currentBalance?.toString() ?? '');
  const [asOfDate, setAsOfDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });

  const parsed = parseFloat(balance);
  const isValid = !isNaN(parsed) && parsed >= 0 && !!asOfDate;
  const projected = projectedBalance(asOfDate);
  const drift = isValid ? parsed - projected : 0;

  const handleSave = () => {
    if (!isValid) return;
    onSave({
      ...cc,
      // Keep the original debt as the progress benchmark; only fill it in if it
      // was never recorded.
      totalDebt: cc.totalDebt || parsed,
      currentBalance: parsed,
      balanceAsOfDate: asOfDate
    });
  };

  return (
    <div>
      <div className="p-4 space-y-4">
        <div className="text-sm text-gray-400">
          Enter the balance from your statement or app. The payment schedule stays exactly
          as it is — only the balance being paid down changes.
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 uppercase block mb-1">Balance</label>
            <input
              type="number"
              value={balance}
              onChange={e => setBalance(e.target.value)}
              className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white font-mono"
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

        <div className="text-xs text-gray-500">
          Payments on or before {new Date(asOfDate + 'T12:00:00').toLocaleDateString()} keep the
          amounts they already had — history stays intact.
        </div>
      </div>

      <div className="flex justify-end gap-3 p-4 border-t border-gray-800">
        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-800 text-white rounded-lg">Cancel</button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!isValid}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg font-medium disabled:opacity-50"
        >
          Update Balance
        </button>
      </div>
    </div>
  );
}
