/**
 * Suppliers page — list with search, role-gated New Supplier button,
 * detail drawer, create/edit modal.
 */
import {  useState, useCallback } from 'react';
import {
  Plus, Search, RefreshCw, Loader2,
  Star, ChevronLeft, ChevronRight, Eye, X, Briefcase} from 'lucide-react';
import { useSuppliersList, type SupplierListParams } from '../hooks/useSuppliers';
import { useAuth } from '../lib/auth';
import { SupplierDetailDrawer } from '../components/suppliers/SupplierDetailDrawer';
import { SupplierForm } from '../components/suppliers/SupplierForm';
import type { Supplier } from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const DEFAULT_PARAMS: SupplierListParams = { page: 1, page_size: 20, search: '' };

function StarDisplay({ rating }: { rating: number | null }) {
  if (rating === null)
    return <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>—</span>;
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(n => (
        <Star key={n} size={11}
          style={{ color: n <= rating ? '#f59e0b' : 'var(--color-border)', fill: n <= rating ? '#f59e0b' : 'none' }} />
      ))}
      <span className="text-xs ml-1 tabular-nums" style={{ color: 'var(--color-text-muted)' }}>{rating}</span>
    </div>
  );
}

function SkeletonRow() {
  return (
    <tr>
      {[140, 100, 140, 80, 60].map((w, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 rounded animate-pulse"
            style={{ width: w, backgroundColor: 'var(--color-bg-elevated)' }} />
        </td>
      ))}
    </tr>
  );
}

