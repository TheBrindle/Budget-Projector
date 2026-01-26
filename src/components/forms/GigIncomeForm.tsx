'use client';

import { useState } from 'react';
import { Income } from '@/lib/types';

interface GigIncomeFormProps {
  income: Income | null;
  onSave: (data: Omit<Income, 'id'>) => void;
  onClose: () => void;
}

const payoutDayOptions = [
  { value: '', label: 'None / Manual' },
  { value: 'sunday', label: 'Sunday' },
  { value: 'monday', label: 'Monday' },
  { value: 'tuesday', label: 'Tuesday' },
  { value: 'wednesday', label: 'Wednesday' },
  { value: 'thursday', label: 'Thursday' },
  { value: 'friday', label: 'Friday' },
  { value: 'saturday', label: 'Saturday' },
];

export default function GigIncomeForm({ income, onSave, onClose }: GigIncomeFormProps) {
  const [form, setForm] = useState({
    name: income?.name || '',
    payoutDay: income?.payoutDay || ''
  });

  const handleSave = () => {
    if (!form.name) return;
    onSave({
      name: form.name,
      amount: 0, // Gig income amount comes from scheduled payments
      frequency: 'gig',
      payoutDay: form.payoutDay as Income['payoutDay'] || undefined,
      scheduledPayments: income?.scheduledPayments || []
    });
  };

  return (
    <div>
      <div className="p-4 space-y-4">
        <div>
          <label className="text-xs text-gray-500 uppercase block mb-1">Name</label>
          <input
            type="text"
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white"
            placeholder="e.g., DoorDash, Uber, Instacart"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 uppercase block mb-1">Payout Day (Optional)</label>
          <select
            value={form.payoutDay}
            onChange={e => setForm({ ...form, payoutDay: e.target.value })}
            className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white"
          >
            {payoutDayOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <div className="text-xs text-gray-500 mt-1">
            If set, new payments will auto-populate to the next payout day
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-3 p-4 border-t border-gray-800">
        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-800 text-white rounded-lg">Cancel</button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!form.name}
          className="px-4 py-2 bg-amber-600 text-white rounded-lg font-medium disabled:opacity-50"
        >
          Save
        </button>
      </div>
    </div>
  );
}
