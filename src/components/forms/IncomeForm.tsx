'use client';

import { useState } from 'react';
import { Income } from '@/lib/types';

interface IncomeFormProps {
  income: Income | null;
  onSave: (data: Omit<Income, 'id'>) => void;
  onClose: () => void;
  defaultMonth?: string; // YYYY-MM format
}

export default function IncomeForm({ income, onSave, onClose, defaultMonth }: IncomeFormProps) {
  // For new income, use defaultMonth with day 1; for existing, use stored date
  const getInitialStartDate = () => {
    if (income?.startDate) return income.startDate;
    if (defaultMonth) return `${defaultMonth}-01`;
    return new Date().toISOString().split('T')[0];
  };

  const [form, setForm] = useState({
    name: income?.name || '',
    amount: income?.amount?.toString() || '',
    frequency: income?.frequency || 'biweekly',
    startDate: getInitialStartDate()
  });

  const handleSave = () => {
    if (!form.name || !form.amount) return;
    onSave({ name: form.name, amount: parseFloat(form.amount), frequency: form.frequency as Income['frequency'], startDate: form.startDate });
  };

  return (
    <div>
      <div className="p-4 space-y-4">
        <div>
          <label className="text-xs text-gray-500 uppercase block mb-1">Name</label>
          <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white" placeholder="e.g., Main Paycheck" />
        </div>
        <div>
          <label className="text-xs text-gray-500 uppercase block mb-1">Amount</label>
          <input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white font-mono" placeholder="0.00" step="0.01" min="0" />
        </div>
        <div>
          <label className="text-xs text-gray-500 uppercase block mb-1">Frequency</label>
          <select value={form.frequency} onChange={e => setForm({ ...form, frequency: e.target.value as 'weekly' | 'biweekly' | 'semimonthly' | 'monthly' })} className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white">
            <option value="weekly">Weekly</option>
            <option value="biweekly">Every 2 weeks</option>
            <option value="semimonthly">Twice a month</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 uppercase block mb-1">Start/Next Date</label>
          <input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white" />
        </div>
      </div>
      <div className="flex justify-end gap-3 p-4 border-t border-gray-800">
        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-800 text-white rounded-lg">Cancel</button>
        <button type="button" onClick={handleSave} disabled={!form.name || !form.amount} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium disabled:opacity-50">Save</button>
      </div>
    </div>
  );
}
