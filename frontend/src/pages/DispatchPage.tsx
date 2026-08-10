/**
 * Main Dispatch page — list with status/courier filters, inline status update,
 * New Dispatch button (owner/sales_executive), delete (owner only).
 *
 * Key: updating to "delivered" auto-flips the parent order to delivered too.
 * The note is shown inline next to the status selector.
 */
import {  useState, useCallback } from 'react';
import {
  Plus, RefreshCw, Loader2, ChevronLeft, ChevronRight,
  Trash2, AlertTriangle, X, Truck
} from 'lucide-react';
import {
  useDispatches,
  useUpdateDispatch,
  useDeleteDispatch,
  type DispatchListParams,
} from '../hooks/useDispatch';
import { useAuth } from '../lib/auth';
import { DispatchForm } from '../components/dispatch/DispatchForm';
import type { Dispatch, DeliveryStatus } from '../types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const DEFAULT_PARAMS: DispatchListParams = { page: 1, page_size: 20 };

const STATUS_OPTIONS: { value: DeliveryStatus | ''; label: string }[] = [
  { value: '',           label: 'All statuses' },
  { value: 'pending',    label: 'Pending' },
  { value: 'shipped',    label: 'Shipped' },
  { value: 'in_transit', label: 'In Transit' },
  { value: 'delivered',  label: 'Delivered' },
  { value: 'returned',   label: 'Returned' },
];

const STATUS_CFG: Record<DeliveryStatus, { label: string; color: string; bg: string }> = {
  pending:    { label: 'Pending',    color: 'var(--color-warning)', bg: 'var(--color-warning-subtle)'  },
  shipped:    { label: 'Shipped',    color: 'var(--color-info)', bg: 'var(--color-info-subtle)'  },
  in_transit: { label: 'In Transit', color: 'var(--color-accent)', bg: 'var(--color-accent-subtle)' },
  delivered:  { label: 'Delivered',  color: 'var(--color-success)', bg: 'var(--color-success-subtle)'  },
  returned:   { label: 'Returned',   color: 'var(--color-danger)', bg: 'var(--color-danger-subtle)'  },
};

const selectStyle: React.CSSProperties = {
  backgroundColor: 'var(--color-bg-elevated)',
  borderColor: 'var(--color-border)',
  color: 'var(--color-text-primary)',
};

