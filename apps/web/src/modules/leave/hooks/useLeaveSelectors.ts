/**
 * modules/leave/hooks/useLeaveSelectors.ts
 *
 * Business logic extracted from Leave.tsx.
 * Components import selectors — they do not compute these inline.
 */

import { useMemo } from 'react';
import { useLeaveRequests, type LeaveRequest } from '../../../hooks/api';

export interface LeaveMetrics {
  total:      number;
  pending:    number;
  approved:   number;
  onLeaveNow: number;
}

function isOnLeaveNow(leave: LeaveRequest): boolean {
  const now = new Date();
  return (
    leave.status === 'approved' &&
    new Date(leave.start_date) <= now &&
    new Date(leave.end_date)   >= now
  );
}

export function useLeaveMetrics(items: LeaveRequest[]): LeaveMetrics {
  return useMemo(() => ({
    total:      items.length,
    pending:    items.filter(l => l.status === 'pending').length,
    approved:   items.filter(l => l.status === 'approved').length,
    onLeaveNow: items.filter(isOnLeaveNow).length,
  }), [items]);
}

export function useFilteredLeave(tab: string) {
  const params =
    tab === 'mine'    ? { mine: 'true' } :
    tab === 'pending' ? { status: 'pending' } : {};
  return useLeaveRequests(params);
}
