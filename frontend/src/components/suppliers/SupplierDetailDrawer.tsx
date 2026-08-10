/**
 * Supplier detail slide-over drawer.
 *
 * Shows:
 * - Full contact info
 * - Computed delivery stats (on_time_delivery_rate, average_actual_delay_days)
 *   Note: average_actual_delay_days can be NEGATIVE = early deliveries on average
 * - Linked purchase orders table (only this supplier's POs)
 */
import { getGarmentImage } from '../../lib/imageMap';
import { useState } from 'react';
import {
  X, Phone, Mail, Package, Star, TrendingUp,
  TrendingDown, Minus, Edit2, Trash2, Loader2,
  AlertTriangle, RefreshCw,
} from 'lucide-react';
import type { PurchaseOrder, PurchaseOrderStatus, Supplier } from '../../types';
import {
  useSupplierDetail,
  useSupplierPurchaseOrders,
  useDeleteSupplier,
} from '../../hooks/useSuppliers';

interface SupplierDetailDrawerProps {
  supplierId: number;
  canManage: boolean;
  canDelete: boolean;
  onClose: () => void;
  onEdit: (supplier: Supplier) => void;
}

// ---------------------------------------------------------------------------
// PO status badge
// ---------------------------------------------------------------------------
const PO_STATUS_CFG: Record<PurchaseOrderStatus, { label: string; color: string; bg: string }> = {
  ordered:    { label: 'Ordered',    color: 'var(--color-info)', bg: 'var(--color-info-subtle)'  },
  in_transit: { label: 'In Transit', color: 'var(--color-accent)', bg: 'var(--color-accent-subtle)' },
  delivered:  { label: 'Delivered',  color: 'var(--color-success)', bg: 'var(--color-success-subtle)'  },
  delayed:    { label: 'Delayed',    color: 'var(--color-danger)', bg: 'var(--color-danger-subtle)'  },
  cancelled:  { label: 'Cancelled',  color: 'var(--color-text-muted)', bg: 'var(--color-bg-overlay)'},
};