// ---------------------------------------------------------------------------
// Inline row status updater
// ---------------------------------------------------------------------------
function StatusUpdater({ dispatch, canUpdate }: { dispatch: Dispatch; canUpdate: boolean }) {
  const updateMutation = useUpdateDispatch(dispatch.id);
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<DeliveryStatus>(dispatch.delivery_status);
  const [error, setError] = useState<string | null>(null);

  const DELIVERY_STATUSES: DeliveryStatus[] = ['pending', 'shipped', 'in_transit', 'delivered', 'returned'];
  const cfg = STATUS_CFG[dispatch.delivery_status];

  if (!canUpdate) {
    return (
      <span className="px-2 py-0.5 rounded-full text-xs font-medium"
        style={{ color: cfg.color, backgroundColor: cfg.bg }}>
        {cfg.label}
      </span>
    );
  }

  if (!editing) {
    return (
      <button onClick={() => setEditing(true)}
        className="px-2 py-0.5 rounded-full text-xs font-medium transition-opacity hover:opacity-80"
        style={{ color: cfg.color, backgroundColor: cfg.bg }}>
        {cfg.label}
      </button>
    );
  }

  async function handleSave() {
    setError(null);
    try {
      await updateMutation.mutateAsync({ delivery_status: selected });
      setEditing(false);
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail ?? 'Update failed.');
    }
  }

  return (
    <div className="flex flex-col gap-1" style={{ minWidth: 180 }}>
      <div className="flex items-center gap-1">
        <select value={selected} onChange={e => setSelected(e.target.value as DeliveryStatus)}
          className="flex-1 rounded-md px-2 py-1 text-xs border outline-none"
          style={selectStyle}>
          {DELIVERY_STATUSES.map(s => (
            <option key={s} value={s}>{STATUS_CFG[s].label}</option>
          ))}
        </select>
        <button onClick={handleSave} disabled={updateMutation.isPending}
          className="btn btn-primary">
          {updateMutation.isPending ? <Loader2 size={11} className="animate-spin" /> : 'Save'}
        </button>
        <button onClick={() => { setEditing(false); setError(null); }}
          className="p-1 rounded-md" style={{ color: 'var(--color-text-muted)' }}>
          <X size={12} />
        </button>
      </div>
      {selected === 'delivered' && (
        <p className="text-xs" style={{ color: 'var(--color-warning)' }}>
          Note: setting Delivered will also flip the linked order to Delivered.
        </p>
      )}
      {error && (
        <p className="text-xs" style={{ color: 'var(--color-danger)' }}>{error}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Delete button (owner only)
// ---------------------------------------------------------------------------
function DeleteButton({ dispatchId }: { dispatchId: number }) {
  const deleteMutation = useDeleteDispatch();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setError(null);
    try {
      await deleteMutation.mutateAsync(dispatchId);
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail ?? 'Delete failed.');
      setConfirming(false);
    }
  }

  if (!confirming) {
    return (
      <div>
        <button onClick={() => setConfirming(true)} title="Delete dispatch"
          className="p-1.5 rounded-md transition-colors"
          style={{ color: 'var(--color-danger)' }}
          onMouseEnter={e => { (e.currentTarget).style.backgroundColor = 'var(--color-danger-subtle)'; }}
          onMouseLeave={e => { (e.currentTarget).style.backgroundColor = 'transparent'; }}>
          <Trash2 size={13} />
        </button>
        {error && (
          <p className="text-xs mt-1" style={{ color: 'var(--color-danger)' }}>{error}</p>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <button onClick={handleDelete} disabled={deleteMutation.isPending}
        className="px-2 py-1 rounded-md text-xs font-semibold disabled:opacity-50"
        style={{ backgroundColor: 'var(--color-danger)', color: 'white' }}>
        {deleteMutation.isPending ? <Loader2 size={10} className="animate-spin" /> : 'Delete?'}
      </button>
      <button onClick={() => setConfirming(false)} className="p-1 rounded"
        style={{ color: 'var(--color-text-muted)' }}>
        <X size={12} />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------
function SkeletonRow() {
  return (
    <tr>
      {[100, 80, 90, 80, 90, 80, 50].map((w, i) => (
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
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t"
      style={{ borderColor: 'var(--color-border)' }}>
      <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
        {total === 0 ? 'No results' : `${Math.min((page-1)*pageSize+1,total)}–${Math.min(page*pageSize,total)} of ${total}`}
      </span>
      <div className="flex items-center gap-1">
        <button onClick={() => onChange(page-1)} disabled={page<=1}
          className="p-1.5 rounded-lg disabled:opacity-30" style={{ color: 'var(--color-text-secondary)' }}>
          <ChevronLeft size={16} />
        </button>
        <span className="px-2 text-xs min-w-[60px] text-center" style={{ color: 'var(--color-text-secondary)' }}>
          {page} / {totalPages}
        </span>
        <button onClick={() => onChange(page+1)} disabled={page>=totalPages}
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
export function DispatchPage() {
  const { user } = useAuth();
  const canCreate = user?.role === 'owner' || user?.role === 'sales_executive';
  const canUpdate = user?.role === 'owner' || user?.role === 'sales_executive';
  const canDelete  = user?.role === 'owner';

  const [params, setParams] = useState<DispatchListParams>(DEFAULT_PARAMS);
  const [courierInput, setCourierInput] = useState('');
  const [showForm, setShowForm] = useState(false);

  const updateParams = useCallback((next: Partial<DispatchListParams>) =>
    setParams(p => ({ ...p, ...next })), []);

  const { data, isLoading, isError, isFetching, refetch } = useDispatches(params);
  const rows = data?.items ?? [];
  const hasFilters = !!(params.delivery_status || courierInput);

  const TH: React.CSSProperties = {
    color: 'var(--color-text-muted)',
    borderBottom: '1px solid var(--color-border)',
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Dispatch</h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
            {data ? `${data.total.toLocaleString()} record${data.total !== 1 ? 's' : ''}` : 'Loading…'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => void refetch()} disabled={isFetching}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border"
            style={{ backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-secondary)', borderColor: 'var(--color-border)' }}>
            {isFetching ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            Refresh
          </button>
          {canCreate && (
            <button id="new-dispatch-btn" onClick={() => setShowForm(true)}
              className="btn btn-primary">
              <Plus size={13} /> New Dispatch
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <select value={params.delivery_status ?? ''} onChange={e => updateParams({ delivery_status: e.target.value as DeliveryStatus | '', page: 1 })}
          className="rounded-lg px-3 py-2 text-sm border outline-none cursor-pointer" style={selectStyle}>
          {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        <input type="text" placeholder="Filter by courier…" value={courierInput}
          onChange={e => { setCourierInput(e.target.value); updateParams({ courier: e.target.value || undefined, page: 1 }); }}
          className="rounded-lg px-3 py-2 text-sm border outline-none w-44"
          style={selectStyle}
          onFocus={e => { e.target.style.borderColor = 'var(--color-accent)'; }}
          onBlur={e => { e.target.style.borderColor = 'var(--color-border)'; }} />

        {hasFilters && (
          <button onClick={() => { setParams(DEFAULT_PARAMS); setCourierInput(''); }}
            className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs border"
            style={{ color: 'var(--color-text-muted)', borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-elevated)' }}>
            ✕ Clear
          </button>
        )}
      </div>

      {/* 403 note */}
      {!canCreate && (
        <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs border"
          style={{ borderColor: 'var(--color-warning-border)', backgroundColor: 'var(--color-warning-subtle)', color: 'var(--color-warning)' }}>
          <AlertTriangle size={12} />
          Your role does not have permission to create or update dispatch records.
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border overflow-hidden"
        style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                {['Invoice', 'Order', 'Courier', 'Dispatch Date', 'Tracking', 'Status', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-xs font-medium uppercase tracking-wide" style={TH}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)}

              {isError && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm"
                    style={{ color: 'var(--color-danger)' }}>
                    Failed to load dispatch records.
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
                      <Truck size={48} style={{ color: 'var(--color-border)' }} className="mb-4" strokeWidth={1.5} />
                      <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                        No dispatch records match the filters
                      </p>
                      
                    </div>
                  </td>
                </tr>
              )}

              {!isLoading && !isError && rows.map((d: Dispatch, idx) => (
                <tr key={d.id} className="transition-colors group"
                  style={{ borderTop: idx > 0 ? '1px solid var(--color-border-subtle)' : undefined }}
                  onMouseEnter={e => { (e.currentTarget).style.backgroundColor = 'var(--color-bg-elevated)'; }}
                  onMouseLeave={e => { (e.currentTarget).style.backgroundColor = 'transparent'; }}>

                  <td className="px-4 py-3 font-mono text-xs font-semibold"
                    style={{ color: 'var(--color-accent-hover)' }}>
                    {d.invoice_number}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs"
                    style={{ color: 'var(--color-text-secondary)' }}>
                    #{d.order_id}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                    {d.courier ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-xs tabular-nums" style={{ color: 'var(--color-text-secondary)' }}>
                    {d.dispatch_date}
                  </td>
                  <td className="px-4 py-3 text-xs font-mono" style={{ color: 'var(--color-text-muted)' }}>
                    {d.tracking_number ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <StatusUpdater dispatch={d} canUpdate={canUpdate} />
                  </td>
                  <td className="px-4 py-3">
                    {canDelete && <DeleteButton dispatchId={d.id} />}
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

      {showForm && <DispatchForm onClose={() => setShowForm(false)} />}
    </div>
  );
}
