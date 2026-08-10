/**
 * React Query hooks for /workers endpoints.
 * WorkerDetail (with computed productivity stats) is fetched only on drawer open
 * to avoid N+1 calls on the list.
 */
import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from '@tanstack/react-query';
import apiClient from '../lib/api';
import type {
  Worker,
  WorkerDetail,
  PaginatedWorkerResponse,
  AttendanceRecord,
} from '../types';

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------
export const workerKeys = {
  all: ['workers'] as const,
  list: (params: WorkerListParams) => ['workers', 'list', params] as const,
  detail: (id: number) => ['workers', 'detail', id] as const,
  attendance: (id: number, page: number) => ['workers', 'attendance', id, page] as const,
  productivity: ['workers', 'productivity'] as const,
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface WorkerListParams {
  page: number;
  page_size: number;
  department?: string;
  is_active?: boolean | null; // null = all
}

export interface WorkerCreatePayload {
  name: string;
  department: string;
  skill?: string | null;
  is_active?: boolean;
}

export interface DepartmentProductivity {
  department: string;
  active_workers: number;
  average_attendance_rate: number | null;
  average_daily_output: number | null;
}

export interface PaginatedAttendanceResponse {
  items: AttendanceRecord[];
  total: number;
  page: number;
  page_size: number;
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useWorkersList(params: WorkerListParams) {
  const cleanParams: Record<string, string | number | boolean> = {
    page: params.page,
    page_size: params.page_size,
  };
  if (params.department) cleanParams.department = params.department;
  if (params.is_active !== null && params.is_active !== undefined)
    cleanParams.is_active = params.is_active;

  return useQuery({
    queryKey: workerKeys.list(params),
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedWorkerResponse>(
        '/workers', { params: cleanParams }
      );
      return data;
    },
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });
}

export function useWorkerDetail(id: number) {
  return useQuery({
    queryKey: workerKeys.detail(id),
    queryFn: async () => {
      const { data } = await apiClient.get<WorkerDetail>(`/workers/${id}`);
      return data;
    },
    enabled: id > 0,
    staleTime: 15_000,
  });
}

export function useWorkerAttendance(workerId: number, page: number) {
  return useQuery({
    queryKey: workerKeys.attendance(workerId, page),
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedAttendanceResponse>(
        `/workers/${workerId}/attendance`,
        { params: { page, page_size: 15 } }
      );
      return data;
    },
    enabled: workerId > 0,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}

export function useDepartmentProductivity() {
  return useQuery({
    queryKey: workerKeys.productivity,
    queryFn: async () => {
      const { data } = await apiClient.get<DepartmentProductivity[]>(
        '/workers/productivity/by-department'
      );
      return data;
    },
    staleTime: 60_000,
  });
}

export function useCreateWorker() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: WorkerCreatePayload) => {
      const { data } = await apiClient.post<Worker>('/workers', payload);
      return data;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: workerKeys.all }),
  });
}

export function useUpdateWorker(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<WorkerCreatePayload>) => {
      const { data } = await apiClient.put<Worker>(`/workers/${id}`, payload);
      return data;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: workerKeys.all }),
  });
}

export function useDeleteWorker() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const { data } = await apiClient.delete<{ message: string; soft_deleted?: boolean }>(
        `/workers/${id}`
      );
      return data;
    },
    // Invalidate list so soft-deleted workers appear inactive immediately
    onSuccess: () => void qc.invalidateQueries({ queryKey: workerKeys.all }),
  });
}
