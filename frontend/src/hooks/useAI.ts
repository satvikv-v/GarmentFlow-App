/**
 * React Query hooks for AI features:
 *   useDelayRisk(batchId)         -- GET /production/batches/{id}/delay-risk
 *   useInventoryForecast(itemId)  -- GET /inventory/items/{id}/forecast
 *   useRecommendations()          -- GET /orders/recommendations
 */
import { useQuery } from '@tanstack/react-query';
import apiClient from '../lib/api';
import type {
  DelayRiskResponse,
  InventoryForecastResponse,
  PaginatedRecommendationResponse,
} from '../types';

// ---------------------------------------------------------------------------
// Delay risk
// ---------------------------------------------------------------------------
export const delayRiskKeys = {
  batch: (id: number) => ['delay-risk', id] as const,
};

/**
 * Fetch delay risk for a production batch.
 *
 * Graceful degradation:
 * - disabled when batchId <= 0
 * - on 503 (model not loaded): returns undefined, caller hides badge
 * - retry: false — avoid hammering a downed model server
 */
export function useDelayRisk(batchId: number) {
  return useQuery({
    queryKey: delayRiskKeys.batch(batchId),
    queryFn: async () => {
      const { data } = await apiClient.get<DelayRiskResponse>(
        `/production/batches/${batchId}/delay-risk`
      );
      return data;
    },
    enabled: batchId > 0,
    retry: false,
    staleTime: 30_000,
  });
}

// ---------------------------------------------------------------------------
// Inventory forecast
// ---------------------------------------------------------------------------
export const forecastKeys = {
  item: (id: number) => ['inventory-forecast', id] as const,
};

export function useInventoryForecast(itemId: number) {
  return useQuery({
    queryKey: forecastKeys.item(itemId),
    queryFn: async () => {
      const { data } = await apiClient.get<InventoryForecastResponse>(
        `/inventory/items/${itemId}/forecast`
      );
      return data;
    },
    enabled: itemId > 0,
    retry: false,
    staleTime: 30_000,
  });
}

// ---------------------------------------------------------------------------
// Order recommendations
// ---------------------------------------------------------------------------
export const recommendationKeys = {
  all: ['recommendations'] as const,
};

export function useRecommendations() {
  return useQuery({
    queryKey: recommendationKeys.all,
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedRecommendationResponse>(
        '/orders/recommendations'
      );
      return data;
    },
    staleTime: 30_000,
    retry: 1,
  });
}
