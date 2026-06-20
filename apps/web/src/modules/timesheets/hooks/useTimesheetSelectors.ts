/**
 * modules/timesheets/hooks/useTimesheetSelectors.ts
 *
 * Business logic extracted from Leave.tsx (TimesheetsModule).
 */

import { useMemo } from 'react';
import { useTimesheets, type Timesheet } from '../../../hooks/api';

export interface TimesheetMetrics {
  total:          number;
  pending:        number;
  totalHours:     number;
  billableHours:  number;
  utilisationPct: number;
}

export function useTimesheetMetrics(items: Timesheet[]): TimesheetMetrics {
  return useMemo(() => {
    const totalHours    = items.reduce((a, t) => a + (t.total_hours    ?? 0), 0);
    const billableHours = items.reduce((a, t) => a + (t.billable_hours ?? 0), 0);
    return {
      total:          items.length,
      pending:        items.filter(t => t.status === 'pending').length,
      totalHours,
      billableHours,
      utilisationPct: totalHours > 0 ? Math.round(billableHours / totalHours * 100) : 0,
    };
  }, [items]);
}

export function useFilteredTimesheets(tab: string) {
  const params =
    tab === 'mine'    ? { mine: 'true' } :
    tab === 'pending' ? { status: 'pending' } : {};
  return useTimesheets(params);
}

export function getDateForWeekDay(weekStart: string, dayIndex: number): string {
  if (!weekStart) return '';
  const d = new Date(weekStart);
  d.setDate(d.getDate() + dayIndex);
  return d.toISOString().split('T')[0];
}
