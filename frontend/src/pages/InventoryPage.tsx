/**
 * Inventory page — item list with filters, role-gated New Item button,
 * item detail drawer (with transaction history + record form).
 *
 * Role visibility:
 *   "New Item" button and "Record Transaction" form — owner, inventory_manager
 */
import {  useState, useCallback } from 'react';
import { Plus, RefreshCw, Loader2, AlertTriangle, ChevronLeft, ChevronRight, Eye , PackageOpen} from 'lucide-react';
import { useInventoryItems, type ItemListParams } from '../hooks/useInventory';
import { useAuth } from '../lib/auth';
import { ItemDetailDrawer } from '../components/inventory/ItemDetailDrawer';
import { ItemForm } from '../components/inventory/ItemForm';
import type { InventoryItem, InventoryCategory } from '../types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const DEFAULT_PARAMS: ItemListParams = {
  page: 1,
  page_size: 20,
  category: '',
  low_stock_only: false,
};

const CATEGORIES: InventoryCategory[] = [
  'fabric', 'thread', 'button', 'zipper', 'label', 'packaging', 'accessory',
];

const selectStyle: React.CSSProperties = {
  backgroundColor: 'var(--color-bg-elevated)',
  borderColor: 'var(--color-border)',
  color: 'var(--color-text-primary)',
};

