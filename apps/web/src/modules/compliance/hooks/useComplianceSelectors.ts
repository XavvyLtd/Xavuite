/**
 * modules/compliance/hooks/useComplianceSelectors.ts
 *
 * Business logic extracted from Leave.tsx (ComplianceModule).
 */

import { useMemo } from 'react';
import { useCompliance, type RTWCheck } from '../../../hooks/api';

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

export function isExpired(check: RTWCheck): boolean {
  return !!check.expiry_date && new Date(check.expiry_date) < new Date();
}

export function isExpiringSoon(check: RTWCheck): boolean {
  if (!check.expiry_date) return false;
  const expiry = new Date(check.expiry_date);
  const now    = new Date();
  return expiry > now && expiry < new Date(Date.now() + NINETY_DAYS_MS);
}

export interface ComplianceMetrics {
  total:        number;
  valid:        number;
  expiringSoon: number;
  expired:      number;
}

export function useComplianceMetrics(items: RTWCheck[]): ComplianceMetrics {
  return useMemo(() => ({
    total:        items.length,
    valid:        items.filter(c => c.status === 'valid').length,
    expiringSoon: items.filter(isExpiringSoon).length,
    expired:      items.filter(c => c.status === 'expired').length,
  }), [items]);
}

export function useFilteredCompliance(tab: string) {
  const params =
    tab === 'expired'  ? { status: 'expired' }  :
    tab === 'expiring' ? { status: 'expiring' }  : {};
  return useCompliance(params);
}
