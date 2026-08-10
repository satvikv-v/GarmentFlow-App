/**
 * Order detail slide-over drawer.
 * Shows full order info, linked production batch status, and dispatch status.
 */
import { X, Package, Truck, Calendar, Hash, Layers, AlertTriangle, Loader2 } from 'lucide-react';
import type { Order } from '../../types';
import { getGarmentImage } from '../../lib/imageMap';
import { StatusBadge, PriorityBadge, BatchStatusBadge } from './OrderBadges';
import { useOrderBatch, useOrderDispatch } from '../../hooks/useOrders';

interface OrderDetailDrawerProps {
  order: Order;
  onClose: () => void;
  onEdit: (order: Order) => void;
}

function Section({ title, icon: Icon, children }: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-xl border p-4"
      style={{ backgroundColor: 'var(--color-bg-elevated)', borderColor: 'var(--color-border)' }}
    >
      <div className="flex items-center gap-2 mb-3">
        <Icon size={14} style={{ color: 'var(--color-text-muted)' }} />
        <span className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
          {title}
        </span>
      </div>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5">
      <span className="text-xs shrink-0" style={{ color: 'var(--color-text-muted)' }}>{label}</span>
      <span className="text-xs text-right font-medium" style={{ color: 'var(--color-text-primary)' }}>{value}</span>
    </div>
  );
}

// Delivery status color map
const DELIVERY_COLORS: Record<string, string> = {
  pending: 'var(--color-warning)',
  shipped: 'var(--color-info)',
  in_transit: 'var(--color-accent)',
  delivered: 'var(--color-success)',
  returned: 'var(--color-danger)',
};

