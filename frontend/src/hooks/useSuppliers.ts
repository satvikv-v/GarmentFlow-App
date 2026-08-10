/**
 * React Query hooks for /suppliers endpoints.
 * Note: the list endpoint returns SupplierOut (no computed stats).
 *       Computed delivery stats (on_time_delivery_rate, average_actual_delay_days)
 *       only come from GET /suppliers/{id} — fetched on drawer open.
 */
import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from '@tanstack/react-query';
import apiClient from '../lib/api';
import type {
  Supplier,
  SupplierDetail,
  PaginatedSupplierResponse,
  PurchaseOrder,
  PaginatedPurchaseOrderResponse,
} from '../types';

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------
export const supplierKeys = {
  all: ['suppliers'] as const,
  list: (params: SupplierListParams) => ['suppliers', 'list', params] as const,
  detail: (id: number) => ['suppliers', 'detail', id] as const,
  pos: (id: number) => ['suppliers', 'pos', id] as const,
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface SupplierListParams {
  page: number;
  page_size: number;
  search?: string;
}

export interface SupplierCreatePayload {
  name: string;
  contact_person?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  materials_supplied?: string | null;
  average_delivery_days?: number | null;
  quality_rating?: number | null;
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useSuppliersList(params: SupplierListParams) {
  const cleanParams: Record<string, string | number> = {
    page: params.page,
    page_size: params.page_size,
  };
  if (params.search) cleanParams.search = params.search;

  return useQuery({
    queryKey: supplierKeys.list(params),
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedSupplierResponse>(
        '/suppliers',
        { params: cleanParams }
      );
      return data;
    },
    placeholderData: keepPreviousData,
    staleTime: 20_000,
  });
}

export function useSupplierDetail(id: number) {
  return useQuery({
    queryKey: supplierKeys.detail(id),
    queryFn: async () => {
      const { data } = await apiClient.get<SupplierDetail>(`/suppliers/${id}`);
      return data;
    },
    enabled: id > 0,
    staleTime: 15_000,
  });
}

export function useSupplierPurchaseOrders(supplierId: number) {
  return useQuery({
    queryKey: supplierKeys.pos(supplierId),
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedPurchaseOrderResponse>(
        `/suppliers/${supplierId}/purchase-orders`,
        { params: { page_size: 50 } }
      );
      return data.items as PurchaseOrder[];
    },
    enabled: supplierId > 0,
    staleTime: 15_000,
  });
}

export function useCreateSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: SupplierCreatePayload) => {
      const { data } = await apiClient.post<Supplier>('/suppliers', payload);
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: supplierKeys.all });
    },
  });
}

export function useUpdateSupplier(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<SupplierCreatePayload>) => {
      const { data } = await apiClient.put<Supplier>(`/suppliers/${id}`, payload);
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: supplierKeys.all });
    },
  });
}

export function useDeleteSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/suppliers/${id}`);
      return id;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: supplierKeys.all });
    },
  });
}
