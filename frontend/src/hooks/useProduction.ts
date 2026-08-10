/**
 * React Query hooks for /production/batches and /workers endpoints.
 */
import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from '@tanstack/react-query';
import apiClient from '../lib/api';
import type {
  ProductionBatch,
  PaginatedBatchResponse,
  BatchStatus,
  Worker,
  PaginatedWorkerResponse,
} from '../types';

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------
export const batchKeys = {
  all: ['batches'] as const,
  list: (params: BatchListParams) => ['batches', 'list', params] as const,
  detail: (id: number) => ['batches', 'detail', id] as const,
};

export const workerKeys = {
  active: ['workers', 'active'] as const,
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface BatchListParams {
  page: number;
  page_size: number;
  status?: BatchStatus | '';
  production_line?: string;
}

export interface BatchCreatePayload {
  order_id: number;
  production_line?: string;
  planned_quantity: number;
  expected_completion_date?: string;
  assigned_worker_ids: number[];
  skip_embroidery: boolean;
}

export interface StageUpdatePayload {
  status?: 'pending' | 'in_progress' | 'completed' | 'delayed' | 'skipped';
  quantity_completed?: number;
  delay_reason?: string;
  notes?: string;
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useBatches(params: BatchListParams) {
  const cleanParams: Record<string, string | number> = {
    page: params.page,
    page_size: params.page_size,
  };
  if (params.status) cleanParams.status = params.status;
  if (params.production_line) cleanParams.production_line = params.production_line;

  return useQuery({
    queryKey: batchKeys.list(params),
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedBatchResponse>(
        '/production/batches',
        { params: cleanParams }
      );
      return data;
    },
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });
}

export function useBatch(id: number) {
  return useQuery({
    queryKey: batchKeys.detail(id),
    queryFn: async () => {
      const { data } = await apiClient.get<ProductionBatch>(
        `/production/batches/${id}`
      );
      return data;
    },
    enabled: id > 0,
    staleTime: 10_000,
  });
}

export function useCreateBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: BatchCreatePayload) => {
      const { data } = await apiClient.post<ProductionBatch>(
        '/production/batches',
        payload
      );
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: batchKeys.all });
    },
  });
}

export function useUpdateStage(batchId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      stageId,
      payload,
    }: {
      stageId: number;
      payload: StageUpdatePayload;
    }) => {
      const { data } = await apiClient.patch<ProductionBatch>(
        `/production/batches/${batchId}/stages/${stageId}`,
        payload
      );
      return data;
    },
    onSuccess: (updatedBatch) => {
      // Optimistically update the detail cache immediately
      qc.setQueryData(batchKeys.detail(batchId), updatedBatch);
      // Also invalidate the list so the status/remaining cols refresh
      void qc.invalidateQueries({ queryKey: batchKeys.all });
    },
  });
}

// ---------------------------------------------------------------------------
// Active workers for batch assignment
// ---------------------------------------------------------------------------
export function useActiveWorkers() {
  return useQuery({
    queryKey: workerKeys.active,
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedWorkerResponse>(
        '/workers',
        { params: { is_active: true, page_size: 100 } }
      );
      return data.items as Worker[];
    },
    staleTime: 60_000,
  });
}
