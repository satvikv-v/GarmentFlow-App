/**
 * Production page — batch list with filters, "New Batch" role gate,
 * batch detail drawer, and creation modal.
 *
 * Role visibility:
 *   "New Batch" button — owner, production_manager only
 *   Stage update form  — owner, production_manager only (enforced in StageTimeline)
 */
import { useState, useCallback } from 'react';
import { Plus, RefreshCw, Loader2 } from 'lucide-react';
import { useBatches, type BatchListParams } from '../hooks/useProduction';
import { useAuth } from '../lib/auth';
import { BatchesTable } from '../components/production/BatchesTable';
import { BatchDetailDrawer } from '../components/production/BatchDetailDrawer';
import { BatchForm } from '../components/production/BatchForm';
import type { ProductionBatch, BatchStatus } from '../types';

const DEFAULT_PARAMS: BatchListParams = {
  page: 1,
  page_size: 20,
  status: '',
  production_line: '',
};

const STATUS_OPTIONS: { value: BatchStatus | ''; label: string }[] = [
  { value: '',            label: 'All statuses' },
  { value: 'planned',     label: 'Planned' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed',   label: 'Completed' },
  { value: 'delayed',     label: 'Delayed' },
  { value: 'on_hold',     label: 'On Hold' },
];

const selectStyle: React.CSSProperties = {
  backgroundColor: 'var(--color-bg-elevated)',
  borderColor: 'var(--color-border)',
  color: 'var(--color-text-primary)',
};

export function ProductionPage() {
  const { user } = useAuth();
  const canManage =
    user?.role === 'owner' || user?.role === 'production_manager';

  // ---- Filter / pagination state -----------------------------------------
  const [params, setParams] = useState<BatchListParams>(DEFAULT_PARAMS);
  const [lineSearch, setLineSearch] = useState('');

  const updateParams = useCallback(
    (next: Partial<BatchListParams>) =>
      setParams(prev => ({ ...prev, ...next })),
    []
  );

  const resetFilters = useCallback(() => {
    setParams(DEFAULT_PARAMS);
    setLineSearch('');
  }, []);

  // ---- Modal / drawer state ----------------------------------------------
  const [viewBatchId, setViewBatchId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);

  const openView = useCallback(
    (batch: ProductionBatch) => setViewBatchId(batch.id),
    []
  );
  const closeView = useCallback(() => setViewBatchId(null), []);
  const closeForm = useCallback(() => setShowForm(false), []);

  // ---- Data --------------------------------------------------------------
  const { data, isLoading, isError, isFetching, refetch } = useBatches(params);

  // Client-side filter on production_line (the API supports it server-side too,
  // but the line values are free-text so partial matching is friendlier client-side)
  const rows = lineSearch.trim()
    ? (data?.items ?? []).filter(b =>
        b.production_line
          ?.toLowerCase()
          .includes(lineSearch.toLowerCase())
      )
    : data?.items ?? [];

  const filteredData = data
    ? { ...data, items: rows, total: lineSearch.trim() ? rows.length : data.total }
    : undefined;

  const hasFilters = !!(params.status || lineSearch);

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h2
            className="text-xl font-bold"
            style={{ color: 'var(--color-text-primary)' }}
          >
            Production
          </h2>
          <p
            className="text-sm mt-0.5"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            {data
              ? `${data.total.toLocaleString()} batch${data.total !== 1 ? 'es' : ''} total`
              : 'Loading batches…'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => void refetch()}
            disabled={isFetching}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all"
            style={{
              backgroundColor: 'var(--color-bg-surface)',
              color: 'var(--color-text-secondary)',
              borderColor: 'var(--color-border)',
            }}
          >
            {isFetching ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <RefreshCw size={12} />
            )}
            Refresh
          </button>

          {/* New Batch — role-gated */}
          {canManage && (
            <button
              id="new-batch-btn"
              onClick={() => setShowForm(true)}
              className="btn btn-primary"
            >
              <Plus size={13} />
              New Batch
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Status */}
        <select
          value={params.status ?? ''}
          onChange={e =>
            updateParams({ status: e.target.value as BatchStatus | '', page: 1 })
          }
          className="rounded-lg px-3 py-2 text-sm border outline-none cursor-pointer"
          style={selectStyle}
        >
          {STATUS_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        {/* Production line */}
        <input
          type="text"
          placeholder="Filter by line…"
          value={lineSearch}
          onChange={e => {
            setLineSearch(e.target.value);
            updateParams({ page: 1 });
          }}
          className="rounded-lg px-3 py-2 text-sm border outline-none w-44"
          style={selectStyle}
          onFocus={e => {
            e.target.style.borderColor = 'var(--color-accent)';
          }}
          onBlur={e => {
            e.target.style.borderColor = 'var(--color-border)';
          }}
        />

        {hasFilters && (
          <button
            onClick={resetFilters}
            className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs border transition-colors"
            style={{
              color: 'var(--color-text-muted)',
              borderColor: 'var(--color-border)',
              backgroundColor: 'var(--color-bg-elevated)',
            }}
            onMouseEnter={e => {
              (e.currentTarget).style.color = 'var(--color-text-primary)';
            }}
            onMouseLeave={e => {
              (e.currentTarget).style.color = 'var(--color-text-muted)';
            }}
          >
            ✕ Clear
          </button>
        )}
      </div>

      {/* Table */}
      <BatchesTable
        data={filteredData}
        isLoading={isLoading}
        isError={isError}
        page={params.page}
        pageSize={params.page_size}
        onView={openView}
        onPageChange={page => updateParams({ page })}
      />

      {/* Batch detail drawer */}
      {viewBatchId !== null && (
        <BatchDetailDrawer
          batchId={viewBatchId}
          canEdit={canManage}
          onClose={closeView}
        />
      )}

      {/* New batch modal */}
      {showForm && <BatchForm onClose={closeForm} />}
    </div>
  );
}
