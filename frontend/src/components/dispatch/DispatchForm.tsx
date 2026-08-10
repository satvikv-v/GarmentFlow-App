/**
 * New Dispatch creation form.
 * Order select is filtered client-side to ready_for_dispatch status only
 * (mirrors the backend's own restriction — prevents a confusing 422).
 * Also handles 409 (duplicate invoice number) and 422 (order not eligible) explicitly.
 */
import { useState } from 'react';
import { X, Loader2, AlertCircle } from 'lucide-react';
import { useCreateDispatch, type DispatchCreatePayload } from '../../hooks/useDispatch';
import { useOrders } from '../../hooks/useOrders';

interface DispatchFormProps { onClose: () => void; }

const inputStyle: React.CSSProperties = {
  backgroundColor: 'var(--color-bg-elevated)',
  borderColor: 'var(--color-border)',
  color: 'var(--color-text-primary)',
};

function Field({ label, children, error }: { label: string; children: React.ReactNode; error?: string }) {
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

export function DispatchForm({ onClose }: DispatchFormProps) {
  const createMutation = useCreateDispatch();

  // Fetch orders filtered to ready_for_dispatch — mirrors the backend restriction client-side
  const { data: ordersData } = useOrders({ page: 1, page_size: 100, status: 'ready_for_dispatch' });
  const eligibleOrders = ordersData?.items ?? [];

  const today = new Date().toISOString().split('T')[0];

  const [orderId,       setOrderId]       = useState<number | ''>('');
  const [invoiceNum,    setInvoiceNum]    = useState('');
  const [courier,       setCourier]       = useState('');
  const [dispatchDate,  setDispatchDate]  = useState(today);
  const [trackingNum,   setTrackingNum]   = useState('');
  const [errors,        setErrors]        = useState<Record<string, string>>({});
  const [globalError,   setGlobalError]   = useState<string | null>(null);

  function validate() {
    const errs: Record<string, string> = {};
    if (!orderId)            errs.order   = 'Please select an order.';
    if (!invoiceNum.trim())  errs.invoice = 'Invoice number is required.';
    if (!dispatchDate)       errs.date    = 'Dispatch date is required.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit() {
    setGlobalError(null);
    if (!validate()) return;
    const payload: DispatchCreatePayload = {
      order_id: Number(orderId),
      invoice_number: invoiceNum.trim(),
      dispatch_date: dispatchDate,
      courier: courier.trim() || null,
      tracking_number: trackingNum.trim() || null,
    };
    try {
      await createMutation.mutateAsync(payload);
      onClose();
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      if (status === 409) {
        setGlobalError(`Invoice number conflict: ${detail ?? 'already exists.'}`);
      } else if (status === 422) {
        setGlobalError(`Order not eligible: ${detail ?? 'must be ready_for_dispatch.'}`);
      } else {
        setGlobalError(detail ?? 'Failed to create dispatch record.');
      }
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-lg rounded-2xl border overflow-hidden flex flex-col max-h-[90vh]"
        style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}>

        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0"
          style={{ borderColor: 'var(--color-border)' }}>
          <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            New Dispatch
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg" style={{ color: 'var(--color-text-muted)' }}
            onMouseEnter={e => { (e.currentTarget).style.backgroundColor = 'var(--color-bg-elevated)'; }}
            onMouseLeave={e => { (e.currentTarget).style.backgroundColor = 'transparent'; }}>
            <X size={16} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
          {globalError && (
            <div className="flex items-start gap-2 rounded-lg px-3 py-2.5 text-xs border"
              style={{ backgroundColor: 'var(--color-danger-subtle)', borderColor: 'var(--color-danger-border)', color: 'var(--color-danger)' }}>
              <AlertCircle size={14} className="mt-0.5 shrink-0" />{globalError}
            </div>
          )}

          {/* Order — only ready_for_dispatch */}
          <Field label="Order * (ready for dispatch only)" error={errors.order}>
            <select value={orderId} onChange={e => setOrderId(e.target.value ? Number(e.target.value) : '')}
              className="w-full rounded-lg px-3 py-2.5 text-sm border outline-none cursor-pointer"
              style={{ ...inputStyle, borderColor: errors.order ? 'rgba(239,68,68,0.5)' : 'var(--color-border)' }}>
              <option value="">Select an order…</option>
              {eligibleOrders.length === 0 && (
                <option value="" disabled>No orders ready for dispatch</option>
              )}
              {eligibleOrders.map(o => (
                <option key={o.id} value={o.id}>
                  {o.order_number} — {o.product} (qty: {o.quantity})
                </option>
              ))}
            </select>
            {eligibleOrders.length === 0 && !errors.order && (
              <p className="text-xs mt-1" style={{ color: 'var(--color-warning)' }}>
                No orders are currently in "ready for dispatch" status.
              </p>
            )}
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Invoice Number *" error={errors.invoice}>
              <input type="text" value={invoiceNum} onChange={e => setInvoiceNum(e.target.value)}
                placeholder="e.g. INV-3001"
                className="w-full rounded-lg px-3 py-2.5 text-sm border outline-none"
                style={{ ...inputStyle, borderColor: errors.invoice ? 'rgba(239,68,68,0.5)' : 'var(--color-border)' }} />
            </Field>
            <Field label="Dispatch Date *" error={errors.date}>
              <input type="date" value={dispatchDate} onChange={e => setDispatchDate(e.target.value)}
                className="w-full rounded-lg px-3 py-2.5 text-sm border outline-none" style={inputStyle} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Courier">
              <input type="text" value={courier} onChange={e => setCourier(e.target.value)}
                placeholder="e.g. BlueDart"
                className="w-full rounded-lg px-3 py-2.5 text-sm border outline-none" style={inputStyle} />
            </Field>
            <Field label="Tracking Number">
              <input type="text" value={trackingNum} onChange={e => setTrackingNum(e.target.value)}
                placeholder="e.g. BD123456789IN"
                className="w-full rounded-lg px-3 py-2.5 text-sm border outline-none" style={inputStyle} />
            </Field>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t shrink-0"
          style={{ borderColor: 'var(--color-border)' }}>
          <button onClick={onClose} className="btn btn-secondary">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={createMutation.isPending}
            className="btn btn-primary">
            {createMutation.isPending && <Loader2 size={13} className="animate-spin" />}
            Create Dispatch
          </button>
        </div>
      </div>
    </div>
  );
}
