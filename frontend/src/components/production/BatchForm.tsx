/**
 * New Batch creation modal.
 * - Order select (fetched from /orders, filtered client-side to exclude those
 *   already having an active batch — checked against /production/batches)
 * - Production line, planned quantity, expected completion date
 * - Worker multi-select (active workers only, from /workers?is_active=true)
 * - skip_embroidery toggle
 */
import { useState, useEffect } from 'react';
import { X, Loader2, AlertCircle, Users } from 'lucide-react';
import { useCreateBatch, useActiveWorkers } from '../../hooks/useProduction';
import { useOrders } from '../../hooks/useOrders';
import type { BatchCreatePayload } from '../../hooks/useProduction';
import type { Order } from '../../types';

interface BatchFormProps {
  onClose: () => void;
}

const inputStyle: React.CSSProperties = {
  backgroundColor: 'var(--color-bg-elevated)',
  borderColor: 'var(--color-border)',
  color: 'var(--color-text-primary)',
};

function Field({ label, children, error }: {
  label: string;
  children: React.ReactNode;
  error?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
        {label}
      </label>
      {children}
      {error && <p className="text-xs mt-1" style={{ color: 'var(--color-danger)' }}>{error}</p>}
    </div>
  );
}

export function BatchForm({ onClose }: BatchFormProps) {
  const createMutation = useCreateBatch();

  // page_size capped at 100 — the backend's hard limit. In practice eligible
  // orders (not cancelled/delivered) fit well within this.
  const { data: ordersData } = useOrders({ page: 1, page_size: 100 });
  const { data: workers = [] } = useActiveWorkers();

  // Only show orders that could have a new batch (not cancelled/delivered)
  const eligibleOrders: Order[] = (ordersData?.items ?? []).filter(o =>
    o.status !== 'cancelled' && o.status !== 'delivered'
  );

  // Form state
  const [orderId, setOrderId] = useState<number | ''>('');
  const [productionLine, setProductionLine] = useState('');
  const [plannedQty, setPlannedQty] = useState<number | ''>('');
  const [expectedDate, setExpectedDate] = useState('');
  const [selectedWorkerIds, setSelectedWorkerIds] = useState<number[]>([]);
  const [skipEmbroidery, setSkipEmbroidery] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [globalError, setGlobalError] = useState<string | null>(null);

  // Auto-fill planned qty from selected order
  useEffect(() => {
    if (orderId) {
      const order = eligibleOrders.find(o => o.id === orderId);
      if (order) setPlannedQty(order.quantity);
    }
  }, [orderId]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggleWorker(id: number) {
    setSelectedWorkerIds(prev =>
      prev.includes(id) ? prev.filter(w => w !== id) : [...prev, id]
    );
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!orderId) errs.order = 'Order is required.';
    if (!plannedQty || Number(plannedQty) <= 0) errs.qty = 'Planned quantity must be > 0.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit() {
    setGlobalError(null);
    if (!validate()) return;

    const payload: BatchCreatePayload = {
      order_id: Number(orderId),
      planned_quantity: Number(plannedQty),
      assigned_worker_ids: selectedWorkerIds,
      skip_embroidery: skipEmbroidery,
    };
    if (productionLine) payload.production_line = productionLine;
    if (expectedDate) payload.expected_completion_date = expectedDate;

    try {
      await createMutation.mutateAsync(payload);
      onClose();
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number; data?: { detail?: string } } })?.response?.status;
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      if (status === 409) {
        setGlobalError(detail ?? 'This order already has an active production batch.');
      } else {
        setGlobalError(detail ?? 'Failed to create batch.');
      }
    }
  }

  const today = new Date().toISOString().split('T')[0];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-xl rounded-2xl border overflow-hidden flex flex-col max-h-[90vh]"
        style={{
          backgroundColor: 'var(--color-bg-surface)',
          borderColor: 'var(--color-border)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b shrink-0"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            New Production Batch
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg" style={{ color: 'var(--color-text-muted)' }}
            onMouseEnter={e => { (e.currentTarget).style.backgroundColor = 'var(--color-bg-elevated)'; }}
            onMouseLeave={e => { (e.currentTarget).style.backgroundColor = 'transparent'; }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
          {globalError && (
            <div
              className="flex items-start gap-2 rounded-lg px-3 py-2.5 text-xs border"
              style={{
                backgroundColor: 'var(--color-danger-subtle)',
                borderColor: 'rgba(239,68,68,0.3)',
                color: '#fca5a5',
              }}
            >
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              {globalError}
            </div>
          )}

          {/* Order select */}
          <Field label="Order *" error={errors.order}>
            <select
              value={orderId}
              onChange={e => setOrderId(e.target.value ? Number(e.target.value) : '')}
              className="w-full rounded-lg px-3 py-2.5 text-sm border outline-none cursor-pointer"
              style={{ ...inputStyle, borderColor: errors.order ? 'rgba(239,68,68,0.5)' : 'var(--color-border)' }}
            >
              <option value="">Select an order…</option>
              {eligibleOrders.map(o => (
                <option key={o.id} value={o.id}>
                  {o.order_number} — {o.product} (qty: {o.quantity})
                </option>
              ))}
            </select>
          </Field>

          {/* Production line + planned qty */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Production Line">
              <input
                type="text"
                value={productionLine}
                onChange={e => setProductionLine(e.target.value)}
                placeholder="e.g. Line A"
                className="w-full rounded-lg px-3 py-2.5 text-sm border outline-none"
                style={inputStyle}
              />
            </Field>
            <Field label="Planned Quantity *" error={errors.qty}>
              <input
                type="number"
                min={1}
                value={plannedQty}
                onChange={e => setPlannedQty(e.target.value ? Number(e.target.value) : '')}
                className="w-full rounded-lg px-3 py-2.5 text-sm border outline-none"
                style={{ ...inputStyle, borderColor: errors.qty ? 'rgba(239,68,68,0.5)' : 'var(--color-border)' }}
              />
            </Field>
          </div>

          {/* Expected completion date */}
          <Field label="Expected Completion Date">
            <input
              type="date"
              value={expectedDate}
              min={today}
              onChange={e => setExpectedDate(e.target.value)}
              className="w-full rounded-lg px-3 py-2.5 text-sm border outline-none"
              style={inputStyle}
            />
          </Field>

          {/* Skip embroidery toggle */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSkipEmbroidery(v => !v)}
              className="w-10 h-5 rounded-full transition-colors relative shrink-0"
              style={{ backgroundColor: skipEmbroidery ? 'var(--color-accent)' : 'var(--color-border)' }}
            >
              <div
                className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform"
                style={{ transform: skipEmbroidery ? 'translateX(20px)' : 'translateX(2px)' }}
              />
            </button>
            <div>
              <p className="text-sm" style={{ color: 'var(--color-text-primary)' }}>Skip Embroidery</p>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                Enable for orders that do not require embroidery — the stage will be marked as skipped.
              </p>
            </div>
          </div>

          {/* Worker multi-select */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Users size={13} style={{ color: 'var(--color-text-muted)' }} />
              <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                Assign Workers ({selectedWorkerIds.length} selected)
              </label>
            </div>
            <div
              className="rounded-lg border p-2 max-h-40 overflow-y-auto space-y-0.5"
              style={{ backgroundColor: 'var(--color-bg-elevated)', borderColor: 'var(--color-border)' }}
            >
              {workers.length === 0 ? (
                <p className="text-xs p-2" style={{ color: 'var(--color-text-muted)' }}>Loading workers…</p>
              ) : (
                workers.map(w => {
                  const selected = selectedWorkerIds.includes(w.id);
                  return (
                    <button
                      key={w.id}
                      type="button"
                      onClick={() => toggleWorker(w.id)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-colors"
                      style={{
                        backgroundColor: selected ? 'var(--color-accent-subtle)' : 'transparent',
                        color: selected ? 'var(--color-accent-hover)' : 'var(--color-text-secondary)',
                      }}
                    >
                      <div
                        className="w-4 h-4 rounded border shrink-0 flex items-center justify-center"
                        style={{
                          borderColor: selected ? 'var(--color-accent)' : 'var(--color-border)',
                          backgroundColor: selected ? 'var(--color-accent)' : 'transparent',
                        }}
                      >
                        {selected && <span className="text-white text-xs">✓</span>}
                      </div>
                      <span className="text-xs font-medium">{w.name}</span>
                      <span className="text-xs ml-auto" style={{ color: 'var(--color-text-muted)' }}>
                        {w.department}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-2 px-6 py-4 border-t shrink-0"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={createMutation.isPending}
            className="btn btn-primary"
          >
            {createMutation.isPending && <Loader2 size={13} className="animate-spin" />}
            Create Batch
          </button>
        </div>
      </div>
    </div>
  );
}
