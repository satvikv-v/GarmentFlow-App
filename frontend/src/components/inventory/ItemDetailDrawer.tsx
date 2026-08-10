/**
 * Item detail slide-over drawer.
 * Shows full item metadata + transaction history + record-transaction form + AI forecast.
 */
import { getGarmentImage } from '../../lib/imageMap';
import { useState } from 'react';
import {
  X, ArrowDownCircle, ArrowUpCircle, RefreshCw,
  AlertTriangle, Loader2, Plus, TrendingUp, Info,
} from 'lucide-react';
import type { InventoryItemDetail, TransactionType } from '../../types';
import { useInventoryItemDetail, useRecordTransaction, type TransactionPayload } from '../../hooks/useInventory';
import { useInventoryForecast } from '../../hooks/useAI';

interface ItemDetailDrawerProps {
  itemId: number;
  canManage: boolean;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Forecast section
// ---------------------------------------------------------------------------
function ForecastSection({ itemId, unit }: { itemId: number; unit: string }) {
  const { data, isLoading, isError } = useInventoryForecast(itemId);

  if (isLoading) {
    return (
      <div
        className="rounded-xl border p-4 flex items-center gap-2"
        style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-elevated)' }}
      >
        <Loader2 size={14} className="animate-spin" style={{ color: 'var(--color-text-muted)' }} />
        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Loading forecast…</span>
      </div>
    );
  }

  if (isError || !data) return null;

  const u = unit || data.unit;

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp size={13} style={{ color: 'var(--color-text-muted)' }} />
        <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
          AI Consumption Forecast
        </p>
      </div>

