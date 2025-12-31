'use client';

import { useState, useMemo } from 'react';
import { Expense } from '@/lib/types';

const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

const categories = [
  { value: 'housing', label: 'Housing' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'auto', label: 'Auto/Transport' },
  { value: 'health', label: 'Health/Medical' },
  { value: 'loan', label: 'Loans' },
  { value: 'other', label: 'Other' }
];

const dayOptions = Array.from({ length: 31 }, (_, i) => i + 1);

type FrequencyType = 'weekly' | 'biweekly' | 'semimonthly' | 'monthly' | 'bimonthly';

interface PaymentPlanFormProps {
  expense: Expense | null;
  onSave: (data: Omit<Expense, 'id'>) => void;
  onClose: () => void;
  defaultMonth?: string; // YYYY-MM format
}

export default function PaymentPlanForm({ expense, onSave, onClose, defaultMonth }: PaymentPlanFormProps) {
  const getFirstDayFromDate = () => {
    if (expense?.startDate) {
      const parts = expense.startDate.split('-');
      return parseInt(parts[2], 10);
    }
    return 1;
  };

  // For new expense, use defaultMonth with day 1; for existing, use stored date
  const getInitialStartDate = () => {
    if (expense?.startDate) return expense.startDate;
    if (defaultMonth) return `${defaultMonth}-01`;
    return new Date().toISOString().split('T')[0];
  };

  const [form, setForm] = useState({
    name: expense?.name || '',
    amount: expense?.amount?.toString() || '',
    startDate: getInitialStartDate(),
    totalDebt: expense?.paymentPlan?.totalDebt?.toString() || '',
    paymentCount: expense?.paymentPlan?.paymentCount?.toString() || '',
    paymentFrequency: (expense?.paymentPlan?.frequency || 'monthly') as FrequencyType,
    category: expense?.category || 'loan',
    firstDay: getFirstDayFromDate(),
    secondDay: expense?.paymentPlan?.secondDay || 15
  });

  const calculatedPayment = useMemo(() => {
    if (form.totalDebt && form.paymentCount) {
      const multiplier = form.paymentFrequency === 'semimonthly' ? 2 : 1;
      return (parseFloat(form.totalDebt) / (parseInt(form.paymentCount) * multiplier)).toFixed(2);
    }
    return '';
  }, [form.totalDebt, form.paymentCount, form.paymentFrequency]);

  const validSecondDay = useMemo(() => {
    if (form.secondDay <= form.firstDay) {
      return Math.min(form.firstDay + 14, 28);
    }
    return form.secondDay;
  }, [form.firstDay, form.secondDay]);

  const endDate = useMemo(() => {
    if (!form.startDate || !form.paymentCount || !form.paymentFrequency) return null;
    const parts = form.startDate.split('-');
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const start = new Date(year, month, form.firstDay, 12, 0, 0);
    const count = parseInt(form.paymentCount);
    const end = new Date(start);
    
    if (form.paymentFrequency === 'weekly') {
      end.setDate(end.getDate() + (count - 1) * 7);
    } else if (form.paymentFrequency === 'biweekly') {
      end.setDate(end.getDate() + (count - 1) * 14);
    } else if (form.paymentFrequency === 'bimonthly') {
      end.setMonth(end.getMonth() + (count - 1) * 2);
    } else if (form.paymentFrequency === 'semimonthly') {
      end.setMonth(end.getMonth() + count - 1);
      end.setDate(validSecondDay);
    } else {
      end.setMonth(end.getMonth() + count - 1);
    }
    return end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }, [form.startDate, form.paymentCount, form.paymentFrequency, form.firstDay, validSecondDay]);

  const handleSave = () => {
    if (!form.name || !form.amount || !form.totalDebt || !form.paymentCount) return;
    
    const parts = form.startDate.split('-');
    const year = parts[0];
    const month = parts[1];
    const startDateStr = year + '-' + month + '-' + String(form.firstDay).padStart(2, '0');
    
    onSave({
      name: form.name,
      amount: parseFloat(form.amount),
      frequency: 'payment_plan',
      startDate: startDateStr,
      category: form.category,
      paymentPlan: {
        totalDebt: parseFloat(form.totalDebt),
        paymentCount: parseInt(form.paymentCount),
        frequency: form.paymentFrequency,
        ...(form.paymentFrequency === 'semimonthly' ? { secondDay: validSecondDay } : {})
      }
    });
  };

  const isValid = form.name && form.amount && form.totalDebt && form.paymentCount;

  const totalPayments = useMemo(() => {
    if (!form.paymentCount) return 0;
    const count = parseInt(form.paymentCount);
    return form.paymentFrequency === 'semimonthly' ? count * 2 : count;
  }, [form.paymentCount, form.paymentFrequency]);

  const getOrdinal = (n: number) => {
    if (n === 1) return '1st';
    if (n === 2) return '2nd';
    if (n === 3) return '3rd';
    return n + 'th';
  };

  return (
    <div>
      <div className="p-4 space-y-4">
        <div>
          <label className="text-xs text-gray-500 uppercase block mb-1">Description</label>
          <input 
            type="text" 
            value={form.name} 
            onChange={e => setForm({ ...form, name: e.target.value })} 
            className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white" 
            placeholder="e.g., Furniture Financing" 
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 uppercase block mb-1">Category</label>
          <select 
            value={form.category} 
            onChange={e => setForm({ ...form, category: e.target.value })} 
            className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white"
          >
            {categories.map(cat => (
              <option key={cat.value} value={cat.value}>{cat.label}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-gray-500 uppercase block mb-1">Total Owed</label>
            <input 
              type="number" 
              value={form.totalDebt} 
              onChange={e => setForm({ ...form, totalDebt: e.target.value })} 
              className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white font-mono" 
              step="0.01" 
              min="0" 
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 uppercase block mb-1">
              {form.paymentFrequency === 'semimonthly' ? '# Months' : '# Payments'}
            </label>
            <input 
              type="number" 
              value={form.paymentCount} 
              onChange={e => setForm({ ...form, paymentCount: e.target.value })} 
              className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white font-mono" 
              min="1" 
            />
          </div>
        </div>
        
        <div>
          <label className="text-xs text-gray-500 uppercase block mb-1">Frequency</label>
          <select 
            value={form.paymentFrequency} 
            onChange={e => setForm({ ...form, paymentFrequency: e.target.value as FrequencyType })} 
            className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white"
          >
            <option value="weekly">Weekly</option>
            <option value="biweekly">Every 2 weeks</option>
            <option value="monthly">Monthly</option>
            <option value="semimonthly">Twice a month</option>
            <option value="bimonthly">Every 2 months</option>
          </select>
        </div>

        {form.paymentFrequency === 'semimonthly' ? (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500 uppercase block mb-1">First Due Date</label>
              <select 
                value={form.firstDay} 
                onChange={e => {
                  const newFirst = parseInt(e.target.value);
                  const newSecond = form.secondDay <= newFirst ? Math.min(newFirst + 14, 28) : form.secondDay;
                  setForm({ ...form, firstDay: newFirst, secondDay: newSecond });
                }} 
                className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white"
              >
                {dayOptions.slice(0, 28).map(day => (
                  <option key={day} value={day}>{getOrdinal(day)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 uppercase block mb-1">Second Due Date</label>
              <select 
                value={validSecondDay} 
                onChange={e => setForm({ ...form, secondDay: parseInt(e.target.value) })} 
                className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white"
              >
                {dayOptions.filter(day => day > form.firstDay).map(day => (
                  <option key={day} value={day}>
                    {getOrdinal(day)}
                    {day > 28 && ' (adjusted for short months)'}
                  </option>
                ))}
              </select>
              <div className="text-xs text-gray-500 mt-1">
                For months without this date, uses last day of month
              </div>
            </div>
          </div>
        ) : (
          <div>
            <label className="text-xs text-gray-500 uppercase block mb-1">Start Month</label>
            <input 
              type="month" 
              value={form.startDate.substring(0, 7)} 
              onChange={e => setForm({ ...form, startDate: e.target.value + '-01' })} 
              className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white" 
            />
          </div>
        )}

        {form.paymentFrequency !== 'semimonthly' && (
          <div>
            <label className="text-xs text-gray-500 uppercase block mb-1">Due Day of Month</label>
            <select 
              value={form.firstDay} 
              onChange={e => setForm({ ...form, firstDay: parseInt(e.target.value) })} 
              className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white"
            >
              {dayOptions.map(day => (
                <option key={day} value={day}>
                  {getOrdinal(day)}
                  {day > 28 && ' (adjusted for short months)'}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="text-xs text-gray-500 uppercase block mb-1">Payment Amount</label>
          <input 
            type="number" 
            value={form.amount} 
            onChange={e => setForm({ ...form, amount: e.target.value })} 
            className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white font-mono" 
            step="0.01" 
            min="0" 
            placeholder={calculatedPayment} 
          />
          {calculatedPayment && !form.amount && (
            <button 
              type="button" 
              onClick={() => setForm({ ...form, amount: calculatedPayment })} 
              className="text-xs text-teal-400 mt-1 hover:underline"
            >
              Use calculated: {formatCurrency(parseFloat(calculatedPayment))}
            </button>
          )}
        </div>

        {endDate && form.paymentCount && (
          <div className="p-3 bg-teal-500/10 border border-teal-500/30 rounded-lg">
            <div className="text-xs text-teal-400 uppercase">Payment Summary</div>
            <div className="font-mono font-semibold text-teal-300">
              {totalPayments} payments of {form.amount ? formatCurrency(parseFloat(form.amount)) : formatCurrency(parseFloat(calculatedPayment) || 0)}
            </div>
            {form.paymentFrequency === 'semimonthly' && (
              <div className="text-xs text-teal-400/70 mt-1">
                Due on the {getOrdinal(form.firstDay)} and {getOrdinal(validSecondDay)} each month
              </div>
            )}
            <div className="text-xs text-teal-400/70 mt-1">Final payment: {endDate}</div>
          </div>
        )}
      </div>
      <div className="flex justify-end gap-3 p-4 border-t border-gray-800">
        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-800 text-white rounded-lg">Cancel</button>
        <button type="button" onClick={handleSave} disabled={!isValid} className="px-4 py-2 bg-teal-600 text-white rounded-lg font-medium disabled:opacity-50">Save</button>
      </div>
    </div>
  );
}
