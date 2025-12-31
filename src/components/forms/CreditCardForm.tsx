'use client';

import { useState, useMemo } from 'react';
import { Expense } from '@/lib/types';

const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

interface CreditCardFormProps {
  expense: Expense | null;
  onSave: (data: Omit<Expense, 'id'>) => void;
  onClose: () => void;
  defaultMonth?: string; // YYYY-MM format
}

export default function CreditCardForm({ expense, onSave, onClose, defaultMonth }: CreditCardFormProps) {
  const [form, setForm] = useState({
    name: expense?.name || '',
    amount: expense?.amount?.toString() || '',
    dayOfMonth: expense?.startDate ? parseInt(expense.startDate.split('-')[2], 10) : 1,
    startMonth: expense?.startDate?.substring(0, 7) || defaultMonth || new Date().toISOString().substring(0, 7),
    currentBalance: expense?.creditCard?.currentBalance?.toString() || expense?.creditCard?.totalDebt?.toString() || '',
    balanceAsOfDate: expense?.creditCard?.balanceAsOfDate || new Date().toISOString().split('T')[0],
    originalDebt: expense?.creditCard?.totalDebt?.toString() || '',
    apr: expense?.creditCard?.apr?.toString() || '0',
    minimumPayment: expense?.creditCard?.minimumPayment?.toString() || ''
  });

  // Calculate payoff details
  const payoffCalc = useMemo(() => {
    if (!form.amount || !form.currentBalance) return null;
    
    const payment = parseFloat(form.amount);
    const debt = parseFloat(form.currentBalance);
    const apr = parseFloat(form.apr) || 0;
    const monthlyRate = (apr / 100) / 12;
    
    if (payment <= 0 || debt <= 0) return null;
    
    // Simple payoff without interest
    if (apr === 0) {
      const months = Math.ceil(debt / payment);
      const totalPaid = payment * months;
      return {
        months,
        totalPaid,
        totalInterest: 0,
        lastPayment: debt % payment || payment
      };
    }
    
    // Payoff with interest
    let remaining = debt;
    let months = 0;
    let totalPaid = 0;
    
    // Check if payment covers at least the monthly interest
    const monthlyInterest = remaining * monthlyRate;
    if (payment <= monthlyInterest) {
      return { months: -1, totalPaid: 0, totalInterest: 0, lastPayment: 0 }; // Will never pay off
    }
    
    while (remaining > 0.01 && months < 600) {
      const interest = remaining * monthlyRate;
      remaining = remaining + interest - payment;
      totalPaid += payment;
      months++;
      
      if (remaining < 0) {
        // Final payment was less than full payment
        totalPaid += remaining; // Subtract the overpayment
        remaining = 0;
      }
    }
    
    return {
      months,
      totalPaid,
      totalInterest: totalPaid - debt,
      lastPayment: payment + (remaining < 0 ? remaining : 0)
    };
  }, [form.amount, form.currentBalance, form.apr]);

  const handleSave = () => {
    if (!form.name || !form.amount || !form.currentBalance) return;
    
    const startDate = `${form.startMonth}-${String(form.dayOfMonth).padStart(2, '0')}`;
    const currentBalance = parseFloat(form.currentBalance);
    
    onSave({
      name: form.name,
      amount: parseFloat(form.amount),
      frequency: 'monthly',
      startDate,
      category: 'credit_card',
      creditCard: {
        totalDebt: parseFloat(form.originalDebt) || currentBalance,
        currentBalance: currentBalance,
        balanceAsOfDate: form.balanceAsOfDate,
        apr: parseFloat(form.apr) || 0,
        minimumPayment: parseFloat(form.minimumPayment || form.amount)
      }
    });
  };

  const isValid = form.name && form.amount && form.currentBalance && payoffCalc && payoffCalc.months > 0;

  const dayOptions = Array.from({ length: 31 }, (_, i) => i + 1);
  
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
          <label className="text-xs text-gray-500 uppercase block mb-1">Card Name</label>
          <input 
            type="text" 
            value={form.name} 
            onChange={e => setForm({ ...form, name: e.target.value })} 
            className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white" 
            placeholder="e.g., Chase Freedom" 
          />
        </div>
        
        <div className="p-3 bg-purple-500/5 border border-purple-500/20 rounded-lg space-y-3">
          <div className="text-xs text-purple-400 uppercase font-semibold">Current Balance</div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Balance Amount</label>
              <input 
                type="number" 
                value={form.currentBalance} 
                onChange={e => setForm({ ...form, currentBalance: e.target.value })} 
                className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white font-mono" 
                step="0.01" 
                min="0" 
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">As of Date</label>
              <input 
                type="date" 
                value={form.balanceAsOfDate} 
                onChange={e => setForm({ ...form, balanceAsOfDate: e.target.value })} 
                className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white" 
              />
            </div>
          </div>
          <div className="text-xs text-gray-500">Enter the balance shown on your statement or app as of this date. Projections calculate forward from here.</div>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-gray-500 uppercase block mb-1">APR % (0 if none)</label>
            <input 
              type="number" 
              value={form.apr} 
              onChange={e => setForm({ ...form, apr: e.target.value })} 
              className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white font-mono" 
              step="0.01" 
              min="0" 
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 uppercase block mb-1">Original Debt (optional)</label>
            <input 
              type="number" 
              value={form.originalDebt} 
              onChange={e => setForm({ ...form, originalDebt: e.target.value })} 
              className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white font-mono" 
              step="0.01" 
              min="0"
              placeholder="For tracking progress"
            />
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-gray-500 uppercase block mb-1">Monthly Payment</label>
            <input 
              type="number" 
              value={form.amount} 
              onChange={e => setForm({ ...form, amount: e.target.value })} 
              className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white font-mono" 
              step="0.01" 
              min="0" 
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 uppercase block mb-1">Minimum Payment</label>
            <input 
              type="number" 
              value={form.minimumPayment} 
              onChange={e => setForm({ ...form, minimumPayment: e.target.value })} 
              className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white font-mono" 
              step="0.01" 
              min="0" 
              placeholder="Optional"
            />
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-gray-500 uppercase block mb-1">First Payment Month</label>
            <input 
              type="month" 
              value={form.startMonth} 
              onChange={e => setForm({ ...form, startMonth: e.target.value })} 
              className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white" 
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 uppercase block mb-1">Due Day</label>
            <select 
              value={form.dayOfMonth} 
              onChange={e => setForm({ ...form, dayOfMonth: parseInt(e.target.value) })} 
              className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white"
            >
              {dayOptions.map(day => (
                <option key={day} value={day}>{getOrdinal(day)}</option>
              ))}
            </select>
          </div>
        </div>
        
        {payoffCalc && (
          <div className={`p-4 rounded-lg border ${payoffCalc.months < 0 ? 'bg-red-500/10 border-red-500/30' : 'bg-purple-500/10 border-purple-500/30'}`}>
            {payoffCalc.months < 0 ? (
              <div className="text-red-400">
                <div className="font-semibold">Payment too low</div>
                <div className="text-xs opacity-75">Monthly payment must exceed the interest charge to pay off the balance</div>
              </div>
            ) : (
              <>
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="text-xs text-purple-400 uppercase">Payoff Time</div>
                    <div className="font-mono text-2xl font-bold text-purple-300">
                      {payoffCalc.months} months
                    </div>
                    <div className="text-xs text-purple-400/70">
                      ({Math.floor(payoffCalc.months / 12)} years {payoffCalc.months % 12} months)
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-purple-400 uppercase">Total Cost</div>
                    <div className="font-mono text-lg font-semibold text-purple-300">
                      {formatCurrency(payoffCalc.totalPaid)}
                    </div>
                  </div>
                </div>
                {payoffCalc.totalInterest > 0 && (
                  <div className="pt-3 border-t border-purple-500/20 flex justify-between text-sm">
                    <span className="text-purple-400/70">Interest paid:</span>
                    <span className="font-mono text-purple-300">{formatCurrency(payoffCalc.totalInterest)}</span>
                  </div>
                )}
                <div className="text-xs text-purple-400/50 mt-2">
                  Payments stop automatically when balance reaches $0.
                </div>
              </>
            )}
          </div>
        )}
      </div>
      
      <div className="flex justify-end gap-3 p-4 border-t border-gray-800">
        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-800 text-white rounded-lg">Cancel</button>
        <button type="button" onClick={handleSave} disabled={!isValid} className="px-4 py-2 bg-purple-600 text-white rounded-lg font-medium disabled:opacity-50">Save</button>
      </div>
    </div>
  );
}
