/**
 * Create / Edit order modal.
 * - Customer searchable select (backed by /customers?search=)
 * - Dynamic size breakdown rows with live total vs quantity validation
 * - Deadline date picker with client-side past-date guard
 * - Shows field-level errors from backend 422 responses inline
 */
import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { X, Plus, Trash2, AlertCircle, Loader2 } from 'lucide-react';
import type { Order, OrderPriority, OrderStatus } from '../../types';
import {
  useCreateOrder,
  useUpdateOrder,
  useCustomers,
  type OrderCreatePayload,
} from '../../hooks/useOrders';

interface OrderFormProps {
  editOrder?: Order | null;
  onClose: () => void;
}

type SizeRow = { size: string; qty: number };

const PRIORITIES: OrderPriority[] = ['low', 'medium', 'high', 'urgent'];
const ORDER_TYPES = ['small', 'bulk', 'repeat'] as const;
const ORDER_STATUSES: OrderStatus[] = [
  'pending', 'confirmed', 'in_production', 'quality_check',
  'ready_for_dispatch', 'dispatched', 'delivered', 'cancelled',
];

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
      {error && (
        <p className="text-xs mt-1" style={{ color: 'var(--color-danger)' }}>{error}</p>
      )}
    </div>
  );
}

export function OrderForm({ editOrder, onClose }: OrderFormProps) {
  const isEdit = !!editOrder;
  const createMutation = useCreateOrder();
  const updateMutation = useUpdateOrder(editOrder?.id ?? 0);
  const isPending = createMutation.isPending || updateMutation.isPending;

  // ---- Customer search ----
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerInputValue, setCustomerInputValue] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const { data: customers = [] } = useCustomers(customerSearch);

  // ---- Form state ----
  const [customerId, setCustomerId] = useState<number | null>(editOrder?.customer_id ?? null);
  const [product, setProduct] = useState(editOrder?.product ?? '');
  const [color, setColor] = useState(editOrder?.color ?? '');
  const [fabric, setFabric] = useState(editOrder?.fabric ?? '');
  const [priority, setPriority] = useState<OrderPriority>(editOrder?.priority ?? 'medium');
  const [orderType, setOrderType] = useState<'small' | 'bulk' | 'repeat'>(
    (editOrder?.order_type as 'small' | 'bulk' | 'repeat') ?? 'small'
  );
  const [deadline, setDeadline] = useState(editOrder?.delivery_deadline ?? '');
  const [editStatus, setEditStatus] = useState<OrderStatus>(editOrder?.status ?? 'pending');
  const [quantity, setQuantity] = useState<number>(editOrder?.quantity ?? 0);
  const [sizeRows, setSizeRows] = useState<SizeRow[]>(() => {
    if (editOrder?.size_breakdown) {
      return Object.entries(editOrder.size_breakdown).map(([size, qty]) => ({ size, qty }));
    }
    return [{ size: 'M', qty: 0 }];
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [globalError, setGlobalError] = useState<string | null>(null);

  // Prefill customer input label on edit
  useEffect(() => {
    if (editOrder?.customer_id && customers.length > 0) {
      const c = customers.find(c => c.id === editOrder.customer_id);
      if (c) setCustomerInputValue(`${c.name}${c.company ? ` (${c.company})` : ''}`);
    }
  }, [editOrder, customers]);

  // ---- Live size breakdown total ----
  const breakdownTotal = sizeRows.reduce((s, r) => s + (r.qty || 0), 0);
  const breakdownMismatch = quantity > 0 && breakdownTotal !== quantity;

  const addSizeRow = useCallback(() => setSizeRows(r => [...r, { size: '', qty: 0 }]), []);
  const removeSizeRow = useCallback((i: number) => setSizeRows(r => r.filter((_, idx) => idx !== i)), []);
  const updateSizeRow = useCallback((i: number, field: keyof SizeRow, val: string | number) => {
    setSizeRows(r => r.map((row, idx) => idx === i ? { ...row, [field]: val } : row));
  }, []);

  // ---- Validation ----
  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!customerId) errs.customer = 'Customer is required.';
    if (!product.trim()) errs.product = 'Product is required.';
    if (!color.trim()) errs.color = 'Color is required.';
    if (!fabric.trim()) errs.fabric = 'Fabric is required.';
    if (!deadline) errs.deadline = 'Delivery deadline is required.';
    if (deadline && new Date(deadline) < new Date(new Date().toDateString())) {
      errs.deadline = 'Deadline cannot be in the past.';
    }
    if (quantity <= 0) errs.quantity = 'Quantity must be > 0.';
    if (sizeRows.some(r => !r.size.trim())) errs.sizes = 'All size labels must be filled.';
    if (breakdownMismatch) errs.sizes = `Size totals (${breakdownTotal}) must equal quantity (${quantity}).`;
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  // ---- Submit ----
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setGlobalError(null);
    if (!validate()) return;

    const sizeBreakdown = Object.fromEntries(sizeRows.map(r => [r.size, r.qty]));

    const payload: OrderCreatePayload = {
      customer_id: customerId!,
      product,
      color,
      fabric,
      size_breakdown: sizeBreakdown,
      quantity,
      delivery_deadline: deadline,
      priority,
      order_type: orderType,
    };

    try {
      if (isEdit) {
        const updatePayload = { ...payload, status: editStatus };
        await updateMutation.mutateAsync(updatePayload);
      } else {
        await createMutation.mutateAsync(payload);
      }
      onClose();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setGlobalError(detail ?? 'An unexpected error occurred.');
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
        className="w-full max-w-2xl rounded-2xl border overflow-hidden flex flex-col max-h-[90vh]"
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
            {isEdit ? `Edit ${editOrder.order_number}` : 'New Order'}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: 'var(--color-text-muted)' }}
            onMouseEnter={e => { (e.currentTarget).style.backgroundColor = 'var(--color-bg-elevated)'; }}
            onMouseLeave={e => { (e.currentTarget).style.backgroundColor = 'transparent'; }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
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

          {/* Customer */}
          <Field label="Customer *" error={errors.customer}>
            <div className="relative">
              <input
                type="text"
                placeholder="Search customer…"
                value={customerInputValue}
                onChange={e => {
                  setCustomerInputValue(e.target.value);
                  setCustomerSearch(e.target.value);
                  setCustomerId(null);
                  setShowCustomerDropdown(true);
                }}
                onFocus={() => setShowCustomerDropdown(true)}
                onBlur={() => setTimeout(() => setShowCustomerDropdown(false), 200)}
                className="w-full rounded-lg px-3 py-2.5 text-sm border outline-none"
                style={{
                  ...inputStyle,
                  borderColor: errors.customer ? 'rgba(239,68,68,0.5)' : 'var(--color-border)',
                }}
              />
              {showCustomerDropdown && customers.length > 0 && (
                <div
                  className="absolute z-10 top-full left-0 right-0 mt-1 rounded-lg border overflow-auto max-h-40"
                  style={{
                    backgroundColor: 'var(--color-bg-overlay)',
                    borderColor: 'var(--color-border)',
                  }}
                >
                  {customers.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setCustomerId(c.id);
                        setCustomerInputValue(`${c.name}${c.company ? ` (${c.company})` : ''}`);
                        setShowCustomerDropdown(false);
                        setErrors(prev => ({ ...prev, customer: '' }));
                      }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-white/5"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      <span>{c.name}</span>
                      {c.company && (
                        <span className="ml-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                          {c.company}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </Field>

          {/* Product / Color / Fabric */}
          <div className="grid grid-cols-3 gap-3">
            <Field label="Product *" error={errors.product}>
              <input
                type="text"
                value={product}
                onChange={e => setProduct(e.target.value)}
                placeholder="e.g. T-Shirt"
                className="w-full rounded-lg px-3 py-2.5 text-sm border outline-none"
                style={{ ...inputStyle, borderColor: errors.product ? 'rgba(239,68,68,0.5)' : 'var(--color-border)' }}
              />
            </Field>
            <Field label="Color *" error={errors.color}>
              <input
                type="text"
                value={color}
                onChange={e => setColor(e.target.value)}
                placeholder="e.g. Navy Blue"
                className="w-full rounded-lg px-3 py-2.5 text-sm border outline-none"
                style={{ ...inputStyle, borderColor: errors.color ? 'rgba(239,68,68,0.5)' : 'var(--color-border)' }}
              />
            </Field>
            <Field label="Fabric *" error={errors.fabric}>
              <input
                type="text"
                value={fabric}
                onChange={e => setFabric(e.target.value)}
                placeholder="e.g. Cotton"
                className="w-full rounded-lg px-3 py-2.5 text-sm border outline-none"
                style={{ ...inputStyle, borderColor: errors.fabric ? 'rgba(239,68,68,0.5)' : 'var(--color-border)' }}
              />
            </Field>
          </div>

          {/* Priority / Type / Deadline */}
          <div className="grid grid-cols-3 gap-3">
            <Field label="Priority">
              <select
                value={priority}
                onChange={e => setPriority(e.target.value as OrderPriority)}
                className="w-full rounded-lg px-3 py-2.5 text-sm border outline-none cursor-pointer"
                style={inputStyle}
              >
                {PRIORITIES.map(p => (
                  <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                ))}
              </select>
            </Field>
            <Field label="Order Type">
              <select
                value={orderType}
                onChange={e => setOrderType(e.target.value as 'small' | 'bulk' | 'repeat')}
                className="w-full rounded-lg px-3 py-2.5 text-sm border outline-none cursor-pointer"
                style={inputStyle}
              >
                {ORDER_TYPES.map(t => (
                  <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                ))}
              </select>
            </Field>
            <Field label="Deadline *" error={errors.deadline}>
              <input
                type="date"
                value={deadline}
                min={today}
                onChange={e => setDeadline(e.target.value)}
                className="w-full rounded-lg px-3 py-2.5 text-sm border outline-none"
                style={{ ...inputStyle, borderColor: errors.deadline ? 'rgba(239,68,68,0.5)' : 'var(--color-border)' }}
              />
            </Field>
          </div>

          {/* Status (edit only) */}
          {isEdit && (
            <Field label="Status">
              <select
                value={editStatus}
                onChange={e => setEditStatus(e.target.value as OrderStatus)}
                className="w-full rounded-lg px-3 py-2.5 text-sm border outline-none cursor-pointer"
                style={inputStyle}
              >
                {ORDER_STATUSES.map(s => (
                  <option key={s} value={s}>{s.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>
                ))}
              </select>
            </Field>
          )}

          {/* Quantity + Size Breakdown */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div>
                <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                  Total Quantity *
                </label>
                <input
                  type="number"
                  min={1}
                  value={quantity || ''}
                  onChange={e => setQuantity(Number(e.target.value))}
                  className="ml-3 rounded-lg px-3 py-1.5 text-sm border outline-none w-24 inline-block"
                  style={{ ...inputStyle, borderColor: errors.quantity ? 'rgba(239,68,68,0.5)' : 'var(--color-border)' }}
                />
                {errors.quantity && (
                  <span className="ml-2 text-xs" style={{ color: 'var(--color-danger)' }}>{errors.quantity}</span>
                )}
              </div>
              <div className="text-xs" style={{ color: breakdownMismatch ? 'var(--color-danger)' : 'var(--color-text-muted)' }}>
                Breakdown total: <strong>{breakdownTotal}</strong>
                {breakdownMismatch && ' ≠ quantity'}
              </div>
            </div>

            <div
              className="rounded-lg border p-3 space-y-2"
              style={{
                borderColor: errors.sizes ? 'rgba(239,68,68,0.5)' : 'var(--color-border)',
                backgroundColor: 'var(--color-bg-elevated)',
              }}
            >
              <p className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                Size Breakdown
              </p>
              {sizeRows.map((row, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Size (e.g. M)"
                    value={row.size}
                    onChange={e => updateSizeRow(i, 'size', e.target.value)}
                    className="rounded-md px-2.5 py-1.5 text-sm border outline-none w-24"
                    style={inputStyle}
                  />
                  <input
                    type="number"
                    min={0}
                    placeholder="Qty"
                    value={row.qty || ''}
                    onChange={e => updateSizeRow(i, 'qty', Number(e.target.value))}
                    className="rounded-md px-2.5 py-1.5 text-sm border outline-none w-24"
                    style={inputStyle}
                  />
                  {sizeRows.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeSizeRow(i)}
                      className="p-1 rounded-md transition-colors"
                      style={{ color: 'var(--color-text-muted)' }}
                      onMouseEnter={e => { (e.currentTarget).style.color = 'var(--color-danger)'; }}
                      onMouseLeave={e => { (e.currentTarget).style.color = 'var(--color-text-muted)'; }}
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={addSizeRow}
                className="flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-colors"
                style={{ color: 'var(--color-accent)' }}
                onMouseEnter={e => { (e.currentTarget).style.backgroundColor = 'var(--color-accent-subtle)'; }}
                onMouseLeave={e => { (e.currentTarget).style.backgroundColor = 'transparent'; }}
              >
                <Plus size={12} /> Add size
              </button>
              {errors.sizes && (
                <p className="text-xs" style={{ color: 'var(--color-danger)' }}>{errors.sizes}</p>
              )}
            </div>
          </div>
        </form>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-2 px-6 py-4 border-t shrink-0"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm border transition-colors"
            style={{
              color: 'var(--color-text-secondary)',
              borderColor: 'var(--color-border)',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit as unknown as React.MouseEventHandler}
            disabled={isPending || breakdownMismatch}
            className="btn btn-primary"
          >
            {isPending && <Loader2 size={13} className="animate-spin" />}
            {isEdit ? 'Save Changes' : 'Create Order'}
          </button>
        </div>
      </div>
    </div>
  );
}
