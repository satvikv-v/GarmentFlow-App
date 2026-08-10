/**
 * React Query hooks for /orders endpoints.
 * Also includes useCustomers for the customer select in the form.
 */
import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from '@tanstack/react-query';
import apiClient from '../lib/api';
import type {
  Order,
  PaginatedOrderResponse,
  OrderStatus,
  OrderPriority,
  Customer,
  PaginatedCustomerResponse,
  ProductionBatch,
  PaginatedBatchResponse,
  Dispatch,
  PaginatedDispatchResponse,
} from '../types';

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------
export const orderKeys = {
  all: ['orders'] as const,
  list: (params: OrderListParams) => ['orders', 'list', params] as const,
  detail: (id: number) => ['orders', 'detail', id] as const,
  batch: (orderId: number) => ['orders', 'batch', orderId] as const,
  dispatch: (orderId: number) => ['orders', 'dispatch', orderId] as const,
};

export const customerKeys = {
  all: ['customers'] as const,
  list: (search?: string) => ['customers', 'list', search] as const,
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface OrderListParams {
  page: number;
  page_size: number;
  status?: OrderStatus | '';
  priority?: OrderPriority | '';
  customer_id?: number | '';
}

export interface OrderCreatePayload {
  customer_id: number;
  product: string;
  color: string;
  fabric: string;
  size_breakdown: Record<string, number>;
  quantity: number;
  delivery_deadline: string;
  priority: OrderPriority;
  order_type: 'small' | 'bulk' | 'repeat';
}

export interface OrderUpdatePayload extends Partial<OrderCreatePayload> {
  status?: OrderStatus;
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useOrders(params: OrderListParams) {
  const cleanParams: Record<string, string | number> = {
    page: params.page,
    page_size: params.page_size,
  };
  if (params.status) cleanParams.status = params.status;
  if (params.priority) cleanParams.priority = params.priority;
  if (params.customer_id) cleanParams.customer_id = params.customer_id;

  return useQuery({
    queryKey: orderKeys.list(params),
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedOrderResponse>('/orders', {
        params: cleanParams,
      });
      return data;
    },
    placeholderData: keepPreviousData,
    staleTime: 10_000,
  });
}

export function useOrder(id: number) {
  return useQuery({
    queryKey: orderKeys.detail(id),
    queryFn: async () => {
      const { data } = await apiClient.get<Order>(`/orders/${id}`);
      return data;
    },
    enabled: id > 0,
  });
}

export function useOrderBatch(orderId: number) {
  return useQuery({
    queryKey: orderKeys.batch(orderId),
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedBatchResponse>(
        '/production/batches',
        { params: { order_id: orderId, page_size: 1 } }
      );
      return data.items[0] as ProductionBatch | undefined;
    },
    enabled: orderId > 0,
    staleTime: 15_000,
  });
}

export function useOrderDispatch(orderId: number) {
  // Dispatch list doesn't filter by order_id server-side, so fetch all
  // dispatches for this order by checking the response. In practice each
  // order has at most one dispatch record so page_size=100 is fine.
  return useQuery({
    queryKey: orderKeys.dispatch(orderId),
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedDispatchResponse>(
        '/dispatch',
        { params: { page_size: 100 } }
      );
      const match = data.items.find((d: Dispatch) => d.order_id === orderId);
      return match ?? null;
    },
    enabled: orderId > 0,
    staleTime: 15_000,
  });
}

export function useCreateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: OrderCreatePayload) => {
      const { data } = await apiClient.post<Order>('/orders', payload);
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: orderKeys.all });
    },
  });
}

export function useUpdateOrder(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: OrderUpdatePayload) => {
      const { data } = await apiClient.put<Order>(`/orders/${id}`, payload);
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: orderKeys.all });
    },
  });
}

export function useDeleteOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/orders/${id}`);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: orderKeys.all });
    },
  });
}

// ---------------------------------------------------------------------------
// Customers (for form select)
// ---------------------------------------------------------------------------
export function useCustomers(search?: string) {
  return useQuery({
    queryKey: customerKeys.list(search),
    queryFn: async () => {
      const params: Record<string, string | number> = { page_size: 100 };
      if (search) params.search = search;
      const { data } = await apiClient.get<PaginatedCustomerResponse>(
        '/customers',
        { params }
      );
      return data.items as Customer[];
    },
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
}
