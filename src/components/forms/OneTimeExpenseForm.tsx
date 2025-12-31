'use client';

import { useState } from 'react';
import { Expense } from '@/lib/types';

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

interface OneTimeExpenseFormProps {
  expense: Expense | null;
  onSave: (data: Omit<Expense, 'id'>) => void;
  onClose: () => void;
  defaultDate?: string; // YYYY-MM-DD format
}

export default function OneTimeExpenseForm({ expense, onSave, onClose, defaultDate }: OneTimeExpenseFormProps) {
  const [form, setForm] = useState({
    name: expense?.name || '',
    amount: expense?.amount?.toString() || '',
    date: expense?.date || defaultDate || new Date().toISOString().split('T')[0],
    category: expense?.category || 'other'
  });

  const handleSave = () => {
    if (!form.name || !form.amount) return;
    onSave({ name: form.name, amount: parseFloat(form.amount), frequency: 'once', date: form.date, category: form.category });
  };

  return (
    <div>
      <div className="p-4 space-y-4">
        <div>
          <label className="text-xs text-gray-500 uppercase block mb-1">Description</label>
          <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white" placeholder="e.g., Car Repair, Medical Bill" />
        </div>
        <div>
          <label className="text-xs text-gray-500 uppercase block mb-1">Amount</label>
          <input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white font-mono" placeholder="0.00" step="0.01" min="0" />
        </div>
        <div>
          <label className="text-xs text-gray-500 uppercase block mb-1">Category</label>
          <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white">
            {categories.map(cat => <option key={cat.value} value={cat.value}>{cat.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 uppercase block mb-1">Date</label>
          <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white" />
        </div>
      </div>
      <div className="flex justify-end gap-3 p-4 border-t border-gray-800">
        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-800 text-white rounded-lg">Cancel</button>
        <button type="button" onClick={handleSave} disabled={!form.name || !form.amount} className="px-4 py-2 bg-orange-600 text-white rounded-lg font-medium disabled:opacity-50">Save</button>
      </div>
    </div>
  );
}
