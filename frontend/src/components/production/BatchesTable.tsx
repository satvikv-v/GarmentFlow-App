/** Production batches table with skeleton and empty/error states. */
import {  Eye, ChevronLeft, ChevronRight , Layers} from 'lucide-react';
import type { ProductionBatch, PaginatedBatchResponse } from '../../types';
import { BatchStatusBadge } from '../orders/OrderBadges';

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------
function SkeletonRow() {
  return (
    <tr>
      {[80, 130, 80, 60, 70, 90, 80].map((w, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 rounded animate-pulse" style={{ width: w, backgroundColor: 'var(--color-bg-elevated)' }} />
        </td>
      ))}
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Pagination (reuses same pattern as Orders)
// ---------------------------------------------------------------------------
interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
}

function Pagination({ page, pageSize, total, onChange }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = Math.min((page - 1) * pageSize + 1, total);
  const to = Math.min(page * pageSize, total);
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
      <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
        {total === 0 ? 'No results' : `${from}–${to} of ${total}`}
      </span>
      <div className="flex items-center gap-1">
        <button onClick={() => onChange(page - 1)} disabled={page <= 1}
          className="p-1.5 rounded-lg disabled:opacity-30" style={{ color: 'var(--color-text-secondary)' }}>
          <ChevronLeft size={16} />
        </button>
        <span className="px-2 text-xs min-w-[60px] text-center" style={{ color: 'var(--color-text-secondary)' }}>
          {page} / {totalPages}
        </span>
        <button onClick={() => onChange(page + 1)} disabled={page >= totalPages}
          className="p-1.5 rounded-lg disabled:opacity-30" style={{ color: 'var(--color-text-secondary)' }}>
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main table
// ---------------------------------------------------------------------------
interface BatchesTableProps {
  data: PaginatedBatchResponse | undefined;
  isLoading: boolean;
  isError: boolean;
  page: number;
  pageSize: number;
  onView: (batch: ProductionBatch) => void;
  onPageChange: (page: number) => void;
}

const TH: React.CSSProperties = {
  color: 'var(--color-text-muted)',
  borderBottom: '1px solid var(--color-border)',
};

export function BatchesTable({
  data, isLoading, isError,
  page, pageSize,
  onView, onPageChange,
}: BatchesTableProps) {
  const rows = data?.items ?? [];

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr>
              {['Batch #', 'Order', 'Line', 'Planned', 'Remaining', 'Status', 'Due', ''].map(h => (
                <th key={h} className="px-4 py-3 text-xs font-medium uppercase tracking-wide" style={TH}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)}

            {isError && (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-sm" style={{ color: 'var(--color-danger)' }}>
                  Failed to load production batches.
                </td>
              </tr>
            )}

            {!isLoading && !isError && rows.length === 0 && (
              <tr>
                  <td colSpan={8} className="px-4 py-16 text-center relative z-0">
                    <div className="absolute inset-0 pointer-events-none z-[-1]" style={{
                      backgroundImage: "url('/watermark.png')",
                      backgroundRepeat: 'repeat',
                      opacity: 0.05,
                    }} />
                    <div className="flex flex-col items-center justify-center">
                      <Layers size={48} style={{ color: 'var(--color-border)' }} className="mb-4" strokeWidth={1.5} />
                      <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                        No batches match your filters
                      </p>
                      <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>'Try adjusting the filters or create a new batch.'</p>
                    </div>
                  </td>
                </tr>
            )}

            {!isLoading && !isError && rows.map((batch, idx) => {
              const isDelayed = batch.status === 'delayed';
              return (
                <tr
                  key={batch.id}
                  className="transition-colors cursor-default group"
                  style={{ borderTop: idx > 0 ? '1px solid var(--color-border-subtle)' : undefined }}
                  onMouseEnter={e => { (e.currentTarget).style.backgroundColor = 'var(--color-bg-elevated)'; }}
                  onMouseLeave={e => { (e.currentTarget).style.backgroundColor = 'transparent'; }}
                >
                  <td className="px-4 py-3">
                    <button
                      onClick={() => onView(batch)}
                      className="font-mono text-xs font-semibold hover:underline"
                      style={{ color: 'var(--color-accent-hover)' }}
                    >
                      {batch.batch_number}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                      #{batch.order_id}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                      {batch.production_line ?? '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                    {batch.planned_quantity.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-xs font-semibold"
                    style={{ color: batch.remaining_production === 0 ? 'var(--color-success)' : isDelayed ? 'var(--color-danger)' : 'var(--color-warning)' }}>
                    {batch.remaining_production.toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <BatchStatusBadge status={batch.status} />
                  </td>
                  <td className="px-4 py-3 text-xs tabular-nums" style={{ color: 'var(--color-text-secondary)' }}>
                    {batch.expected_completion_date ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => onView(batch)}
                      title="View batch"
                      className="p-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-all"
                      style={{ color: 'var(--color-text-secondary)' }}
                      onMouseEnter={e => { (e.currentTarget).style.backgroundColor = 'var(--color-bg-overlay)'; }}
                      onMouseLeave={e => { (e.currentTarget).style.backgroundColor = 'transparent'; }}
                    >
                      <Eye size={13} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!isLoading && !isError && (
        <Pagination page={page} pageSize={pageSize} total={data?.total ?? 0} onChange={onPageChange} />
      )}
    </div>
  );
}
