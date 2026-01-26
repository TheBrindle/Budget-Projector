'use client';

import { useState, useMemo } from 'react';
import { Income, ScheduledPayment } from '@/lib/types';

interface GigPaymentFormProps {
  gigSources: Income[];  // All gig income sources
  selectedSourceId?: string;  // Pre-selected source (for quick-log from source card)
  payment?: ScheduledPayment;  // For editing existing payment
  onSave: (incomeId: string, payment: Omit<ScheduledPayment, 'id'>) => void;
  onClose: () => void;
}

// Helper to get next occurrence of a weekday
const getNextPayoutDay = (payoutDay: string, fromDate?: Date): string => {
  const dayMap: Record<string, number> = {
    sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
    thursday: 4, friday: 5, saturday: 6
  };

  const targetDay = dayMap[payoutDay];
  if (targetDay === undefined) {
    // No payout day set, return today
    const today = fromDate || new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  }

  const today = fromDate || new Date();
  const currentDay = today.getDay();
  let daysUntil = targetDay - currentDay;

  // If target day is today or in the past this week, go to next week
  if (daysUntil <= 0) {
    daysUntil += 7;
  }

  const nextDate = new Date(today);
  nextDate.setDate(today.getDate() + daysUntil);

  return `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}-${String(nextDate.getDate()).padStart(2, '0')}`;
};

export default function GigPaymentForm({ gigSources, selectedSourceId, payment, onSave, onClose }: GigPaymentFormProps) {
  // Determine initial date based on selected source's payout day
  const getInitialDate = () => {
    if (payment?.date) return payment.date;

    const source = gigSources.find(s => s.id === selectedSourceId);
    if (source?.payoutDay) {
      return getNextPayoutDay(source.payoutDay);
    }

    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  };

  const [form, setForm] = useState({
    sourceId: selectedSourceId || gigSources[0]?.id || '',
    amount: payment?.amount?.toString() || '',
    date: getInitialDate(),
    note: payment?.note || ''
  });

  // When source changes, update date if the new source has a payout day
  const handleSourceChange = (newSourceId: string) => {
    const source = gigSources.find(s => s.id === newSourceId);
    let newDate = form.date;

    // Only auto-update date if not editing an existing payment
    if (!payment && source?.payoutDay) {
      newDate = getNextPayoutDay(source.payoutDay);
    }

    setForm({ ...form, sourceId: newSourceId, date: newDate });
  };

  const selectedSource = useMemo(() =>
    gigSources.find(s => s.id === form.sourceId),
    [gigSources, form.sourceId]
  );

  const handleSave = () => {
    if (!form.sourceId || !form.amount || !form.date) return;
    onSave(form.sourceId, {
      date: form.date,
      amount: parseFloat(form.amount),
      note: form.note || undefined
    });
  };

  return (
    <div>
      <div className="p-4 space-y-4">
        {gigSources.length > 1 && (
          <div>
            <label className="text-xs text-gray-500 uppercase block mb-1">Gig Source</label>
            <select
              value={form.sourceId}
              onChange={e => handleSourceChange(e.target.value)}
              className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white"
            >
              {gigSources.map(source => (
                <option key={source.id} value={source.id}>
                  {source.name}{source.payoutDay ? ` (${source.payoutDay}s)` : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        {gigSources.length === 1 && (
          <div className="p-3 bg-gray-800 rounded-lg">
            <div className="text-xs text-gray-500 uppercase mb-1">Gig Source</div>
            <div className="font-medium">{gigSources[0].name}</div>
          </div>
        )}

        <div>
          <label className="text-xs text-gray-500 uppercase block mb-1">Amount</label>
          <input
            type="number"
            value={form.amount}
            onChange={e => setForm({ ...form, amount: e.target.value })}
            className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white font-mono"
            placeholder="0.00"
            step="0.01"
            min="0"
          />
        </div>

        <div>
          <label className="text-xs text-gray-500 uppercase block mb-1">Date</label>
          <input
            type="date"
            value={form.date}
            onChange={e => setForm({ ...form, date: e.target.value })}
            className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white"
          />
          {selectedSource?.payoutDay && !payment && (
            <div className="text-xs text-amber-400 mt-1">
              Auto-set to next {selectedSource.payoutDay}
            </div>
          )}
        </div>

        <div>
          <label className="text-xs text-gray-500 uppercase block mb-1">Note (Optional)</label>
          <input
            type="text"
            value={form.note}
            onChange={e => setForm({ ...form, note: e.target.value })}
            className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white"
            placeholder="e.g., Weekend shifts, Tuesday delivery"
          />
        </div>
      </div>
      <div className="flex justify-end gap-3 p-4 border-t border-gray-800">
        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-800 text-white rounded-lg">Cancel</button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!form.sourceId || !form.amount || !form.date}
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium disabled:opacity-50"
        >
          {payment ? 'Update' : 'Log Payment'}
        </button>
      </div>
    </div>
  );
}
