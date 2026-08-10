/**
 * React Query hooks for /dispatch endpoints.
 * Role: create/PATCH = owner + sales_executive; DELETE = owner only.
 */
import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from '@tanstack/react-query';
import apiClient from '../lib/api';
import type { Dispatch, PaginatedDispatchResponse, DeliveryStatus } from '../types';

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------
export const dispatchKeys = {
  all: ['dispatch'] as const,
  list: (params: DispatchListParams) => ['dispatch', 'list', params] as const,
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface DispatchListParams {
  page: number;
  page_size: number;
  delivery_status?: DeliveryStatus | '';
  courier?: string;
}

export interface DispatchCreatePayload {
  order_id: number;
  batch_id?: number | null;
  invoice_number: string;
  courier?: string | null;
  dispatch_date: string;   // ISO date
  tracking_number?: string | null;
  delivery_status?: DeliveryStatus;
}

export interface DispatchUpdatePayload {
  delivery_status?: DeliveryStatus;
  tracking_number?: string | null;
  courier?: string | null;
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useDispatches(params: DispatchListParams) {
  const cleanParams: Record<string, string | number> = {
    page: params.page,
    page_size: params.page_size,
  };
  if (params.delivery_status) cleanParams.delivery_status = params.delivery_status;
  if (params.courier) cleanParams.courier = params.courier;

  return useQuery({
    queryKey: dispatchKeys.list(params),
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedDispatchResponse>(
        '/dispatch', { params: cleanParams }
      );
      return data;
    },
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });
}

export function useCreateDispatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: DispatchCreatePayload) => {
      const { data } = await apiClient.post<Dispatch>('/dispatch', payload);
      return data;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: dispatchKeys.all }),
  });
}

export function useUpdateDispatch(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: DispatchUpdatePayload) => {
      const { data } = await apiClient.patch<Dispatch>(`/dispatch/${id}`, payload);
      return data;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: dispatchKeys.all }),
  });
}

export function useDeleteDispatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/dispatch/${id}`);
      return id;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: dispatchKeys.all }),
  });
}
