'use client';

import { useState, useEffect, useMemo } from 'react';
import { Expense, SplitConfig } from '@/lib/types';

const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

const categories = [
  { value: 'housing', label: 'Housing' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'auto', label: 'Auto/Transport' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'food', label: 'Food/Groceries' },
  { value: 'health', label: 'Health/Medical' },
  { value: 'entertainment', label: 'Entertainment' },
  { value: 'subscriptions', label: 'Subscriptions' },
  { value: 'loan', label: 'Loans' },
  { value: 'other', label: 'Other' }
];

interface ExpenseFormProps {
  expense: Expense | null;
  onSave: (data: Omit<Expense, 'id'>) => void;
  onClose: () => void;
  defaultMonth?: string; // YYYY-MM format
}

export default function ExpenseForm({ expense, onSave, onClose, defaultMonth }: ExpenseFormProps) {
  // For new expense, use defaultMonth with day 1; for existing, use stored date
  const getInitialStartDate = () => {
    if (expense?.startDate) return expense.startDate;
    if (defaultMonth) return `${defaultMonth}-01`;
    return new Date().toISOString().split('T')[0];
  };

  const [form, setForm] = useState({
    name: expense?.name || '',
    amount: expense?.amount?.toString() || '',
    frequency: expense?.frequency || 'monthly',
    startDate: getInitialStartDate(),
    category: expense?.category || 'other'
  });

  // Split configuration state
  const [firstDay, setFirstDay] = useState(expense?.splitConfig?.firstDay?.toString() || '1');
  const [firstAmount, setFirstAmount] = useState(expense?.splitConfig?.firstAmount?.toString() || '');
  const [secondDay, setSecondDay] = useState(expense?.splitConfig?.secondDay?.toString() || '15');

  // Balance / payoff tracking state (reuses the credit-card payoff engine)
  const [trackBalance, setTrackBalance] = useState(!!expense?.creditCard);
  const [currentBalance, setCurrentBalance] = useState(
    expense?.creditCard?.currentBalance?.toString() ?? expense?.creditCard?.totalDebt?.toString() ?? ''
  );
  const [balanceAsOfDate, setBalanceAsOfDate] = useState(
    expense?.creditCard?.balanceAsOfDate || new Date().toISOString().split('T')[0]
  );
  const [apr, setApr] = useState(expense?.creditCard?.apr?.toString() ?? '0');

  // Optional end date — the last date this recurring expense occurs (its "duration")
  const [endDate, setEndDate] = useState(expense?.endDate || '');

  const total = parseFloat(form.amount) || 0;
  const first = parseFloat(firstAmount) || 0;
  const second = total - first;
  const endBeforeStart = endDate !== '' && endDate < form.startDate;

  // Live payoff projection (mirrors CreditCardForm). months = -1 means it never pays off.
  const payoffCalc = useMemo(() => {
    const payment = parseFloat(form.amount);
    const debt = parseFloat(currentBalance);
    const rate = (parseFloat(apr) || 0) / 100 / 12;
    if (!payment || !debt || payment <= 0 || debt <= 0) return null;

    if (rate === 0) {
      const months = Math.ceil(debt / payment);
      return { months, totalPaid: payment * months, totalInterest: 0 };
    }
    if (payment <= debt * rate) return { months: -1, totalPaid: 0, totalInterest: 0 };

    let remaining = debt;
    let months = 0;
    let totalPaid = 0;
    while (remaining > 0.01 && months < 600) {
      remaining += remaining * rate;
      remaining -= payment;
      totalPaid += payment;
      months++;
      if (remaining < 0) { totalPaid += remaining; remaining = 0; }
    }
    return { months, totalPaid, totalInterest: totalPaid - debt };
  }, [form.amount, currentBalance, apr]);

  // Auto-set first amount to half when switching to split or when amount changes
  useEffect(() => {
    if (form.frequency === 'split' && total > 0 && !firstAmount) {
      setFirstAmount(Math.floor(total / 2).toString());
    }
  }, [form.frequency, total]);

  const handleSave = () => {
    if (!form.name || !form.amount) return;
    
    const expenseData: Omit<Expense, 'id'> = {
      name: form.name,
      amount: parseFloat(form.amount),
      frequency: form.frequency as Expense['frequency'],
      startDate: form.startDate,
      category: form.category,
      // Optional duration — the last date this recurring item occurs.
      // Write undefined when cleared so editing removes any previously-saved end date.
      endDate: endDate || undefined
    };

    // Add split config if frequency is split
    if (form.frequency === 'split') {
      expenseData.splitConfig = {
        firstDay: parseInt(firstDay) || 1,
        firstAmount: first,
        secondDay: parseInt(secondDay) || 15,
        secondAmount: second
      };
    }

    // Attach balance/payoff tracking (monthly only — the payoff engine is monthly).
    // Set undefined when off so editing clears any previously-saved balance.
    if (trackBalance && form.frequency === 'monthly' && parseFloat(currentBalance) > 0) {
      const balance = parseFloat(currentBalance);
      expenseData.creditCard = {
        totalDebt: expense?.creditCard?.totalDebt ?? balance,
        currentBalance: balance,
        balanceAsOfDate,
        apr: parseFloat(apr) || 0,
        minimumPayment: parseFloat(form.amount)
      };
    } else {
      expenseData.creditCard = undefined;
    }

    onSave(expenseData);
  };

  return (
    <div>
      <div className="p-4 space-y-4">
        <div>
          <label className="text-xs text-gray-500 uppercase block mb-1">Name</label>
          <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white" placeholder="e.g., Rent, Car Payment" />
        </div>
        <div>
          <label className="text-xs text-gray-500 uppercase block mb-1">Amount {form.frequency === 'split' ? '(Total Monthly)' : ''}</label>
          <input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white font-mono" placeholder="0.00" step="0.01" min="0" />
        </div>
        <div>
          <label className="text-xs text-gray-500 uppercase block mb-1">Category</label>
          <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white">
            {categories.map(cat => <option key={cat.value} value={cat.value}>{cat.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 uppercase block mb-1">Frequency</label>
          <select value={form.frequency} onChange={e => setForm({ ...form, frequency: e.target.value as Expense['frequency'] })} className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white">
            <option value="weekly">Weekly</option>
            <option value="biweekly">Every 2 weeks</option>
            <option value="semimonthly">Twice a month (same amount)</option>
            <option value="monthly">Monthly</option>
            <option value="bimonthly">Every 2 months</option>
            <option value="quarterly">Quarterly (every 3 months)</option>
            <option value="split">Split Monthly (different amounts)</option>
          </select>
        </div>

        {/* Split Configuration */}
        {form.frequency === 'split' && (
          <div className="border border-cyan-500/30 rounded-lg overflow-hidden">
            <div className="p-3 bg-cyan-500/10 border-b border-cyan-500/30">
              <h3 className="font-medium text-cyan-400">Split Configuration</h3>
              <p className="text-xs text-gray-400 mt-1">Two payments per month with different amounts</p>
            </div>
            
            <div className="p-3 space-y-4">
              {/* First Payment */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 uppercase block mb-1">First Payment Day</label>
                  <select
                    value={firstDay}
                    onChange={e => setFirstDay(e.target.value)}
                    className="w-full p-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                  >
                    {Array.from({ length: 28 }, (_, i) => i + 1).map(day => (
                      <option key={day} value={day}>{day}{day === 1 ? 'st' : day === 2 ? 'nd' : day === 3 ? 'rd' : 'th'}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase block mb-1">First Amount</label>
                  <input
                    type="number"
                    value={firstAmount}
                    onChange={e => setFirstAmount(e.target.value)}
                    className="w-full p-2 bg-gray-800 border border-gray-700 rounded-lg text-white font-mono"
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    max={total}
                  />
                </div>
              </div>

              {/* Second Payment */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 uppercase block mb-1">Second Payment Day</label>
                  <select
                    value={secondDay}
                    onChange={e => setSecondDay(e.target.value)}
                    className="w-full p-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                  >
                    {Array.from({ length: 28 }, (_, i) => i + 1).map(day => (
                      <option key={day} value={day}>{day}{day === 1 ? 'st' : day === 2 ? 'nd' : day === 3 ? 'rd' : 'th'}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase block mb-1">Second Amount</label>
                  <div className="p-2 bg-gray-900 border border-gray-700 rounded-lg text-white font-mono">
                    {formatCurrency(second)}
                  </div>
                </div>
              </div>

              {/* Summary */}
              {total > 0 && (
                <div className="p-3 bg-gray-800 rounded-lg space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Day {firstDay}:</span>
                    <span className="text-cyan-400 font-mono">{formatCurrency(first)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Day {secondDay}:</span>
                    <span className="text-cyan-400 font-mono">{formatCurrency(second)}</span>
                  </div>
                  <div className="flex justify-between border-t border-gray-700 pt-2">
                    <span className="text-white font-medium">Monthly Total:</span>
                    <span className="text-white font-mono font-bold">{formatCurrency(total)}</span>
                  </div>
                </div>
              )}

              {second < 0 && (
                <div className="p-2 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                  First amount exceeds total. Please adjust.
                </div>
              )}
            </div>
          </div>
        )}

        {form.frequency !== 'split' && (
          <div>
            <label className="text-xs text-gray-500 uppercase block mb-1">Start/Next Date</label>
            <input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white" />
          </div>
        )}

        {form.frequency === 'split' && (
          <div>
            <label className="text-xs text-gray-500 uppercase block mb-1">Start Month</label>
            <input type="month" value={form.startDate.substring(0, 7)} onChange={e => setForm({ ...form, startDate: e.target.value + '-01' })} className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white" />
            <p className="text-xs text-gray-500 mt-1">Payments will begin in this month</p>
          </div>
        )}

        {/* Optional end date — the duration / last date this recurring expense occurs */}
        <div>
          <label className="text-xs text-gray-500 uppercase block mb-1">Ends On (optional)</label>
          <div className="flex gap-2">
            <input
              type="date"
              value={endDate}
              min={form.startDate}
              onChange={e => setEndDate(e.target.value)}
              className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white"
            />
            {endDate && (
              <button
                type="button"
                onClick={() => setEndDate('')}
                className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 rounded-lg text-sm whitespace-nowrap"
              >
                Clear
              </button>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {endDate ? 'Nothing projects after this date; past entries stay visible.' : 'Leave blank to continue indefinitely.'}
          </p>
          {endBeforeStart && (
            <p className="text-xs text-red-400 mt-1">End date can&apos;t be before the start date.</p>
          )}
        </div>

        {/* Optional balance / payoff tracking — monthly only (payoff engine is monthly) */}
        {form.frequency === 'monthly' && (
          <div className="border border-purple-500/30 rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setTrackBalance(!trackBalance)}
              className="w-full flex items-center justify-between p-3 bg-purple-500/10 border-b border-purple-500/30 text-left"
            >
              <div>
                <h3 className="font-medium text-purple-400">Track a balance / project payoff</h3>
                <p className="text-xs text-gray-400 mt-1">Optional — like a credit card. The Amount above is the monthly payment.</p>
              </div>
              <span className={`text-2xl leading-none ${trackBalance ? 'text-purple-400' : 'text-gray-600'}`}>
                {trackBalance ? '−' : '+'}
              </span>
            </button>

            {trackBalance && (
              <div className="p-3 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 uppercase block mb-1">Current Balance</label>
                    <input
                      type="number"
                      value={currentBalance}
                      onChange={e => setCurrentBalance(e.target.value)}
                      className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white font-mono"
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 uppercase block mb-1">As of Date</label>
                    <input
                      type="date"
                      value={balanceAsOfDate}
                      onChange={e => setBalanceAsOfDate(e.target.value)}
                      className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase block mb-1">APR % (0 if none)</label>
                  <input
                    type="number"
                    value={apr}
                    onChange={e => setApr(e.target.value)}
                    className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white font-mono"
                    step="0.01"
                    min="0"
                  />
                </div>

                {payoffCalc && (
                  <div className={`p-3 rounded-lg border ${payoffCalc.months < 0 ? 'bg-red-500/10 border-red-500/30' : 'bg-purple-500/10 border-purple-500/30'}`}>
                    {payoffCalc.months < 0 ? (
                      <div className="text-red-400 text-sm">
                        <div className="font-semibold">Payment too low</div>
                        <div className="text-xs opacity-75">The monthly Amount must exceed the interest charge to pay this off.</div>
                      </div>
                    ) : (
                      <div className="flex justify-between items-center">
                        <div>
                          <div className="text-xs text-purple-400 uppercase">Payoff Time</div>
                          <div className="font-mono text-xl font-bold text-purple-300">{payoffCalc.months} mo</div>
                          <div className="text-xs text-purple-400/70">({Math.floor(payoffCalc.months / 12)}y {payoffCalc.months % 12}m)</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-purple-400 uppercase">Total Cost</div>
                          <div className="font-mono text-lg font-semibold text-purple-300">{formatCurrency(payoffCalc.totalPaid)}</div>
                          {payoffCalc.totalInterest > 0 && (
                            <div className="text-xs text-purple-400/70">incl. {formatCurrency(payoffCalc.totalInterest)} interest</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      <div className="flex justify-end gap-3 p-4 border-t border-gray-800">
        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-800 text-white rounded-lg">Cancel</button>
        <button 
          type="button" 
          onClick={handleSave} 
          disabled={!form.name || !form.amount || endBeforeStart || (form.frequency === 'split' && second < 0) || (trackBalance && form.frequency === 'monthly' && (!currentBalance || (payoffCalc?.months ?? 0) <= 0))}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium disabled:opacity-50"
        >
          Save
        </button>
      </div>
    </div>
  );
}
