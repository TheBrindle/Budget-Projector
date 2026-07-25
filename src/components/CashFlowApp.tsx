'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';
import { CashFlowData, CreditCard, Income, Expense, DayData, DayEvent, InstanceOverride, isSkippedOverride, categoryColorOptions, defaultCategoryColors, CategoryColorKey, ScheduledPayment } from '@/lib/types';
import { getPeriodRate, getDailyRate, daysBetween, resolveInterestMethod } from '@/lib/payoff';
import Modal from './Modal';
import IncomeForm from './forms/IncomeForm';
import OneTimeIncomeForm from './forms/OneTimeIncomeForm';
import GigIncomeForm from './forms/GigIncomeForm';
import GigPaymentForm from './forms/GigPaymentForm';
import ExpenseForm from './forms/ExpenseForm';
import OneTimeExpenseForm from './forms/OneTimeExpenseForm';
import CreditCardForm from './forms/CreditCardForm';
import PaymentPlanForm from './forms/PaymentPlanForm';
import InstanceEditForm from './forms/InstanceEditForm';
import BalanceUpdateForm from './forms/BalanceUpdateForm';

const defaultData: CashFlowData = { 
  startingBalance: 0, 
  startingDate: new Date().toISOString().split('T')[0],
  warningThreshold: 500, 
  floorThreshold: 50, 
  incomes: [], 
  expenses: [],
  categoryColors: {}
};

