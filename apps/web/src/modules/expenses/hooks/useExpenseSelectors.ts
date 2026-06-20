/**
 * modules/expenses/hooks/useExpenseSelectors.ts
 *
 * Business logic extracted from Leave.tsx (ExpensesModule).
 */

import { useMemo } from 'react';
import { useExpenses, type ExpenseClaim } from '../../../hooks/api';

export interface ExpenseMetrics {
  total:         number;
  pendingCount:  number;
  pendingValue:  number;
  approvedValue: number;
  rejectedCount: number;
}

export function useExpenseMetrics(items: ExpenseClaim[]): ExpenseMetrics {
  return useMemo(() => ({
    total:         items.length,
    pendingCount:  items.filter(e => e.status === 'pending').length,
    pendingValue:  items.filter(e => e.status === 'pending').reduce((a, e) => a + e.amount, 0),
    approvedValue: items.filter(e => e.status === 'approved').reduce((a, e) => a + e.amount, 0),
    rejectedCount: items.filter(e => e.status === 'rejected').length,
  }), [items]);
}

export function useFilteredExpenses(tab: string) {
  const params =
    tab === 'mine'    ? { mine: 'true' } :
    tab === 'pending' ? { status: 'pending' } : {};
  return useExpenses(params);
}

export const EXPENSE_CATEGORY_ICONS: Record<string, string> = {
  travel:        '✈️',
  accommodation: '🏨',
  meals:         '🍽️',
  equipment:     '💻',
  training:      '🎓',
  software:      '📱',
  other:         '📦',
};
