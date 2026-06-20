/**
 * platform/auth/apiClient.ts
 *
 * Shared API fetch primitives used by all module hooks.
 * No business logic — transport layer only.
 */

import { useQuery, useMutation, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import { useAuth, apiFetch } from '../../context/AuthContext';

export function useApi<T>(
  key: unknown[],
  path: string,
  options?: Omit<UseQueryOptions<T>, 'queryKey' | 'queryFn'>
) {
  const { accessToken } = useAuth();
  return useQuery<T>({
    queryKey: key,
    queryFn:  () => apiFetch<T>(path, {}, accessToken),
    enabled:  !!accessToken,
    ...options,
  });
}

export function useApiMutation<TData = unknown, TVariables = unknown>(
  path: string | ((vars: TVariables) => string),
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'POST',
  invalidateKeys?: unknown[][]
) {
  const { accessToken } = useAuth();
  const qc = useQueryClient();

  return useMutation<TData, Error, TVariables>({
    mutationFn: (vars) => {
      const url = typeof path === 'function' ? path(vars) : path;
      return apiFetch<TData>(url, {
        method,
        body: vars ? JSON.stringify(vars) : undefined,
      }, accessToken);
    },
    onSuccess: () => {
      invalidateKeys?.forEach(key => qc.invalidateQueries({ queryKey: key }));
    },
  });
}