function POStatusBadge({ status }: { status: PurchaseOrderStatus }) {
  const cfg = PO_STATUS_CFG[status];
  return (
    <span className="px-1.5 py-0.5 rounded-full text-xs font-medium"
      style={{ color: cfg.color, backgroundColor: cfg.bg }}>
      {cfg.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Star display (read-only)
// ---------------------------------------------------------------------------
function StarDisplay({ rating }: { rating: number | null }) {
  if (rating === null) return <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Not rated</span>;
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(n => (
        <Star key={n} size={14}
          style={{ color: n <= rating ? '#f59e0b' : 'var(--color-border)', fill: n <= rating ? '#f59e0b' : 'none' }} />
      ))}
      <span className="text-xs ml-1" style={{ color: 'var(--color-text-muted)' }}>{rating}/5</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Delivery stat display — delay days with sign awareness
// ---------------------------------------------------------------------------
function DelayDays({ days }: { days: number | null }) {
  if (days === null) return <span style={{ color: 'var(--color-text-muted)' }}>—</span>;
  if (days < 0) return (
    <span className="flex items-center gap-1" style={{ color: 'var(--color-success)' }}>
      <TrendingDown size={13} />
      {Math.abs(days)} days early on avg
    </span>
  );
  if (days === 0) return (
    <span className="flex items-center gap-1" style={{ color: 'var(--color-success)' }}>
      <Minus size={13} />
      On-time exactly
    </span>
  );
  return (
    <span className="flex items-center gap-1" style={{ color: 'var(--color-danger)' }}>
      <TrendingUp size={13} />
      {days} days late on avg
    </span>
  );
}

// ---------------------------------------------------------------------------
// Delete confirmation (inline in drawer footer)
// ---------------------------------------------------------------------------
function DeleteSection({ supplierId, supplierName, onDeleted }: {
  supplierId: number;
  supplierName: string;
  onDeleted: () => void;
}) {
  const deleteMutation = useDeleteSupplier();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setError(null);
    try {
      await deleteMutation.mutateAsync(supplierId);
      onDeleted();
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      if (status === 409) {
        setError(detail ?? 'This supplier has linked inventory items or purchase orders. Remove those first.');
      } else {
        setError(detail ?? 'Failed to delete supplier.');
      }
      setConfirming(false);
    }
  }

  if (!confirming) {
    return (
      <div>
        <button
          onClick={() => setConfirming(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs border transition-colors"
          style={{ color: 'var(--color-danger)', borderColor: 'rgba(239,68,68,0.3)', backgroundColor: 'var(--color-danger-subtle)' }}
        >
          <Trash2 size={13} /> Delete Supplier
        </button>
        {error && (
          <div className="mt-2 flex items-start gap-2 rounded-lg px-3 py-2 text-xs border"
            style={{ backgroundColor: 'var(--color-danger-subtle)', borderColor: 'rgba(239,68,68,0.3)', color: '#fca5a5' }}>
            <AlertTriangle size={13} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl border p-3 space-y-2"
      style={{ borderColor: 'rgba(239,68,68,0.4)', backgroundColor: 'var(--color-danger-subtle)' }}>
      <p className="text-xs font-semibold" style={{ color: '#fca5a5' }}>
        Delete "{supplierName}"?
      </p>
      <p className="text-xs" style={{ color: '#fca5a5', opacity: 0.8 }}>
        This is permanent and will fail if the supplier has linked inventory items or purchase orders.
      </p>
      <div className="flex gap-2">
        <button onClick={() => setConfirming(false)}
          className="flex-1 px-3 py-1.5 rounded-lg text-xs border"
          style={{ color: 'var(--color-text-secondary)', borderColor: 'var(--color-border)' }}>
          Cancel
        </button>
        <button onClick={handleDelete} disabled={deleteMutation.isPending}
          className="flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50"
          style={{ backgroundColor: 'var(--color-danger)', color: 'white' }}>
          {deleteMutation.isPending && <Loader2 size={11} className="animate-spin" />}
          Confirm Delete
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main drawer
// ---------------------------------------------------------------------------
export function SupplierDetailDrawer({
  supplierId, canManage, canDelete, onClose, onEdit,
}: SupplierDetailDrawerProps) {
  const {
    data: supplier, isLoading: detailLoading, isError: detailError, refetch,
  } = useSupplierDetail(supplierId);

  const {
    data: pos = [], isLoading: posLoading,
  } = useSupplierPurchaseOrders(supplierId);

  return (
    <>
      <div className="fixed inset-0 z-40" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={onClose} />

      <div className="fixed top-0 right-0 bottom-0 z-50 w-full max-w-lg flex flex-col border-l"
        style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}>

        {/* Cover Header */}
        <div className="relative h-48 shrink-0 w-full">
          {supplier ? (
            <img 
              src={getGarmentImage('fabric')}
              alt="Supplier Cover"
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
             <div className="absolute inset-0" style={{ backgroundColor: 'var(--color-bg-elevated)' }} />
          )}
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.2) 60%, transparent 100%)' }} />
          
          <div className="absolute inset-x-0 bottom-0 p-5 flex items-end justify-between">
            <div className="min-w-0 pr-2">
              {supplier ? (
                <>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-xl font-bold text-white truncate leading-tight">
                      {supplier.name}
                    </h2>
                  </div>
                  <p className="text-xs font-medium text-white/70 mt-1 tracking-wide truncate">
                    {supplier.contact_person ? `${supplier.contact_person} · ` : ''}{supplier.email}
                  </p>
                </>
              ) : (
                <h2 className="text-xl font-bold text-white leading-tight">Supplier Detail</h2>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => void refetch()}
                className="p-1.5 rounded-lg backdrop-blur-md transition-colors text-white/80"
                style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
                onMouseEnter={e => { (e.currentTarget).style.backgroundColor = 'rgba(255,255,255,0.2)'; }}
                onMouseLeave={e => { (e.currentTarget).style.backgroundColor = 'rgba(255,255,255,0.1)'; }}
              >
                <RefreshCw size={14} />
              </button>
              {canManage && supplier && (
                <button
                  onClick={() => onEdit(supplier)}
                  className="p-1.5 rounded-lg backdrop-blur-md transition-colors text-white/80"
                  style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
                  onMouseEnter={e => { (e.currentTarget).style.backgroundColor = 'rgba(255,255,255,0.2)'; }}
                  onMouseLeave={e => { (e.currentTarget).style.backgroundColor = 'rgba(255,255,255,0.1)'; }}
                >
                  <Edit2 size={14} />
                </button>
              )}
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
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {detailLoading && (
            <div className="flex items-center justify-center gap-2 py-12">
              <Loader2 size={18} className="animate-spin" style={{ color: 'var(--color-text-muted)' }} />
              <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Loading…</span>
            </div>
          )}
          {detailError && (
            <div className="text-center py-12">
              <p className="text-sm" style={{ color: 'var(--color-danger)' }}>Failed to load supplier.</p>
              <button onClick={() => void refetch()} className="text-xs underline mt-2"
                style={{ color: 'var(--color-text-muted)' }}>Retry</button>
            </div>
          )}

          {supplier && (
            <>
              {/* Contact info */}
              <div className="rounded-xl border p-4 space-y-2.5"
                style={{ backgroundColor: 'var(--color-bg-elevated)', borderColor: 'var(--color-border)' }}>
                <p className="text-xs font-medium uppercase tracking-wide"
                  style={{ color: 'var(--color-text-muted)' }}>Contact</p>
                {supplier.contact_person && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs w-5 shrink-0" style={{ color: 'var(--color-text-muted)' }}>👤</span>
                    <span className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
                      {supplier.contact_person}
                    </span>
                  </div>
                )}
                {supplier.contact_phone && (
                  <div className="flex items-center gap-2">
                    <Phone size={13} style={{ color: 'var(--color-text-muted)' }} className="shrink-0" />
                    <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                      {supplier.contact_phone}
                    </span>
                  </div>
                )}
                {supplier.contact_email && (
                  <div className="flex items-center gap-2">
                    <Mail size={13} style={{ color: 'var(--color-text-muted)' }} className="shrink-0" />
                    <a href={`mailto:${supplier.contact_email}`}
                      className="text-sm hover:underline"
                      style={{ color: 'var(--color-accent-hover)' }}>
                      {supplier.contact_email}
                    </a>
                  </div>
                )}
                {supplier.materials_supplied && (
                  <div className="flex items-start gap-2">
                    <Package size={13} style={{ color: 'var(--color-text-muted)' }} className="mt-0.5 shrink-0" />
                    <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                      {supplier.materials_supplied}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-2 pt-1">
                  <Star size={13} style={{ color: 'var(--color-text-muted)' }} className="shrink-0" />
                  <StarDisplay rating={supplier.quality_rating} />
                </div>
              </div>

              {/* Computed delivery performance stats */}
              <div className="rounded-xl border p-4 space-y-3"
                style={{ backgroundColor: 'var(--color-bg-elevated)', borderColor: 'var(--color-border)' }}>
                <p className="text-xs font-medium uppercase tracking-wide"
                  style={{ color: 'var(--color-text-muted)' }}>
                  Delivery Performance <span className="text-xs normal-case font-normal">(from real PO data)</span>
                </p>

                {/* Stats grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--color-bg-overlay)' }}>
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Total POs</p>
                    <p className="text-xl font-bold tabular-nums mt-1"
                      style={{ color: 'var(--color-text-primary)' }}>
                      {supplier.total_purchase_orders}
                    </p>
                  </div>
                  <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--color-bg-overlay)' }}>
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>On-Time Rate</p>
                    <p className="text-xl font-bold tabular-nums mt-1"
                      style={{
                        color: supplier.on_time_delivery_rate === null
                          ? 'var(--color-text-muted)'
                          : supplier.on_time_delivery_rate >= 80
                          ? 'var(--color-success)'
                          : supplier.on_time_delivery_rate >= 60
                          ? 'var(--color-warning)'
                          : 'var(--color-danger)',
                      }}>
                      {supplier.on_time_delivery_rate !== null
                        ? `${supplier.on_time_delivery_rate}%`
                        : '—'}
                    </p>
                  </div>
                </div>

                {/* Avg delay with sign explanation */}
                <div className="rounded-lg px-3 py-2.5"
                  style={{ backgroundColor: 'var(--color-bg-overlay)' }}>
                  <p className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>
                    Avg. Delivery Variance
                    <span className="ml-1 opacity-60">(negative = delivered early)</span>
                  </p>
                  <div className="text-sm font-semibold">
                    <DelayDays days={supplier.average_actual_delay_days} />
                  </div>
                </div>

                {supplier.on_time_delivery_rate === null && (
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    Stats computed only from delivered POs with both expected and actual dates.
                    Not enough data yet.
                  </p>
                )}

                {supplier.average_delivery_days !== null && (
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    Stated lead time: ~{supplier.average_delivery_days} days
                  </p>
                )}
              </div>

              {/* Purchase orders table */}
              <div>
                <p className="text-xs font-medium uppercase tracking-wide mb-3"
                  style={{ color: 'var(--color-text-muted)' }}>
                  Purchase Orders ({posLoading ? '…' : pos.length})
                </p>
                {posLoading ? (
                  <div className="flex items-center gap-2 py-4">
                    <Loader2 size={14} className="animate-spin" style={{ color: 'var(--color-text-muted)' }} />
                    <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Loading…</span>
                  </div>
                ) : pos.length === 0 ? (
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    No purchase orders for this supplier.
                  </p>
                ) : (
                  <div className="rounded-xl border overflow-hidden"
                    style={{ borderColor: 'var(--color-border)' }}>
                    <table className="w-full text-left">
                      <thead>
                        <tr>
                          {['Item', 'Qty', 'Status', 'Expected', 'Actual'].map(h => (
                            <th key={h} className="px-3 py-2 text-xs font-medium"
                              style={{ color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border)' }}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {pos.map((po: PurchaseOrder, idx: number) => (
                          <tr key={po.id}
                            style={{ borderTop: idx > 0 ? '1px solid var(--color-border-subtle)' : undefined }}>
                            <td className="px-3 py-2 text-xs font-mono"
                              style={{ color: 'var(--color-text-muted)' }}>
                              #{po.inventory_item_id}
                            </td>
                            <td className="px-3 py-2 text-xs tabular-nums"
                              style={{ color: 'var(--color-text-secondary)' }}>
                              {po.quantity}
                            </td>
                            <td className="px-3 py-2">
                              <POStatusBadge status={po.status} />
                            </td>
                            <td className="px-3 py-2 text-xs tabular-nums"
                              style={{ color: 'var(--color-text-muted)' }}>
                              {po.expected_delivery_date ?? '—'}
                            </td>
                            <td className="px-3 py-2 text-xs tabular-nums"
                              style={{
                                color: po.actual_delivery_date &&
                                  po.expected_delivery_date &&
                                  po.actual_delivery_date > po.expected_delivery_date
                                  ? 'var(--color-danger)'
                                  : po.actual_delivery_date
                                  ? 'var(--color-success)'
                                  : 'var(--color-text-muted)',
                              }}>
                              {po.actual_delivery_date ?? '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Delete section — owner only */}
              {canDelete && (
                <DeleteSection
                  supplierId={supplier.id}
                  supplierName={supplier.name}
                  onDeleted={onClose}
                />
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