// Sample data for preview mode - demonstrates app features
const getPreviewData = (): CashFlowData => {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();
  const firstOfMonth = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
  const lastMonth = currentMonth === 0 
    ? `${currentYear - 1}-12-01` 
    : `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
  
  // Find next Friday for paycheck
  const nextFriday = new Date(today);
  nextFriday.setDate(today.getDate() + ((5 - today.getDay() + 7) % 7 || 7));
  const paycheckDate = `${nextFriday.getFullYear()}-${String(nextFriday.getMonth() + 1).padStart(2, '0')}-${String(nextFriday.getDate()).padStart(2, '0')}`;

  return {
    startingBalance: 3247.82,
    startingDate: firstOfMonth,
    warningThreshold: 500,
    floorThreshold: 100,
    incomes: [
      {
        id: 'preview-income-1',
        name: 'Paycheck',
        amount: 2847.50,
        frequency: 'biweekly',
        startDate: paycheckDate
      },
      {
        id: 'preview-income-2',
        name: 'Freelance Work',
        amount: 450,
        frequency: 'monthly',
        startDate: `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-15`
      }
    ],
    expenses: [
      // Housing
      {
        id: 'preview-expense-1',
        name: 'Rent',
        amount: 1650,
        frequency: 'monthly',
        startDate: firstOfMonth,
        category: 'housing'
      },
      // Utilities
      {
        id: 'preview-expense-2',
        name: 'Electric',
        amount: 145,
        frequency: 'monthly',
        startDate: `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-18`,
        category: 'utilities'
      },
      {
        id: 'preview-expense-3',
        name: 'Internet',
        amount: 79.99,
        frequency: 'monthly',
        startDate: `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-05`,
        category: 'utilities'
      },
      // Auto
      {
        id: 'preview-expense-4',
        name: 'Car Payment',
        amount: 387.42,
        frequency: 'monthly',
        startDate: `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-10`,
        category: 'auto'
      },
      {
        id: 'preview-expense-5',
        name: 'Car Insurance',
        amount: 142,
        frequency: 'monthly',
        startDate: `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`,
        category: 'insurance'
      },
      // Food - split payment example
      {
        id: 'preview-expense-6',
        name: 'Groceries',
        amount: 600,
        frequency: 'split',
        startDate: firstOfMonth,
        category: 'food',
        splitConfig: {
          firstDay: 1,
          firstAmount: 350,
          secondDay: 15,
          secondAmount: 250
        }
      },
      // Subscriptions
      {
        id: 'preview-expense-7',
        name: 'Streaming Services',
        amount: 45.97,
        frequency: 'monthly',
        startDate: `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-12`,
        category: 'subscriptions'
      },
      {
        id: 'preview-expense-8',
        name: 'Gym Membership',
        amount: 49.99,
        frequency: 'monthly',
        startDate: `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`,
        category: 'health'
      },
      // Credit Card
      {
        id: 'preview-expense-9',
        name: 'Visa Card',
        amount: 350,
        frequency: 'monthly',
        startDate: `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-20`,
        category: 'credit_card',
        creditCard: {
          totalDebt: 4850,
          currentBalance: 4850,
          balanceAsOfDate: firstOfMonth,
          apr: 22.99,
          minimumPayment: 97
        }
      },
      // Payment Plan example
      {
        id: 'preview-expense-10',
        name: 'Medical Bill',
        amount: 125,
        frequency: 'payment_plan',
        startDate: lastMonth,
        category: 'health',
        paymentPlan: {
          totalDebt: 750,
          paymentCount: 6,
          frequency: 'monthly'
        }
      },
      // One-time expense
      {
        id: 'preview-expense-11',
        name: 'Car Registration',
        amount: 285,
        frequency: 'once',
        date: `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-22`,
        category: 'auto'
      },
      // Quarterly expense
      {
        id: 'preview-expense-12',
        name: 'Water/Sewer',
        amount: 185,
        frequency: 'quarterly',
        startDate: firstOfMonth,
        category: 'utilities'
      }
    ],
    categoryColors: {}
  };
};

const expenseCategories = [
  { value: 'housing', label: 'Housing' }, { value: 'utilities', label: 'Utilities' }, { value: 'auto', label: 'Auto/Transport' },
  { value: 'insurance', label: 'Insurance' }, { value: 'food', label: 'Food/Groceries' }, { value: 'health', label: 'Health/Medical' },
  { value: 'entertainment', label: 'Entertainment' }, { value: 'subscriptions', label: 'Subscriptions' },
  { value: 'credit_card', label: 'Credit Cards' }, { value: 'loan', label: 'Loans' }, { value: 'other', label: 'Other' }
];

// Helper to get color classes for a category
const getCategoryColor = (category: string, categoryColors: Record<string, string> = {}) => {
  const colorKey = categoryColors[category] || defaultCategoryColors[category] || 'orange';
  const color = categoryColorOptions.find(c => c.key === colorKey) || categoryColorOptions[0];
  return color;
};

const frequencyLabels: Record<string, string> = {
  once: 'One-time', weekly: 'Weekly', biweekly: 'Every 2 weeks', semimonthly: 'Twice a month', monthly: 'Monthly', bimonthly: 'Every 2 months', quarterly: 'Quarterly', payment_plan: 'Payment Plan', split: 'Split Monthly', gig: 'Gig/Variable'
};

const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

// Parse date string without timezone issues
const parseDate = (dateStr: string): Date => {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0);
};

// Format date to YYYY-MM-DD
const formatDateStr = (date: Date): string => {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

// 'YYYY-MM' key for a year/month pair. Zero-padded so keys sort as strings.
const monthKey = (year: number, month: number) => `${year}-${String(month + 1).padStart(2, '0')}`;

interface OccurrenceInfo {
  day: number;
  dateStr: string;
  amount: number;
  isOverride: boolean;
  isSkipped?: boolean;
  isSplit?: boolean;
  splitPart?: 1 | 2;
  originalDate?: string;
}

// The schedule an item would follow on its own, before any balance/payoff
// tracking is applied. Handles frequency, overrides, splits and endDate.
const getRawOccurrencesInMonth = (item: Income | Expense, year: number, month: number): OccurrenceInfo[] => {
  const occurrences: OccurrenceInfo[] = [];
  const monthStart = new Date(year, month, 1);
  // End of the last day: occurrence dates are parsed at noon, so a midnight
  // monthEnd would drop anything landing on the final day of the month.
  const monthEnd = new Date(year, month + 1, 0, 23, 59, 59);
  const overrides = item.overrides || [];

  // Drop any occurrences past endDate (inclusive), then dedupe + sort.
  // endDate = "last date this recurring item occurs"; history before it stays.
  const finalize = (occs: OccurrenceInfo[]): OccurrenceInfo[] => {
    const filtered = item.endDate ? occs.filter(o => o.dateStr <= item.endDate!) : occs;
    const seen = new Set<string>();
    return filtered.filter(o => {
      const key = o.dateStr + (o.isSplit ? '-split-' + o.amount : '');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).sort((a, b) => a.day - b.day);
  };

  // Helper to check if a date is overridden (moved or skipped)
  const getOverride = (dateStr: string) => overrides.find(o => o.originalDate === dateStr);
  
  // Helper to add occurrence (including skipped ones and splits)
  const addOccurrence = (date: Date, originalDateStr?: string) => {
    const dateStr = formatDateStr(date);
    const override = originalDateStr ? getOverride(originalDateStr) : getOverride(dateStr);
    
    if (override) {
      if (isSkippedOverride(override)) {
        // Skipped - show with $0 amount at original date
        if (date.getFullYear() === year && date.getMonth() === month) {
          occurrences.push({
            day: date.getDate(),
            dateStr,
            amount: 0,
            isOverride: true,
            isSkipped: true,
            originalDate: originalDateStr || dateStr
          });
        }
        return;
      }
      
      const newDate = parseDate(override.newDate!);
      
      // Check if this override has a split
      if (override.split) {
        const firstDate = newDate;
        const secondDate = parseDate(override.split.secondDate);
        
        // First payment
        if (firstDate.getFullYear() === year && firstDate.getMonth() === month) {
          occurrences.push({
            day: firstDate.getDate(),
            dateStr: override.newDate!,
            amount: override.split.firstAmount,
            isOverride: true,
            isSplit: true,
            splitPart: 1,
            originalDate: originalDateStr || dateStr
          });
        }
        
        // Second payment
        if (secondDate.getFullYear() === year && secondDate.getMonth() === month) {
          occurrences.push({
            day: secondDate.getDate(),
            dateStr: override.split.secondDate,
            amount: override.split.secondAmount,
            isOverride: true,
            isSplit: true,
            splitPart: 2,
            originalDate: originalDateStr || dateStr
          });
        }
      } else {
        // Regular override (no split)
        if (newDate.getFullYear() === year && newDate.getMonth() === month) {
          occurrences.push({
            day: newDate.getDate(),
            dateStr: override.newDate!,
            amount: override.newAmount ?? item.amount,
            isOverride: true,
            originalDate: originalDateStr || dateStr
          });
        }
      }
    } else if (date.getFullYear() === year && date.getMonth() === month) {
      occurrences.push({
        day: date.getDate(),
        dateStr,
        amount: item.amount,
        isOverride: false
      });
    }
  };

  // Check for overrides that move INTO this month from other months
  overrides.forEach(override => {
    if (override.newDate && !isSkippedOverride(override)) {
      const newDate = parseDate(override.newDate);
      const origDate = parseDate(override.originalDate);
      const isFromDifferentMonth = !(origDate.getFullYear() === year && origDate.getMonth() === month);
      
      if (isFromDifferentMonth) {
        // Check if this override has a split
        if (override.split) {
          const firstDate = newDate;
          const secondDate = parseDate(override.split.secondDate);
          
          // First payment moved into this month
          if (firstDate.getFullYear() === year && firstDate.getMonth() === month) {
            occurrences.push({
              day: firstDate.getDate(),
              dateStr: override.newDate,
              amount: override.split.firstAmount,
              isOverride: true,
              isSplit: true,
              splitPart: 1,
              originalDate: override.originalDate
            });
          }
          
          // Second payment in this month
          if (secondDate.getFullYear() === year && secondDate.getMonth() === month) {
            occurrences.push({
              day: secondDate.getDate(),
              dateStr: override.split.secondDate,
              amount: override.split.secondAmount,
              isOverride: true,
              isSplit: true,
              splitPart: 2,
              originalDate: override.originalDate
            });
          }
        } else {
          // Regular override moved into this month
          const totalAmount = override.newAmount ?? item.amount;
          if (newDate.getFullYear() === year && newDate.getMonth() === month) {
            occurrences.push({
              day: newDate.getDate(),
              dateStr: override.newDate,
              amount: totalAmount,
              isOverride: true,
              originalDate: override.originalDate
            });
          }
        }
      }
    }
  });

  if (item.frequency === 'once') {
    const itemDate = parseDate(item.date!);
    addOccurrence(itemDate);
    return finalize(occurrences);
  }

  // Handle gig frequency - return only scheduled payments in this month
  if (item.frequency === 'gig') {
    const income = item as Income;
    const scheduledPayments = income.scheduledPayments || [];

    scheduledPayments.forEach(payment => {
      const paymentDate = parseDate(payment.date);
      if (paymentDate.getFullYear() === year && paymentDate.getMonth() === month) {
        occurrences.push({
          day: paymentDate.getDate(),
          dateStr: payment.date,
          amount: payment.amount,
          isOverride: false
        });
      }
    });

    return finalize(occurrences);
  }

  const start = parseDate(item.startDate || item.date!);
  const expense = item as Expense;

  // Handle split frequency separately (not part of payment plan frequencies)
  if (item.frequency === 'split') {
    const splitConfig = expense.splitConfig;
    if (splitConfig) {
      const monthsFromStart = (year - start.getFullYear()) * 12 + (month - start.getMonth());
      if (monthsFromStart >= 0) {
        const daysInMonth = getDaysInMonth(year, month);
        
        // First payment
        const firstDay = Math.min(splitConfig.firstDay, daysInMonth);
        const firstDateStr = formatDateStr(new Date(year, month, firstDay));
        const firstOverride = overrides.find(o => o.originalDate === firstDateStr);
        
        if (firstOverride) {
          if (isSkippedOverride(firstOverride)) {
            occurrences.push({
              day: firstDay,
              dateStr: firstDateStr,
              amount: 0,
              isOverride: true,
              isSkipped: true,
              isSplit: true,
              splitPart: 1,
              originalDate: firstDateStr
            });
          } else if (firstOverride.newDate) {
            const newDate = parseDate(firstOverride.newDate);
            if (newDate.getFullYear() === year && newDate.getMonth() === month) {
              occurrences.push({
                day: newDate.getDate(),
                dateStr: firstOverride.newDate,
                amount: firstOverride.newAmount ?? splitConfig.firstAmount,
                isOverride: true,
                isSplit: true,
                splitPart: 1,
                originalDate: firstDateStr
              });
            }
          }
        } else {
          occurrences.push({
            day: firstDay,
            dateStr: firstDateStr,
            amount: splitConfig.firstAmount,
            isOverride: false,
            isSplit: true,
            splitPart: 1
          });
        }
        
        // Second payment
        const secondDay = Math.min(splitConfig.secondDay, daysInMonth);
        const secondDateStr = formatDateStr(new Date(year, month, secondDay));
        const secondOverride = overrides.find(o => o.originalDate === secondDateStr);
        
        if (secondOverride) {
          if (isSkippedOverride(secondOverride)) {
            occurrences.push({
              day: secondDay,
              dateStr: secondDateStr,
              amount: 0,
              isOverride: true,
              isSkipped: true,
              isSplit: true,
              splitPart: 2,
              originalDate: secondDateStr
            });
          } else if (secondOverride.newDate) {
            const newDate = parseDate(secondOverride.newDate);
            if (newDate.getFullYear() === year && newDate.getMonth() === month) {
              occurrences.push({
                day: newDate.getDate(),
                dateStr: secondOverride.newDate,
                amount: secondOverride.newAmount ?? splitConfig.secondAmount,
                isOverride: true,
                isSplit: true,
                splitPart: 2,
                originalDate: secondDateStr
              });
            }
          }
        } else {
          occurrences.push({
            day: secondDay,
            dateStr: secondDateStr,
            amount: splitConfig.secondAmount,
            isOverride: false,
            isSplit: true,
            splitPart: 2
          });
        }
      }
    }
    return finalize(occurrences);
  }

  const freq = expense.paymentPlan?.frequency || item.frequency;
  const maxPayments = expense.paymentPlan?.paymentCount || Infinity;

  switch (freq) {
    case 'weekly': {
      let d = new Date(start); let count = 1;
      while (d < monthStart && count <= maxPayments) { d.setDate(d.getDate() + 7); count++; }
      while (d <= monthEnd && count <= maxPayments) {
        if (d >= monthStart) addOccurrence(new Date(d));
        d.setDate(d.getDate() + 7); count++;
      }
      break;
    }
    case 'biweekly': {
      let d = new Date(start); let count = 1;
      while (d < monthStart && count <= maxPayments) { d.setDate(d.getDate() + 14); count++; }
      while (d <= monthEnd && count <= maxPayments) {
        if (d >= monthStart) addOccurrence(new Date(d));
        d.setDate(d.getDate() + 14); count++;
      }
      break;
    }
    case 'semimonthly': {
      // For payment plans, use the secondDay from the plan; for incomes, use default logic
      const firstDay = start.getDate();
      const secondDay = expense.paymentPlan?.secondDay || (start.getDate() <= 15 ? 15 : 28);
      const daysInMonth = getDaysInMonth(year, month);
      
      // Check if we're within the payment plan duration (if applicable)
      const monthsFromStart = (year - start.getFullYear()) * 12 + (month - start.getMonth());
      const withinPlanDuration = maxPayments === Infinity || monthsFromStart < maxPayments;
      
      if (monthsFromStart >= 0 && withinPlanDuration) {
        // First payment of the month
        const actualFirstDay = Math.min(firstDay, daysInMonth);
        addOccurrence(new Date(year, month, actualFirstDay));
        
        // Second payment of the month
        const actualSecondDay = Math.min(secondDay, daysInMonth);
        if (actualSecondDay > actualFirstDay) {
          addOccurrence(new Date(year, month, actualSecondDay));
        }
      }
      break;
    }
    case 'bimonthly': {
      const dayOfMonth = Math.min(start.getDate(), getDaysInMonth(year, month));
      const monthsFromStart = (year - start.getFullYear()) * 12 + (month - start.getMonth());
      if (monthsFromStart >= 0 && monthsFromStart % 2 === 0) {
        if (maxPayments < Infinity) {
          const paymentNumber = monthsFromStart / 2;
          if (paymentNumber < maxPayments) addOccurrence(new Date(year, month, dayOfMonth));
        } else addOccurrence(new Date(year, month, dayOfMonth));
      }
      break;
    }
    case 'quarterly': {
      const dayOfMonth = Math.min(start.getDate(), getDaysInMonth(year, month));
      const monthsFromStart = (year - start.getFullYear()) * 12 + (month - start.getMonth());
      if (monthsFromStart >= 0 && monthsFromStart % 3 === 0) {
        if (maxPayments < Infinity) {
          const paymentNumber = monthsFromStart / 3;
          if (paymentNumber < maxPayments) addOccurrence(new Date(year, month, dayOfMonth));
        } else addOccurrence(new Date(year, month, dayOfMonth));
      }
      break;
    }
    default: {
      const dayOfMonth = Math.min(start.getDate(), getDaysInMonth(year, month));
      const monthsFromStart = (year - start.getFullYear()) * 12 + (month - start.getMonth());
      if (monthsFromStart >= 0) {
        if (maxPayments < Infinity) {
          if (monthsFromStart < maxPayments) {
            addOccurrence(new Date(year, month, dayOfMonth));
          }
        } else {
          addOccurrence(new Date(year, month, dayOfMonth));
        }
      }
    }
  }
  
  return finalize(occurrences);
};

// ---------------------------------------------------------------------------
// Balance / payoff tracking
//
// Any expense can carry a `creditCard` block (balance + as-of date + APR). The
// schedule below amortizes that balance across the expense's own occurrences —
// whatever its frequency — so interest accrues each payment period, the final
// payment shrinks to whatever is left, and payments stop once it hits $0.
// ---------------------------------------------------------------------------

interface BalanceSchedule {
  // 'YYYY-MM' -> amount actually paid for each raw occurrence that month.
  // null means the occurrence falls after payoff and should be dropped.
  months: Map<string, (number | null)[]>;
  // 'YYYY-MM' -> balance remaining at the end of that month
  endBalances: Map<string, number>;
  // 'YYYY-MM-DD' -> balance immediately after that date's payment. Lets any date
  // be answered without re-running the amortization.
  balanceAfter: Map<string, number>;
  firstMonth: string; // month containing balanceAsOfDate; nothing before it is touched
  startBalance: number;
  paidOffDate: string | null; // date of the payment that cleared the balance
  neverPaysOff: boolean; // payments never exceed the interest charge
}

const MAX_SCHEDULE_MONTHS = 600; // 50 years — stops runaway projections

// Schedules are keyed on the expense object itself. Expenses are replaced (never
// mutated) on every edit, so a stale schedule can't outlive its expense.
const scheduleCache = new WeakMap<Expense, BalanceSchedule>();

const buildBalanceSchedule = (expense: Expense): BalanceSchedule => {
  const cc = expense.creditCard!;
  const asOf = cc.balanceAsOfDate || formatDateStr(new Date());
  const periodRate = getPeriodRate(cc.apr || 0, expense.frequency);
  const dailyRate = getDailyRate(cc.apr || 0);
  const method = resolveInterestMethod(cc.interestMethod, expense.category);
  // Escrow / taxes / insurance leave the bank account but never touch the balance.
  const escrow = Math.max(0, cc.escrowPortion || 0);
  const startBalance = Math.max(0, cc.currentBalance ?? cc.totalDebt ?? 0);

  const months = new Map<string, (number | null)[]>();
  const endBalances = new Map<string, number>();
  const balanceAfter = new Map<string, number>();
  // Daily compounding needs to know how long the money sat. The recorded balance
  // is the starting point, so the first stretch runs from the as-of date.
  let lastAccrual = asOf;

  const asOfDate = parseDate(asOf);
  let year = asOfDate.getFullYear();
  let month = asOfDate.getMonth();
  const firstMonth = monthKey(year, month);

  let balance = startBalance;
  let paidOffDate: string | null = null;
  let processed = 0;

  while (processed < MAX_SCHEDULE_MONTHS) {
    const key = monthKey(year, month);
    const raw = getRawOccurrencesInMonth(expense, year, month);

    const adjusted = raw.map(occ => {
      // On or before the as-of date this is history — the balance the user
      // recorded already reflects it, so leave the amount untouched.
      if (occ.dateStr <= asOf) return occ.amount;
      if (balance <= 0.005) return null; // paid off before this payment came due

      // Interest accrues even when a payment is skipped. Daily compounding uses
      // the real gap since the last payment, so a payment 3 days after the as-of
      // date isn't charged a whole month of interest.
      if (method === 'daily') {
        balance *= Math.pow(1 + dailyRate, daysBetween(lastAccrual, occ.dateStr));
      } else {
        balance += balance * periodRate;
      }
      lastAccrual = occ.dateStr;

      // Only what's left after escrow pays the balance down.
      const principalDue = Math.max(0, occ.amount - escrow);
      const principal = occ.isSkipped ? 0 : Math.min(principalDue, balance);
      balance -= principal;
      if (balance <= 0.005) {
        balance = 0;
        paidOffDate = occ.dateStr;
      }
      balanceAfter.set(occ.dateStr, balance);
      // What actually leaves the account: principal plus the escrow that rode
      // along with it. Only the final payment differs from the full amount.
      return occ.isSkipped ? 0 : principal + escrow;
    });

    months.set(key, adjusted);
    endBalances.set(key, balance);
    processed++;

    if (balance <= 0.005) break;
    // Nothing left to project once the series has ended.
    if (expense.endDate && monthKey(year, month) >= expense.endDate.substring(0, 7)) break;

    month++;
    if (month > 11) { month = 0; year++; }
  }

  return {
    months,
    endBalances,
    balanceAfter,
    firstMonth,
    startBalance,
    paidOffDate,
    neverPaysOff: balance > 0.005,
  };
};

const getBalanceSchedule = (expense: Expense): BalanceSchedule => {
  let schedule = scheduleCache.get(expense);
  if (!schedule) {
    schedule = buildBalanceSchedule(expense);
    scheduleCache.set(expense, schedule);
  }
  return schedule;
};

// Occurrences are asked for repeatedly — once per day of the month per item, and
// again for every month between the anchor and the view. Cache per item object;
// items are replaced (never mutated) on edit, so entries can't go stale.
const occurrenceCache = new WeakMap<Income | Expense, Map<string, OccurrenceInfo[]>>();

const getOccurrencesInMonth = (item: Income | Expense, year: number, month: number): OccurrenceInfo[] => {
  const key = monthKey(year, month);
  let perItem = occurrenceCache.get(item);
  if (!perItem) {
    perItem = new Map();
    occurrenceCache.set(item, perItem);
  }
  const hit = perItem.get(key);
  if (hit) return hit;
  const computed = computeOccurrencesInMonth(item, year, month);
  perItem.set(key, computed);
  return computed;
};

const computeOccurrencesInMonth = (item: Income | Expense, year: number, month: number): OccurrenceInfo[] => {
  const raw = getRawOccurrencesInMonth(item, year, month);
  const expense = item as Expense;
  if (!expense.creditCard || raw.length === 0) return raw;

  const schedule = getBalanceSchedule(expense);
  const key = monthKey(year, month);

  // Before the balance was recorded these are historical payments — show them
  // as they were, so converting an existing expense never erases its history.
  if (key < schedule.firstMonth) return raw;

  const adjusted = schedule.months.get(key);
  // Past the end of the schedule: everything after payoff is gone; if the
  // balance never clears, payments simply continue.
  if (!adjusted) return schedule.paidOffDate ? [] : raw;

  const result: OccurrenceInfo[] = [];
  raw.forEach((occ, i) => {
    const amount = adjusted[i];
    if (amount === null || amount === undefined) return;
    result.push(amount === occ.amount ? occ : { ...occ, amount });
  });
  return result;
};

// Overrides are matched by the date an instance would naturally fall on. When the
// schedule moves — a new start date, a new frequency — an override can stop
// lining up with any real occurrence. That's not just dead data: one that moved
// an instance into another month keeps injecting a phantom payment there while
// the original instance quietly reappears. Drop the ones that no longer match.
const pruneOrphanedOverrides = <T extends Income | Expense>(item: T): T => {
  const overrides = item.overrides;
  if (!overrides || overrides.length === 0) return item;

  const withoutOverrides = { ...item, overrides: undefined } as T;
  const kept = overrides.filter(override => {
    const date = parseDate(override.originalDate);
    return getRawOccurrencesInMonth(withoutOverrides, date.getFullYear(), date.getMonth())
      .some(occ => occ.dateStr === override.originalDate);
  });

  return kept.length === overrides.length ? item : ({ ...item, overrides: kept } as T);
};

// Balance remaining at the end of the given month.
const getRemainingBalanceAtMonth = (expense: Expense, year: number, month: number): number => {
  if (!expense.creditCard) return 0;
  const schedule = getBalanceSchedule(expense);
  const key = monthKey(year, month);
  if (key < schedule.firstMonth) return schedule.startBalance;
  const end = schedule.endBalances.get(key);
  if (end !== undefined) return Math.max(0, end);
  // Past the schedule horizon.
  return schedule.paidOffDate ? 0 : schedule.startBalance;
};

interface MonthProjection {
  year: number;
  month: number;
  monthEnd: number;
  lowest: number;
  lowestDay: number;
  income: number;
  expenses: number;
}

// One difference between a scenario and Reality
interface ScenarioChange {
  key: string;
  kind: 'added' | 'removed' | 'changed';
  type: 'income' | 'expense';
  id: string;
  name: string;
  details: string[];
}

// Human-readable summary of what changed on an item
const describeItemChange = (before: Income | Expense, after: Income | Expense): string[] => {
  const details: string[] = [];
  if (before.name !== after.name) details.push(`renamed from "${before.name}"`);
  if (before.amount !== after.amount) details.push(`${formatCurrency(before.amount)} → ${formatCurrency(after.amount)}`);
  if (before.frequency !== after.frequency) details.push(`${frequencyLabels[before.frequency]} → ${frequencyLabels[after.frequency]}`);
  if ((before.startDate || before.date) !== (after.startDate || after.date)) {
    details.push(`starts ${after.startDate || after.date}`);
  }
  if (before.endDate !== after.endDate) {
    details.push(after.endDate ? `ends ${after.endDate}` : 'end date removed');
  }
  const beforeCategory = (before as Expense).category;
  const afterCategory = (after as Expense).category;
  if (beforeCategory !== afterCategory) details.push(`category → ${afterCategory}`);
  if (JSON.stringify((before as Expense).creditCard) !== JSON.stringify((after as Expense).creditCard)) {
    details.push((after as Expense).creditCard ? 'balance tracking changed' : 'balance tracking removed');
  }
  if (details.length === 0) details.push('modified');
  return details;
};

// What a form hands back — loose enough to describe either an income or an
// expense without collapsing their differing frequency unions.
interface ItemDraft {
  amount?: number;
  frequency?: string;
  startDate?: string;
  date?: string;
  endDate?: string;
  splitConfig?: unknown;
  creditCard?: unknown;
  paymentPlan?: unknown;
}

// Fields that change what the projection draws. Renaming or recategorizing is
// harmless to apply retroactively; these rewrite history.
const getProjectionChanges = (before: Income | Expense, after: ItemDraft): string[] => {
  const changes: string[] = [];
  if (after.amount !== undefined && before.amount !== after.amount) {
    changes.push(`${formatCurrency(before.amount)} → ${formatCurrency(after.amount)}`);
  }
  if (after.frequency && before.frequency !== after.frequency) {
    changes.push(`${frequencyLabels[before.frequency]} → ${frequencyLabels[after.frequency]}`);
  }
  const beforeStart = before.startDate || before.date;
  const afterStart = after.startDate || after.date;
  if (afterStart && beforeStart !== afterStart) {
    changes.push(`starts ${new Date(afterStart + 'T12:00:00').toLocaleDateString()} instead of ${beforeStart ? new Date(beforeStart + 'T12:00:00').toLocaleDateString() : '—'}`);
  }
  if (JSON.stringify((before as Expense).splitConfig) !== JSON.stringify(after.splitConfig)) changes.push('split amounts changed');
  if (JSON.stringify((before as Expense).paymentPlan) !== JSON.stringify(after.paymentPlan)) changes.push('payment plan changed');
  // Deliberately not compared: `creditCard`. A balance is a fact re-measured over
  // time — new charges land on the card, so it moves for reasons the schedule
  // knows nothing about. buildBalanceSchedule already leaves every occurrence on
  // or before balanceAsOfDate untouched, so re-recording a balance can't rewrite
  // history and must never fork a new version (that's what produced duplicate
  // monthly payments). The payment amount still supersedes — that one is a
  // schedule change.
  return changes;
};

// One real-world item and every version of it, oldest first
interface ItemSeries<T> {
  key: string;
  current: T;
  versions: T[];
}

const groupIntoSeries = <T extends Income | Expense>(items: T[]): ItemSeries<T>[] => {
  const bySeries = new Map<string, T[]>();
  items.forEach(item => {
    const key = item.seriesId || item.id;
    const list = bySeries.get(key);
    if (list) list.push(item);
    else bySeries.set(key, [item]);
  });
  return Array.from(bySeries.entries()).map(([key, versions]) => {
    const sorted = [...versions].sort((a, b) =>
      (a.startDate || a.date || '').localeCompare(b.startDate || b.date || '')
    );
    return { key, current: sorted[sorted.length - 1], versions: sorted };
  });
};

interface CashFlowAppProps {
  user: User | null;
  onExitPreview?: () => void;
}

export default function CashFlowApp({ user, onExitPreview }: CashFlowAppProps) {
  const isPreviewMode = !user;
  const [activeTab, setActiveTab] = useState('dashboard');
  const [data, setData] = useState<CashFlowData>(() => isPreviewMode ? getPreviewData() : defaultData);
  const [loading, setLoading] = useState(!isPreviewMode); // Don't show loading in preview mode
  const [saving, setSaving] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(() => { const now = new Date(); return { year: now.getFullYear(), month: now.getMonth() }; });
  const [viewMode, setViewMode] = useState('list');
  const [modal, setModal] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<Income | Expense | null>(null);
  const [editingEvent, setEditingEvent] = useState<DayEvent | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [timeRange, setTimeRange] = useState<'6m' | '1y' | '2y' | '5y' | '10y' | '15y'>('1y');
  const [monthDropdownOpen, setMonthDropdownOpen] = useState(false);
  const [pastMonthDropdownOpen, setPastMonthDropdownOpen] = useState(false);
  const [oldMonthWarning, setOldMonthWarning] = useState<{ show: boolean; event: DayEvent | null; item: Income | Expense | null }>({ show: false, event: null, item: null });
  const [editingGigPayment, setEditingGigPayment] = useState<ScheduledPayment | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'income' | 'expense'; item: Income | Expense } | null>(null);
  const [checkpointColumnMissing, setCheckpointColumnMissing] = useState(false);
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null);
  const [scenarioName, setScenarioName] = useState('');
  const [renamingScenario, setRenamingScenario] = useState(false);
  const [expandedSeries, setExpandedSeries] = useState<string[]>([]);
  // Promoting a sandbox change into Reality is hard to undo, and the changes list
  // is scrolled by swiping right over the buttons — so it always confirms first.
  const [confirmPromote, setConfirmPromote] = useState<ScenarioChange | null>(null);
  // An earlier version the user wants to correct. Held by id so the modal always
  // reads the live item rather than a snapshot.
  const [versionAction, setVersionAction] = useState<{ type: 'income' | 'expense'; versionId: string; successorId: string } | null>(null);
  const [pendingChange, setPendingChange] = useState<
    | { type: 'income'; id: string; name: string; data: Omit<Income, 'id'>; changes: string[]; pastCount: number; orphanedOverrides: number; effectiveFrom: string }
    | { type: 'expense'; id: string; name: string; data: Omit<Expense, 'id'>; changes: string[]; pastCount: number; orphanedOverrides: number; effectiveFrom: string }
    | null
  >(null);
  // formatDateStr is local-time; toISOString would hand back tomorrow's date
  // for anyone east of UTC in the evening.
  const [newCheckpoint, setNewCheckpoint] = useState(() => ({
    date: formatDateStr(new Date()),
    amount: '',
    note: ''
  }));

  const supabase = createClient();

  // Helper to get default date in selected month
  const getDefaultDateInSelectedMonth = () => {
    const day = Math.min(15, getDaysInMonth(selectedMonth.year, selectedMonth.month));
    return `${selectedMonth.year}-${String(selectedMonth.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };

  useEffect(() => {
    if (isPreviewMode) return;
    
    const loadData = async () => {
      try {
        const { data: cashflowData, error } = await supabase.from('cashflow_data').select('*').eq('user_id', user!.id).single();
        if (error) {
          setLoading(false);
          return;
        }
        if (cashflowData) {
          const incomes = Array.isArray(cashflowData.incomes) ? cashflowData.incomes : [];
          const expenses = Array.isArray(cashflowData.expenses) ? cashflowData.expenses : [];
          
          setData({
            id: cashflowData.id, 
            user_id: cashflowData.user_id,
            startingBalance: parseFloat(cashflowData.starting_balance) || 0,
            startingDate: cashflowData.starting_date || new Date().toISOString().split('T')[0],
            warningThreshold: parseFloat(cashflowData.warning_threshold) || 500,
            floorThreshold: parseFloat(cashflowData.floor_threshold) || 50,
            incomes: incomes,
            expenses: expenses,
            categoryColors: cashflowData.category_colors || {},
            checkpoints: Array.isArray(cashflowData.checkpoints) ? cashflowData.checkpoints : [],
            scenarios: Array.isArray(cashflowData.scenarios) ? cashflowData.scenarios : []
          });
        }
      } catch (err) {
        console.error('Error loading data:', err);
      }
      setLoading(false);
    };
    loadData();
  }, [user?.id, isPreviewMode]);

  const saveData = async (newData: CashFlowData) => {
    if (isPreviewMode) return;
    
    setSaving(true);
    try {
      const { data: existingData } = await supabase
        .from('cashflow_data')
        .select('id')
        .eq('user_id', user!.id)
        .single();
      
      const payload = {
        starting_balance: newData.startingBalance,
        starting_date: newData.startingDate,
        warning_threshold: newData.warningThreshold,
        floor_threshold: newData.floorThreshold,
        incomes: newData.incomes,
        expenses: newData.expenses,
        category_colors: newData.categoryColors || {},
        checkpoints: newData.checkpoints || [],
        scenarios: newData.scenarios || []
      };

      const write = (body: Record<string, unknown>) => existingData
        ? supabase.from('cashflow_data').update(body).eq('user_id', user!.id)
        : supabase.from('cashflow_data').insert({ ...body, user_id: user!.id });

      let { error } = await write(payload);

      // These columns are newer than some databases. Rather than lose the whole
      // save, drop whichever one is missing and tell the user to run the migration.
      if (error && /checkpoints|scenarios/i.test(error.message || '')) {
        const { checkpoints, scenarios, ...core } = payload;
        ({ error } = await write(core));
        setCheckpointColumnMissing(true);
      }

      if (error) console.error('Error saving data:', error);
    } catch (err) {
      console.error('Error saving data:', err);
    }
    setSaving(false);
  };

  const updateData = (updates: Partial<CashFlowData>) => { const newData = { ...data, ...updates }; setData(newData); saveData(newData); };

  // The budget currently on screen: Reality, or the scenario you're sandboxed in.
  const activeScenario = (data.scenarios || []).find(s => s.id === activeScenarioId) || null;
  const budget = activeScenario
    ? { incomes: activeScenario.incomes, expenses: activeScenario.expenses }
    : { incomes: data.incomes, expenses: data.expenses };

  // Every income/expense edit lands on whichever budget is active, so editing
  // inside a scenario can never touch Reality.
  const updateBudget = (updates: { incomes?: Income[]; expenses?: Expense[] }) => {
    if (activeScenarioId) {
      updateData({ scenarios: (data.scenarios || []).map(s => s.id === activeScenarioId ? { ...s, ...updates } : s) });
    } else {
      updateData(updates);
    }
  };

  // Fork the budget you're currently looking at into a new sandbox
  const createScenario = (name: string) => {
    const id = Date.now().toString();
    const copy = <T,>(items: T[]): T[] => JSON.parse(JSON.stringify(items));
    updateData({
      scenarios: [...(data.scenarios || []), {
        id,
        name: name.trim() || 'Untitled scenario',
        createdAt: formatDateStr(new Date()),
        incomes: copy(budget.incomes),
        expenses: copy(budget.expenses)
      }]
    });
    setActiveScenarioId(id);
    setModal(null);
    setScenarioName('');
  };

  const deleteScenario = (id: string) => {
    updateData({ scenarios: (data.scenarios || []).filter(s => s.id !== id) });
    if (activeScenarioId === id) setActiveScenarioId(null);
    setModal(null);
  };

  const renameScenario = (id: string, name: string) => {
    updateData({ scenarios: (data.scenarios || []).map(s => s.id === id ? { ...s, name: name.trim() || s.name } : s) });
    setRenamingScenario(false);
  };

  // What this scenario changed relative to Reality
  const scenarioDiff = useMemo((): ScenarioChange[] => {
    if (!activeScenario) return [];
    const changes: ScenarioChange[] = [];

    const compare = (type: 'income' | 'expense', realityItems: (Income | Expense)[], scenarioItems: (Income | Expense)[]) => {
      const realityById = new Map(realityItems.map(i => [i.id, i]));
      const scenarioById = new Map(scenarioItems.map(i => [i.id, i]));

      scenarioItems.forEach(item => {
        const original = realityById.get(item.id);
        if (!original) {
          changes.push({ key: `${type}:${item.id}`, kind: 'added', type, id: item.id, name: item.name, details: [`${formatCurrency(item.amount)} ${frequencyLabels[item.frequency] || ''}`] });
        } else if (JSON.stringify(original) !== JSON.stringify(item)) {
          changes.push({ key: `${type}:${item.id}`, kind: 'changed', type, id: item.id, name: item.name, details: describeItemChange(original, item) });
        }
      });

      realityItems.forEach(item => {
        if (!scenarioById.has(item.id)) {
          changes.push({ key: `${type}:${item.id}`, kind: 'removed', type, id: item.id, name: item.name, details: [`was ${formatCurrency(item.amount)} ${frequencyLabels[item.frequency] || ''}`] });
        }
      });
    };

    compare('income', data.incomes, activeScenario.incomes);
    compare('expense', data.expenses, activeScenario.expenses);
    return changes;
  }, [activeScenario, data.incomes, data.expenses]);

  // Apply one scenario change to Reality. A change that would rewrite history
  // supersedes instead, exactly like editing the item directly.
  const promoteInto = <T extends Income | Expense>(
    reality: T[],
    source: T | undefined,
    change: ScenarioChange
  ): T[] | null => {
    if (change.kind === 'removed') {
      // Stop it going forward rather than deleting — deleting erases its history
      return reality.map(i => i.id === change.id ? ({ ...i, endDate: todayStr() } as T) : i);
    }
    if (!source) return null;
    const copy = pruneOrphanedOverrides(JSON.parse(JSON.stringify(source)) as T);
    if (change.kind === 'added') return [...reality, copy];

    const original = reality.find(i => i.id === change.id);
    const prep = original ? prepareEdit(original, copy) : null;
    if (original && prep) {
      return supersedeInList(reality, change.id, copy, prep.effectiveFrom);
    }
    return reality.map(i => i.id === change.id ? copy : i);
  };

  const promoteChange = (change: ScenarioChange) => {
    if (!activeScenario) return;
    if (change.type === 'income') {
      const next = promoteInto(data.incomes, activeScenario.incomes.find(i => i.id === change.id), change);
      if (next) updateData({ incomes: next });
    } else {
      const next = promoteInto(data.expenses, activeScenario.expenses.find(e => e.id === change.id), change);
      if (next) updateData({ expenses: next });
    }
  };

  // What "Make real" will actually do — spelled out before it happens, since
  // promoting supersedes or stops items in Reality rather than just copying them.
  const describePromotion = (change: ScenarioChange): string => {
    if (change.kind === 'added') return `Adds ${change.name} to Reality.`;
    if (change.kind === 'removed') return `Stops ${change.name} in Reality from today. Its history stays visible.`;

    const original: Income | Expense | undefined = change.type === 'income'
      ? data.incomes.find(i => i.id === change.id)
      : data.expenses.find(e => e.id === change.id);
    const source: Income | Expense | undefined = change.type === 'income'
      ? activeScenario?.incomes.find(i => i.id === change.id)
      : activeScenario?.expenses.find(e => e.id === change.id);
    const prep = original && source ? prepareEdit(original, source) : null;

    if (prep) {
      return `Applies to ${change.name} in Reality from `
        + `${new Date(prep.effectiveFrom + 'T12:00:00').toLocaleDateString()}. `
        + 'Everything before that date stays exactly as it was.';
    }
    return `Updates ${change.name} in Reality.`;
  };

  const addIncome = (income: Omit<Income, 'id'>) => { updateBudget({ incomes: [...budget.incomes, { ...income, id: Date.now().toString() }] }); setModal(null); };
  const updateIncome = (id: string, updates: Partial<Income>) => { updateBudget({ incomes: budget.incomes.map(i => i.id === id ? pruneOrphanedOverrides({ ...i, ...updates }) : i) }); setModal(null); setEditingItem(null); };
  const deleteIncome = (id: string) => { updateBudget({ incomes: budget.incomes.filter(i => i.id !== id) }); };
  const addExpense = (expense: Omit<Expense, 'id'>) => { updateBudget({ expenses: [...budget.expenses, { ...expense, id: Date.now().toString() }] }); setModal(null); };
  const updateExpense = (id: string, updates: Partial<Expense>) => { updateBudget({ expenses: budget.expenses.map(e => e.id === id ? pruneOrphanedOverrides({ ...e, ...updates }) : e) }); setModal(null); setEditingItem(null); };
  const deleteExpense = (id: string) => { updateBudget({ expenses: budget.expenses.filter(e => e.id !== id) }); };

  const addCheckpoint = () => {
    const amount = parseFloat(newCheckpoint.amount);
    if (!newCheckpoint.date || isNaN(amount)) return;
    updateData({
      checkpoints: [
        ...(data.checkpoints || []).filter(c => c.date !== newCheckpoint.date),
        { id: Date.now().toString(), date: newCheckpoint.date, actualBalance: amount, note: newCheckpoint.note || undefined }
      ]
    });
    setNewCheckpoint({ date: formatDateStr(new Date()), amount: '', note: '' });
  };

  const deleteCheckpoint = (id: string) => {
    updateData({ checkpoints: (data.checkpoints || []).filter(c => c.id !== id) });
  };

  // Today as YYYY-MM-DD (local time)
  const todayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  // Click handler for the × button on a recurring item.
  // For non-recurring items (once / gig), just delete — there's no "history vs future" distinction.
  // For recurring items, open the confirm modal so the user can choose: stop forward vs delete entirely.
  const requestDeleteExpense = (expense: Expense) => {
    if (expense.frequency === 'once') { deleteExpense(expense.id); return; }
    setDeleteConfirm({ type: 'expense', item: expense });
  };
  const requestDeleteIncome = (income: Income) => {
    if (income.frequency === 'once' || income.frequency === 'gig') { deleteIncome(income.id); return; }
    setDeleteConfirm({ type: 'income', item: income });
  };

  // Stop the recurrence going forward without wiping history.
  const stopExpenseForward = (id: string) => {
    updateBudget({ expenses: budget.expenses.map(e => e.id === id ? { ...e, endDate: todayStr() } : e) });
    setDeleteConfirm(null);
  };
  const stopIncomeForward = (id: string) => {
    updateBudget({ incomes: budget.incomes.map(i => i.id === id ? { ...i, endDate: todayStr() } : i) });
    setDeleteConfirm(null);
  };

  // Gig income management functions
  const addGigPayment = (incomeId: string, payment: Omit<ScheduledPayment, 'id'>) => {
    const income = budget.incomes.find(i => i.id === incomeId);
    if (!income || income.frequency !== 'gig') return;

    const newPayment: ScheduledPayment = {
      ...payment,
      id: Date.now().toString()
    };

    const updatedPayments = [...(income.scheduledPayments || []), newPayment];
    updateBudget({
      incomes: budget.incomes.map(i =>
        i.id === incomeId ? { ...i, scheduledPayments: updatedPayments } : i
      )
    });
    setModal(null);
    setEditingItem(null);
    setEditingGigPayment(null);
  };

  const updateGigPayment = (incomeId: string, paymentId: string, updates: Partial<ScheduledPayment>) => {
    const income = budget.incomes.find(i => i.id === incomeId);
    if (!income || income.frequency !== 'gig') return;

    const updatedPayments = (income.scheduledPayments || []).map(p =>
      p.id === paymentId ? { ...p, ...updates } : p
    );

    updateBudget({
      incomes: budget.incomes.map(i =>
        i.id === incomeId ? { ...i, scheduledPayments: updatedPayments } : i
      )
    });
    setModal(null);
    setEditingItem(null);
    setEditingGigPayment(null);
  };

  const deleteGigPayment = (incomeId: string, paymentId: string) => {
    const income = budget.incomes.find(i => i.id === incomeId);
    if (!income || income.frequency !== 'gig') return;

    const updatedPayments = (income.scheduledPayments || []).filter(p => p.id !== paymentId);

    updateBudget({
      incomes: budget.incomes.map(i =>
        i.id === incomeId ? { ...i, scheduledPayments: updatedPayments } : i
      )
    });
  };

  // Helper to get gig income sources
  const gigIncomes = useMemo(() =>
    budget.incomes.filter(i => i.frequency === 'gig'),
    [budget.incomes]
  );

  // Helper to get regular (non-gig) income sources
  const regularIncomes = useMemo(() =>
    budget.incomes.filter(i => i.frequency !== 'gig'),
    [budget.incomes]
  );

  // Type-safe save handlers for modals
  // How many occurrences has this item already produced? Zero means editing it
  // retroactively can't break anything, so we shouldn't ask.
  const countPastOccurrences = (item: Income | Expense): number => {
    const today = todayStr();
    const startStr = item.startDate || item.date;
    if (!startStr || startStr >= today) return 0;

    const start = parseDate(startStr);
    let year = start.getFullYear();
    let month = start.getMonth();
    const now = new Date();
    let guard = 0;
    let count = 0;

    while ((year < now.getFullYear() || (year === now.getFullYear() && month <= now.getMonth())) && guard < 600) {
      count += getOccurrencesInMonth(item, year, month).filter(o => o.dateStr < today).length;
      if (count > 500) break; // enough to know it's "a lot"
      month++;
      if (month > 11) { month = 0; year++; }
      guard++;
    }
    return count;
  };

  // First scheduled occurrence on or after a date — the natural point for a
  // change to take effect, so a mid-cycle edit doesn't invent an extra payment.
  const nextOccurrenceOnOrAfter = (item: Income | Expense, fromDateStr: string): string | null => {
    const from = parseDate(fromDateStr);
    let year = from.getFullYear();
    let month = from.getMonth();
    for (let i = 0; i < 24; i++) {
      const hit = getOccurrencesInMonth(item, year, month).find(o => o.dateStr >= fromDateStr);
      if (hit) return hit.dateStr;
      month++;
      if (month > 11) { month = 0; year++; }
    }
    return null;
  };

  // Cap the old version the day before the change and start a new one, both
  // tagged with the same seriesId so the list still shows a single item.
  const supersedeInList = <T extends Income | Expense>(
    items: T[],
    id: string,
    draft: Partial<T>,
    effectiveFrom: string
  ): T[] | null => {
    const original = items.find(i => i.id === id);
    if (!original) return null;

    const seriesId = original.seriesId || original.id;
    const lastDayOfOldVersion = formatDateStr(new Date(parseDate(effectiveFrom).getTime() - 86400000));
    const draftEnd = (draft as Income).endDate;

    const successor = {
      ...(draft as object),
      id: `${Date.now()}`,
      seriesId,
      startDate: effectiveFrom,
      endDate: draftEnd && draftEnd < effectiveFrom ? undefined : draftEnd,
      // Per-instance edits belong to the version that was running at the time
      overrides: undefined
    } as T;

    // Insert the new version right after the old one so list and day-event
    // ordering stay put instead of the item jumping to the bottom.
    return items.flatMap(i => i.id === id
      ? [pruneOrphanedOverrides({ ...i, seriesId, endDate: lastDayOfOldVersion } as T), successor]
      : [i]);
  };

  // Fold an earlier version back into the one that replaced it: the later version's
  // amounts take over its whole date range and the extra entry disappears. This is
  // the repair for a version that shouldn't have been split off in the first place
  // — no dates lose their payment, so nothing disappears from history.
  const combineVersions = <T extends Income | Expense>(items: T[], versionId: string, successorId: string): T[] => {
    const version = items.find(i => i.id === versionId);
    const successor = items.find(i => i.id === successorId);
    if (!version || !successor) return items;

    const startDate = version.startDate || version.date || successor.startDate;
    return items
      .filter(i => i.id !== versionId)
      .map(i => i.id === successorId
        ? pruneOrphanedOverrides({
            ...i,
            startDate,
            // Per-instance edits from both stretches survive wherever they still
            // line up with a real occurrence; pruning drops the rest.
            overrides: [...(version.overrides || []), ...(successor.overrides || [])]
          } as T)
        : i);
  };

  const applyVersionAction = (mode: 'combine' | 'delete') => {
    if (!versionAction) return;
    const { type, versionId, successorId } = versionAction;

    if (type === 'income') {
      const next = mode === 'combine'
        ? combineVersions(budget.incomes, versionId, successorId)
        : budget.incomes.filter(i => i.id !== versionId);
      updateBudget({ incomes: next });
    } else {
      const next = mode === 'combine'
        ? combineVersions(budget.expenses, versionId, successorId)
        : budget.expenses.filter(e => e.id !== versionId);
      updateBudget({ expenses: next });
    }

    setVersionAction(null);
  };

  // Would this edit rewrite history? If so, return what to ask the user.
  const prepareEdit = (original: Income | Expense, d: ItemDraft) => {
    // One-time and gig items have no recurring history to rewrite
    if (original.frequency === 'once' || original.frequency === 'gig') return null;
    const changes = getProjectionChanges(original, d);
    if (changes.length === 0) return null;
    const pastCount = countPastOccurrences(original);
    if (pastCount === 0) return null;
    return {
      changes,
      pastCount,
      // Per-instance edits that won't survive a schedule change
      orphanedOverrides: (original.overrides || []).length > 0 && !!d.startDate && d.startDate !== (original.startDate || original.date)
        ? (original.overrides || []).length
        : 0,
      effectiveFrom: nextOccurrenceOnOrAfter(original, todayStr()) || todayStr()
    };
  };

  const applyPendingChange = (mode: 'retroactive' | 'forward') => {
    if (!pendingChange) return;

    if (mode === 'retroactive') {
      if (pendingChange.type === 'expense') updateExpense(pendingChange.id, pendingChange.data);
      else updateIncome(pendingChange.id, pendingChange.data);
    } else if (pendingChange.type === 'expense') {
      const next = supersedeInList(budget.expenses, pendingChange.id, pendingChange.data, pendingChange.effectiveFrom);
      if (next) updateBudget({ expenses: next });
    } else {
      const next = supersedeInList(budget.incomes, pendingChange.id, pendingChange.data, pendingChange.effectiveFrom);
      if (next) updateBudget({ incomes: next });
    }

    setPendingChange(null);
    setModal(null);
    setEditingItem(null);
  };

  const handleSaveIncome = (d: Omit<Income, 'id'>) => {
    if (!editingItem) { addIncome(d); return; }
    const original = budget.incomes.find(i => i.id === editingItem.id);
    const prep = original ? prepareEdit(original, d) : null;
    if (original && prep) {
      setPendingChange({ type: 'income', id: original.id, name: original.name, data: d, ...prep });
      setEditingItem(null);
      setModal('apply-change');
      return;
    }
    updateIncome(editingItem.id, d);
  };

  const handleSaveExpense = (d: Omit<Expense, 'id'>) => {
    if (!editingItem) { addExpense(d); return; }
    const original = budget.expenses.find(e => e.id === editingItem.id);
    const prep = original ? prepareEdit(original, d) : null;
    if (original && prep) {
      setPendingChange({ type: 'expense', id: original.id, name: original.name, data: d, ...prep });
      setEditingItem(null);
      setModal('apply-change');
      return;
    }
    updateExpense(editingItem.id, d);
  };

  // Handle gig payment save
  const handleSaveGigPayment = (incomeId: string, payment: Omit<ScheduledPayment, 'id'>) => {
    if (editingGigPayment) {
      updateGigPayment(incomeId, editingGigPayment.id, payment);
    } else {
      addGigPayment(incomeId, payment);
    }
  };

  // Handle instance override
  const handleSaveInstanceOverride = (override: InstanceOverride) => {
    if (!editingEvent || !editingItem) return;
    
    const currentItem = editingEvent.type === 'income'
      ? budget.incomes.find(i => i.id === editingItem.id)
      : budget.expenses.find(e => e.id === editingItem.id);
    
    if (!currentItem) return;
    
    const existingOverrides = currentItem.overrides || [];
    const newOverrides = existingOverrides.filter(o => o.originalDate !== override.originalDate);
    newOverrides.push(override);
    
    if (editingEvent.type === 'income') {
      updateIncome(editingItem.id, { overrides: newOverrides });
    } else {
      updateExpense(editingItem.id, { overrides: newOverrides });
    }
    setEditingEvent(null);
  };

  const handleRemoveInstanceOverride = () => {
    if (!editingEvent || !editingItem) return;
    
    // Get fresh reference to the item from current data
    const currentItem = editingEvent.type === 'income'
      ? budget.incomes.find(i => i.id === editingItem.id)
      : budget.expenses.find(e => e.id === editingItem.id);
    
    if (!currentItem) return;
    
    const originalDate = editingEvent.originalDate || editingEvent.instanceDate;
    const newOverrides = (currentItem.overrides || []).filter(o => o.originalDate !== originalDate);
    
    if (editingEvent.type === 'income') {
      updateIncome(editingItem.id, { overrides: newOverrides });
    } else {
      updateExpense(editingItem.id, { overrides: newOverrides });
    }
    setEditingEvent(null);
  };

  const handleEditRecurring = () => {
    if (!editingEvent || !editingItem) return;
    setEditingEvent(null);
    
    if (editingEvent.type === 'income') {
      const income = editingItem as Income;
      setModal(income.frequency === 'once' ? 'income-once' : 'income');
    } else {
      const expense = editingItem as Expense;
      if (expense.category === 'credit_card') setModal('credit-card');
      else if (expense.frequency === 'payment_plan') setModal('payment-plan');
      else if (expense.frequency === 'once') setModal('expense-once');
      else setModal('expense');
    }
  };

  // Every real balance the user has recorded, oldest first. The starting point in
  // Settings is simply checkpoint zero.
  const balanceAnchors = useMemo(() => {
    const list = [{ date: data.startingDate, balance: data.startingBalance }];
    (data.checkpoints || []).forEach(c => list.push({ date: c.date, balance: c.actualBalance }));
    return list.sort((a, b) => a.date.localeCompare(b.date));
  }, [data.startingDate, data.startingBalance, data.checkpoints]);

  // The most recent real balance on or before a date. Projecting from here rather
  // than from the original starting balance keeps the forecast tied to reality.
  const anchorOnOrBefore = (dateStr: string, anchors = balanceAnchors) => {
    let chosen = anchors[0];
    for (const anchor of anchors) {
      if (anchor.date <= dateStr) chosen = anchor;
      else break;
    }
    return chosen;
  };

  // Checkpoint balances by date — a checkpoint resets the running balance at the
  // start of its day, before that day's transactions.
  const checkpointByDate = useMemo(() => {
    const map = new Map<string, number>();
    (data.checkpoints || []).forEach(c => map.set(c.date, c.actualBalance));
    return map;
  }, [data.checkpoints]);

  const dailyData: DayData[] = useMemo(() => {
    const { year, month } = selectedMonth;
    const days: DayData[] = [];

    // Anchor to the latest real balance recorded before this month begins
    const anchor = anchorOnOrBefore(`${monthKey(year, month)}-01`);
    const startDate = parseDate(anchor.date);
    const startYear = startDate.getFullYear();
    const startMonth = startDate.getMonth();
    const startDay = startDate.getDate();

    // Calculate balance at the start of the selected month
    // by processing all transactions from the anchor to end of previous month
    let balanceAtMonthStart = anchor.balance;

    // Process from the anchor date forward to the day before selected month
    let tempYear = startYear;
    let tempMonth = startMonth;

    while (tempYear < year || (tempYear === year && tempMonth < month)) {
      const daysInThisMonth = getDaysInMonth(tempYear, tempMonth);
      const dayStart = (tempYear === startYear && tempMonth === startMonth) ? startDay : 1;
      
      for (let d = dayStart; d <= daysInThisMonth; d++) {
        budget.incomes.forEach(income => {
          const occurrences = getOccurrencesInMonth(income, tempYear, tempMonth);
          occurrences.filter(o => o.day === d).forEach(occ => {
            balanceAtMonthStart += occ.amount;
          });
        });
        budget.expenses.forEach(expense => {
          const occurrences = getOccurrencesInMonth(expense, tempYear, tempMonth);
          occurrences.filter(o => o.day === d).forEach(occ => {
            balanceAtMonthStart -= occ.amount;
          });
        });
      }
      
      tempMonth++;
      if (tempMonth > 11) {
        tempMonth = 0;
        tempYear++;
      }
    }
    
    // Now calculate daily data for the selected month
    let runningBalance = balanceAtMonthStart;
    const isStartMonth = year === startYear && month === startMonth;
    const firstDayToProcess = isStartMonth ? startDay : 1;
    
    // For days before the start date in the starting month, show no balance
    if (isStartMonth && startDay > 1) {
      for (let day = 1; day < startDay; day++) {
        days.push({ day, events: [], change: 0, balance: 0 });
      }
    }
    
    for (let day = firstDayToProcess; day <= getDaysInMonth(year, month); day++) {
      // A checkpoint recorded on this day snaps the projection back to reality
      const checkpoint = checkpointByDate.get(`${monthKey(year, month)}-${String(day).padStart(2, '0')}`);
      if (checkpoint !== undefined) runningBalance = checkpoint;

      let dayChange = 0;
      const events: DayEvent[] = [];

      budget.incomes.forEach(income => {
        const occurrences = getOccurrencesInMonth(income, year, month);
        // Use filter to get all occurrences on this day (supports splits)
        const dayOccurrences = occurrences.filter(o => o.day === day);
        dayOccurrences.forEach(occ => {
          dayChange += occ.amount;
          events.push({
            type: 'income',
            name: income.name,
            amount: occ.amount,
            id: income.id,
            isOverride: occ.isOverride,
            isSkipped: occ.isSkipped,
            isSplit: occ.isSplit,
            originalDate: occ.originalDate,
            instanceDate: occ.dateStr
          });
        });
      });
      
      budget.expenses.forEach(expense => {
        const occurrences = getOccurrencesInMonth(expense, year, month);
        // Use filter to get all occurrences on this day (supports splits)
        const dayOccurrences = occurrences.filter(o => o.day === day);
        dayOccurrences.forEach(occ => {
          dayChange -= occ.amount;
          events.push({
            type: 'expense',
            name: expense.name + (occ.splitPart ? ` (${occ.splitPart}/2)` : ''),
            amount: occ.amount,
            category: expense.category,
            id: expense.id,
            isOverride: occ.isOverride,
            isSkipped: occ.isSkipped,
            isSplit: occ.isSplit,
            splitPart: occ.splitPart,
            originalDate: occ.originalDate,
            instanceDate: occ.dateStr
          });
        });
      });
      
      // Stamp each event with the balance right after it, so the list can show
      // a running balance per transaction rather than one per day.
      let afterEvent = runningBalance;
      events.forEach(event => {
        afterEvent += event.type === 'income' ? event.amount : -event.amount;
        event.runningBalance = afterEvent;
      });

      runningBalance += dayChange;
      days.push({ day, events, change: dayChange, balance: runningBalance });
    }
    return days;
  }, [data, selectedMonth]);

  const stats = useMemo(() => {
    const lowestDay = dailyData.reduce((min, d) => d.balance < min.balance ? d : min, dailyData[0] || { balance: 0, day: 1 });
    const totalIncome = dailyData.reduce((sum, d) => sum + d.events.filter(e => e.type === 'income').reduce((s, e) => s + e.amount, 0), 0);
    const totalExpenses = dailyData.reduce((sum, d) => sum + d.events.filter(e => e.type === 'expense').reduce((s, e) => s + e.amount, 0), 0);
    return { lowestBalance: lowestDay?.balance ?? 0, lowestDay: lowestDay?.day ?? 1, endingBalance: dailyData[dailyData.length - 1]?.balance ?? data.startingBalance, totalIncome, totalExpenses, availableForVariable: totalIncome - totalExpenses };
  }, [dailyData, data]);

  // Today's balance, projected forward from the most recent real balance recorded
  const todaysBalance = useMemo(() => {
    const today = new Date();
    const todayYear = today.getFullYear();
    const todayMonth = today.getMonth();
    const todayDay = today.getDate();

    const anchor = anchorOnOrBefore(formatDateStr(today));
    const startDate = parseDate(anchor.date);
    const startYear = startDate.getFullYear();
    const startMonth = startDate.getMonth();
    const startDay = startDate.getDate();

    let balance = anchor.balance;

    // Process from starting date to today
    let tempYear = startYear;
    let tempMonth = startMonth;
    
    while (tempYear < todayYear || (tempYear === todayYear && tempMonth <= todayMonth)) {
      const daysInThisMonth = getDaysInMonth(tempYear, tempMonth);
      const dayStart = (tempYear === startYear && tempMonth === startMonth) ? startDay : 1;
      const dayEnd = (tempYear === todayYear && tempMonth === todayMonth) ? todayDay : daysInThisMonth;
      
      for (let d = dayStart; d <= dayEnd; d++) {
        budget.incomes.forEach(income => {
          const occurrences = getOccurrencesInMonth(income, tempYear, tempMonth);
          occurrences.filter(o => o.day === d).forEach(occ => {
            balance += occ.amount;
          });
        });
        budget.expenses.forEach(expense => {
          const occurrences = getOccurrencesInMonth(expense, tempYear, tempMonth);
          occurrences.filter(o => o.day === d).forEach(occ => {
            balance -= occ.amount;
          });
        });
      }
      
      tempMonth++;
      if (tempMonth > 11) {
        tempMonth = 0;
        tempYear++;
      }
    }
    
    return balance;
  }, [data]);

  // Balance the projection expects at the start of targetDate, running forward
  // from a given anchor and ignoring anything recorded after it.
  const projectBalanceAt = (anchor: { date: string; balance: number }, targetDateStr: string): number => {
    const start = parseDate(anchor.date);
    const target = parseDate(targetDateStr);
    if (target <= start) return anchor.balance;

    let balance = anchor.balance;
    let year = start.getFullYear();
    let month = start.getMonth();

    while (year < target.getFullYear() || (year === target.getFullYear() && month <= target.getMonth())) {
      const isFirstMonth = year === start.getFullYear() && month === start.getMonth();
      const isLastMonth = year === target.getFullYear() && month === target.getMonth();
      const from = isFirstMonth ? start.getDate() : 1;
      // Stop the day before the target — a checkpoint records the balance at the
      // start of its date, before that day's transactions.
      const to = isLastMonth ? target.getDate() - 1 : getDaysInMonth(year, month);

      for (let d = from; d <= to; d++) {
        budget.incomes.forEach(income => {
          getOccurrencesInMonth(income, year, month).forEach(occ => { if (occ.day === d) balance += occ.amount; });
        });
        budget.expenses.forEach(expense => {
          getOccurrencesInMonth(expense, year, month).forEach(occ => { if (occ.day === d) balance -= occ.amount; });
        });
      }

      month++;
      if (month > 11) { month = 0; year++; }
    }
    return balance;
  };

  // Each checkpoint vs. what the budget predicted for that date. Drift is the
  // money the budget didn't account for: negative means you spent more than planned.
  const checkpointAnalysis = useMemo(() => {
    const sorted = [...(data.checkpoints || [])].sort((a, b) => a.date.localeCompare(b.date));
    return sorted.map(checkpoint => {
      const prior = balanceAnchors.filter(a => a.date < checkpoint.date);
      const anchor = prior.length ? prior[prior.length - 1] : balanceAnchors[0];
      const predicted = projectBalanceAt(anchor, checkpoint.date);
      const days = Math.max(1, Math.round((parseDate(checkpoint.date).getTime() - parseDate(anchor.date).getTime()) / 86400000));
      const drift = checkpoint.actualBalance - predicted;
      return { ...checkpoint, predicted, drift, anchorDate: anchor.date, days, driftPerMonth: (drift / days) * 30.44 };
    });
  }, [data, balanceAnchors]);

  // What the drift says about the budget as a whole.
  const driftInsight = useMemo(() => {
    if (checkpointAnalysis.length === 0) return null;
    const latest = checkpointAnalysis[checkpointAnalysis.length - 1];
    const avgPerMonth = checkpointAnalysis.reduce((sum, c) => sum + c.driftPerMonth, 0) / checkpointAnalysis.length;
    // Clamp: a checkpoint dated in the future shouldn't read as negative days
    const daysSince = Math.max(0, Math.round((new Date().getTime() - parseDate(latest.date).getTime()) / 86400000));
    return { latest, avgPerMonth, daysSince, count: checkpointAnalysis.length };
  }, [checkpointAnalysis]);

  // Walk a budget's whole timeline once, from the first real balance through the
  // end of the requested month, and summarize each month. This is what makes
  // comparing several budgets side by side affordable.
  const projectTimeline = (
    incomes: Income[],
    expenses: Expense[],
    endYear: number,
    endMonth: number
  ): MonthProjection[] => {
    const first = balanceAnchors[0];
    const start = parseDate(first.date);
    const result: MonthProjection[] = [];

    let balance = first.balance;
    let year = start.getFullYear();
    let month = start.getMonth();

    while (year < endYear || (year === endYear && month <= endMonth)) {
      const daysInMonth = getDaysInMonth(year, month);
      const fromDay = (year === start.getFullYear() && month === start.getMonth()) ? start.getDate() : 1;
      let lowest = Infinity;
      let lowestDay = fromDay;
      let income = 0;
      let spend = 0;

      for (let d = fromDay; d <= daysInMonth; d++) {
        const checkpoint = checkpointByDate.get(`${monthKey(year, month)}-${String(d).padStart(2, '0')}`);
        if (checkpoint !== undefined) balance = checkpoint;

        incomes.forEach(item => {
          getOccurrencesInMonth(item, year, month).forEach(occ => {
            if (occ.day === d) { balance += occ.amount; income += occ.amount; }
          });
        });
        expenses.forEach(item => {
          getOccurrencesInMonth(item, year, month).forEach(occ => {
            if (occ.day === d) { balance -= occ.amount; spend += occ.amount; }
          });
        });

        if (balance < lowest) { lowest = balance; lowestDay = d; }
      }

      result.push({
        year, month,
        monthEnd: balance,
        lowest: lowest === Infinity ? balance : lowest,
        lowestDay, income, expenses: spend
      });

      month++;
      if (month > 11) { month = 0; year++; }
    }
    return result;
  };

  // Headline numbers for one budget over the selected time range.
  const summarizeBudget = (incomes: Income[], expenses: Expense[]) => {
    const now = new Date();
    const monthCounts: Record<string, number> = { '6m': 6, '1y': 12, '2y': 24, '5y': 60, '10y': 120, '15y': 180 };
    const horizon = new Date(now.getFullYear(), now.getMonth() + (monthCounts[timeRange] || 12), 1);
    const timeline = projectTimeline(incomes, expenses, horizon.getFullYear(), horizon.getMonth());

    // Only look forward — the past is the same for every scenario
    const future = timeline.filter(t => t.year > now.getFullYear() || (t.year === now.getFullYear() && t.month >= now.getMonth()));
    const last = future[future.length - 1] ?? timeline[timeline.length - 1];

    let lowest = Infinity;
    let lowestAt: MonthProjection | null = null;
    let firstNegative: MonthProjection | null = null;
    for (const t of future) {
      if (t.lowest < lowest) { lowest = t.lowest; lowestAt = t; }
      if (!firstNegative && t.lowest < 0) firstNegative = t;
    }

    const totalIncome = future.reduce((sum, t) => sum + t.income, 0);
    const totalSpend = future.reduce((sum, t) => sum + t.expenses, 0);

    // When the last balance-tracked expense clears
    let debtFreeDate: string | null = null;
    let anyNeverClears = false;
    expenses.filter(e => e.creditCard).forEach(e => {
      const schedule = getBalanceSchedule(e);
      if (schedule.neverPaysOff || !schedule.paidOffDate) anyNeverClears = true;
      else if (!debtFreeDate || schedule.paidOffDate > debtFreeDate) debtFreeDate = schedule.paidOffDate;
    });

    return {
      endBalance: last?.monthEnd ?? 0,
      lowest: lowest === Infinity ? (last?.monthEnd ?? 0) : lowest,
      lowestAt,
      firstNegative,
      avgNet: (totalIncome - totalSpend) / Math.max(1, future.length),
      debtFreeDate,
      anyNeverClears,
      hasDebt: expenses.some(e => e.creditCard)
    };
  };

  // Reality vs. every scenario. Only computed while the compare view is open.
  const scenarioComparison = useMemo(() => {
    if (modal !== 'scenario-compare') return null;
    return [
      { id: null as string | null, name: 'Reality', ...summarizeBudget(data.incomes, data.expenses) },
      ...(data.scenarios || []).map(s => ({ id: s.id as string | null, name: s.name, ...summarizeBudget(s.incomes, s.expenses) }))
    ];
  }, [modal, data, balanceAnchors, checkpointByDate, timeRange]);

  const months = useMemo(() => {
    const result = [];
    const now = new Date();
    const monthCounts: Record<string, number> = { '6m': 6, '1y': 12, '2y': 24, '5y': 60, '10y': 120, '15y': 180 };
    const futureCount = monthCounts[timeRange] || 12;
    
    // Calculate past months from startingDate
    const startDate = parseDate(data.startingDate);
    const startYear = startDate.getFullYear();
    const startMonth = startDate.getMonth();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    
    // Months from start date to current month
    const pastMonthCount = (currentYear - startYear) * 12 + (currentMonth - startMonth);
    
    // Start from the startingDate month
    for (let i = -pastMonthCount; i < futureCount; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      result.push({
        year: d.getFullYear(),
        month: d.getMonth(),
        label: d.toLocaleString('default', { month: 'short', year: 'numeric' }),
        shortLabel: d.toLocaleString('default', { month: 'short' }) + ' ' + String(d.getFullYear()).slice(2)
      });
    }
    return result;
  }, [timeRange, data.startingDate]);
  const alerts = useMemo(() => { const result = []; if (stats.lowestBalance < data.floorThreshold) result.push({ type: 'danger', title: 'Critical Balance Alert', text: `Balance drops to ${formatCurrency(stats.lowestBalance)} on day ${stats.lowestDay}` }); else if (stats.lowestBalance < data.warningThreshold) result.push({ type: 'warning', title: 'Low Balance Warning', text: `Balance drops to ${formatCurrency(stats.lowestBalance)} on day ${stats.lowestDay}` }); return result; }, [stats, data.floorThreshold, data.warningThreshold]);
  const getBalanceStatus = (balance: number) => { if (balance < data.floorThreshold) return 'danger'; if (balance < data.warningThreshold) return 'warning'; return 'safe'; };
  const groupedExpenses = useMemo(() => {
    const groups: Record<string, ItemSeries<Expense>[]> = {};
    expenseCategories.forEach(cat => { groups[cat.value] = []; });
    // Group by series so successive versions of one expense share a row
    groupIntoSeries(budget.expenses).forEach(series => {
      (groups[series.current.category] || groups['other']).push(series);
    });
    return groups;
  }, [budget.expenses]);

  const incomeSeries = useMemo(() => groupIntoSeries(regularIncomes), [regularIncomes]);

  const toggleSeries = (key: string) =>
    setExpandedSeries(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);

  // "Was $1,650.00/mo until Aug 31, 2026"
  // An item's history: every version of it, oldest first, in plain language. Prior
  // versions are the amounts that were really in effect back then, so correcting
  // one is funnelled through a confirm — a stray tap must not rewrite past months.
  const renderItemHistory = (type: 'income' | 'expense', series: ItemSeries<Income | Expense>) => {
    const priorCount = series.versions.length - 1;
    if (priorCount < 1) return null;
    const isExpanded = expandedSeries.includes(series.key);

    return (
      <div className="mt-1">
        <button
          onClick={() => toggleSeries(series.key)}
          className="text-xs text-blue-400 hover:text-blue-300"
        >
          {isExpanded ? '▾' : '▸'} Amount changed {priorCount === 1 ? 'once' : `${priorCount} times`} — show history
        </button>
        {isExpanded && (
          <div className="mt-1 space-y-1 border-l border-gray-700 pl-2">
            {series.versions.map((version, i) => {
              const isCurrent = i === series.versions.length - 1;
              return (
                <div key={version.id} className="flex items-center justify-between gap-2 text-xs">
                  <span className={isCurrent ? 'text-gray-300' : 'text-gray-500'}>
                    {versionSummary(version)}
                    {isCurrent && <span className="text-green-400/80"> — current</span>}
                  </span>
                  {!isCurrent && (
                    <button
                      onClick={() => setVersionAction({ type, versionId: version.id, successorId: series.versions[i + 1].id })}
                      className="text-blue-400/70 hover:text-blue-300 whitespace-nowrap"
                    >
                      Not right?
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const versionSummary = (item: Income | Expense) =>
    `${formatCurrency(item.amount)} ${frequencyLabels[item.frequency] || ''}`
    + (item.startDate || item.date ? ` from ${new Date((item.startDate || item.date)! + 'T12:00:00').toLocaleDateString()}` : '')
    + (item.endDate ? ` until ${new Date(item.endDate + 'T12:00:00').toLocaleDateString()}` : '');

  // Remaining balance and payoff outlook for any balance-tracked expense,
  // as of the month currently being viewed.
  const getTrackedBalance = (expense: Expense): { remaining: number; isPaidOff: boolean; monthsRemaining: number; payoffDate: string | null; neverPaysOff: boolean } => {
    if (!expense.creditCard) return { remaining: 0, isPaidOff: true, monthsRemaining: 0, payoffDate: null, neverPaysOff: false };

    const { year, month } = selectedMonth;
    const schedule = getBalanceSchedule(expense);
    const remaining = getRemainingBalanceAtMonth(expense, year, month);

    if (remaining <= 0.005) return { remaining: 0, isPaidOff: true, monthsRemaining: 0, payoffDate: null, neverPaysOff: false };
    if (schedule.neverPaysOff || !schedule.paidOffDate) {
      return { remaining, isPaidOff: false, monthsRemaining: 0, payoffDate: 'none at this payment', neverPaysOff: true };
    }

    const payoff = parseDate(schedule.paidOffDate);
    const monthsRemaining = Math.max(0, (payoff.getFullYear() - year) * 12 + (payoff.getMonth() - month));
    return {
      remaining,
      isPaidOff: false,
      monthsRemaining,
      payoffDate: payoff.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      neverPaysOff: false
    };
  };

  // What the projection expects a tracked balance to be on a given date. Used to
  // show the gap when a real balance is re-recorded — that gap is the charges (or
  // extra payments) the projection never knew about.
  const getProjectedBalanceOnDate = (expense: Expense, dateStr: string): number => {
    const cc = expense.creditCard;
    if (!cc) return 0;
    const schedule = getBalanceSchedule(expense);
    // Before the current anchor there's nothing projected yet — the recorded
    // balance is all we know.
    if (dateStr <= (cc.balanceAsOfDate || '')) return schedule.startBalance;

    // The schedule already recorded the balance after every payment, so this is
    // the most recent one on or before the date — no second amortization to keep
    // in step with the first.
    let latestDate = '';
    schedule.balanceAfter.forEach((_, occDate) => {
      if (occDate <= dateStr && occDate > latestDate) latestDate = occDate;
    });
    return latestDate ? Math.max(0, schedule.balanceAfter.get(latestDate)!) : schedule.startBalance;
  };

  const handleEditEvent = (event: DayEvent) => {
    // Check if this event is more than 3 months old
    const eventDate = parseDate(event.instanceDate);
    const now = new Date();
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
    
    const item = event.type === 'income' 
      ? budget.incomes.find(i => i.id === event.id)
      : budget.expenses.find(e => e.id === event.id);
    
    if (!item) return;
    
    if (eventDate < threeMonthsAgo) {
      // Show warning for old months
      setOldMonthWarning({ show: true, event, item });
    } else {
      // Proceed directly
      setEditingItem(item);
      setEditingEvent(event);
      setModal('instance-edit');
    }
  };

  const confirmOldMonthEdit = () => {
    if (oldMonthWarning.event && oldMonthWarning.item) {
      setEditingItem(oldMonthWarning.item);
      setEditingEvent(oldMonthWarning.event);
      setModal('instance-edit');
    }
    setOldMonthWarning({ show: false, event: null, item: null });
  };

  const handleSignOut = async () => { 
    if (isPreviewMode && onExitPreview) {
      onExitPreview();
    } else {
      try {
        const { error } = await supabase.auth.signOut();
        if (error) {
          console.error('Sign out error:', error);
        }
        // Force reload to clear any cached state
        window.location.href = '/';
      } catch (err) {
        console.error('Sign out exception:', err);
        window.location.href = '/';
      }
    }
  };

  if (loading) return <div className="min-h-screen bg-gray-950 flex items-center justify-center"><div className="text-gray-400">Loading...</div></div>;

  // The live pair behind the "earlier amount" dialog, plus what each option costs.
  const versionDetail = (() => {
    if (!versionAction) return null;
    const items: (Income | Expense)[] = versionAction.type === 'income' ? budget.incomes : budget.expenses;
    const version = items.find(i => i.id === versionAction.versionId);
    const successor = items.find(i => i.id === versionAction.successorId);
    if (!version || !successor) return null;
    return {
      version,
      successor,
      pastCount: countPastOccurrences(version),
      tracksBalance: !!(version as Expense).creditCard || !!(successor as Expense).creditCard
    };
  })();

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 font-sans">
      {/* Preview Mode Banner */}
      {isPreviewMode && (
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-4 py-2 text-center text-sm">
          <span className="font-medium">🎮 Preview Mode</span>
          <span className="mx-2">—</span>
          <span className="opacity-90">Data is stored locally and will be cleared when you leave.</span>
          <button 
            onClick={onExitPreview} 
            className="ml-3 px-2 py-0.5 bg-white/20 hover:bg-white/30 rounded text-xs font-medium"
          >
            Exit Preview
          </button>
        </div>
      )}
      
      <header className="bg-gray-900 border-b border-gray-800 p-3 sticky top-0 z-50">
        <div className="flex justify-between items-center gap-3 max-w-6xl mx-auto">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-sm">💰</div>
            <span className="font-mono font-bold text-lg">CashFlow</span>
            {isPreviewMode && <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded">Preview</span>}
            {saving && <span className="text-xs text-gray-500">Saving...</span>}
          </div>
          <nav className="hidden sm:flex gap-1 bg-gray-800 p-1 rounded-lg">
            {['dashboard', 'income', 'expenses', 'settings'].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={`px-3 py-1.5 text-sm font-medium rounded-md capitalize ${activeTab === tab ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}>{tab}</button>
            ))}
          </nav>
          <button className="sm:hidden p-2 bg-gray-800 rounded-lg" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">{mobileMenuOpen ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /> : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />}</svg>
          </button>
        </div>
        {mobileMenuOpen && (
          <nav className="sm:hidden mt-3 flex flex-col gap-1 bg-gray-800 p-2 rounded-lg">
            {['dashboard', 'income', 'expenses', 'settings'].map(tab => (<button key={tab} onClick={() => { setActiveTab(tab); setMobileMenuOpen(false); }} className={`px-4 py-3 text-left text-sm font-medium rounded-md capitalize ${activeTab === tab ? 'bg-gray-700 text-white' : 'text-gray-400'}`}>{tab}</button>))}
            <button onClick={handleSignOut} className="px-4 py-3 text-left text-sm font-medium rounded-md text-red-400 hover:bg-gray-700">{isPreviewMode ? 'Exit Preview' : 'Sign Out'}</button>
          </nav>
        )}
      </header>

      <main className="p-2 sm:p-4 max-w-6xl mx-auto">
        {/* Scenario bar — always visible so you know which budget you're editing */}
        <div className={`mb-3 p-2 sm:p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center gap-2 ${activeScenario ? 'bg-purple-500/10 border-purple-500/40' : 'bg-gray-900 border-gray-800'}`}>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-lg">{activeScenario ? '🧪' : '🌍'}</span>
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-wide text-gray-500">Viewing</div>
              {renamingScenario && activeScenario ? (
                <input
                  autoFocus
                  defaultValue={activeScenario.name}
                  onBlur={e => renameScenario(activeScenario.id, e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') renameScenario(activeScenario.id, (e.target as HTMLInputElement).value); }}
                  className="px-2 py-0.5 bg-gray-800 border border-gray-700 rounded text-white text-sm"
                />
              ) : (
                <select
                  value={activeScenarioId ?? ''}
                  onChange={e => setActiveScenarioId(e.target.value || null)}
                  className={`bg-transparent font-semibold text-sm focus:outline-none cursor-pointer ${activeScenario ? 'text-purple-300' : 'text-white'}`}
                >
                  <option value="" className="bg-gray-900 text-white">Reality</option>
                  {(data.scenarios || []).map(s => (
                    <option key={s.id} value={s.id} className="bg-gray-900 text-white">{s.name}</option>
                  ))}
                </select>
              )}
            </div>
            {activeScenario && (
              <button
                onClick={() => setModal('scenario-changes')}
                className="ml-1 px-2 py-1 bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 rounded text-xs font-medium whitespace-nowrap"
              >
                {scenarioDiff.length} change{scenarioDiff.length === 1 ? '' : 's'}
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {activeScenario && (
              <>
                <button onClick={() => setRenamingScenario(true)} className="px-2.5 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-xs">Rename</button>
                <button onClick={() => setModal('scenario-discard')} className="px-2.5 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/30 rounded-lg text-xs">Discard</button>
              </>
            )}
            {(data.scenarios || []).length > 0 && (
              <button onClick={() => setModal('scenario-compare')} className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium">Compare</button>
            )}
            <button onClick={() => { setScenarioName(''); setModal('scenario-new'); }} className="px-2.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-medium whitespace-nowrap">
              + Scenario
            </button>
          </div>
        </div>

        {activeScenario && (
          <div className="mb-3 text-xs text-purple-300/70 px-1">
            Sandbox — edits here don&apos;t touch Reality. Forked {new Date(activeScenario.createdAt + 'T12:00:00').toLocaleDateString()}.
          </div>
        )}

        {activeTab === 'dashboard' && (
          <div className="space-y-3">
            {alerts.map((alert, i) => (<div key={i} className={`p-3 rounded-lg flex items-start gap-2 ${alert.type === 'danger' ? 'bg-red-500/10 border border-red-500/30 text-red-400' : 'bg-yellow-500/10 border border-yellow-500/30 text-yellow-400'}`}><span className="text-lg">{alert.type === 'danger' ? '🚨' : '⚠️'}</span><div><div className="font-semibold text-sm">{alert.title}</div><div className="text-xs opacity-90">{alert.text}</div></div></div>))}
            
            {/* Reality check — is the projection still tracking the real account? */}
            {(!driftInsight || driftInsight.daysSince >= 14) && (
              <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30 flex flex-col sm:flex-row sm:items-center gap-2">
                <span className="text-lg">🎯</span>
                <div className="flex-1">
                  <div className="font-semibold text-sm text-blue-300">
                    {driftInsight ? `Last reality check was ${driftInsight.daysSince} days ago` : 'Check the projection against reality'}
                  </div>
                  <div className="text-xs text-blue-300/80">
                    Record your real bank balance so projections re-anchor and you can see how far the budget drifted.
                  </div>
                </div>
                <button
                  onClick={() => setActiveTab('settings')}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg whitespace-nowrap"
                >
                  Record balance
                </button>
              </div>
            )}

            {driftInsight && driftInsight.daysSince < 14 && Math.abs(driftInsight.latest.drift) >= 1 && (
              <div className={`p-3 rounded-lg flex items-start gap-2 ${driftInsight.latest.drift < 0 ? 'bg-red-500/10 border border-red-500/30' : 'bg-green-500/10 border border-green-500/30'}`}>
                <span className="text-lg">{driftInsight.latest.drift < 0 ? '📉' : '📈'}</span>
                <div>
                  <div className={`font-semibold text-sm ${driftInsight.latest.drift < 0 ? 'text-red-400' : 'text-green-400'}`}>
                    {driftInsight.latest.drift < 0 ? 'Behind' : 'Ahead of'} projection by {formatCurrency(Math.abs(driftInsight.latest.drift))}
                  </div>
                  <div className="text-xs text-gray-400">
                    Over the {driftInsight.latest.days} days since your last checkpoint — about {formatCurrency(Math.abs(driftInsight.latest.driftPerMonth))}/mo unaccounted for.
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              {[{ label: 'Today\'s Balance', value: todaysBalance }, { label: 'Lowest Point', value: stats.lowestBalance, sub: `Day ${stats.lowestDay}` }, { label: 'Month End', value: stats.endingBalance }, { label: 'Variable Budget', value: stats.availableForVariable }].map((stat, i) => (
                <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-3">
                  <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">{stat.label}</div>
                  <div className={`font-mono text-lg font-semibold ${getBalanceStatus(stat.value) === 'safe' ? 'text-green-400' : getBalanceStatus(stat.value) === 'warning' ? 'text-yellow-400' : 'text-red-400'}`}>{formatCurrency(stat.value)}</div>
                  {stat.sub && <div className="text-xs text-gray-500">{stat.sub}</div>}
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex gap-1 bg-gray-800 p-1 rounded-lg">
                  {(['6m', '1y', '2y', '5y', '10y', '15y'] as const).map(range => (
                    <button
                      key={range}
                      onClick={() => setTimeRange(range)}
                      className={`px-2 py-1 text-xs font-medium rounded ${timeRange === range ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
                    >
                      {range}
                    </button>
                  ))}
                </div>
                <div className="flex gap-1 bg-gray-800 p-1 rounded-lg">
                  <button onClick={() => setViewMode('calendar')} className={`px-3 py-1.5 text-sm rounded-md ${viewMode === 'calendar' ? 'bg-gray-700 text-white' : 'text-gray-400'}`}>📅</button>
                  <button onClick={() => setViewMode('list')} className={`px-3 py-1.5 text-sm rounded-md ${viewMode === 'list' ? 'bg-gray-700 text-white' : 'text-gray-400'}`}>📋</button>
                </div>
              </div>
              
              <div className="flex items-center gap-1">
                {(() => {
                  const now = new Date();
                  const currentMonthIdx = months.findIndex(m => m.year === now.getFullYear() && m.month === now.getMonth());
                  const selectedIdx = months.findIndex(m => m.year === selectedMonth.year && m.month === selectedMonth.month);
                  
                  // Past months: everything before current month (for left dropdown)
                  const pastMonths = currentMonthIdx > 0 ? months.slice(0, currentMonthIdx) : [];
                  
                  // Visible months: current month + next few months
                  const visibleCount = timeRange === '6m' ? 6 : timeRange === '1y' ? 6 : 5;
                  const visibleStart = Math.max(0, currentMonthIdx);
                  const visibleMonths = months.slice(visibleStart, visibleStart + visibleCount);
                  
                  // Future overflow: months beyond visible range
                  const futureMonths = months.slice(visibleStart + visibleCount);
                  
                  // Check if selected month is in past
                  const selectedInPast = selectedIdx < currentMonthIdx;
                  const selectedInFuture = selectedIdx >= visibleStart + visibleCount;
                  
                  return (
                    <>
                      {/* Past months dropdown */}
                      {pastMonths.length > 0 && (
                        <div className="relative flex-shrink-0">
                          <button
                            onClick={() => { setPastMonthDropdownOpen(!pastMonthDropdownOpen); setMonthDropdownOpen(false); }}
                            className={`px-2 py-2 rounded-lg text-sm flex items-center gap-1 ${
                              selectedInPast 
                                ? 'bg-blue-600 text-white' 
                                : 'bg-gray-800 text-gray-400 hover:text-white'
                            }`}
                          >
                            <svg className={`w-3 h-3 transition-transform ${pastMonthDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                            <span className="hidden sm:inline">
                              {selectedInPast 
                                ? months[selectedIdx]?.label 
                                : `${pastMonths.length} past`}
                            </span>
                            <span className="sm:hidden">
                              {selectedInPast 
                                ? months[selectedIdx]?.shortLabel 
                                : '←'}
                            </span>
                          </button>
                          {pastMonthDropdownOpen && (
                            <>
                              <div className="fixed inset-0 z-40" onClick={() => setPastMonthDropdownOpen(false)} />
                              <div className="absolute left-0 top-full mt-1 z-50 bg-gray-800 border border-gray-700 rounded-lg shadow-xl max-h-64 overflow-y-auto min-w-40">
                                <div className="px-3 py-2 text-xs text-gray-500 uppercase border-b border-gray-700">Past Months</div>
                                {[...pastMonths].reverse().map((m, idx) => (
                                  <button
                                    key={`past-${m.year}-${m.month}`}
                                    onClick={() => {
                                      setSelectedMonth({ year: m.year, month: m.month });
                                      setPastMonthDropdownOpen(false);
                                    }}
                                    className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-700 ${
                                      selectedMonth.year === m.year && selectedMonth.month === m.month
                                        ? 'bg-blue-600 text-white'
                                        : 'text-gray-300'
                                    } ${idx === pastMonths.length - 1 ? 'rounded-b-lg' : ''}`}
                                  >
                                    {m.label}
                                  </button>
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                      )}
                      
                      {/* Today button */}
                      {selectedIdx !== currentMonthIdx && currentMonthIdx >= 0 && (
                        <button
                          onClick={() => setSelectedMonth({ year: now.getFullYear(), month: now.getMonth() })}
                          className="px-2 py-2 rounded-lg text-xs bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 flex-shrink-0"
                          title="Jump to current month"
                        >
                          Today
                        </button>
                      )}
                      
                      {/* Visible month tabs */}
                      <div className="flex gap-1 overflow-hidden flex-1">
                        {visibleMonths.map((m) => {
                          const isCurrentMonth = m.year === now.getFullYear() && m.month === now.getMonth();
                          const isSelected = selectedMonth.year === m.year && selectedMonth.month === m.month;
                          return (
                            <button
                              key={`${m.year}-${m.month}`}
                              onClick={() => setSelectedMonth({ year: m.year, month: m.month })}
                              className={`px-2 sm:px-3 py-2 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap flex-1 min-w-0 truncate ${
                                isSelected
                                  ? 'bg-blue-600 text-white'
                                  : isCurrentMonth
                                    ? 'bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-600/30'
                                    : 'bg-gray-900 border border-gray-800 text-gray-400 hover:text-white'
                              }`}
                            >
                              <span className="hidden sm:inline">{m.label}</span>
                              <span className="sm:hidden">{m.shortLabel}</span>
                            </button>
                          );
                        })}
                      </div>
                      
                      {/* Future months dropdown */}
                      {futureMonths.length > 0 && (
                        <div className="relative flex-shrink-0">
                          <button
                            onClick={() => { setMonthDropdownOpen(!monthDropdownOpen); setPastMonthDropdownOpen(false); }}
                            className={`px-2 py-2 rounded-lg text-sm flex items-center gap-1 ${
                              selectedInFuture 
                                ? 'bg-blue-600 text-white' 
                                : 'bg-gray-800 text-gray-400 hover:text-white'
                            }`}
                          >
                            <span className="hidden sm:inline">
                              {selectedInFuture 
                                ? months[selectedIdx]?.label 
                                : `${futureMonths.length} more`}
                            </span>
                            <span className="sm:hidden">
                              {selectedInFuture 
                                ? months[selectedIdx]?.shortLabel 
                                : '→'}
                            </span>
                            <svg className={`w-3 h-3 transition-transform ${monthDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                          {monthDropdownOpen && (
                            <>
                              <div className="fixed inset-0 z-40" onClick={() => setMonthDropdownOpen(false)} />
                              <div className="absolute right-0 top-full mt-1 z-50 bg-gray-800 border border-gray-700 rounded-lg shadow-xl max-h-64 overflow-y-auto min-w-40">
                                <div className="px-3 py-2 text-xs text-gray-500 uppercase border-b border-gray-700">Future Months</div>
                                {futureMonths.map((m, idx) => (
                                  <button
                                    key={`future-${m.year}-${m.month}`}
                                    onClick={() => {
                                      setSelectedMonth({ year: m.year, month: m.month });
                                      setMonthDropdownOpen(false);
                                    }}
                                    className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-700 ${
                                      selectedMonth.year === m.year && selectedMonth.month === m.month
                                        ? 'bg-blue-600 text-white'
                                        : 'text-gray-300'
                                    } ${idx === futureMonths.length - 1 ? 'rounded-b-lg' : ''}`}
                                  >
                                    {m.label}
                                  </button>
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>

            {viewMode === 'calendar' && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                <div className="grid grid-cols-7 bg-gray-800 border-b border-gray-700">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, i) => (<div key={i} className="p-2 text-center text-xs font-semibold text-gray-500 uppercase hidden sm:block">{day}</div>))}
                  {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (<div key={`mobile-${i}`} className="p-1 text-center text-xs font-semibold text-gray-500 uppercase sm:hidden">{day}</div>))}
                </div>
                <div className="grid grid-cols-7">
                  {Array.from({ length: getFirstDayOfMonth(selectedMonth.year, selectedMonth.month) }).map((_, i) => (<div key={`empty-${i}`} className="min-h-16 sm:min-h-24 p-1 border-r border-b border-gray-800 bg-gray-800/50" />))}
                  {dailyData.map((dayData) => (
                    <div key={dayData.day} className="min-h-16 sm:min-h-24 p-1 border-r border-b border-gray-800 flex flex-col">
                      <div className="flex justify-between items-start">
                        <span className="text-xs font-semibold text-gray-500">{dayData.day}</span>
                        <span className={`text-[10px] sm:text-xs font-mono font-semibold px-1 rounded ${getBalanceStatus(dayData.balance) === 'safe' ? 'bg-green-500/10 text-green-400' : getBalanceStatus(dayData.balance) === 'warning' ? 'bg-yellow-500/10 text-yellow-400' : 'bg-red-500/10 text-red-400'}`}>
                          {dayData.balance >= 0 ? '' : '-'}${Math.abs(dayData.balance).toFixed(0)}
                        </span>
                      </div>
                      <div className="flex-1 overflow-hidden mt-0.5 space-y-0.5">
                        {dayData.events.slice(0, 4).map((e, i) => {
                          const catColor = e.type === 'expense' ? getCategoryColor(e.category || 'other', data.categoryColors) : null;
                          return (
                          <button 
                            key={i} 
                            onClick={() => handleEditEvent(e)} 
                            className={`w-full text-left text-[9px] sm:text-[11px] px-1 py-0.5 rounded truncate cursor-pointer hover:opacity-80 transition-opacity block ${e.isOverride && !e.isSkipped ? 'ring-1 ring-yellow-400' : ''} ${e.isSkipped ? 'bg-gray-500/20 text-gray-500 line-through' : e.type === 'income' ? 'bg-emerald-500/20 text-emerald-400' : `${catColor?.bg} ${catColor?.text}`}`}
                          >
                            <span className="hidden sm:inline">{e.isSkipped ? '⊘ ' : ''}{e.isSplit ? '✂ ' : ''}{e.name.length > 12 ? e.name.substring(0, 12) + '…' : e.name}</span>
                            <span className="sm:hidden">{e.isSkipped ? 'SKIP' : (e.type === 'income' ? '+' : '-') + '$' + e.amount.toFixed(0)}</span>
                            <span className="hidden sm:inline font-mono ml-1">{e.isSkipped ? '' : (e.type === 'income' ? '+' : '-') + '$' + e.amount.toFixed(0)}</span>
                          </button>
                          );
                        })}
                        {dayData.events.length > 4 && <div className="text-[9px] text-gray-500 text-center">+{dayData.events.length - 4} more</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {viewMode === 'list' && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                <div className="grid grid-cols-12 bg-gray-800 border-b border-gray-700 px-3 py-2 text-xs font-semibold text-gray-500 uppercase">
                  <div className="col-span-1">Day</div>
                  <div className="col-span-5 sm:col-span-6">Event</div>
                  <div className="col-span-3 sm:col-span-2 text-right">Amount</div>
                  <div className="col-span-3 text-right">Balance</div>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {dailyData.map((day) => (
                    day.events.length > 0 ? (
                      day.events.map((event, eventIdx) => {
                        const catColor = event.type === 'expense' ? getCategoryColor(event.category || 'other', data.categoryColors) : null;
                        // Balance after this specific transaction, not just the day's close
                        const eventBalance = event.runningBalance ?? day.balance;
                        const isDayClose = eventIdx === day.events.length - 1;
                        const balanceStatus = getBalanceStatus(eventBalance);
                        return (
                        <div key={`${day.day}-${eventIdx}`} className={`grid grid-cols-12 px-3 py-2 border-b border-gray-800 items-center ${event.isSkipped ? 'bg-gray-500/5' : eventBalance < data.floorThreshold ? 'bg-red-500/5' : ''}`}>
                          <div className="col-span-1 font-mono font-semibold text-gray-400 text-sm">
                            {eventIdx === 0 ? day.day : ''}
                          </div>
                          <div className="col-span-5 sm:col-span-6">
                            <button 
                              onClick={() => handleEditEvent(event)} 
                              className={`text-xs sm:text-sm px-2 py-1 rounded cursor-pointer hover:opacity-80 transition-opacity ${event.isOverride && !event.isSkipped ? 'ring-1 ring-yellow-400' : ''} ${event.isSkipped ? 'bg-gray-500/20 text-gray-500 line-through' : event.type === 'income' ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30' : `${catColor?.bg} ${catColor?.text} ${catColor?.hoverBg}`}`}
                            >
                              {event.isSkipped && <span className="mr-1">⊘</span>}
                              {event.isSplit && <span className="mr-1">✂</span>}
                              {event.name.length > 15 ? event.name.substring(0, 15) + '…' : event.name}
                              {event.isSkipped && <span className="ml-1 text-[10px] no-underline">(skipped)</span>}
                            </button>
                          </div>
                          <div className={`col-span-3 sm:col-span-2 text-right font-mono text-sm font-semibold ${event.isSkipped ? 'text-gray-500' : event.type === 'income' ? 'text-emerald-400' : catColor?.text}`}>
                            {event.isSkipped ? '$0.00' : (event.type === 'income' ? '+' : '-') + formatCurrency(event.amount).replace('$', '$')}
                          </div>
                          <div className={`col-span-3 text-right font-mono text-sm ${isDayClose ? 'font-semibold' : 'font-normal opacity-70'} ${balanceStatus === 'safe' ? 'text-green-400' : balanceStatus === 'warning' ? 'text-yellow-400' : 'text-red-400'}`}>
                            {formatCurrency(eventBalance)}
                          </div>
                        </div>
                        );
                      })
                    ) : null
                  ))}
                  {dailyData.filter(d => d.events.length > 0).length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <div className="text-2xl mb-2">📭</div>
                      <div>No events this month</div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'income' && (
          <div className="space-y-3">
            {/* Regular Income Section */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 p-3 bg-gray-800 border-b border-gray-700">
                <h2 className="font-semibold">Income Sources</h2>
                <div className="flex gap-2 w-full sm:w-auto">
                  <button onClick={() => { setEditingItem(null); setModal('income'); }} className="flex-1 sm:flex-none px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg">+ Recurring</button>
                  <button onClick={() => { setEditingItem(null); setModal('income-once'); }} className="flex-1 sm:flex-none px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg">+ One-time</button>
                  <button onClick={() => { setEditingItem(null); setModal('gig-income'); }} className="flex-1 sm:flex-none px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-lg">+ Gig Income</button>
                </div>
              </div>
              <div className="p-3 space-y-2">
                {regularIncomes.length === 0 && gigIncomes.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <div className="text-3xl mb-2">💵</div>
                    <div className="font-medium">No income sources yet</div>
                  </div>
                ) : (
                  <>
                    {/* Regular Income Items */}
                    {incomeSeries.map(series => {
                      const income = series.current;
                      return (
                      <div key={series.key} className={`flex flex-col sm:flex-row sm:items-center gap-2 p-3 border rounded-lg ${income.endDate ? 'bg-gray-800/50 border-gray-700/50' : 'bg-gray-800 border-gray-700'}`}>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate flex items-center gap-2">
                            {income.name}
                            {income.endDate && (
                              <span className="text-xs bg-gray-700 text-gray-400 px-2 py-0.5 rounded">
                                Stopped {new Date(income.endDate + 'T12:00:00').toLocaleDateString()}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500">
                            {frequencyLabels[income.frequency]} • {income.frequency === 'once' ? new Date(income.date! + 'T12:00:00').toLocaleDateString() : `Starting ${new Date(income.startDate! + 'T12:00:00').toLocaleDateString()}`}
                            {income.endDate && (
                              <button
                                onClick={() => updateBudget({ incomes: budget.incomes.map(i => i.id === income.id ? { ...i, endDate: undefined } : i) })}
                                className="ml-2 text-blue-400 hover:text-blue-300 underline"
                              >
                                Resume
                              </button>
                            )}
                          </div>

                          {/* Earlier versions — e.g. what you earned before the raise */}
                          {renderItemHistory('income', series)}
                        </div>
                        <div className="flex items-center justify-between sm:justify-end gap-2">
                          <div className="font-mono text-emerald-400 font-semibold text-lg">{formatCurrency(income.amount)}</div>
                          <div className="flex gap-2">
                            <button onClick={() => { setEditingItem(income); setModal(income.frequency === 'once' ? 'income-once' : 'income'); }} className="px-3 py-1.5 bg-gray-700 text-gray-300 rounded text-sm">Edit</button>
                            <button onClick={() => requestDeleteIncome(income)} className="px-3 py-1.5 bg-red-500/10 text-red-400 rounded">×</button>
                          </div>
                        </div>
                      </div>
                      );
                    })}
                  </>
                )}
              </div>
            </div>

            {/* Gig Income Section */}
            {gigIncomes.length > 0 && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                <div className="p-3 bg-gray-800 border-b border-gray-700">
                  <h2 className="font-semibold text-amber-400">Gig / Variable Income</h2>
                </div>
                <div className="p-3 space-y-3">
                  {gigIncomes.map(gig => {
                    const allPayments = [...(gig.scheduledPayments || [])].sort((a, b) => a.date.localeCompare(b.date));

                    // Get first day of current month for filtering
                    const now = new Date();
                    const currentMonthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

                    // Split into past and current/future payments
                    const pastPayments = allPayments.filter(p => p.date < currentMonthStart);
                    const visiblePayments = allPayments.filter(p => p.date >= currentMonthStart);
                    const visibleTotal = visiblePayments.reduce((sum, p) => sum + p.amount, 0);
                    const pastTotal = pastPayments.reduce((sum, p) => sum + p.amount, 0);

                    // Helper to clear all past payments
                    const clearPastPayments = () => {
                      const updatedPayments = allPayments.filter(p => p.date >= currentMonthStart);
                      updateBudget({
                        incomes: budget.incomes.map(i =>
                          i.id === gig.id ? { ...i, scheduledPayments: updatedPayments } : i
                        )
                      });
                    };

                    return (
                      <div key={gig.id} className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
                        {/* Gig Source Header */}
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 bg-gray-700/50">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate flex items-center gap-2">
                              <span className="text-amber-400">●</span>
                              {gig.name}
                              {gig.payoutDay && (
                                <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded capitalize">
                                  {gig.payoutDay}s
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-500">
                              {visiblePayments.length} upcoming payment{visiblePayments.length !== 1 ? 's' : ''}
                              {visibleTotal > 0 && ` • ${formatCurrency(visibleTotal)}`}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => { setEditingItem(gig); setEditingGigPayment(null); setModal('gig-payment'); }}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded"
                            >
                              Log Payment
                            </button>
                            <button
                              onClick={() => { setEditingItem(gig); setModal('gig-income'); }}
                              className="px-3 py-1.5 bg-gray-600 text-gray-300 rounded text-sm"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => deleteIncome(gig.id)}
                              className="px-3 py-1.5 bg-red-500/10 text-red-400 rounded"
                            >
                              ×
                            </button>
                          </div>
                        </div>

                        {/* Past Payments Summary */}
                        {pastPayments.length > 0 && (
                          <div className="flex items-center justify-between px-3 py-2 bg-gray-700/30 border-t border-gray-700 text-xs">
                            <span className="text-gray-500">
                              {pastPayments.length} past payment{pastPayments.length !== 1 ? 's' : ''} ({formatCurrency(pastTotal)})
                            </span>
                            <button
                              onClick={clearPastPayments}
                              className="text-gray-400 hover:text-red-400"
                            >
                              Clear history
                            </button>
                          </div>
                        )}

                        {/* Visible Payments List (current month + future) */}
                        {visiblePayments.length > 0 && (
                          <div className="border-t border-gray-700">
                            {visiblePayments.map(payment => (
                              <div key={payment.id} className="flex items-center gap-2 px-3 py-2 border-b border-gray-700/50 last:border-b-0 hover:bg-gray-700/30">
                                <div className="text-xs text-gray-500 w-20">
                                  {new Date(payment.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                </div>
                                <div className="flex-1 min-w-0">
                                  {payment.note && (
                                    <span className="text-xs text-gray-400 truncate">{payment.note}</span>
                                  )}
                                </div>
                                <div className="font-mono text-emerald-400 text-sm font-semibold">
                                  {formatCurrency(payment.amount)}
                                </div>
                                <div className="flex gap-1">
                                  <button
                                    onClick={() => { setEditingItem(gig); setEditingGigPayment(payment); setModal('gig-payment'); }}
                                    className="px-2 py-1 bg-gray-700 text-gray-400 rounded text-xs hover:bg-gray-600"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => deleteGigPayment(gig.id, payment.id)}
                                    className="px-2 py-1 bg-red-500/10 text-red-400 rounded text-xs hover:bg-red-500/20"
                                  >
                                    ×
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Empty State for Gig */}
                        {visiblePayments.length === 0 && pastPayments.length === 0 && (
                          <div className="p-3 text-center text-gray-500 text-sm">
                            No payments logged yet. Click "Log Payment" to add one.
                          </div>
                        )}
                        {visiblePayments.length === 0 && pastPayments.length > 0 && (
                          <div className="p-3 text-center text-gray-500 text-sm border-t border-gray-700">
                            No upcoming payments. Click "Log Payment" to add one.
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'expenses' && (
          <div className="space-y-3">
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 p-3 bg-gray-800 border-b border-gray-700">
                <h2 className="font-semibold">Expenses</h2>
                <div className="grid grid-cols-2 sm:flex gap-2 w-full sm:w-auto">
                  <button onClick={() => { setEditingItem(null); setModal('expense'); }} className="px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg">+ Recurring</button>
                  <button onClick={() => { setEditingItem(null); setModal('expense-once'); }} className="px-3 py-2 bg-orange-600 text-white text-sm font-medium rounded-lg">+ One-time</button>
                  <button onClick={() => { setEditingItem(null); setModal('payment-plan'); }} className="px-3 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg">+ Plan</button>
                  <button onClick={() => { setEditingItem(null); setModal('credit-card'); }} className="px-3 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg">+ Card</button>
                </div>
              </div>
              <div className="p-3 space-y-4">
                {budget.expenses.length === 0 ? (<div className="text-center py-8 text-gray-500"><div className="text-3xl mb-2">📋</div><div className="font-medium">No expenses yet</div></div>) : (
                  expenseCategories.map(cat => {
                    const items = groupedExpenses[cat.value];
                    if (!items || items.length === 0) return null;
                    return (
                      <div key={cat.value}>
                        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-2">
                          {cat.value === 'credit_card' && '💳 '}{cat.label}
                          {cat.value === 'credit_card' && (
                            <span className="font-normal normal-case text-gray-500 ml-2">
                              (balances as of {new Date(selectedMonth.year, selectedMonth.month).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })})
                            </span>
                          )}
                        </h3>
                        <div className="space-y-2">
                          {items.map(series => {
                            const expense = series.current;
                            const ccBalance = expense.creditCard ? getTrackedBalance(expense) : null;
                            const catColor = getCategoryColor(expense.category, data.categoryColors);
                            const isPaidOff = ccBalance?.isPaidOff;
                            const openEditor = () => {
                              setEditingItem(expense);
                              setModal(expense.category === 'credit_card' ? 'credit-card' : expense.frequency === 'payment_plan' ? 'payment-plan' : expense.frequency === 'once' ? 'expense-once' : 'expense');
                            };
                            return (
                            <div key={expense.id} className={`flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded-lg border ${isPaidOff ? 'bg-green-500/5 border-green-500/20' : expense.endDate ? 'bg-gray-800/50 border-gray-700/50' : 'bg-gray-800 border-gray-700'}`}>
                              <div className="flex-1 min-w-0">
                                <div className="font-medium truncate flex items-center gap-2">
                                  <span className={`${catColor.text}`}>●</span>
                                  {expense.name}
                                  {isPaidOff && <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded">PAID OFF</span>}
                                  {expense.endDate && !isPaidOff && (
                                    <span className="text-xs bg-gray-700 text-gray-400 px-2 py-0.5 rounded">
                                      {expense.endDate < new Date().toISOString().split('T')[0] ? 'Stopped' : 'Ends'} {new Date(expense.endDate + 'T12:00:00').toLocaleDateString()}
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-gray-500 ml-4">
                                  {frequencyLabels[expense.frequency]}
                                  {expense.creditCard && (
                                    isPaidOff ? (
                                      <span className="text-green-400"> • Original: {formatCurrency(expense.creditCard.totalDebt)} — Paid off!</span>
                                    ) : (
                                      <>
                                        <span className={catColor.text}> • Balance: {formatCurrency(ccBalance?.remaining || 0)}</span>
                                        {/* `x && …` on a number renders a literal 0 when x is 0 */}
                                        {!!ccBalance?.monthsRemaining && ccBalance.monthsRemaining > 0 && (
                                          <span className="text-gray-400"> • {ccBalance.monthsRemaining} mo left</span>
                                        )}
                                        {ccBalance?.payoffDate && (
                                          ccBalance.neverPaysOff
                                            ? <span className="text-yellow-500/80"> • no payoff date at this payment</span>
                                            : <span className="text-gray-500"> (payoff: {ccBalance.payoffDate})</span>
                                        )}
                                      </>
                                    )
                                  )}
                                  {expense.paymentPlan && (
                                    <span className={catColor.text}>
                                      {expense.paymentPlan.frequency === 'semimonthly' 
                                        ? ` • ${expense.paymentPlan.paymentCount * 2} payments (2x/mo)`
                                        : ` • ${expense.paymentPlan.paymentCount} payments`
                                      }
                                    </span>
                                  )}
                                  {expense.splitConfig && (
                                    <span className={catColor.text}>
                                      {` • Day ${expense.splitConfig.firstDay}: ${formatCurrency(expense.splitConfig.firstAmount)}, Day ${expense.splitConfig.secondDay}: ${formatCurrency(expense.splitConfig.secondAmount)}`}
                                    </span>
                                  )}
                                  {expense.endDate && (
                                    <button
                                      onClick={() => updateBudget({ expenses: budget.expenses.map(e => e.id === expense.id ? { ...e, endDate: undefined } : e) })}
                                      className="ml-2 text-blue-400 hover:text-blue-300 underline"
                                    >
                                      Resume
                                    </button>
                                  )}
                                </div>

                                {/* Earlier versions of this expense, kept so history stays true */}
                                <div className="ml-4">{renderItemHistory('expense', series)}</div>
                                {isPaidOff && (
                                  <div className="mt-2 ml-4 flex flex-wrap items-center gap-2 p-2 bg-green-500/10 border border-green-500/20 rounded-lg">
                                    <span className="text-xs text-green-300">Balance cleared — adjust or remove this expense?</span>
                                    <div className="flex gap-2">
                                      <button
                                        onClick={() => { setEditingItem(expense); setModal('update-balance'); }}
                                        className="px-2.5 py-1 bg-green-600/20 hover:bg-green-600/30 text-green-300 border border-green-500/30 rounded text-xs font-medium"
                                      >
                                        Adjust balance
                                      </button>
                                      <button
                                        onClick={() => requestDeleteExpense(expense)}
                                        className="px-2.5 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/30 rounded text-xs font-medium"
                                      >
                                        Remove
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center justify-between sm:justify-end gap-2">
                                <div className={`font-mono font-semibold text-lg ${isPaidOff ? 'text-green-400' : catColor.text}`}>{formatCurrency(expense.amount)}/mo</div>
                                <div className="flex gap-2">
                                  {/* Any recurring expense can carry a balance — a mortgage, a
                                      business card, a loan. Payment plans already model their own
                                      debt, and a one-time expense has nothing to pay down. */}
                                  {expense.frequency !== 'once' && expense.frequency !== 'payment_plan' && (
                                    <button
                                      onClick={() => { setEditingItem(expense); setModal('update-balance'); }}
                                      className={`px-3 py-1.5 rounded text-sm whitespace-nowrap ${expense.creditCard ? 'bg-purple-500/15 text-purple-300' : 'bg-gray-700/50 text-gray-400'}`}
                                      title={expense.creditCard
                                        ? 'Record the current balance without changing the payment schedule'
                                        : 'Track what\'s still owed on this expense'}
                                    >
                                      {expense.creditCard ? 'Balance' : '+ Balance'}
                                    </button>
                                  )}
                                  <button onClick={openEditor} className="px-3 py-1.5 bg-gray-700 text-gray-300 rounded text-sm">Edit</button>
                                  <button onClick={() => requestDeleteExpense(expense)} className="px-3 py-1.5 bg-red-500/10 text-red-400 rounded">×</button>
                                </div>
                              </div>
                            </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-3">
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="p-3 bg-gray-800 border-b border-gray-700"><h2 className="font-semibold">Starting Point</h2></div>
              <div className="p-3 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-500 uppercase block mb-1">Starting Balance</label>
                    <input type="number" value={data.startingBalance} onChange={(e) => updateData({ startingBalance: parseFloat(e.target.value) || 0 })} className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white font-mono text-lg" step="0.01" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 uppercase block mb-1">As of Date</label>
                    <input type="date" value={data.startingDate} onChange={(e) => updateData({ startingDate: e.target.value })} className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white" />
                  </div>
                </div>
                <div className="text-xs text-gray-500">Your first real bank balance. Projections run from here until you record a newer checkpoint below.</div>
              </div>
            </div>

            {/* Reality check — actual balances vs. what the budget predicted */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="p-3 bg-gray-800 border-b border-gray-700">
                <h2 className="font-semibold">Balance Checkpoints</h2>
                <p className="text-xs text-gray-500 mt-1">Record your real bank balance now and then. Projections re-anchor to the newest one, and the gap against the prediction shows how well your budget matches reality.</p>
              </div>

              {checkpointColumnMissing && (
                <div className="m-3 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-xs text-yellow-300 space-y-1">
                  <div className="font-semibold">Checkpoints and scenarios aren&apos;t saving to your database yet.</div>
                  <div className="text-yellow-300/80">Run this once in the Supabase SQL editor:</div>
                  <code className="block p-2 bg-gray-950 rounded font-mono text-[11px] text-yellow-200 overflow-x-auto whitespace-pre">
{`ALTER TABLE cashflow_data ADD COLUMN IF NOT EXISTS checkpoints JSONB DEFAULT '[]'::jsonb;
ALTER TABLE cashflow_data ADD COLUMN IF NOT EXISTS scenarios JSONB DEFAULT '[]'::jsonb;`}
                  </code>
                </div>
              )}

              <div className="p-3 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                  <div>
                    <label className="text-xs text-gray-500 uppercase block mb-1">Date</label>
                    <input
                      type="date"
                      value={newCheckpoint.date}
                      onChange={e => setNewCheckpoint({ ...newCheckpoint, date: e.target.value })}
                      className="w-full p-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 uppercase block mb-1">Actual Balance</label>
                    <input
                      type="number"
                      value={newCheckpoint.amount}
                      onChange={e => setNewCheckpoint({ ...newCheckpoint, amount: e.target.value })}
                      className="w-full p-2 bg-gray-800 border border-gray-700 rounded-lg text-white font-mono text-sm"
                      placeholder="0.00"
                      step="0.01"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 uppercase block mb-1">Note (optional)</label>
                    <input
                      type="text"
                      value={newCheckpoint.note}
                      onChange={e => setNewCheckpoint({ ...newCheckpoint, note: e.target.value })}
                      className="w-full p-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
                      placeholder="e.g., after payday"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      onClick={addCheckpoint}
                      disabled={!newCheckpoint.date || newCheckpoint.amount === ''}
                      className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50"
                    >
                      Record
                    </button>
                  </div>
                </div>

                {checkpointAnalysis.length === 0 ? (
                  <div className="text-center py-6 text-gray-500">
                    <div className="text-2xl mb-1">🎯</div>
                    <div className="text-sm">No checkpoints yet</div>
                    <div className="text-xs text-gray-600 mt-1">Record today&apos;s balance to start measuring drift.</div>
                  </div>
                ) : (
                  <>
                    {driftInsight && (
                      <div className={`p-3 rounded-lg border ${Math.abs(driftInsight.avgPerMonth) < 25 ? 'bg-green-500/10 border-green-500/30' : driftInsight.avgPerMonth < 0 ? 'bg-red-500/10 border-red-500/30' : 'bg-blue-500/10 border-blue-500/30'}`}>
                        {Math.abs(driftInsight.avgPerMonth) < 25 ? (
                          <div className="text-sm text-green-300">
                            <span className="font-semibold">Your budget is accurate.</span> Reality tracks the projection within {formatCurrency(Math.abs(driftInsight.avgPerMonth))}/mo.
                          </div>
                        ) : driftInsight.avgPerMonth < 0 ? (
                          <div className="text-sm text-red-300">
                            <span className="font-semibold">You&apos;re running {formatCurrency(Math.abs(driftInsight.avgPerMonth))}/mo behind projection.</span>
                            <span className="text-red-300/80"> That&apos;s spending the budget doesn&apos;t know about — long-range projections are optimistic by roughly {formatCurrency(Math.abs(driftInsight.avgPerMonth) * 12)}/year.</span>
                          </div>
                        ) : (
                          <div className="text-sm text-blue-300">
                            <span className="font-semibold">You&apos;re running {formatCurrency(driftInsight.avgPerMonth)}/mo ahead of projection.</span>
                            <span className="text-blue-300/80"> Either income is understated or some expenses cost less than budgeted.</span>
                          </div>
                        )}
                        <div className="text-xs text-gray-400 mt-1">
                          Based on {driftInsight.count} checkpoint{driftInsight.count === 1 ? '' : 's'} • last recorded {driftInsight.daysSince === 0 ? 'today' : `${driftInsight.daysSince} day${driftInsight.daysSince === 1 ? '' : 's'} ago`}
                        </div>
                      </div>
                    )}

                    <div className="border border-gray-800 rounded-lg overflow-hidden">
                      <div className="grid grid-cols-12 bg-gray-800 px-3 py-2 text-xs font-semibold text-gray-500 uppercase">
                        <div className="col-span-3">Date</div>
                        <div className="col-span-3 text-right">Predicted</div>
                        <div className="col-span-3 text-right">Actual</div>
                        <div className="col-span-3 text-right">Drift</div>
                      </div>
                      {[...checkpointAnalysis].reverse().map(row => (
                        <div key={row.id} className="grid grid-cols-12 px-3 py-2 border-t border-gray-800 items-center text-sm">
                          <div className="col-span-3">
                            <div className="text-gray-300">{new Date(row.date + 'T12:00:00').toLocaleDateString()}</div>
                            {row.note && <div className="text-xs text-gray-600 truncate">{row.note}</div>}
                          </div>
                          <div className="col-span-3 text-right font-mono text-gray-500">{formatCurrency(row.predicted)}</div>
                          <div className="col-span-3 text-right font-mono text-gray-200">{formatCurrency(row.actualBalance)}</div>
                          <div className="col-span-3 text-right flex items-center justify-end gap-2">
                            <span className={`font-mono font-semibold ${Math.abs(row.drift) < 1 ? 'text-gray-500' : row.drift < 0 ? 'text-red-400' : 'text-green-400'}`}>
                              {row.drift >= 0 ? '+' : '−'}{formatCurrency(Math.abs(row.drift))}
                            </span>
                            <button onClick={() => deleteCheckpoint(row.id)} className="px-2 py-0.5 bg-red-500/10 text-red-400 rounded text-xs">×</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="p-3 bg-gray-800 border-b border-gray-700"><h2 className="font-semibold">Alert Thresholds</h2></div>
              <div className="p-3 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-500 uppercase block mb-1">Warning Threshold</label>
                    <input type="number" value={data.warningThreshold} onChange={(e) => updateData({ warningThreshold: parseFloat(e.target.value) || 0 })} className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white font-mono" step="50" />
                    <div className="text-xs text-gray-500 mt-1">Show warning when below this</div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 uppercase block mb-1">Danger Floor</label>
                    <input type="number" value={data.floorThreshold} onChange={(e) => updateData({ floorThreshold: parseFloat(e.target.value) || 0 })} className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white font-mono" step="10" />
                    <div className="text-xs text-gray-500 mt-1">Critical alert when below this</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="p-3 bg-gray-800 border-b border-gray-700"><h2 className="font-semibold">Category Colors</h2></div>
              <div className="p-3 space-y-3">
                <div className="text-xs text-gray-500 mb-3">Choose a color for each expense category. Click the color swatch to change it.</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {expenseCategories.map(cat => {
                    const currentColor = getCategoryColor(cat.value, data.categoryColors);
                    return (
                      <div key={cat.value} className="flex items-center gap-3 p-2 bg-gray-800 rounded-lg">
                        <div className="relative">
                          <button 
                            className={`w-8 h-8 rounded-lg ${currentColor.bg} ${currentColor.text} flex items-center justify-center text-xs font-bold border-2 border-transparent hover:border-white/30`}
                            onClick={() => {
                              const colorPicker = document.getElementById(`color-picker-${cat.value}`);
                              if (colorPicker) colorPicker.classList.toggle('hidden');
                            }}
                          >
                            ●
                          </button>
                          <div id={`color-picker-${cat.value}`} className="hidden absolute top-full left-0 mt-1 p-2 bg-gray-900 border border-gray-700 rounded-lg z-50 grid grid-cols-4 gap-1">
                            {categoryColorOptions.map(color => (
                              <button
                                key={color.key}
                                onClick={() => {
                                  const newColors = { ...data.categoryColors, [cat.value]: color.key };
                                  updateData({ categoryColors: newColors });
                                  document.getElementById(`color-picker-${cat.value}`)?.classList.add('hidden');
                                }}
                                className={`w-6 h-6 rounded ${color.bg} ${color.text} flex items-center justify-center text-[10px] hover:ring-2 ring-white/50 ${currentColor.key === color.key ? 'ring-2 ring-white' : ''}`}
                                title={color.label}
                              >
                                ●
                              </button>
                            ))}
                          </div>
                        </div>
                        <span className="text-sm text-gray-300 flex-1">{cat.label}</span>
                        <span className={`text-xs px-2 py-0.5 rounded ${currentColor.bg} ${currentColor.text}`}>{currentColor.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="p-3 bg-gray-800 border-b border-gray-700"><h2 className="font-semibold">Account</h2></div>
              <div className="p-3 space-y-4">
                {isPreviewMode ? (
                  <>
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                      <div className="text-sm text-emerald-400 font-medium">Preview Mode Active</div>
                      <div className="text-xs text-gray-400 mt-1">Data is stored locally in your browser and will be cleared when you exit.</div>
                    </div>
                    <button onClick={onExitPreview} className="px-4 py-2 bg-emerald-500/10 text-emerald-400 rounded-lg hover:bg-emerald-500/20 text-sm">Exit Preview & Sign In</button>
                  </>
                ) : (
                  <>
                    <div className="text-sm text-gray-400">Signed in as: <span className="text-white">{user?.email}</span></div>
                    <button onClick={handleSignOut} className="px-4 py-2 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 text-sm">Sign Out</button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {modal === 'income' && (
        <Modal title={editingItem ? "Edit Income" : "Add Recurring Income"} onClose={() => { setModal(null); setEditingItem(null); }}>
          <IncomeForm 
            income={editingItem as Income | null} 
            onSave={handleSaveIncome} 
            onClose={() => { setModal(null); setEditingItem(null); }} 
            defaultMonth={`${selectedMonth.year}-${String(selectedMonth.month + 1).padStart(2, '0')}`} 
          />
        </Modal>
      )}
      {modal === 'income-once' && (
        <Modal title={editingItem ? "Edit One-time Income" : "Add One-time Income"} onClose={() => { setModal(null); setEditingItem(null); }}>
          <OneTimeIncomeForm
            income={editingItem as Income | null}
            onSave={handleSaveIncome}
            onClose={() => { setModal(null); setEditingItem(null); }}
            defaultDate={getDefaultDateInSelectedMonth()}
          />
        </Modal>
      )}
      {modal === 'gig-income' && (
        <Modal title={editingItem ? "Edit Gig Income" : "Add Gig Income"} onClose={() => { setModal(null); setEditingItem(null); }}>
          <GigIncomeForm
            income={editingItem as Income | null}
            onSave={handleSaveIncome}
            onClose={() => { setModal(null); setEditingItem(null); }}
          />
        </Modal>
      )}
      {modal === 'gig-payment' && gigIncomes.length > 0 && (
        <Modal
          title={editingGigPayment ? "Edit Gig Payment" : "Log Gig Payment"}
          onClose={() => { setModal(null); setEditingItem(null); setEditingGigPayment(null); }}
        >
          <GigPaymentForm
            gigSources={gigIncomes}
            selectedSourceId={editingItem?.id}
            payment={editingGigPayment || undefined}
            onSave={handleSaveGigPayment}
            onClose={() => { setModal(null); setEditingItem(null); setEditingGigPayment(null); }}
          />
        </Modal>
      )}
      {modal === 'expense' && (
        <Modal title={editingItem ? "Edit Expense" : "Add Recurring Expense"} onClose={() => { setModal(null); setEditingItem(null); }}>
          <ExpenseForm 
            expense={editingItem as Expense | null} 
            onSave={handleSaveExpense} 
            onClose={() => { setModal(null); setEditingItem(null); }} 
            defaultMonth={`${selectedMonth.year}-${String(selectedMonth.month + 1).padStart(2, '0')}`} 
          />
        </Modal>
      )}
      {modal === 'expense-once' && (
        <Modal title={editingItem ? "Edit One-time Expense" : "Add One-time Expense"} onClose={() => { setModal(null); setEditingItem(null); }}>
          <OneTimeExpenseForm 
            expense={editingItem as Expense | null} 
            onSave={handleSaveExpense} 
            onClose={() => { setModal(null); setEditingItem(null); }} 
            defaultDate={getDefaultDateInSelectedMonth()} 
          />
        </Modal>
      )}
      {modal === 'payment-plan' && (
        <Modal title={editingItem ? "Edit Payment Plan" : "Add Payment Plan"} onClose={() => { setModal(null); setEditingItem(null); }}>
          <PaymentPlanForm 
            expense={editingItem as Expense | null} 
            onSave={handleSaveExpense} 
            onClose={() => { setModal(null); setEditingItem(null); }} 
            defaultMonth={`${selectedMonth.year}-${String(selectedMonth.month + 1).padStart(2, '0')}`} 
          />
        </Modal>
      )}
      {modal === 'credit-card' && (
        <Modal title={editingItem ? "Edit Credit Card" : "Add Credit Card"} onClose={() => { setModal(null); setEditingItem(null); }}>
          <CreditCardForm 
            expense={editingItem as Expense | null} 
            onSave={handleSaveExpense} 
            onClose={() => { setModal(null); setEditingItem(null); }} 
            defaultMonth={`${selectedMonth.year}-${String(selectedMonth.month + 1).padStart(2, '0')}`} 
          />
        </Modal>
      )}
      {/* Attach or re-record a real balance. Applies in place — never forks a version. */}
      {modal === 'update-balance' && editingItem && (
        <Modal
          title={(editingItem as Expense).creditCard ? `Update ${editingItem.name} Balance` : `Track ${editingItem.name} Balance`}
          onClose={() => { setModal(null); setEditingItem(null); }}
        >
          <BalanceUpdateForm
            expense={editingItem as Expense}
            projectedBalance={(asOfDate) => getProjectedBalanceOnDate(editingItem as Expense, asOfDate)}
            onSave={(creditCard: CreditCard) => updateExpense(editingItem.id, { creditCard })}
            onStopTracking={() => updateExpense(editingItem.id, { creditCard: undefined })}
            onClose={() => { setModal(null); setEditingItem(null); }}
          />
        </Modal>
      )}
      {modal === 'instance-edit' && editingEvent && editingItem && (
        <Modal title={`Edit ${editingEvent.name}`} onClose={() => { setModal(null); setEditingItem(null); setEditingEvent(null); }}>
          <InstanceEditForm
            event={editingEvent}
            item={editingItem}
            onSave={handleSaveInstanceOverride}
            onRemoveOverride={handleRemoveInstanceOverride}
            onEditRecurring={handleEditRecurring}
            onSetDuration={(endDate) => {
              if (!editingItem || !editingEvent) return;
              if (editingEvent.type === 'income') updateIncome(editingItem.id, { endDate });
              else updateExpense(editingItem.id, { endDate });
              setModal(null); setEditingItem(null); setEditingEvent(null);
            }}
            onClose={() => { setModal(null); setEditingItem(null); setEditingEvent(null); }}
            trackedBalance={
              (editingItem as Expense).creditCard
                ? getRemainingBalanceAtMonth(
                    editingItem as Expense,
                    parseInt(editingEvent.instanceDate.split('-')[0]),
                    parseInt(editingEvent.instanceDate.split('-')[1]) - 1
                  )
                : undefined
            }
          />
        </Modal>
      )}

      {/* How should an edit to a running item apply — retroactively, or from now? */}
      {modal === 'apply-change' && pendingChange && (
        <Modal title={`Change to ${pendingChange.name}`} onClose={() => { setPendingChange(null); setModal(null); }}>
          <div className="p-4 space-y-4">
            <div className="p-3 bg-gray-800 rounded-lg">
              <div className="text-xs text-gray-500 uppercase mb-1">What&apos;s changing</div>
              {pendingChange.changes.map((c, i) => (
                <div key={i} className="font-mono text-sm text-yellow-400">{c}</div>
              ))}
            </div>

            <div className="text-sm text-gray-400">
              This {pendingChange.type} already has past occurrences. How should the change apply?
            </div>

            <button
              type="button"
              onClick={() => applyPendingChange('forward')}
              className="w-full text-left p-3 bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/40 rounded-lg"
            >
              <div className="font-medium text-blue-300">Life changed — apply going forward</div>
              <div className="text-xs text-gray-400 mt-1">
                Everything before this date stays exactly as it was. The old version is kept as history.
              </div>
              <div className="mt-2 flex items-center gap-2" onClick={e => e.stopPropagation()}>
                <span className="text-xs text-gray-500 uppercase">Effective</span>
                <input
                  type="date"
                  value={pendingChange.effectiveFrom}
                  onChange={e => setPendingChange({ ...pendingChange, effectiveFrom: e.target.value })}
                  className="p-2 bg-gray-800 border border-gray-700 rounded text-white text-sm"
                />
              </div>
            </button>

            <button
              type="button"
              onClick={() => applyPendingChange('retroactive')}
              className="w-full text-left p-3 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg"
            >
              <div className="font-medium text-gray-200">Correct a mistake — apply to all history</div>
              <div className="text-xs text-gray-400 mt-1">
                Rewrites {pendingChange.pastCount > 500 ? '500+' : pendingChange.pastCount} past occurrence{pendingChange.pastCount === 1 ? '' : 's'} as if it had always been this way. Past balances will change.
              </div>
              {pendingChange.orphanedOverrides > 0 && (
                <div className="text-xs text-yellow-400/80 mt-1">
                  Moving the start date also discards {pendingChange.orphanedOverrides} per-instance edit{pendingChange.orphanedOverrides === 1 ? '' : 's'} that no longer {pendingChange.orphanedOverrides === 1 ? 'lines' : 'line'} up.
                </div>
              )}
            </button>
          </div>
          <div className="flex justify-end gap-3 p-4 border-t border-gray-800">
            <button onClick={() => { setPendingChange(null); setModal(null); }} className="px-4 py-2 bg-gray-800 text-white rounded-lg">Cancel</button>
          </div>
        </Modal>
      )}

      {/* Fork a new scenario from whatever budget is on screen */}
      {modal === 'scenario-new' && (
        <Modal title="New Scenario" onClose={() => setModal(null)}>
          <div className="p-4 space-y-3">
            <div className="text-sm text-gray-300">
              Forks {activeScenario ? `"${activeScenario.name}"` : 'Reality'} into a sandbox you can change freely. Your real budget stays untouched.
            </div>
            <div>
              <label className="text-xs text-gray-500 uppercase block mb-1">Name</label>
              <input
                autoFocus
                type="text"
                value={scenarioName}
                onChange={e => setScenarioName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && scenarioName.trim()) createScenario(scenarioName); }}
                className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white"
                placeholder="e.g., New job, Move to Austin, Lose the side gig"
              />
            </div>
            <div className="text-xs text-gray-500">
              Your starting balance and recorded checkpoints are shared — every scenario projects from the same real starting point.
            </div>
          </div>
          <div className="flex justify-end gap-3 p-4 border-t border-gray-800">
            <button onClick={() => setModal(null)} className="px-4 py-2 bg-gray-800 text-white rounded-lg">Cancel</button>
            <button
              onClick={() => createScenario(scenarioName)}
              disabled={!scenarioName.trim()}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg font-medium disabled:opacity-50"
            >
              Create sandbox
            </button>
          </div>
        </Modal>
      )}

      {/* What this scenario changed, with the option to make any of it real */}
      {modal === 'scenario-changes' && activeScenario && (
        <Modal title={`${activeScenario.name} vs. Reality`} onClose={() => setModal(null)}>
          <div className="p-4 space-y-2 max-h-[60vh] overflow-y-auto">
            {scenarioDiff.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <div className="text-2xl mb-2">🧪</div>
                <div className="text-sm">Identical to Reality so far</div>
                <div className="text-xs text-gray-600 mt-1">Edit income or expenses to see the difference here.</div>
              </div>
            ) : (
              scenarioDiff.map(change => (
                <div key={change.key} className="p-3 bg-gray-800 border border-gray-700 rounded-lg flex flex-col sm:flex-row sm:items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`font-mono text-sm ${change.kind === 'added' ? 'text-green-400' : change.kind === 'removed' ? 'text-red-400' : 'text-yellow-400'}`}>
                        {change.kind === 'added' ? '+' : change.kind === 'removed' ? '−' : '~'}
                      </span>
                      <span className="font-medium truncate">{change.name}</span>
                      <span className="text-xs text-gray-500 uppercase">{change.type}</span>
                    </div>
                    <div className="text-xs text-gray-400 ml-5">{change.details.join(' • ')}</div>
                  </div>
                  <button
                    onClick={() => setConfirmPromote(change)}
                    className="px-3 py-1.5 bg-green-600/20 hover:bg-green-600/30 text-green-300 border border-green-500/30 rounded text-xs font-medium whitespace-nowrap"
                  >
                    Make real
                  </button>
                </div>
              ))
            )}
          </div>
          <div className="flex justify-between items-center gap-3 p-4 border-t border-gray-800">
            <div className="text-xs text-gray-500">&quot;Make real&quot; applies one change to Reality and leaves the sandbox as-is.</div>
            <button onClick={() => setModal(null)} className="px-4 py-2 bg-gray-800 text-white rounded-lg">Done</button>
          </div>
        </Modal>
      )}

      {/* Correcting an earlier version. Combining is the safe repair for a version
          that shouldn't exist; deleting drops those months' payments outright. */}
      {versionDetail && (
        <Modal title={`Earlier amount for ${versionDetail.version.name}`} onClose={() => setVersionAction(null)}>
          <div className="p-4 space-y-4">
            <div className="p-3 bg-gray-800 rounded-lg space-y-1 text-sm">
              <div className="text-xs text-gray-500 uppercase">This period</div>
              <div className="font-mono text-yellow-400">{versionSummary(versionDetail.version)}</div>
              <div className="text-xs text-gray-500 uppercase pt-2">Replaced by</div>
              <div className="font-mono text-green-400">{versionSummary(versionDetail.successor)}</div>
            </div>

            <div className="text-sm text-gray-400">
              These are the amounts that were really in effect back then, so both options below
              change what past months look like.
            </div>

            <button
              type="button"
              onClick={() => applyVersionAction('combine')}
              className="w-full text-left p-3 bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/40 rounded-lg"
            >
              <div className="font-medium text-blue-300">It was always the newer amount</div>
              <div className="text-xs text-gray-400 mt-1">
                Extends {formatCurrency(versionDetail.successor.amount)} back over this period and removes
                the extra entry. Every date keeps a payment — nothing vanishes from the calendar. Use this
                if the split was created by mistake.
              </div>
            </button>

            <button
              type="button"
              onClick={() => applyVersionAction('delete')}
              className="w-full text-left p-3 bg-red-500/5 hover:bg-red-500/10 border border-red-500/30 rounded-lg"
            >
              <div className="font-medium text-red-300">This period never happened</div>
              <div className="text-xs text-gray-400 mt-1">
                Deletes it, removing {versionDetail.pastCount === 1 ? 'its 1 past payment' : `all ${versionDetail.pastCount} of its past payments`} from
                the projection. Balances in those months change.
                {versionDetail.tracksBalance && ' This expense tracks a balance, so its payoff projection shifts too.'}
              </div>
            </button>

            <div className="text-xs text-gray-500">
              {activeScenario
                ? `Only affects the ${activeScenario.name} sandbox — Reality is untouched.`
                : 'This changes your real budget, not a sandbox.'}
            </div>
          </div>

          <div className="flex justify-end gap-3 p-4 border-t border-gray-800">
            <button type="button" onClick={() => setVersionAction(null)} className="px-4 py-2 bg-gray-800 text-white rounded-lg">
              Leave it alone
            </button>
          </div>
        </Modal>
      )}

      {/* Confirm before anything from the sandbox lands in Reality. Renders over
          the changes list, which stays open behind it. */}
      {confirmPromote && activeScenario && (
        <Modal title="Make this real?" onClose={() => setConfirmPromote(null)}>
          <div className="p-4 space-y-4">
            <div className="p-3 bg-gray-800 rounded-lg">
              <div className="flex items-center gap-2">
                <span className={`font-mono text-sm ${confirmPromote.kind === 'added' ? 'text-green-400' : confirmPromote.kind === 'removed' ? 'text-red-400' : 'text-yellow-400'}`}>
                  {confirmPromote.kind === 'added' ? '+' : confirmPromote.kind === 'removed' ? '−' : '~'}
                </span>
                <span className="font-medium truncate">{confirmPromote.name}</span>
                <span className="text-xs text-gray-500 uppercase">{confirmPromote.type}</span>
              </div>
              <div className="text-xs text-gray-400 ml-5 mt-0.5">{confirmPromote.details.join(' • ')}</div>
            </div>

            <div className="text-sm text-gray-300">{describePromotion(confirmPromote)}</div>

            <div className="text-xs text-gray-500">
              This leaves {activeScenario.name} untouched, but it changes your real budget —
              there&apos;s no undo.
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 p-4 border-t border-gray-800">
            <button
              type="button"
              onClick={() => setConfirmPromote(null)}
              className="px-4 py-2 bg-gray-800 text-white rounded-lg"
            >
              No, keep it in the sandbox
            </button>
            <button
              type="button"
              onClick={() => { promoteChange(confirmPromote); setConfirmPromote(null); }}
              className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium"
            >
              Yes, make it real
            </button>
          </div>
        </Modal>
      )}

      {/* Side-by-side outcomes */}
      {modal === 'scenario-compare' && scenarioComparison && (
        <Modal title={`Compare — next ${timeRange}`} onClose={() => setModal(null)}>
          <div className="p-4 overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-xs uppercase text-gray-500">
                  <th className="text-left font-semibold py-2 pr-3">Outcome</th>
                  {scenarioComparison.map(row => (
                    <th key={row.id ?? 'reality'} className={`text-right font-semibold py-2 px-3 whitespace-nowrap ${row.id === activeScenarioId ? 'text-purple-300' : row.id === null ? 'text-white' : 'text-gray-400'}`}>
                      {row.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="font-mono">
                <tr className="border-t border-gray-800">
                  <td className="py-2 pr-3 font-sans text-gray-400">Balance at end</td>
                  {scenarioComparison.map(row => (
                    <td key={row.id ?? 'reality'} className={`text-right py-2 px-3 font-semibold ${row.endBalance < 0 ? 'text-red-400' : 'text-green-400'}`}>
                      {formatCurrency(row.endBalance)}
                    </td>
                  ))}
                </tr>
                <tr className="border-t border-gray-800">
                  <td className="py-2 pr-3 font-sans text-gray-400">Lowest point</td>
                  {scenarioComparison.map(row => (
                    <td key={row.id ?? 'reality'} className={`text-right py-2 px-3 ${row.lowest < data.floorThreshold ? 'text-red-400' : 'text-gray-200'}`}>
                      {formatCurrency(row.lowest)}
                      {row.lowestAt && (
                        <div className="text-[10px] font-sans text-gray-600">
                          {new Date(row.lowestAt.year, row.lowestAt.month).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                        </div>
                      )}
                    </td>
                  ))}
                </tr>
                <tr className="border-t border-gray-800">
                  <td className="py-2 pr-3 font-sans text-gray-400">Goes negative</td>
                  {scenarioComparison.map(row => (
                    <td key={row.id ?? 'reality'} className={`text-right py-2 px-3 font-sans ${row.firstNegative ? 'text-red-400' : 'text-green-400'}`}>
                      {row.firstNegative
                        ? new Date(row.firstNegative.year, row.firstNegative.month).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
                        : 'Never'}
                    </td>
                  ))}
                </tr>
                <tr className="border-t border-gray-800">
                  <td className="py-2 pr-3 font-sans text-gray-400">Avg monthly net</td>
                  {scenarioComparison.map(row => (
                    <td key={row.id ?? 'reality'} className={`text-right py-2 px-3 ${row.avgNet < 0 ? 'text-red-400' : 'text-green-400'}`}>
                      {row.avgNet >= 0 ? '+' : '−'}{formatCurrency(Math.abs(row.avgNet))}
                    </td>
                  ))}
                </tr>
                <tr className="border-t border-gray-800">
                  <td className="py-2 pr-3 font-sans text-gray-400">Debt-free</td>
                  {scenarioComparison.map(row => (
                    <td key={row.id ?? 'reality'} className="text-right py-2 px-3 font-sans text-gray-200">
                      {!row.hasDebt ? <span className="text-gray-600">No balances</span>
                        : row.anyNeverClears ? <span className="text-red-400">Never</span>
                        : row.debtFreeDate ? new Date(row.debtFreeDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
                        : <span className="text-green-400">Clear</span>}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          <div className="flex justify-between items-center gap-3 p-4 border-t border-gray-800">
            <div className="text-xs text-gray-500">All scenarios project from the same real starting balance.</div>
            <button onClick={() => setModal(null)} className="px-4 py-2 bg-gray-800 text-white rounded-lg">Close</button>
          </div>
        </Modal>
      )}

      {/* Discard a sandbox */}
      {modal === 'scenario-discard' && activeScenario && (
        <Modal title={`Discard "${activeScenario.name}"?`} onClose={() => setModal(null)}>
          <div className="p-4 space-y-2">
            <div className="text-sm text-gray-300">
              This deletes the sandbox and its {scenarioDiff.length} change{scenarioDiff.length === 1 ? '' : 's'}. Reality is unaffected.
            </div>
            <div className="text-xs text-gray-500">Anything you wanted to keep should be made real first.</div>
          </div>
          <div className="flex justify-end gap-3 p-4 border-t border-gray-800">
            <button onClick={() => setModal(null)} className="px-4 py-2 bg-gray-800 text-white rounded-lg">Cancel</button>
            <button onClick={() => deleteScenario(activeScenario.id)} className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium">Discard sandbox</button>
          </div>
        </Modal>
      )}

      {/* Old Month Warning Modal */}
      {oldMonthWarning.show && oldMonthWarning.event && (
        <Modal title="⚠️ Editing Old Transaction" onClose={() => setOldMonthWarning({ show: false, event: null, item: null })}>
          <div className="p-4 space-y-4">
            <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <div className="text-yellow-400 font-medium mb-2">
                You are about to edit a transaction from:
              </div>
              <div className="text-2xl font-bold text-white">
                {new Date(oldMonthWarning.event.instanceDate + 'T12:00:00').toLocaleDateString('en-US', { 
                  month: 'long', 
                  year: 'numeric',
                  day: 'numeric'
                })}
              </div>
              <div className="text-sm text-gray-400 mt-2">
                This is more than 3 months ago. Please confirm you want to edit this historical transaction.
              </div>
            </div>
            
            <div className="p-3 bg-gray-800 rounded-lg">
              <div className="text-sm text-gray-400">Transaction:</div>
              <div className="font-medium">{oldMonthWarning.event.name}</div>
              <div className="text-sm text-gray-500">{formatCurrency(oldMonthWarning.event.amount)}</div>
            </div>
            
            <div className="text-sm text-gray-500">
              Editing past transactions will affect all balance calculations from that point forward.
            </div>
          </div>
          
          <div className="flex justify-end gap-3 p-4 border-t border-gray-800">
            <button 
              onClick={() => setOldMonthWarning({ show: false, event: null, item: null })} 
              className="px-4 py-2 bg-gray-800 text-white rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={confirmOldMonthEdit}
              className="px-4 py-2 bg-yellow-600 text-white rounded-lg font-medium"
            >
              Yes, Edit This Transaction
            </button>
          </div>
        </Modal>
      )}

      {/* Delete Recurring Item Modal */}
      {deleteConfirm && (
        <Modal title={`Remove ${deleteConfirm.item.name}?`} onClose={() => setDeleteConfirm(null)}>
          <div className="p-4 space-y-3">
            <div className="text-sm text-gray-300">
              This is a recurring {deleteConfirm.type}. Past occurrences are projections derived from this entry, so deleting it removes them from your history too.
            </div>
            <div className="text-sm text-gray-400">
              Choose how you want to remove it:
            </div>
          </div>
          <div className="p-4 pt-0 space-y-2">
            <button
              onClick={() => {
                if (deleteConfirm.type === 'expense') stopExpenseForward(deleteConfirm.item.id);
                else stopIncomeForward(deleteConfirm.item.id);
              }}
              className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-left"
            >
              <div>Stop going forward</div>
              <div className="text-xs text-blue-200 font-normal mt-0.5">Keeps history visible. Sets end date to today.</div>
            </button>
            <button
              onClick={() => {
                if (deleteConfirm.type === 'expense') deleteExpense(deleteConfirm.item.id);
                else deleteIncome(deleteConfirm.item.id);
                setDeleteConfirm(null);
              }}
              className="w-full px-4 py-3 bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/30 rounded-lg font-medium text-left"
            >
              <div>Delete entirely</div>
              <div className="text-xs text-red-300/70 font-normal mt-0.5">Removes all past and future occurrences.</div>
            </button>
            <button
              onClick={() => setDeleteConfirm(null)}
              className="w-full px-4 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg"
            >
              Cancel
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
