'use client';

import { useState, useMemo } from 'react';
import { DayEvent, Income, Expense, InstanceOverride } from '@/lib/types';
import { projectPayoff } from '@/lib/payoff';

const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

// Months to payoff for a balance paid down at this expense's own frequency.
const calculatePayoff = (balance: number, payment: number, apr: number, frequency: string): { months: number; totalInterest: number } => {
  if (balance <= 0) return { months: 0, totalInterest: 0 };
  const projection = projectPayoff(balance, [payment], apr, frequency);
  if (!projection) return { months: -1, totalInterest: 0 };
  return { months: projection.months, totalInterest: projection.totalInterest };
};

interface InstanceEditFormProps {
  event: DayEvent;
  item: Income | Expense;
  onSave: (override: InstanceOverride) => void;
  onRemoveOverride: () => void;
  onEditRecurring: () => void;
  // Set the whole series' end date (generic optional "duration") — undefined clears it
  onSetDuration: (endDate: string | undefined) => void;
  onClose: () => void;
  // Optional: balance remaining at this instance, for balance-tracked expenses
  trackedBalance?: number;
}

export default function InstanceEditForm({ event, item, onSave, onRemoveOverride, onEditRecurring, onSetDuration, onClose, trackedBalance }: InstanceEditFormProps) {
  const existingOverride = item.overrides?.find(o => o.originalDate === (event.originalDate || event.instanceDate));
  
  const [newDate, setNewDate] = useState(existingOverride?.split ? existingOverride.newDate || event.instanceDate : event.instanceDate);
  const [newAmount, setNewAmount] = useState(
    existingOverride?.split 
      ? (existingOverride.split.firstAmount + existingOverride.split.secondAmount).toString()
      : event.isSkipped ? item.amount.toString() : event.amount.toString()
  );
  const [note, setNote] = useState(existingOverride?.note || '');
  
  // Split state
  const [enableSplit, setEnableSplit] = useState(!!existingOverride?.split);
  const [splitFirstAmount, setSplitFirstAmount] = useState(
    existingOverride?.split?.firstAmount?.toString() || Math.floor(event.amount / 2).toString()
  );
  const [splitSecondDate, setSplitSecondDate] = useState(existingOverride?.split?.secondDate || '');

  // Generic optional end date for the WHOLE series (e.g., a utility bill that ends when you move)
  const [endDate, setEndDate] = useState(item.endDate || '');

  const isRecurring = item.frequency !== 'once';
  const originalDate = event.originalDate || event.instanceDate;
  const isSkipped = event.isSkipped;
  const isSplitExpense = (item as Expense).frequency === 'split';
  
  // Any expense can carry a balance (credit card, loan, or a converted expense)
  const expense = item as Expense;
  const cc = expense.creditCard;
  const isCreditCard = !!cc;

  // Check if this is an expense that can be split (food, entertainment, other categories)
  const canSplit = event.type === 'expense' && isRecurring && !isSkipped && !isSplitExpense && !isCreditCard &&
    ['food', 'entertainment', 'other'].includes(expense.category || '');

  const totalAmount = parseFloat(newAmount) || event.amount;
  const firstAmount = parseFloat(splitFirstAmount) || 0;
  const secondAmount = totalAmount - firstAmount;

  // Duration (whole-series end date) guards
  const endBeforeStart = endDate !== '' && !!item.startDate && endDate < item.startDate;
  const durationChanged = (endDate || undefined) !== (item.endDate || undefined);
  const durationLabel = !endDate && item.endDate ? 'Remove end date' : 'Save end date';

  // Payoff impact of changing this single payment
  const ccProjection = useMemo(() => {
    if (!isCreditCard || !cc || !trackedBalance) return null;

    const balance = trackedBalance;
    const apr = cc.apr || 0;
    const frequency = expense.frequency;
    const regularPayment = item.amount;
    const adjustedPayment = parseFloat(newAmount) || regularPayment;

    // Calculate with regular payment
    const regularPayoff = calculatePayoff(balance, regularPayment, apr, frequency);

    // Calculate with adjusted payment (just this one payment different)
    // For simplicity, if this payment is higher, subtract the extra from balance first
    const extraPayment = adjustedPayment - regularPayment;
    const adjustedBalance = Math.max(0, balance - extraPayment);
    const adjustedPayoff = calculatePayoff(adjustedBalance, regularPayment, apr, frequency);

    const monthsSaved = regularPayoff.months - adjustedPayoff.months;
    const interestSaved = regularPayoff.totalInterest - adjustedPayoff.totalInterest;

    return {
      balance,
      regularPayment,
      adjustedPayment,
      regularMonths: regularPayoff.months,
      adjustedMonths: adjustedPayoff.months,
      monthsSaved,
      interestSaved,
      apr
    };
  }, [isCreditCard, cc, expense.frequency, trackedBalance, item.amount, newAmount]);

  const handleSave = () => {
    const override: InstanceOverride = {
      originalDate,
      newDate: newDate !== originalDate ? newDate : originalDate,
      newAmount: parseFloat(newAmount) !== event.amount ? parseFloat(newAmount) : undefined,
      note: note || undefined
    };
    
    // Add split if enabled
    if (enableSplit && splitSecondDate && firstAmount > 0 && secondAmount > 0) {
      override.split = {
        firstAmount: firstAmount,
        secondAmount: secondAmount,
        secondDate: splitSecondDate
      };
    }
    
    // If restoring from skip, we need newDate to be set
    if (isSkipped) {
      override.newDate = newDate;
    }
    
    // Only save if something changed or we're restoring
    if (override.newDate || override.newAmount !== undefined || override.note || override.split || isSkipped) {
      onSave(override);
    } else {
      onClose();
    }
  };

  const handleSkip = () => {
    onSave({
      originalDate,
      newDate: 'SKIPPED',
      note: 'Skipped'
    });
  };

  const handleRestore = () => {
    onSave({
      originalDate,
      newDate: originalDate,
      newAmount: event.amount,
      note: 'Restored'
    });
  };

  return (
    <div>
      <div className="p-4 space-y-4">
        {/* Header info */}
        <div className={`p-3 rounded-lg ${isSkipped ? 'bg-gray-600/50 border border-gray-500' : isCreditCard ? 'bg-purple-500/10 border border-purple-500/30' : 'bg-gray-800'}`}>
          <div className="font-medium text-lg">
            {isSkipped && <span className="mr-2">⊘</span>}
            <span className={isSkipped ? 'line-through text-gray-400' : ''}>{event.name}</span>
          </div>
          <div className="text-sm text-gray-400">
            {isCreditCard
              ? (expense.category === 'credit_card' ? 'Credit card payment' : 'Balance payment')
              : isRecurring ? (isSplitExpense ? 'Split payment' : 'Recurring') : 'One-time'} {event.type}
            {event.splitPart && <span className="ml-1 text-cyan-400">(Part {event.splitPart} of 2)</span>}
            {isSkipped && <span className="ml-2 text-gray-500 font-semibold">(SKIPPED)</span>}
            {event.isOverride && !isSkipped && <span className="ml-2 text-yellow-400">(Modified)</span>}
          </div>
          <div className="text-sm text-gray-500 mt-1">
            Default amount: {formatCurrency(event.amount)}
          </div>
        </div>

        {/* Remaining balance + payoff outlook */}
        {isCreditCard && ccProjection && (
          <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-purple-400">Balance at this point:</span>
              <span className="font-mono font-semibold text-purple-300">{formatCurrency(ccProjection.balance)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-purple-400">Months to payoff:</span>
              <span className="font-mono font-semibold text-purple-300">
                {ccProjection.regularMonths > 0 ? `${ccProjection.regularMonths} months` : 'Never'}
              </span>
            </div>
            {ccProjection.apr > 0 && (
              <div className="text-xs text-purple-400/70">
                APR: {ccProjection.apr}%
              </div>
            )}
          </div>
        )}

        {isSkipped && (
          <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <div className="text-sm text-yellow-400">
              This {event.type} was skipped for this date. You can restore it or keep it skipped.
            </div>
          </div>
        )}

        {isRecurring && (
          <>
            {/* Date override */}
            <div>
              <label className="text-xs text-gray-500 uppercase block mb-1">
                {isSkipped ? 'Restore to date' : enableSplit ? 'First payment date' : 'Date for this instance'}
              </label>
              <input 
                type="date" 
                value={newDate} 
                onChange={e => setNewDate(e.target.value)} 
                className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white" 
              />
              {newDate !== originalDate && (
                <div className="text-xs text-yellow-400 mt-1">
                  Originally scheduled: {new Date(originalDate + 'T12:00:00').toLocaleDateString()}
                </div>
              )}
            </div>

            {/* Amount override */}
            <div>
              <label className="text-xs text-gray-500 uppercase block mb-1">
                {isSkipped ? 'Restore with amount' : enableSplit ? 'Total amount to split' : isCreditCard ? 'Payment amount' : 'Amount for this instance'}
              </label>
              <input 
                type="number" 
                value={newAmount} 
                onChange={e => setNewAmount(e.target.value)} 
                className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white font-mono" 
                step="0.01" 
                min="0" 
              />
              {parseFloat(newAmount) !== event.amount && (
                <div className="text-xs text-yellow-400 mt-1">
                  Default: {formatCurrency(event.amount)}
                </div>
              )}
            </div>

            {/* Credit Card Impact Preview */}
            {isCreditCard && ccProjection && parseFloat(newAmount) !== ccProjection.regularPayment && (
              <div className={`p-3 rounded-lg border ${ccProjection.monthsSaved > 0 ? 'bg-green-500/10 border-green-500/30' : ccProjection.monthsSaved < 0 ? 'bg-red-500/10 border-red-500/30' : 'bg-gray-800 border-gray-700'}`}>
                <div className="text-sm font-medium mb-2">
                  {ccProjection.monthsSaved > 0 ? '🎉 Impact of extra payment:' : ccProjection.monthsSaved < 0 ? '⚠️ Impact of reduced payment:' : 'Payment impact:'}
                </div>
                
                {ccProjection.adjustedMonths > 0 ? (
                  <>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-400">New payoff time:</span>
                      <span className={`font-mono font-semibold ${ccProjection.monthsSaved > 0 ? 'text-green-400' : ccProjection.monthsSaved < 0 ? 'text-red-400' : 'text-gray-300'}`}>
                        {ccProjection.adjustedMonths} months
                      </span>
                    </div>
                    
                    {ccProjection.monthsSaved !== 0 && (
                      <div className="flex justify-between items-center mt-1">
                        <span className="text-sm text-gray-400">
                          {ccProjection.monthsSaved > 0 ? 'Months saved:' : 'Months added:'}
                        </span>
                        <span className={`font-mono font-semibold ${ccProjection.monthsSaved > 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {Math.abs(ccProjection.monthsSaved)} months
                        </span>
                      </div>
                    )}
                    
                    {ccProjection.interestSaved > 0 && (
                      <div className="flex justify-between items-center mt-1">
                        <span className="text-sm text-gray-400">Interest saved:</span>
                        <span className="font-mono font-semibold text-green-400">
                          {formatCurrency(ccProjection.interestSaved)}
                        </span>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-red-400 text-sm">
                    Payment too low to pay off balance
                  </div>
                )}
              </div>
            )}

            {/* Split Payment Section */}
            {canSplit && (
              <div className="border border-gray-700 rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => setEnableSplit(!enableSplit)}
                  className={`w-full p-3 flex items-center justify-between ${enableSplit ? 'bg-cyan-500/10' : 'bg-gray-800'}`}
                >
                  <span className="font-medium">Split This Instance</span>
                  <span className={`text-xs px-2 py-1 rounded ${enableSplit ? 'bg-cyan-500 text-white' : 'bg-gray-700 text-gray-400'}`}>
                    {enableSplit ? 'ON' : 'OFF'}
                  </span>
                </button>
                
                {enableSplit && (
                  <div className="p-3 space-y-3 bg-gray-800/50">
                    <div className="text-xs text-gray-400">
                      Split this payment across two dates for this month only.
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-gray-500 uppercase block mb-1">First Payment</label>
                        <input 
                          type="number" 
                          value={splitFirstAmount} 
                          onChange={e => setSplitFirstAmount(e.target.value)} 
                          className="w-full p-2 bg-gray-800 border border-gray-700 rounded-lg text-white font-mono text-sm" 
                          step="0.01" 
                          min="0"
                          max={totalAmount}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 uppercase block mb-1">Second Payment</label>
                        <div className="p-2 bg-gray-900 border border-gray-700 rounded-lg text-white font-mono text-sm">
                          {formatCurrency(secondAmount)}
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <label className="text-xs text-gray-500 uppercase block mb-1">Second Payment Date</label>
                      <input 
                        type="date" 
                        value={splitSecondDate} 
                        onChange={e => setSplitSecondDate(e.target.value)} 
                        className="w-full p-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm" 
                      />
                    </div>
                    
                    {splitSecondDate && secondAmount > 0 && (
                      <div className="p-2 bg-gray-900 rounded-lg text-xs space-y-1">
                        <div className="flex justify-between">
                          <span className="text-gray-400">{new Date(newDate + 'T12:00:00').toLocaleDateString()}:</span>
                          <span className="text-cyan-400 font-mono">{formatCurrency(firstAmount)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">{new Date(splitSecondDate + 'T12:00:00').toLocaleDateString()}:</span>
                          <span className="text-cyan-400 font-mono">{formatCurrency(secondAmount)}</span>
                        </div>
                        <div className="flex justify-between border-t border-gray-700 pt-1 mt-1">
                          <span className="text-gray-300">Total:</span>
                          <span className="text-white font-mono">{formatCurrency(totalAmount)}</span>
                        </div>
                      </div>
                    )}
                    
                    {secondAmount <= 0 && (
                      <div className="p-2 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                        First amount must be less than total.
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Note */}
            <div>
              <label className="text-xs text-gray-500 uppercase block mb-1">Note (optional)</label>
              <input
                type="text"
                value={note}
                onChange={e => setNote(e.target.value)}
                className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white"
                placeholder={isSkipped ? 'e.g., Restored - paying late' : isCreditCard ? 'e.g., Bonus payment from gift' : 'e.g., Paying early this month'}
              />
            </div>

            {/* Duration — generic optional end date for the WHOLE series, not just this date */}
            <div className="border border-gray-700 rounded-lg p-3 space-y-2">
              <label className="text-xs text-gray-500 uppercase block">Ends On (optional)</label>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={endDate}
                  min={item.startDate}
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
              <p className="text-xs text-gray-500">
                Applies to the whole {event.type}, not just this date — e.g., a bill that ends when you move. Leave blank to continue indefinitely.
              </p>
              {endBeforeStart && (
                <p className="text-xs text-red-400">End date can&apos;t be before the start date.</p>
              )}
              <button
                type="button"
                onClick={() => onSetDuration(endDate || undefined)}
                disabled={endBeforeStart || !durationChanged}
                className="w-full px-4 py-2 bg-blue-500/10 text-blue-400 rounded-lg text-sm hover:bg-blue-500/20 disabled:opacity-50"
              >
                {durationLabel}
              </button>
            </div>
          </>
        )}

        {/* Actions */}
        <div className="pt-2 space-y-2">
          {isRecurring && !isSkipped && (
            <button 
              type="button" 
              onClick={handleSkip}
              className="w-full px-4 py-2 bg-red-500/10 text-red-400 rounded-lg text-sm hover:bg-red-500/20"
            >
              Skip this instance
            </button>
          )}

          {isSkipped && (
            <button 
              type="button" 
              onClick={handleRestore}
              className="w-full px-4 py-2 bg-green-500/10 text-green-400 rounded-lg text-sm hover:bg-green-500/20"
            >
              Quick restore (default date & amount)
            </button>
          )}
          
          {event.isOverride && !isSkipped && (
            <button 
              type="button" 
              onClick={onRemoveOverride}
              className="w-full px-4 py-2 bg-gray-700 text-gray-300 rounded-lg text-sm hover:bg-gray-600"
            >
              Reset to default
            </button>
          )}
          
          <button 
            type="button" 
            onClick={onEditRecurring}
            className="w-full px-4 py-2 bg-blue-500/10 text-blue-400 rounded-lg text-sm hover:bg-blue-500/20"
          >
            Edit all future {event.type === 'income' ? 'income' : 'payments'}
          </button>
        </div>
      </div>

      <div className="flex justify-end gap-3 p-4 border-t border-gray-800">
        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-800 text-white rounded-lg">
          Cancel
        </button>
        {isRecurring && (
          <button 
            type="button" 
            onClick={handleSave} 
            disabled={enableSplit && (secondAmount <= 0 || !splitSecondDate)}
            className={`px-4 py-2 rounded-lg font-medium disabled:opacity-50 ${isSkipped ? 'bg-green-600 text-white' : 'bg-blue-600 text-white'}`}
          >
            {isSkipped ? 'Restore & Save' : 'Save Changes'}
          </button>
        )}
      </div>
    </div>
  );
}