export function OrderDetailDrawer({ order, onClose, onEdit }: OrderDetailDrawerProps) {
  const { data: batch, isLoading: batchLoading } = useOrderBatch(order.id);
  const { data: dispatch, isLoading: dispatchLoading } = useOrderDispatch(order.id);

  // Size breakdown display
  const sizeEntries = Object.entries(order.size_breakdown ?? {});

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className="fixed top-0 right-0 bottom-0 z-50 w-full max-w-md flex flex-col border-l"
        style={{
          backgroundColor: 'var(--color-bg-surface)',
          borderColor: 'var(--color-border)',
        }}
      >
        {/* Cover Header */}
        <div className="relative h-48 shrink-0 w-full">
          <img 
            src={getGarmentImage(order.product)}
            alt="Order Cover"
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.2) 60%, transparent 100%)' }} />
          
          <div className="absolute inset-x-0 bottom-0 p-5 flex items-end justify-between">
            <div>
              <p className="font-mono text-xs font-semibold text-white/80 mb-0.5">
                {order.order_number}
              </p>
              <h2 className="text-xl font-bold text-white leading-tight">
                {order.product}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onEdit(order)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium backdrop-blur-md transition-colors"
                style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: 'white' }}
                onMouseEnter={e => { (e.currentTarget).style.backgroundColor = 'rgba(255,255,255,0.25)'; }}
                onMouseLeave={e => { (e.currentTarget).style.backgroundColor = 'rgba(255,255,255,0.15)'; }}
              >
                Edit
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
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Status + priority row */}
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge status={order.status} />
            <PriorityBadge priority={order.priority} />
            <span
              className="text-xs px-2 py-0.5 rounded-full border"
              style={{
                color: 'var(--color-text-muted)',
                borderColor: 'var(--color-border)',
              }}
            >
              {order.order_type}
            </span>
          </div>

          {/* Core details */}
          <Section title="Order Details" icon={Hash}>
            <Row label="Customer ID" value={`#${order.customer_id}`} />
            <Row label="Color" value={order.color} />
            <Row label="Fabric" value={order.fabric} />
            <Row label="Total Quantity" value={order.quantity.toLocaleString()} />
            <Row
              label="Deadline"
              value={
                <span className="flex items-center gap-1">
                  <Calendar size={11} />
                  {order.delivery_deadline}
                </span>
              }
            />
            <Row label="Created" value={new Date(order.created_at).toLocaleDateString()} />
          </Section>

          {/* Size breakdown */}
          <Section title="Size Breakdown" icon={Layers}>
            {sizeEntries.length === 0 ? (
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>No size data</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {sizeEntries.map(([size, qty]) => (
                  <div
                    key={size}
                    className="flex items-center justify-between rounded-lg px-3 py-2"
                    style={{ backgroundColor: 'var(--color-bg-overlay)' }}
                  >
                    <span className="text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>{size}</span>
                    <span className="text-xs tabular-nums font-medium" style={{ color: 'var(--color-text-primary)' }}>
                      {(qty as number).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Production batch */}
          <Section title="Production Batch" icon={Package}>
            {batchLoading ? (
              <div className="flex items-center gap-2 py-2">
                <Loader2 size={13} className="animate-spin" style={{ color: 'var(--color-text-muted)' }} />
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Loading…</span>
              </div>
            ) : batch ? (
              <>
                <Row label="Batch #" value={<span className="font-mono">{batch.batch_number}</span>} />
                <Row label="Status" value={<BatchStatusBadge status={batch.status} />} />
                <Row label="Line" value={batch.production_line ?? '—'} />
                <Row label="Planned Qty" value={batch.planned_quantity.toLocaleString()} />
                <Row
                  label="Expected Done"
                  value={batch.expected_completion_date ?? '—'}
                />
                {/* Stage pipeline mini-view */}
                {batch.stages && batch.stages.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs mb-2" style={{ color: 'var(--color-text-muted)' }}>Stage Pipeline</p>
                    <div className="space-y-1">
                      {batch.stages.map(stage => {
                        const stageColor =
                          stage.status === 'completed' ? 'var(--color-success)' :
                          stage.status === 'in_progress' ? 'var(--color-accent)' :
                          stage.status === 'delayed' ? 'var(--color-danger)' :
                          stage.status === 'skipped' ? 'var(--color-text-muted)' :
                          'var(--color-border)';
                        return (
                          <div key={stage.id} className="flex items-center gap-2">
                            <div
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: stageColor }}
                            />
                            <span className="text-xs flex-1 capitalize" style={{ color: 'var(--color-text-secondary)' }}>
                              {stage.stage_name.replace(/_/g, ' ')}
                            </span>
                            {stage.status === 'in_progress' && (
                              <span className="text-xs" style={{ color: 'var(--color-accent)' }}>active</span>
                            )}
                            {stage.quantity_completed > 0 && (
                              <span className="text-xs tabular-nums" style={{ color: 'var(--color-text-muted)' }}>
                                {stage.quantity_completed.toLocaleString()}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center gap-2 py-2">
                <AlertTriangle size={13} style={{ color: 'var(--color-warning)' }} />
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  No production batch linked yet
                </span>
              </div>
            )}
          </Section>

          {/* Dispatch */}
          <Section title="Dispatch" icon={Truck}>
            {dispatchLoading ? (
              <div className="flex items-center gap-2 py-2">
                <Loader2 size={13} className="animate-spin" style={{ color: 'var(--color-text-muted)' }} />
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Loading…</span>
              </div>
            ) : dispatch ? (
              <>
                <Row label="Invoice #" value={<span className="font-mono">{dispatch.invoice_number}</span>} />
                <Row
                  label="Status"
                  value={
                    <span
                      className="text-xs font-medium"
                      style={{ color: DELIVERY_COLORS[dispatch.delivery_status] ?? 'var(--color-text-primary)' }}
                    >
                      {dispatch.delivery_status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </span>
                  }
                />
                <Row label="Courier" value={dispatch.courier ?? '—'} />
                <Row label="Tracking #" value={dispatch.tracking_number ?? '—'} />
                <Row label="Dispatched On" value={dispatch.dispatch_date} />
              </>
            ) : (
              <div className="flex items-center gap-2 py-2">
                <AlertTriangle size={13} style={{ color: 'var(--color-text-muted)' }} />
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  Not dispatched yet
                </span>
              </div>
            )}
          </Section>
        </div>
      </div>
    </>
  );
}
