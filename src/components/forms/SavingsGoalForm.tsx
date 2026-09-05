'use client';

import { useMemo, useState } from 'react';
import { SavingsGoal } from '@/lib/types';
import { projectGoal, requiredMonthlyFor } from '@/lib/goals';

// What the cash-flow walk says about a candidate monthly amount. Mirrors the
// app's CashFlowFit so the form can show "fits" / "too tight" without knowing
// how the projection works.
export interface GoalFit {
  lowest: number;
  year: number;
  month: number;
  breachesFloor: boolean;
  goesNegative: boolean;
}

interface SavingsGoalFormProps {
  goal: SavingsGoal | null;
  inBudget: boolean; // a linked Savings expense already exists in the budget on screen
  floorThreshold: number;
  ceiling: number; // the most per month the projection can spare above the floor
  checkFit: (monthly: number, startDate: string) => GoalFit | null;
  onSave: (goal: Omit<SavingsGoal, 'id'>, addToBudget: boolean) => void;
  onClose: () => void;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

const formatMonthYear = (dateStr: string) =>
  new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

const formatDate = (dateStr: string) =>
  new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Six months out — a sensible default for "buy by".
const defaultTargetDate = () => {
  const d = new Date();
  d.setMonth(d.getMonth() + 6);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export default function SavingsGoalForm({ goal, inBudget, floorThreshold, ceiling, checkFit, onSave, onClose }: SavingsGoalFormProps) {
  const today = todayStr();
  const [form, setForm] = useState({
    name: goal?.name || '',
    targetAmount: goal?.targetAmount?.toString() || '',
    savedSoFar: goal?.savedSoFar?.toString() || '',
    savedAsOfDate: goal?.savedAsOfDate || today,
    planBy: goal?.planBy || 'amount' as 'amount' | 'date',
    monthlyAmount: goal?.monthlyAmount?.toString() || '',
    targetDate: goal?.targetDate || defaultTargetDate(),
    startDate: goal?.startDate || today,
    note: goal?.note || '',
  });
  const [addToBudget, setAddToBudget] = useState(goal ? inBudget : true);

  const targetAmount = parseFloat(form.targetAmount) || 0;
  const savedSoFar = parseFloat(form.savedSoFar) || 0;
  const typedMonthly = parseFloat(form.monthlyAmount) || 0;

  // The goal as it would be saved, with the derived number filled in: planning
  // by date, the monthly amount is whatever it takes to make the date.
  const draft = useMemo((): SavingsGoal => {
    const base: SavingsGoal = {
      id: goal?.id || 'draft',
      name: form.name,
      targetAmount,
      savedSoFar,
      savedAsOfDate: form.savedAsOfDate,
      // Past contributions are projected at the amount that was planned then,
      // so editing an existing goal doesn't rewrite what's already been saved.
      monthlyAmount: goal?.monthlyAmount || typedMonthly,
      startDate: form.startDate,
      targetDate: form.planBy === 'date' ? form.targetDate : undefined,
      planBy: form.planBy,
      note: form.note || undefined,
    };
    if (form.planBy === 'date') {
      const required = requiredMonthlyFor(base, form.targetDate, today);
      return { ...base, monthlyAmount: required ?? 0 };
    }
    return { ...base, monthlyAmount: typedMonthly };
  }, [goal, form, targetAmount, savedSoFar, typedMonthly, today]);

  const outlook = useMemo(() => (targetAmount > 0 ? projectGoal(draft, today) : null), [draft, targetAmount, today]);
  const dateTooSoon = form.planBy === 'date' && targetAmount > 0 && !outlook?.isFunded
    && requiredMonthlyFor(draft, form.targetDate, today) === null;

  const fit = useMemo(
    () => (draft.monthlyAmount > 0 && !outlook?.isFunded ? checkFit(draft.monthlyAmount, form.startDate) : null),
    [draft.monthlyAmount, form.startDate, outlook?.isFunded, checkFit]
  );

  const canSave = form.name.trim() !== '' && targetAmount > 0 && form.startDate !== '' && (
    form.planBy === 'amount' ? typedMonthly > 0 : !dateTooSoon
  );

  const handleSave = () => {
    if (!canSave) return;
    const { id, ...rest } = draft;
    void id;
    onSave({ ...rest, name: form.name.trim() }, addToBudget);
  };

  const inputClass = 'w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white';

  return (
    <div>
      <div className="p-4 space-y-4">
        <div>
          <label className="text-xs text-gray-500 uppercase block mb-1">What are you buying?</label>
          <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={inputClass} placeholder="e.g., Used car, Lawn mower, New roof" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 uppercase block mb-1">Price</label>
            <input type="number" value={form.targetAmount} onChange={e => setForm({ ...form, targetAmount: e.target.value })} className={`${inputClass} font-mono`} placeholder="0.00" step="0.01" min="0" />
          </div>
          <div>
            <label className="text-xs text-gray-500 uppercase block mb-1">Already saved</label>
            <input type="number" value={form.savedSoFar} onChange={e => setForm({ ...form, savedSoFar: e.target.value })} className={`${inputClass} font-mono`} placeholder="0.00" step="0.01" min="0" />
          </div>
        </div>

        {savedSoFar > 0 && (
          <div>
            <label className="text-xs text-gray-500 uppercase block mb-1">Saved as of</label>
            <input type="date" value={form.savedAsOfDate} onChange={e => setForm({ ...form, savedAsOfDate: e.target.value })} className={inputClass} />
            <div className="text-xs text-gray-500 mt-1">Contributions dated on or before this day are counted inside that figure.</div>
          </div>
        )}

        {/* Which number you know, and which one the app works out */}
        <div>
          <label className="text-xs text-gray-500 uppercase block mb-1">Plan by</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setForm({ ...form, planBy: 'amount' })}
              className={`p-2 rounded-lg border text-left ${form.planBy === 'amount' ? 'bg-lime-500/20 border-lime-500/50' : 'bg-gray-800 border-gray-700'}`}
            >
              <div className="text-sm font-medium">Monthly amount</div>
              <div className="text-xs text-gray-400">Tell me when I can buy it.</div>
            </button>
            <button
              type="button"
              onClick={() => setForm({ ...form, planBy: 'date' })}
              className={`p-2 rounded-lg border text-left ${form.planBy === 'date' ? 'bg-lime-500/20 border-lime-500/50' : 'bg-gray-800 border-gray-700'}`}
            >
              <div className="text-sm font-medium">Buy-by date</div>
              <div className="text-xs text-gray-400">Tell me what to save each month.</div>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {form.planBy === 'amount' ? (
            <div>
              <label className="text-xs text-gray-500 uppercase block mb-1">Save per month</label>
              <input type="number" value={form.monthlyAmount} onChange={e => setForm({ ...form, monthlyAmount: e.target.value })} className={`${inputClass} font-mono`} placeholder="0.00" step="0.01" min="0" />
            </div>
          ) : (
            <div>
              <label className="text-xs text-gray-500 uppercase block mb-1">Buy by</label>
              <input type="date" value={form.targetDate} onChange={e => setForm({ ...form, targetDate: e.target.value })} className={inputClass} />
            </div>
          )}
          <div>
            <label className="text-xs text-gray-500 uppercase block mb-1">First contribution</label>
            <input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} className={inputClass} />
          </div>
        </div>

        {/* What the cash flow can actually spare */}
        {form.planBy === 'amount' && (
          <div className="text-xs">
            {ceiling > 0 ? (
              <span className="text-gray-400">
                Your projection can spare about{' '}
                <button
                  type="button"
                  onClick={() => setForm({ ...form, monthlyAmount: String(ceiling) })}
                  className="font-mono text-green-400 hover:text-green-300 underline"
                >
                  {formatCurrency(ceiling)}
                </button>
                {' '}a month before some month drops below your {formatCurrency(floorThreshold)} floor.
              </span>
            ) : (
              <span className="text-yellow-400/80">
                Your projection has no room above the {formatCurrency(floorThreshold)} floor in the next year — any monthly saving will make some month tighter.
              </span>
            )}
          </div>
        )}

        {/* The answer — once there's a number to answer with */}
        {outlook && (form.planBy === 'date' || typedMonthly > 0) && (
          <div className="p-3 bg-lime-500/5 border border-lime-500/20 rounded-lg space-y-2">
            {outlook.isFunded ? (
              <div className="text-sm text-green-400 font-medium">Already fully funded — you can buy it now.</div>
            ) : dateTooSoon ? (
              <div className="text-sm text-yellow-400">
                No contribution date falls before {formatDate(form.targetDate)}. Pick a later date, or move the first contribution earlier.
              </div>
            ) : form.planBy === 'date' ? (
              <>
                <div className="text-sm">
                  Save <span className="font-mono text-lime-300 font-semibold">{formatCurrency(draft.monthlyAmount)}</span> a month
                  to have {formatCurrency(targetAmount)} by <span className="text-white">{formatDate(form.targetDate)}</span>.
                </div>
                <div className="text-xs text-gray-400">
                  {outlook.contributionsLeft} contribution{outlook.contributionsLeft === 1 ? '' : 's'}, {formatCurrency(outlook.remaining)} still to go.
                </div>
              </>
            ) : (
              <>
                <div className="text-sm">
                  Ready <span className="text-lime-300 font-semibold">{outlook.readyDate ? formatDate(outlook.readyDate) : '—'}</span>
                  {outlook.monthsAway >= 0 && (
                    <span className="text-gray-400"> — {outlook.monthsAway === 0 ? 'this month' : `${outlook.monthsAway} month${outlook.monthsAway === 1 ? '' : 's'} away`}</span>
                  )}
                </div>
                <div className="text-xs text-gray-400">
                  {outlook.contributionsLeft} contribution{outlook.contributionsLeft === 1 ? '' : 's'} of {formatCurrency(draft.monthlyAmount)}
                  {outlook.lastContribution < draft.monthlyAmount - 0.005 && ` (last one ${formatCurrency(outlook.lastContribution)})`}
                  , {formatCurrency(outlook.remaining)} still to go.
                </div>
              </>
            )}

            {fit && (
              fit.goesNegative ? (
                <div className="text-xs text-red-400">
                  At {formatCurrency(draft.monthlyAmount)} a month your balance goes negative in {new Date(fit.year, fit.month).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} ({formatCurrency(fit.lowest)}).
                </div>
              ) : fit.breachesFloor ? (
                <div className="text-xs text-yellow-400">
                  At {formatCurrency(draft.monthlyAmount)} a month, {new Date(fit.year, fit.month).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} dips to {formatCurrency(fit.lowest)} — under your {formatCurrency(floorThreshold)} floor.
                </div>
              ) : (
                <div className="text-xs text-green-400/80">
                  Fits: the tightest month in the next year is {new Date(fit.year, fit.month).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} at {formatCurrency(fit.lowest)}, above your floor.
                </div>
              )
            )}
          </div>
        )}

        <div>
          <label className="text-xs text-gray-500 uppercase block mb-1">Note (optional)</label>
          <input type="text" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} className={inputClass} placeholder="e.g., Replace the old one before spring" />
        </div>

        <label className="flex items-start gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={addToBudget} onChange={e => setAddToBudget(e.target.checked)} className="mt-0.5" />
          <span>
            <span className="text-gray-200">Put the monthly contribution in my budget</span>
            <span className="block text-xs text-gray-500">
              Adds a monthly Savings expense{outlook?.readyDate && !outlook.isFunded ? ` through ${formatMonthYear(outlook.readyDate)}` : ''} so the projection shows the money leaving. The purchase itself comes out of what you&apos;ve set aside.
            </span>
          </span>
        </label>
      </div>

      <div className="flex justify-end gap-3 p-4 border-t border-gray-800">
        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-800 text-white rounded-lg">Cancel</button>
        <button type="button" onClick={handleSave} disabled={!canSave} className="px-4 py-2 bg-lime-600 text-white rounded-lg font-medium disabled:opacity-50">
          {goal ? 'Save' : 'Add goal'}
        </button>
      </div>
    </div>
  );
}