function Pagination({ page, pageSize, total, onChange }: {
  page: number; pageSize: number; total: number; onChange: (p: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = Math.min((page - 1) * pageSize + 1, total);
  const to = Math.min(page * pageSize, total);
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t"
      style={{ borderColor: 'var(--color-border)' }}>
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
// Main page
// ---------------------------------------------------------------------------
export function SuppliersPage() {
  const { user } = useAuth();
  const canManage = user?.role === 'owner' || user?.role === 'inventory_manager';
  const canDelete  = user?.role === 'owner';

  const [params, setParams] = useState<SupplierListParams>(DEFAULT_PARAMS);
  const [searchInput, setSearchInput] = useState('');
  const updateParams = useCallback(
    (next: Partial<SupplierListParams>) => setParams(p => ({ ...p, ...next })),
    []
  );

  // Debounce: update search param on input (instant — API is fast enough)
  function handleSearchChange(val: string) {
    setSearchInput(val);
    updateParams({ search: val, page: 1 });
  }

  const [viewSupplierId, setViewSupplierId] = useState<number | null>(null);
  const [editSupplier,   setEditSupplier]   = useState<Supplier | null>(null);
  const [showForm,       setShowForm]       = useState(false);

  const openView = useCallback((s: Supplier) => setViewSupplierId(s.id), []);
  const closeView = useCallback(() => setViewSupplierId(null), []);

  const handleEdit = useCallback((s: Supplier) => {
    setViewSupplierId(null);
    setEditSupplier(s);
    setShowForm(true);
  }, []);

  const closeForm = useCallback(() => {
    setShowForm(false);
    setEditSupplier(null);
  }, []);

  const { data, isLoading, isError, isFetching, refetch } = useSuppliersList(params);
  const rows = data?.items ?? [];

  const TH: React.CSSProperties = {
    color: 'var(--color-text-muted)',
    borderBottom: '1px solid var(--color-border)',
  };

  const selectStyle: React.CSSProperties = {
    backgroundColor: 'var(--color-bg-elevated)',
    borderColor: 'var(--color-border)',
    color: 'var(--color-text-primary)',
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Suppliers</h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
            {data ? `${data.total.toLocaleString()} supplier${data.total !== 1 ? 's' : ''}` : 'Loading…'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => void refetch()} disabled={isFetching}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border"
            style={{ backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-secondary)', borderColor: 'var(--color-border)' }}>
            {isFetching ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            Refresh
          </button>
          {canManage && (
            <button id="new-supplier-btn"
              onClick={() => { setEditSupplier(null); setShowForm(true); }}
              className="btn btn-primary">
              <Plus size={13} /> New Supplier
            </button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: 'var(--color-text-muted)' }} />
          <input
            type="text"
            placeholder="Search suppliers…"
            value={searchInput}
            onChange={e => handleSearchChange(e.target.value)}
            className="rounded-lg pl-9 pr-3 py-2 text-sm border outline-none w-64"
            style={selectStyle}
            onFocus={e => { e.target.style.borderColor = 'var(--color-accent)'; }}
            onBlur={e => { e.target.style.borderColor = 'var(--color-border)'; }}
          />
        </div>
        {searchInput && (
          <button onClick={() => handleSearchChange('')}
            className="flex items-center gap-1 px-2.5 py-2 rounded-lg text-xs border"
            style={{ color: 'var(--color-text-muted)', borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-elevated)' }}>
            <X size={12} /> Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl border overflow-hidden"
        style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                {['Name', 'Contact Person', 'Materials', 'Quality', 'Avg Lead Time', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-xs font-medium uppercase tracking-wide" style={TH}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)}

              {isError && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm"
                    style={{ color: 'var(--color-danger)' }}>
                    Failed to load suppliers.
                  </td>
                </tr>
              )}

              {!isLoading && !isError && rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-16 text-center relative z-0">
                    <div className="absolute inset-0 pointer-events-none z-[-1]" style={{
                      backgroundImage: "url('/watermark.png')",
                      backgroundRepeat: 'repeat',
                      opacity: 0.05,
                    }} />
                    <div className="flex flex-col items-center justify-center">
                      <Briefcase size={48} style={{ color: 'var(--color-border)' }} className="mb-4" strokeWidth={1.5} />
                      <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                        {searchInput ? `No suppliers matching "${searchInput}"` : 'No suppliers yet'}
                      </p>
                      <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>{canManage && !searchInput ? 'Click "New Supplier" to add one.' : ''}</p>
                    </div>
                  </td>
                </tr>
              )}

              {!isLoading && !isError && rows.map((supplier, idx) => (
                <tr key={supplier.id}
                  className="transition-colors cursor-default group"
                  style={{ borderTop: idx > 0 ? '1px solid var(--color-border-subtle)' : undefined }}
                  onMouseEnter={e => { (e.currentTarget).style.backgroundColor = 'var(--color-bg-elevated)'; }}
                  onMouseLeave={e => { (e.currentTarget).style.backgroundColor = 'transparent'; }}>

                  <td className="px-4 py-3">
                    <button onClick={() => openView(supplier)}
                      className="font-medium text-sm hover:underline text-left"
                      style={{ color: 'var(--color-text-primary)' }}>
                      {supplier.name}
                    </button>
                  </td>

                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                    {supplier.contact_person ?? '—'}
                  </td>

                  <td className="px-4 py-3 max-w-[200px]">
                    <p className="text-xs truncate" style={{ color: 'var(--color-text-secondary)' }}>
                      {supplier.materials_supplied ?? '—'}
                    </p>
                  </td>

                  <td className="px-4 py-3">
                    <StarDisplay rating={supplier.quality_rating} />
                  </td>

                  <td className="px-4 py-3 text-xs tabular-nums" style={{ color: 'var(--color-text-secondary)' }}>
                    {supplier.average_delivery_days != null
                      ? `~${supplier.average_delivery_days}d`
                      : '—'}
                  </td>

                  <td className="px-4 py-3">
                    <button onClick={() => openView(supplier)} title="View detail"
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
      {viewSupplierId !== null && (
        <SupplierDetailDrawer
          supplierId={viewSupplierId}
          canManage={canManage}
          canDelete={canDelete}
          onClose={closeView}
          onEdit={handleEdit}
        />
      )}

      {/* Create / edit modal */}
      {showForm && (
        <SupplierForm editSupplier={editSupplier} onClose={closeForm} />
      )}
    </div>
  );
}