      <div
        className="rounded-xl border overflow-hidden"
        style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-elevated)' }}
      >
        {data.has_history ? (
          <>
            {/* Numbers grid */}
            <div className="grid grid-cols-2 gap-px" style={{ backgroundColor: 'var(--color-border)' }}>
              {[
                { label: 'Avg per Batch',       value: `${data.avg_qty_per_batch?.toLocaleString() ?? '—'} ${u}`, accent: undefined },
                { label: 'Open Batches',         value: data.open_batch_count.toString(), accent: undefined },
                {
                  label: 'Est. Pipeline Demand',
                  value: `${data.estimated_demand?.toLocaleString() ?? '—'} ${u}`,
                  accent: (data.surplus_after_demand !== null && data.surplus_after_demand < 0)
                    ? 'var(--color-danger)' : '#f59e0b',
                },
                {
                  label: 'Suggested Reorder',
                  value: (data.suggested_reorder_qty !== null && data.suggested_reorder_qty > 0)
                    ? `${data.suggested_reorder_qty.toLocaleString()} ${u}`
                    : 'None needed',
                  accent: (data.suggested_reorder_qty !== null && data.suggested_reorder_qty > 0)
                    ? 'var(--color-accent-hover)' : 'var(--color-text-muted)',
                },
              ].map(card => (
                <div
                  key={card.label}
                  className="p-3 flex flex-col gap-0.5"
                  style={{ backgroundColor: 'var(--color-bg-elevated)' }}
                >
                  <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{card.label}</span>
                  <span
                    className="text-sm font-bold tabular-nums"
                    style={{ color: card.accent ?? 'var(--color-text-primary)' }}
                  >
                    {card.value}
                  </span>
                </div>
              ))}
            </div>

            {/* Pipeline-wide framing — prominent, not buried */}
            <div
              className="px-3 py-2.5 border-t flex items-start gap-2"
              style={{ borderColor: 'var(--color-border)', backgroundColor: 'rgba(245,158,11,0.06)' }}
            >
              <Info size={12} className="mt-0.5 shrink-0" style={{ color: 'var(--color-warning)' }} />
              <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                <span className="font-semibold" style={{ color: 'var(--color-warning)' }}>Pipeline-wide estimate:</span>{' '}
                assumes all {data.open_batch_count} open batches consume at the historical
                average rate simultaneously. This is an upper-bound planning figure —{' '}
                not an immediate purchase order amount.
              </p>
            </div>

            {/* Data quality note */}
            <div className="px-3 py-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
              <p className="text-xs italic" style={{ color: 'var(--color-text-muted)' }}>
                Based on {data.n_issue_transactions} historical issue transactions.
                Accuracy improves with real data spread across multiple weeks.
              </p>
            </div>
          </>
        ) : (
          /* Zero-history — explicit state, not a blank section */
          <div className="p-4 flex items-start gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: 'rgba(245,158,11,0.1)' }}
            >
              <AlertTriangle size={14} style={{ color: 'var(--color-warning)' }} />
            </div>
            <div>
              <p className="text-xs font-semibold mb-1" style={{ color: 'var(--color-text-primary)' }}>
                Insufficient Data
              </p>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                No issue transactions recorded for this item. Demand cannot be
                estimated automatically — compare current stock ({data.current_stock} {u}) against
                minimum stock ({data.minimum_stock} {u}) and reorder manually if needed.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Transaction row
// ---------------------------------------------------------------------------
const TX_CONFIG: Record<TransactionType, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  receive:    { label: 'Receive',    icon: <ArrowDownCircle size={13} />, color: 'var(--color-success)', bg: 'var(--color-success-subtle)'   },
  issue:      { label: 'Issue',      icon: <ArrowUpCircle   size={13} />, color: 'var(--color-danger)', bg: 'var(--color-danger-subtle)'   },
  adjustment: { label: 'Adjustment', icon: <RefreshCw        size={13} />, color: 'var(--color-warning)', bg: 'var(--color-warning-subtle)' },
};

function fmt(iso: string) {
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ---------------------------------------------------------------------------
// Record Transaction form
// ---------------------------------------------------------------------------
const TX_TYPES: TransactionType[] = ['receive', 'issue', 'adjustment'];

interface TxFormProps {
  itemId: number;
  currentStock: number;
  onSuccess: (updated: InventoryItemDetail) => void;
}

function TxForm({ itemId, currentStock, onSuccess }: TxFormProps) {
  const mutation = useRecordTransaction(itemId);
  const [open, setOpen] = useState(false);
  const [txType, setTxType]     = useState<TransactionType>('receive');
  const [qty, setQty]           = useState('');
  const [reference, setRef]     = useState('');
  const [error, setError]       = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    const q = parseFloat(qty);
    if (!qty || isNaN(q) || q <= 0) {
      setError('Quantity must be a positive number.');
      return;
    }
    const payload: TransactionPayload = { transaction_type: txType, quantity: q };
    if (reference.trim()) payload.reference = reference.trim();

    try {
      const updated = await mutation.mutateAsync(payload);
      onSuccess(updated);
      setQty('');
      setRef('');
      setOpen(false);
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail ?? 'Transaction failed.');
    }
  }

  const inputStyle: React.CSSProperties = {
    backgroundColor: 'var(--color-bg-base)',
    borderColor: 'var(--color-border)',
    color: 'var(--color-text-primary)',
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold w-full justify-center border transition-colors"
        style={{
          color: 'var(--color-accent-hover)',
          borderColor: 'var(--color-accent)',
          backgroundColor: 'var(--color-accent-subtle)',
        }}
      >
        <Plus size={13} /> Record Transaction
      </button>
    );
  }

  return (
    <div
      className="rounded-xl border p-4 space-y-3"
      style={{ backgroundColor: 'var(--color-bg-elevated)', borderColor: 'var(--color-accent)' }}
    >
      <p className="text-xs font-semibold" style={{ color: 'var(--color-text-primary)' }}>
        Record Transaction
      </p>

      {/* Type */}
      <div className="grid grid-cols-3 gap-1.5">
        {TX_TYPES.map(t => {
          const cfg = TX_CONFIG[t];
          const selected = txType === t;
          return (
            <button
              key={t}
              type="button"
              onClick={() => setTxType(t)}
              className="flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-medium border transition-all"
              style={{
                color: selected ? cfg.color : 'var(--color-text-muted)',
                borderColor: selected ? cfg.color : 'var(--color-border)',
                backgroundColor: selected ? cfg.bg : 'transparent',
              }}
            >
              {cfg.icon}
              {cfg.label}
            </button>
          );
        })}
      </div>

      {/* Quantity */}
      <div>
        <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>
          Quantity {txType === 'issue' && (
            <span style={{ color: 'var(--color-warning)' }}>
              (stock: {currentStock})
            </span>
          )}
        </label>
        <input
          type="number"
          min="0.01"
          step="0.01"
          value={qty}
          onChange={e => setQty(e.target.value)}
          placeholder="e.g. 50"
          className="w-full rounded-lg px-3 py-2 text-sm border outline-none"
          style={{ ...inputStyle, borderColor: error ? 'rgba(239,68,68,0.5)' : 'var(--color-border)' }}
        />
      </div>

      {/* Reference */}
      <div>
        <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>
          Reference (optional)
        </label>
        <input
          type="text"
          value={reference}
          onChange={e => setRef(e.target.value)}
          placeholder="e.g. PO-123 or Batch note"
          className="w-full rounded-lg px-3 py-2 text-sm border outline-none"
          style={inputStyle}
        />
      </div>

      {/* Inline error — shows backend 422 message directly */}
      {error && (
        <div
          className="flex items-start gap-2 rounded-lg px-3 py-2 text-xs border"
          style={{
            backgroundColor: 'var(--color-danger-subtle)',
            borderColor: 'rgba(239,68,68,0.3)',
            color: '#fca5a5',
          }}
        >
          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => { setOpen(false); setError(null); }}
          className="flex-1 px-3 py-2 rounded-lg text-xs border"
          style={{ color: 'var(--color-text-secondary)', borderColor: 'var(--color-border)' }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={mutation.isPending}
          className="btn btn-primary flex-1"
        >
          {mutation.isPending && <Loader2 size={11} className="animate-spin" />}
          Save
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main drawer
// ---------------------------------------------------------------------------
export function ItemDetailDrawer({ itemId, canManage, onClose }: ItemDetailDrawerProps) {
  const { data: fetched, isLoading, isError, refetch } = useInventoryItemDetail(itemId);
  // Keep local copy so transaction success updates stock display immediately
  const [local, setLocal] = useState<InventoryItemDetail | null>(null);
  const item = local ?? fetched;

  return (
    <>
      <div
        className="fixed inset-0 z-40"
        style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
        onClick={onClose}
      />

      <div
        className="fixed top-0 right-0 bottom-0 z-50 w-full max-w-lg flex flex-col border-l"
        style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}
      >
        {/* Cover Header */}
        <div className="relative h-48 shrink-0 w-full">
          {item ? (
            <img 
              src={getGarmentImage(item.category)}
              alt="Item Cover"
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
             <div className="absolute inset-0" style={{ backgroundColor: 'var(--color-bg-elevated)' }} />
          )}
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.2) 60%, transparent 100%)' }} />
          
          <div className="absolute inset-x-0 bottom-0 p-5 flex items-end justify-between">
            <div className="min-w-0 pr-2">
              {item ? (
                <>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-xl font-bold text-white truncate leading-tight">
                      {item.name}
                    </h2>
                    {item.is_low_stock && (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium backdrop-blur-md"
                        style={{ color: '#fca5a5', backgroundColor: 'rgba(220,38,38,0.25)', border: '1px solid rgba(220,38,38,0.4)' }}>
                        <AlertTriangle size={10} /> Low Stock
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-medium text-white/70 mt-1 capitalize tracking-wide">
                    {item.category}
                  </p>
                </>
              ) : (
                <h2 className="text-xl font-bold text-white leading-tight">
                  Item Detail
                </h2>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => { setLocal(null); void refetch(); }}
                className="p-1.5 rounded-lg backdrop-blur-md transition-colors text-white/80"
                style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
                onMouseEnter={e => { (e.currentTarget).style.backgroundColor = 'rgba(255,255,255,0.2)'; }}
                onMouseLeave={e => { (e.currentTarget).style.backgroundColor = 'rgba(255,255,255,0.1)'; }}
              >
                <RefreshCw size={14} />
              </button>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg backdrop-blur-md transition-colors text-white/80"
                style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
                onMouseEnter={e => { (e.currentTarget).style.backgroundColor = 'rgba(255,255,255,0.2)'; }}
                onMouseLeave={e => { (e.currentTarget).style.backgroundColor = 'rgba(255,255,255,0.1)'; }}
              >
                <X size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {isLoading && (
            <div className="flex items-center justify-center gap-2 py-12">
              <Loader2 size={18} className="animate-spin" style={{ color: 'var(--color-text-muted)' }} />
              <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Loading…</span>
            </div>
          )}
          {isError && (
            <div className="text-center py-12">
              <p className="text-sm" style={{ color: 'var(--color-danger)' }}>Failed to load item.</p>
              <button onClick={() => void refetch()} className="text-xs underline mt-2"
                style={{ color: 'var(--color-text-muted)' }}>Retry</button>
            </div>
          )}

          {item && (
            <>
              {/* Stock overview cards */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Current Stock', value: `${item.current_stock} ${item.unit}`,
                    accent: item.is_low_stock ? 'var(--color-danger)' : 'var(--color-success)' },
                  { label: 'Minimum Stock', value: `${item.minimum_stock} ${item.unit}`,
                    accent: 'var(--color-text-secondary)' },
                ].map(card => (
                  <div key={card.label}
                    className="rounded-xl p-3 flex flex-col gap-1"
                    style={{ backgroundColor: 'var(--color-bg-elevated)', borderColor: 'var(--color-border)' }}
                  >
                    <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{card.label}</span>
                    <span className="text-lg font-bold tabular-nums" style={{ color: card.accent }}>{card.value}</span>
                  </div>
                ))}
              </div>

              {/* Metadata */}
              <div
                className="rounded-xl border p-4 grid grid-cols-2 gap-x-4 gap-y-2"
                style={{ backgroundColor: 'var(--color-bg-elevated)', borderColor: 'var(--color-border)' }}
              >
                {[
                  ['Category',      item.category.charAt(0).toUpperCase() + item.category.slice(1)],
                  ['Unit',          item.unit],
                  ['Purchase Cost', item.purchase_cost != null ? `₹${item.purchase_cost.toFixed(2)}` : '—'],
                  ['Supplier ID',   item.supplier_id ? `#${item.supplier_id}` : '—'],
                  ['Created',       new Date(item.created_at).toLocaleDateString()],
                  ['Updated',       new Date(item.updated_at).toLocaleDateString()],
                ].map(([label, val]) => (
                  <div key={label as string}>
                    <span className="text-xs block" style={{ color: 'var(--color-text-muted)' }}>{label}</span>
                    <span className="text-xs font-medium" style={{ color: 'var(--color-text-primary)' }}>{val}</span>
                  </div>
                ))}
              </div>

              {/* Record transaction */}
              {canManage && (
                <TxForm
                  itemId={item.id}
                  currentStock={item.current_stock}
                  onSuccess={updated => setLocal(updated)}
                />
              )}

              {/* Transaction history */}
              <div>
                <p className="text-xs font-medium uppercase tracking-wide mb-3"
                  style={{ color: 'var(--color-text-muted)' }}>
                  Recent Transactions ({item.recent_transactions.length})
                </p>
                {item.recent_transactions.length === 0 ? (
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>No transactions yet.</p>
                ) : (
                  <div className="space-y-1.5">
                    {item.recent_transactions.map(tx => {
                      const cfg = TX_CONFIG[tx.transaction_type];
                      return (
                        <div
                          key={tx.id}
                          className="flex items-start justify-between rounded-lg px-3 py-2.5 border"
                          style={{
                            backgroundColor: 'var(--color-bg-elevated)',
                            borderColor: 'var(--color-border)',
                          }}
                        >
                          <div className="flex items-start gap-2 min-w-0">
                            <span
                              className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium shrink-0 mt-0.5"
                              style={{ color: cfg.color, backgroundColor: cfg.bg }}
                            >
                              {cfg.icon}
                              {cfg.label}
                            </span>
                            <div className="min-w-0">
                              <p className="text-xs font-semibold tabular-nums" style={{ color: 'var(--color-text-primary)' }}>
                                {tx.transaction_type === 'issue' ? '-' : '+'}{tx.quantity}
                              </p>
                              {tx.reference && (
                                <p className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>
                                  {tx.reference}
                                </p>
                              )}
                              {tx.batch_id && (
                                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                  Batch #{tx.batch_id}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="text-right shrink-0 ml-2">
                            <p className="text-xs tabular-nums" style={{ color: 'var(--color-text-muted)' }}>
                              {fmt(tx.created_at)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* AI Consumption Forecast */}
              <ForecastSection itemId={item.id} unit={item.unit} />
            </>
          )}
        </div>
      </div>
    </>
  );
}
