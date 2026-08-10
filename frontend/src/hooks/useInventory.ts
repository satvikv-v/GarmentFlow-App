/**
 * React Query hooks for /inventory/items and /suppliers endpoints.
 */
import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from '@tanstack/react-query';
import apiClient from '../lib/api';
import type {
  InventoryItem,
  InventoryItemDetail,
  PaginatedInventoryResponse,
  InventoryCategory,
  TransactionType,
  Supplier,
  PaginatedSupplierResponse,
} from '../types';

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------
export const inventoryKeys = {
  all: ['inventory'] as const,
  list: (params: ItemListParams) => ['inventory', 'list', params] as const,
  detail: (id: number) => ['inventory', 'detail', id] as const,
};

export const supplierKeys = {
  list: ['suppliers', 'list'] as const,
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface ItemListParams {
  page: number;
  page_size: number;
  category?: InventoryCategory | '';
  low_stock_only?: boolean;
}

export interface ItemCreatePayload {
  name: string;
  category: InventoryCategory;
  unit: string;
  current_stock: number;
  minimum_stock: number;
  supplier_id?: number | null;
  purchase_cost?: number | null;
}

export interface TransactionPayload {
  transaction_type: TransactionType;
  quantity: number;
  reference?: string;
  batch_id?: number | null;
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useInventoryItems(params: ItemListParams) {
  const cleanParams: Record<string, string | number | boolean> = {
    page: params.page,
    page_size: params.page_size,
  };
  if (params.category) cleanParams.category = params.category;
  if (params.low_stock_only) cleanParams.low_stock_only = true;

  return useQuery({
    queryKey: inventoryKeys.list(params),
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedInventoryResponse>(
        '/inventory/items',
        { params: cleanParams }
      );
      return data;
    },
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });
}

export function useInventoryItemDetail(id: number) {
  return useQuery({
    queryKey: inventoryKeys.detail(id),
    queryFn: async () => {
      const { data } = await apiClient.get<InventoryItemDetail>(
        `/inventory/items/${id}`
      );
      return data;
    },
    enabled: id > 0,
    staleTime: 10_000,
  });
}

export function useCreateInventoryItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: ItemCreatePayload) => {
      const { data } = await apiClient.post<InventoryItem>(
        '/inventory/items',
        payload
      );
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: inventoryKeys.all });
    },
  });
}

export function useRecordTransaction(itemId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: TransactionPayload) => {
      // Returns full InventoryItemDetail (with updated stock + fresh transactions)
      const { data } = await apiClient.post<InventoryItemDetail>(
        `/inventory/items/${itemId}/transactions`,
        payload
      );
      return data;
    },
    onSuccess: (updated) => {
      // Immediately update both the detail cache and the list so stock
      // figures refresh without a full page reload
      qc.setQueryData(inventoryKeys.detail(itemId), updated);
      void qc.invalidateQueries({ queryKey: inventoryKeys.list });
    },
  });
}

// ---------------------------------------------------------------------------
// Suppliers (for item form select)
// ---------------------------------------------------------------------------
export function useSuppliers() {
  return useQuery({
    queryKey: supplierKeys.list,
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedSupplierResponse>(
        '/suppliers',
        { params: { page_size: 100 } }
      );
      return data.items as Supplier[];
    },
    staleTime: 60_000,
  });
}
