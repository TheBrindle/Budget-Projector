'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';
import { CashFlowData, Income, Expense, DayData, DayEvent, InstanceOverride, isSkippedOverride, categoryColorOptions, defaultCategoryColors, CategoryColorKey } from '@/lib/types';
import Modal from './Modal';
import IncomeForm from './forms/IncomeForm';
import OneTimeIncomeForm from './forms/OneTimeIncomeForm';
import ExpenseForm from './forms/ExpenseForm';
import OneTimeExpenseForm from './forms/OneTimeExpenseForm';
import CreditCardForm from './forms/CreditCardForm';
import PaymentPlanForm from './forms/PaymentPlanForm';
import InstanceEditForm from './forms/InstanceEditForm';

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
  once: 'One-time', weekly: 'Weekly', biweekly: 'Every 2 weeks', semimonthly: 'Twice a month', monthly: 'Monthly', bimonthly: 'Every 2 months', payment_plan: 'Payment Plan', split: 'Split Monthly'
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

// Calculate credit card remaining balance at a specific year/month
// Returns { remainingBalance, isPaidOff, paymentThisMonth }
const getCreditCardBalanceAtMonth = (
  expense: Expense,
  targetYear: number,
  targetMonth: number
): { remainingBalance: number; isPaidOff: boolean; paymentThisMonth: number } => {
  if (!expense.creditCard) {
    return { remainingBalance: 0, isPaidOff: true, paymentThisMonth: 0 };
  }

  const cc = expense.creditCard;
  const apr = cc.apr || 0;
  const monthlyRate = (apr / 100) / 12;
  const regularPayment = expense.amount;
  
  // Use balanceAsOfDate if available, otherwise use today's date
  // This handles migration from old data that only had totalDebt
  const today = new Date();
  const balanceDate = cc.balanceAsOfDate 
    ? parseDate(cc.balanceAsOfDate)
    : new Date(today.getFullYear(), today.getMonth(), 1); // First of current month
  const balanceYear = balanceDate.getFullYear();
  const balanceMonth = balanceDate.getMonth();
  
  // Start date for payments (when payments begin)
  const startDate = parseDate(expense.startDate || new Date().toISOString().split('T')[0]);
  const startYear = startDate.getFullYear();
  const startMonth = startDate.getMonth();
  const paymentDay = startDate.getDate();
  
  const overrides = expense.overrides || [];

  // Use currentBalance if available, otherwise fall back to totalDebt
  let balance = cc.currentBalance ?? cc.totalDebt;
  
  // If target is before the balance date, return the balance as-is
  if (targetYear < balanceYear || (targetYear === balanceYear && targetMonth < balanceMonth)) {
    return { remainingBalance: balance, isPaidOff: false, paymentThisMonth: 0 };
  }
  
  // Start processing from the month AFTER the balance date
  // (the balance is already the end-of-month balance for balanceMonth)
  let currentYear = balanceYear;
  let currentMonth = balanceMonth + 1;
  if (currentMonth > 11) {
    currentMonth = 0;
    currentYear++;
  }

  // Process each month from after balance date until target month
  while (currentYear < targetYear || (currentYear === targetYear && currentMonth < targetMonth)) {
    if (balance <= 0) break;

    // Only add interest and subtract payments if we're at or after the first payment month
    const isPaymentMonth = (currentYear > startYear) || 
      (currentYear === startYear && currentMonth >= startMonth);
    
    if (isPaymentMonth) {
      // Add interest for this month
      balance += balance * monthlyRate;

      // Get payment for this month
      const monthStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
      let payment = regularPayment;

      // Check for override
      const expectedDateStr = `${monthStr}-${String(Math.min(paymentDay, getDaysInMonth(currentYear, currentMonth))).padStart(2, '0')}`;
      const override = overrides.find(o => o.originalDate === expectedDateStr);
      
      if (override) {
        if (!isSkippedOverride(override) && override.newDate) {
          const movedDate = parseDate(override.newDate);
          if (movedDate.getFullYear() < targetYear || 
              (movedDate.getFullYear() === targetYear && movedDate.getMonth() < targetMonth)) {
            payment = override.newAmount ?? regularPayment;
          } else {
            payment = 0;
          }
        } else {
          payment = 0;
        }
      }

      balance -= payment;
      if (balance < 0) balance = 0;
    }

    // Move to next month
    currentMonth++;
    if (currentMonth > 11) {
      currentMonth = 0;
      currentYear++;
    }
  }

  // Calculate payment for the target month
  let paymentThisMonth = 0;
  if (balance > 0) {
    const isPaymentMonth = (targetYear > startYear) || 
      (targetYear === startYear && targetMonth >= startMonth);
    
    if (isPaymentMonth) {
      // Add interest for target month
      const interestThisMonth = balance * monthlyRate;
      balance += interestThisMonth;
      
      const monthStr = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}`;
      const expectedDateStr = `${monthStr}-${String(Math.min(paymentDay, getDaysInMonth(targetYear, targetMonth))).padStart(2, '0')}`;
      const override = overrides.find(o => o.originalDate === expectedDateStr);
      
      if (override && isSkippedOverride(override)) {
        paymentThisMonth = 0;
      } else if (override?.newAmount !== undefined) {
        paymentThisMonth = Math.min(override.newAmount, balance);
      } else {
        paymentThisMonth = Math.min(regularPayment, balance);
      }
    }
  }

  return {
    remainingBalance: Math.max(0, balance),
    isPaidOff: balance <= 0,
    paymentThisMonth
  };
};

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

const getOccurrencesInMonth = (item: Income | Expense, year: number, month: number): OccurrenceInfo[] => {
  const occurrences: OccurrenceInfo[] = [];
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0);
  const overrides = item.overrides || [];

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
    return occurrences;
  }

  const start = parseDate(item.startDate || item.date!);
  const expense = item as Expense;
  
  // Special handling for credit cards - calculate remaining balance and adjust payment
  if (expense.creditCard) {
    const dayOfMonth = Math.min(start.getDate(), getDaysInMonth(year, month));
    const dateStr = formatDateStr(new Date(year, month, dayOfMonth));
    const override = overrides.find(o => o.originalDate === dateStr);
    
    // Check for skipped first - show even if otherwise paid off
    if (override && isSkippedOverride(override)) {
      // Skipped - show with $0
      occurrences.push({
        day: dayOfMonth,
        dateStr,
        amount: 0,
        isOverride: true,
        isSkipped: true,
        originalDate: dateStr
      });
      return occurrences;
    }
    
    const ccStatus = getCreditCardBalanceAtMonth(expense, year, month);
    
    // If paid off, no occurrence
    if (ccStatus.isPaidOff || ccStatus.paymentThisMonth <= 0) {
      return occurrences;
    }
    
    // Check if we're before the start date
    const monthsFromStart = (year - start.getFullYear()) * 12 + (month - start.getMonth());
    if (monthsFromStart < 0) {
      return occurrences;
    }
    
    if (override && override.newDate) {
      const newDate = parseDate(override.newDate);
      if (newDate.getFullYear() === year && newDate.getMonth() === month) {
        occurrences.push({
          day: newDate.getDate(),
          dateStr: override.newDate,
          amount: override.newAmount ?? ccStatus.paymentThisMonth,
          isOverride: true,
          originalDate: dateStr
        });
      }
    } else if (!override) {
      occurrences.push({
        day: dayOfMonth,
        dateStr,
        amount: ccStatus.paymentThisMonth,
        isOverride: false
      });
    }
    
    return occurrences;
  }
  
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
    return occurrences;
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
  
  // Remove duplicates by dateStr (allows multiple occurrences on same day for splits)
  const seen = new Set<string>();
  return occurrences.filter(o => {
    const key = o.dateStr + (o.isSplit ? '-split-' + o.amount : '');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a, b) => a.day - b.day);
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

  const supabase = createClient();

  // Helper to get default date in selected month
  const getDefaultDateInSelectedMonth = () => {
    const day = Math.min(15, getDaysInMonth(selectedMonth.year, selectedMonth.month));
    return `${selectedMonth.year}-${String(selectedMonth.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };

  useEffect(() => {
    // Skip loading in preview mode
    if (isPreviewMode) return;
    
    const loadData = async () => {
      const { data: cashflowData, error } = await supabase.from('cashflow_data').select('*').eq('user_id', user!.id).single();
      if (!error && cashflowData) {
        setData({
          id: cashflowData.id, user_id: cashflowData.user_id,
          startingBalance: parseFloat(cashflowData.starting_balance) || 0,
          startingDate: cashflowData.starting_date || new Date().toISOString().split('T')[0],
          warningThreshold: parseFloat(cashflowData.warning_threshold) || 500,
          floorThreshold: parseFloat(cashflowData.floor_threshold) || 50,
          incomes: cashflowData.incomes || [], expenses: cashflowData.expenses || [],
          categoryColors: cashflowData.category_colors || {}
        });
      }
      setLoading(false);
    };
    loadData();
  }, [user?.id, isPreviewMode]);

  const saveData = async (newData: CashFlowData) => {
    // Skip saving in preview mode
    if (isPreviewMode) return;
    
    setSaving(true);
    await supabase.from('cashflow_data').upsert({
      user_id: user!.id, starting_balance: newData.startingBalance, starting_date: newData.startingDate,
      warning_threshold: newData.warningThreshold, floor_threshold: newData.floorThreshold, 
      incomes: newData.incomes, expenses: newData.expenses,
      category_colors: newData.categoryColors || {}
    }, { onConflict: 'user_id' });
    setSaving(false);
  };

  const updateData = (updates: Partial<CashFlowData>) => { const newData = { ...data, ...updates }; setData(newData); saveData(newData); };

  const addIncome = (income: Omit<Income, 'id'>) => { updateData({ incomes: [...data.incomes, { ...income, id: Date.now().toString() }] }); setModal(null); };
  const updateIncome = (id: string, updates: Partial<Income>) => { updateData({ incomes: data.incomes.map(i => i.id === id ? { ...i, ...updates } : i) }); setModal(null); setEditingItem(null); };
  const deleteIncome = (id: string) => { updateData({ incomes: data.incomes.filter(i => i.id !== id) }); };
  const addExpense = (expense: Omit<Expense, 'id'>) => { updateData({ expenses: [...data.expenses, { ...expense, id: Date.now().toString() }] }); setModal(null); };
  const updateExpense = (id: string, updates: Partial<Expense>) => { updateData({ expenses: data.expenses.map(e => e.id === id ? { ...e, ...updates } : e) }); setModal(null); setEditingItem(null); };
  const deleteExpense = (id: string) => { updateData({ expenses: data.expenses.filter(e => e.id !== id) }); };

  // Type-safe save handlers for modals
  const handleSaveIncome = (d: Omit<Income, 'id'>) => {
    if (editingItem) {
      updateIncome(editingItem.id, d);
    } else {
      addIncome(d);
    }
  };
  
  const handleSaveExpense = (d: Omit<Expense, 'id'>) => {
    if (editingItem) {
      updateExpense(editingItem.id, d);
    } else {
      addExpense(d);
    }
  };

  // Handle instance override
  const handleSaveInstanceOverride = (override: InstanceOverride) => {
    if (!editingEvent || !editingItem) return;
    
    const existingOverrides = editingItem.overrides || [];
    const newOverrides = existingOverrides.filter(o => o.originalDate !== override.originalDate);
    newOverrides.push(override);
    
    if (editingEvent.type === 'income') {
      updateIncome(editingItem.id, { overrides: newOverrides });
    } else {
      updateExpense(editingItem.id, { overrides: newOverrides });
    }
    setModal(null);
    setEditingEvent(null);
    setEditingItem(null);
  };

  const handleRemoveInstanceOverride = () => {
    if (!editingEvent || !editingItem) return;
    const originalDate = editingEvent.originalDate || editingEvent.instanceDate;
    const newOverrides = (editingItem.overrides || []).filter(o => o.originalDate !== originalDate);
    
    if (editingEvent.type === 'income') {
      updateIncome(editingItem.id, { overrides: newOverrides });
    } else {
      updateExpense(editingItem.id, { overrides: newOverrides });
    }
    setModal(null);
    setEditingEvent(null);
    setEditingItem(null);
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

  const dailyData: DayData[] = useMemo(() => {
    const { year, month } = selectedMonth;
    const days: DayData[] = [];
    
    // Parse starting date
    const startDate = parseDate(data.startingDate);
    const startYear = startDate.getFullYear();
    const startMonth = startDate.getMonth();
    const startDay = startDate.getDate();
    
    // Calculate balance at the start of the selected month
    // by processing all transactions from startingDate to end of previous month
    let balanceAtMonthStart = data.startingBalance;
    
    // Process from starting date forward to the day before selected month
    let tempYear = startYear;
    let tempMonth = startMonth;
    
    while (tempYear < year || (tempYear === year && tempMonth < month)) {
      const daysInThisMonth = getDaysInMonth(tempYear, tempMonth);
      const dayStart = (tempYear === startYear && tempMonth === startMonth) ? startDay : 1;
      
      for (let d = dayStart; d <= daysInThisMonth; d++) {
        data.incomes.forEach(income => {
          const occurrences = getOccurrencesInMonth(income, tempYear, tempMonth);
          const occ = occurrences.find(o => o.day === d);
          if (occ) balanceAtMonthStart += occ.amount;
        });
        data.expenses.forEach(expense => {
          const occurrences = getOccurrencesInMonth(expense, tempYear, tempMonth);
          const occ = occurrences.find(o => o.day === d);
          if (occ) balanceAtMonthStart -= occ.amount;
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
      let dayChange = 0;
      const events: DayEvent[] = [];
      
      data.incomes.forEach(income => {
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
      
      data.expenses.forEach(expense => {
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

  // Calculate today's balance from starting balance
  const todaysBalance = useMemo(() => {
    const today = new Date();
    const todayYear = today.getFullYear();
    const todayMonth = today.getMonth();
    const todayDay = today.getDate();
    
    const startDate = parseDate(data.startingDate);
    const startYear = startDate.getFullYear();
    const startMonth = startDate.getMonth();
    const startDay = startDate.getDate();
    
    let balance = data.startingBalance;
    
    // Process from starting date to today
    let tempYear = startYear;
    let tempMonth = startMonth;
    
    while (tempYear < todayYear || (tempYear === todayYear && tempMonth <= todayMonth)) {
      const daysInThisMonth = getDaysInMonth(tempYear, tempMonth);
      const dayStart = (tempYear === startYear && tempMonth === startMonth) ? startDay : 1;
      const dayEnd = (tempYear === todayYear && tempMonth === todayMonth) ? todayDay : daysInThisMonth;
      
      for (let d = dayStart; d <= dayEnd; d++) {
        data.incomes.forEach(income => {
          const occurrences = getOccurrencesInMonth(income, tempYear, tempMonth);
          const occ = occurrences.find(o => o.day === d);
          if (occ) balance += occ.amount;
        });
        data.expenses.forEach(expense => {
          const occurrences = getOccurrencesInMonth(expense, tempYear, tempMonth);
          const occ = occurrences.find(o => o.day === d);
          if (occ) balance -= occ.amount;
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

  const months = useMemo(() => {
    const result = [];
    const now = new Date();
    const monthCounts: Record<string, number> = { '6m': 6, '1y': 12, '2y': 24, '5y': 60, '10y': 120, '15y': 180 };
    const count = monthCounts[timeRange] || 12;
    for (let i = 0; i < count; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      result.push({
        year: d.getFullYear(),
        month: d.getMonth(),
        label: d.toLocaleString('default', { month: 'short', year: 'numeric' }),
        shortLabel: d.toLocaleString('default', { month: 'short' }) + ' ' + String(d.getFullYear()).slice(2)
      });
    }
    return result;
  }, [timeRange]);
  const alerts = useMemo(() => { const result = []; if (stats.lowestBalance < data.floorThreshold) result.push({ type: 'danger', title: 'Critical Balance Alert', text: `Balance drops to ${formatCurrency(stats.lowestBalance)} on day ${stats.lowestDay}` }); else if (stats.lowestBalance < data.warningThreshold) result.push({ type: 'warning', title: 'Low Balance Warning', text: `Balance drops to ${formatCurrency(stats.lowestBalance)} on day ${stats.lowestDay}` }); return result; }, [stats, data.floorThreshold, data.warningThreshold]);
  const getBalanceStatus = (balance: number) => { if (balance < data.floorThreshold) return 'danger'; if (balance < data.warningThreshold) return 'warning'; return 'safe'; };
  const groupedExpenses = useMemo(() => { const groups: Record<string, Expense[]> = {}; expenseCategories.forEach(cat => { groups[cat.value] = []; }); data.expenses.forEach(expense => { (groups[expense.category] || groups['other']).push(expense); }); return groups; }, [data.expenses]);

  // Calculate current remaining balance for credit cards
  const getCreditCardRemainingBalance = (expense: Expense): { remaining: number; isPaidOff: boolean; monthsRemaining: number; payoffDate: string | null } => {
    if (!expense.creditCard) return { remaining: 0, isPaidOff: true, monthsRemaining: 0, payoffDate: null };
    
    // Use selected month for projection
    const { year, month } = selectedMonth;
    const status = getCreditCardBalanceAtMonth(expense, year, month);
    const remaining = Math.max(0, status.remainingBalance);
    
    // Calculate months remaining until payoff from selected month
    let monthsRemaining = 0;
    let payoffDate: string | null = null;
    
    if (!status.isPaidOff && remaining > 0) {
      const cc = expense.creditCard;
      const apr = cc.apr || 0;
      const monthlyRate = (apr / 100) / 12;
      const payment = expense.amount;
      
      // Simulate forward to find payoff
      let balance = remaining;
      let projYear = year;
      let projMonth = month;
      const maxMonths = 360; // 30 year cap
      
      while (balance > 0 && monthsRemaining < maxMonths) {
        // Add interest
        balance += balance * monthlyRate;
        // Subtract payment
        balance -= payment;
        monthsRemaining++;
        
        // Move to next month
        projMonth++;
        if (projMonth > 11) {
          projMonth = 0;
          projYear++;
        }
        
        if (balance <= 0) {
          payoffDate = new Date(projYear, projMonth, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
          break;
        }
      }
      
      if (monthsRemaining >= maxMonths) {
        payoffDate = 'Never (payment too low)';
      }
    }
    
    return { remaining, isPaidOff: status.isPaidOff, monthsRemaining, payoffDate };
  };

  const handleEditEvent = (event: DayEvent) => {
    // Check if this event is more than 3 months old
    const eventDate = parseDate(event.instanceDate);
    const now = new Date();
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
    
    const item = event.type === 'income' 
      ? data.incomes.find(i => i.id === event.id)
      : data.expenses.find(e => e.id === event.id);
    
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
      await supabase.auth.signOut(); 
    }
  };

  if (loading) return <div className="min-h-screen bg-gray-950 flex items-center justify-center"><div className="text-gray-400">Loading...</div></div>;

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
        {activeTab === 'dashboard' && (
          <div className="space-y-3">
            {alerts.map((alert, i) => (<div key={i} className={`p-3 rounded-lg flex items-start gap-2 ${alert.type === 'danger' ? 'bg-red-500/10 border border-red-500/30 text-red-400' : 'bg-yellow-500/10 border border-yellow-500/30 text-yellow-400'}`}><span className="text-lg">{alert.type === 'danger' ? '🚨' : '⚠️'}</span><div><div className="font-semibold text-sm">{alert.title}</div><div className="text-xs opacity-90">{alert.text}</div></div></div>))}
            
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
                                {pastMonths.map((m, idx) => (
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
                        return (
                        <div key={`${day.day}-${eventIdx}`} className={`grid grid-cols-12 px-3 py-2 border-b border-gray-800 items-center ${event.isSkipped ? 'bg-gray-500/5' : day.balance < data.floorThreshold ? 'bg-red-500/5' : ''}`}>
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
                          <div className={`col-span-3 text-right font-mono text-sm font-semibold ${eventIdx === day.events.length - 1 ? (getBalanceStatus(day.balance) === 'safe' ? 'text-green-400' : getBalanceStatus(day.balance) === 'warning' ? 'text-yellow-400' : 'text-red-400') : 'text-gray-600'}`}>
                            {eventIdx === day.events.length - 1 ? formatCurrency(day.balance) : ''}
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
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 p-3 bg-gray-800 border-b border-gray-700">
                <h2 className="font-semibold">Income Sources</h2>
                <div className="flex gap-2 w-full sm:w-auto">
                  <button onClick={() => { setEditingItem(null); setModal('income'); }} className="flex-1 sm:flex-none px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg">+ Recurring</button>
                  <button onClick={() => { setEditingItem(null); setModal('income-once'); }} className="flex-1 sm:flex-none px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg">+ One-time</button>
                </div>
              </div>
              <div className="p-3 space-y-2">
                {data.incomes.length === 0 ? (<div className="text-center py-8 text-gray-500"><div className="text-3xl mb-2">💵</div><div className="font-medium">No income sources yet</div></div>) : (
                  data.incomes.map(income => (
                    <div key={income.id} className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 bg-gray-800 border border-gray-700 rounded-lg">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{income.name}</div>
                        <div className="text-xs text-gray-500">{frequencyLabels[income.frequency]} • {income.frequency === 'once' ? new Date(income.date! + 'T12:00:00').toLocaleDateString() : `Starting ${new Date(income.startDate! + 'T12:00:00').toLocaleDateString()}`}</div>
                      </div>
                      <div className="flex items-center justify-between sm:justify-end gap-2">
                        <div className="font-mono text-emerald-400 font-semibold text-lg">{formatCurrency(income.amount)}</div>
                        <div className="flex gap-2">
                          <button onClick={() => { setEditingItem(income); setModal(income.frequency === 'once' ? 'income-once' : 'income'); }} className="px-3 py-1.5 bg-gray-700 text-gray-300 rounded text-sm">Edit</button>
                          <button onClick={() => deleteIncome(income.id)} className="px-3 py-1.5 bg-red-500/10 text-red-400 rounded">×</button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
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
                {data.expenses.length === 0 ? (<div className="text-center py-8 text-gray-500"><div className="text-3xl mb-2">📋</div><div className="font-medium">No expenses yet</div></div>) : (
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
                          {items.map(expense => {
                            const ccBalance = expense.creditCard ? getCreditCardRemainingBalance(expense) : null;
                            const catColor = getCategoryColor(expense.category, data.categoryColors);
                            const isPaidOff = ccBalance?.isPaidOff;
                            return (
                            <div key={expense.id} className={`flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded-lg border ${isPaidOff ? 'bg-green-500/5 border-green-500/20' : 'bg-gray-800 border-gray-700'}`}>
                              <div className="flex-1 min-w-0">
                                <div className="font-medium truncate flex items-center gap-2">
                                  <span className={`${catColor.text}`}>●</span>
                                  {expense.name}
                                  {isPaidOff && <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded">PAID OFF</span>}
                                </div>
                                <div className="text-xs text-gray-500 ml-4">
                                  {frequencyLabels[expense.frequency]} 
                                  {expense.creditCard && (
                                    isPaidOff ? (
                                      <span className="text-green-400"> • Original: {formatCurrency(expense.creditCard.totalDebt)} — Paid off!</span>
                                    ) : (
                                      <>
                                        <span className={catColor.text}> • Balance: {formatCurrency(ccBalance?.remaining || 0)}</span>
                                        {ccBalance?.monthsRemaining && ccBalance.monthsRemaining > 0 && (
                                          <span className="text-gray-400"> • {ccBalance.monthsRemaining} mo left</span>
                                        )}
                                        {ccBalance?.payoffDate && (
                                          <span className="text-gray-500"> (payoff: {ccBalance.payoffDate})</span>
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
                                </div>
                              </div>
                              <div className="flex items-center justify-between sm:justify-end gap-2">
                                <div className={`font-mono font-semibold text-lg ${isPaidOff ? 'text-green-400' : catColor.text}`}>{formatCurrency(expense.amount)}/mo</div>
                                <div className="flex gap-2">
                                  <button onClick={() => { setEditingItem(expense); setModal(expense.category === 'credit_card' ? 'credit-card' : expense.frequency === 'payment_plan' ? 'payment-plan' : expense.frequency === 'once' ? 'expense-once' : 'expense'); }} className="px-3 py-1.5 bg-gray-700 text-gray-300 rounded text-sm">Edit</button>
                                  <button onClick={() => deleteExpense(expense.id)} className="px-3 py-1.5 bg-red-500/10 text-red-400 rounded">×</button>
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
                <div className="text-xs text-gray-500">Enter your actual bank balance and the date it was recorded. All calculations will start from this point.</div>
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
      {modal === 'instance-edit' && editingEvent && editingItem && (
        <Modal title={`Edit ${editingEvent.name}`} onClose={() => { setModal(null); setEditingItem(null); setEditingEvent(null); }}>
          <InstanceEditForm 
            event={editingEvent} 
            item={editingItem} 
            onSave={handleSaveInstanceOverride}
            onRemoveOverride={handleRemoveInstanceOverride}
            onEditRecurring={handleEditRecurring}
            onClose={() => { setModal(null); setEditingItem(null); setEditingEvent(null); }}
            creditCardBalance={
              (editingItem as Expense).creditCard 
                ? getCreditCardBalanceAtMonth(
                    editingItem as Expense,
                    parseInt(editingEvent.instanceDate.split('-')[0]),
                    parseInt(editingEvent.instanceDate.split('-')[1]) - 1
                  ).remainingBalance
                : undefined
            }
          />
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
    </div>
  );
}