// ---------------------------------------------------------------------------
// Skeleton row
// ---------------------------------------------------------------------------
function SkeletonRow() {
  return (
    <tr>
      {[120, 80, 80, 70, 70, 90, 90].map((w, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 rounded animate-pulse" style={{ width: w, backgroundColor: 'var(--color-bg-elevated)' }} />
        </td>
      ))}
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------
function Pagination({ page, pageSize, total, onChange }: {
  page: number; pageSize: number; total: number; onChange: (p: number) => void;
}) {
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
// Stock level bar
// ---------------------------------------------------------------------------
function StockBar({ current, minimum }: { current: number; minimum: number }) {
  if (minimum <= 0) return null;
  // Bar fills based on current vs. 2× minimum as full-scale reference
  const pct = Math.min(100, Math.round((current / (minimum * 2)) * 100));
  const color = current <= minimum ? 'var(--color-danger)' : current < minimum * 1.5 ? 'var(--color-warning)' : 'var(--color-success)';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-bg-overlay)' }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs tabular-nums w-8 text-right" style={{ color }}>
        {current}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export function InventoryPage() {
  const { user } = useAuth();
  const canManage = user?.role === 'owner' || user?.role === 'inventory_manager';

  const [params, setParams] = useState<ItemListParams>(DEFAULT_PARAMS);
  const updateParams = useCallback((next: Partial<ItemListParams>) => setParams(p => ({ ...p, ...next })), []);
  const resetFilters = useCallback(() => setParams(DEFAULT_PARAMS), []);

  const [viewItemId, setViewItemId] = useState<number | null>(null);
  const [showForm,   setShowForm]   = useState(false);

  const openView  = useCallback((item: InventoryItem) => setViewItemId(item.id), []);
  const closeView = useCallback(() => setViewItemId(null), []);
  const closeForm = useCallback(() => setShowForm(false), []);

  const { data, isLoading, isError, isFetching, refetch } = useInventoryItems(params);
  const rows = data?.items ?? [];
  const hasFilters = !!(params.category || params.low_stock_only);

  const TH: React.CSSProperties = {
    color: 'var(--color-text-muted)',
    borderBottom: '1px solid var(--color-border)',
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Inventory</h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
            {data ? `${data.total.toLocaleString()} item${data.total !== 1 ? 's' : ''} total` : 'Loading…'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => void refetch()} disabled={isFetching}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all"
            style={{ backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-secondary)', borderColor: 'var(--color-border)' }}>
            {isFetching ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            Refresh
          </button>
          {canManage && (
            <button id="new-item-btn" onClick={() => setShowForm(true)}
              className="btn btn-primary">
              <Plus size={13} /> New Item
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Category */}
        <select value={params.category ?? ''} onChange={e => updateParams({ category: e.target.value as InventoryCategory | '', page: 1 })}
          className="rounded-lg px-3 py-2 text-sm border outline-none cursor-pointer" style={selectStyle}>
          <option value="">All categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
        </select>

        {/* Low stock toggle */}
        <button
          id="low-stock-toggle"
          onClick={() => updateParams({ low_stock_only: !params.low_stock_only, page: 1 })}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-all"
          style={{
            borderColor: params.low_stock_only ? 'var(--color-danger)' : 'var(--color-border)',
            backgroundColor: params.low_stock_only ? 'rgba(239,68,68,0.1)' : 'var(--color-bg-elevated)',
            color: params.low_stock_only ? '#fca5a5' : 'var(--color-text-secondary)',
          }}
        >
          <AlertTriangle size={12} />
          Low Stock Only
        </button>

        {hasFilters && (
          <button onClick={resetFilters}
            className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs border transition-colors"
            style={{ color: 'var(--color-text-muted)', borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-elevated)' }}
            onMouseEnter={e => { (e.currentTarget).style.color = 'var(--color-text-primary)'; }}
            onMouseLeave={e => { (e.currentTarget).style.color = 'var(--color-text-muted)'; }}>
            ✕ Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div
        className="rounded-xl border overflow-hidden"
        style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                {['Item', 'Category', 'Stock', 'Min Stock', 'Supplier', 'Last Updated', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-xs font-medium uppercase tracking-wide" style={TH}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)}

              {isError && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm" style={{ color: 'var(--color-danger)' }}>
                    Failed to load inventory items.
                  </td>
                </tr>
              )}

              {!isLoading && !isError && rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center relative z-0">
                    <div className="absolute inset-0 pointer-events-none z-[-1]" style={{
                      backgroundImage: "url('/watermark.png')",
                      backgroundRepeat: 'repeat',
                      opacity: 0.05,
                    }} />
                    <div className="flex flex-col items-center justify-center">
                      <PackageOpen size={48} style={{ color: 'var(--color-border)' }} className="mb-4" strokeWidth={1.5} />
                      <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                        No items match your filters
                      </p>
                      <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>{params.low_stock_only ? 'All items have stock above minimum — great!' : 'Try adjusting the filters.'}</p>
                    </div>
                  </td>
                </tr>
              )}

              {!isLoading && !isError && rows.map((item, idx) => (
                <tr
                  key={item.id}
                  className="transition-colors cursor-default group"
                  style={{
                    borderTop: idx > 0 ? '1px solid var(--color-border-subtle)' : undefined,
                    backgroundColor: item.is_low_stock ? 'rgba(239,68,68,0.04)' : undefined,
                  }}
                  onMouseEnter={e => { (e.currentTarget).style.backgroundColor = item.is_low_stock ? 'rgba(239,68,68,0.08)' : 'var(--color-bg-elevated)'; }}
                  onMouseLeave={e => { (e.currentTarget).style.backgroundColor = item.is_low_stock ? 'rgba(239,68,68,0.04)' : 'transparent'; }}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => openView(item)}
                        className="font-medium text-sm hover:underline text-left"
                        style={{ color: 'var(--color-text-primary)' }}>
                        {item.name}
                      </button>
                      {item.is_low_stock && (
                        <span
                          className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs font-medium border shrink-0"
                          style={{ color: 'var(--color-danger)', backgroundColor: 'var(--color-danger-subtle)', borderColor: 'var(--color-danger-border)' }}
                        >
                          <AlertTriangle size={9} /> Low
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs capitalize px-2 py-0.5 rounded-full border"
                      style={{ color: 'var(--color-text-secondary)', borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-elevated)' }}>
                      {item.category}
                    </span>
                  </td>
                  <td className="px-4 py-3" style={{ minWidth: 130 }}>
                    <StockBar current={item.current_stock} minimum={item.minimum_stock} />
                    <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{item.unit}</p>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                    {item.minimum_stock} {item.unit}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                    {item.supplier_id ? `#${item.supplier_id}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs tabular-nums" style={{ color: 'var(--color-text-muted)' }}>
                    {new Date(item.updated_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => openView(item)} title="View detail"
                      className="p-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-all"
                      style={{ color: 'var(--color-text-secondary)' }}
                      onMouseEnter={e => { (e.currentTarget).style.backgroundColor = 'var(--color-bg-overlay)'; }}
                      onMouseLeave={e => { (e.currentTarget).style.backgroundColor = 'transparent'; }}>
                      <Eye size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!isLoading && !isError && (
          <Pagination page={params.page} pageSize={params.page_size} total={data?.total ?? 0}
            onChange={p => updateParams({ page: p })} />
        )}
      </div>

      {/* Detail drawer */}
      {viewItemId !== null && (
        <ItemDetailDrawer itemId={viewItemId} canManage={canManage} onClose={closeView} />
      )}

      {/* New item modal */}
      {showForm && <ItemForm onClose={closeForm} />}
    </div>
  );
}
