/** New Inventory Item creation modal. */
import { useState } from 'react';
import { X, Loader2, AlertCircle } from 'lucide-react';
import { useCreateInventoryItem, useSuppliers, type ItemCreatePayload } from '../../hooks/useInventory';
import type { InventoryCategory } from '../../types';

const CATEGORIES: InventoryCategory[] = [
  'fabric', 'thread', 'button', 'zipper', 'label', 'packaging', 'accessory',
];

const inputStyle: React.CSSProperties = {
  backgroundColor: 'var(--color-bg-elevated)',
  borderColor: 'var(--color-border)',
  color: 'var(--color-text-primary)',
};

function Field({ label, children, error }: {
  label: string; children: React.ReactNode; error?: string;
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

interface ItemFormProps { onClose: () => void; }

export function ItemForm({ onClose }: ItemFormProps) {
  const createMutation = useCreateInventoryItem();
  const { data: suppliers = [] } = useSuppliers();

  const [name,         setName]         = useState('');
  const [category,     setCategory]     = useState<InventoryCategory>('fabric');
  const [unit,         setUnit]         = useState('');
  const [currentStock, setCurrentStock] = useState('0');
  const [minStock,     setMinStock]     = useState('0');
  const [supplierId,   setSupplierId]   = useState<number | ''>('');
  const [cost,         setCost]         = useState('');
  const [errors,       setErrors]       = useState<Record<string, string>>({});
  const [globalError,  setGlobalError]  = useState<string | null>(null);

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Name is required.';
    if (!unit.trim()) errs.unit = 'Unit is required (e.g. metres, pcs, kg).';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit() {
    setGlobalError(null);
    if (!validate()) return;

    const payload: ItemCreatePayload = {
      name: name.trim(),
      category,
      unit: unit.trim(),
      current_stock: parseFloat(currentStock) || 0,
      minimum_stock: parseFloat(minStock) || 0,
      supplier_id: supplierId || null,
      purchase_cost: cost ? parseFloat(cost) : null,
    };

    try {
      await createMutation.mutateAsync(payload);
      onClose();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setGlobalError(detail ?? 'Failed to create item.');
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-lg rounded-2xl border overflow-hidden flex flex-col max-h-[90vh]"
        style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}
      >
        <div
          className="flex items-center justify-between px-6 py-4 border-b shrink-0"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            New Inventory Item
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg" style={{ color: 'var(--color-text-muted)' }}
            onMouseEnter={e => { (e.currentTarget).style.backgroundColor = 'var(--color-bg-elevated)'; }}
            onMouseLeave={e => { (e.currentTarget).style.backgroundColor = 'transparent'; }}>
            <X size={16} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
          {globalError && (
            <div
              className="flex items-start gap-2 rounded-lg px-3 py-2.5 text-xs border"
              style={{ backgroundColor: 'var(--color-danger-subtle)', borderColor: 'var(--color-danger-border)', color: 'var(--color-danger)' }}
            >
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              {globalError}
            </div>
          )}

          <Field label="Item Name *" error={errors.name}>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="e.g. Cotton Fabric" className="w-full rounded-lg px-3 py-2.5 text-sm border outline-none"
              style={{ ...inputStyle, borderColor: errors.name ? 'rgba(239,68,68,0.5)' : 'var(--color-border)' }} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Category">
              <select value={category} onChange={e => setCategory(e.target.value as InventoryCategory)}
                className="w-full rounded-lg px-3 py-2.5 text-sm border outline-none cursor-pointer" style={inputStyle}>
                {CATEGORIES.map(c => (
                  <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                ))}
              </select>
            </Field>

            <Field label="Unit *" error={errors.unit}>
              <input type="text" value={unit} onChange={e => setUnit(e.target.value)}
                placeholder="e.g. metres, pcs, kg"
                className="w-full rounded-lg px-3 py-2.5 text-sm border outline-none"
                style={{ ...inputStyle, borderColor: errors.unit ? 'rgba(239,68,68,0.5)' : 'var(--color-border)' }} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Initial Stock">
              <input type="number" min="0" step="0.01" value={currentStock}
                onChange={e => setCurrentStock(e.target.value)}
                className="w-full rounded-lg px-3 py-2.5 text-sm border outline-none" style={inputStyle} />
            </Field>
            <Field label="Minimum Stock (reorder point)">
              <input type="number" min="0" step="0.01" value={minStock}
                onChange={e => setMinStock(e.target.value)}
                className="w-full rounded-lg px-3 py-2.5 text-sm border outline-none" style={inputStyle} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Supplier (optional)">
              <select value={supplierId} onChange={e => setSupplierId(e.target.value ? Number(e.target.value) : '')}
                className="w-full rounded-lg px-3 py-2.5 text-sm border outline-none cursor-pointer" style={inputStyle}>
                <option value="">None</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
            <Field label="Purchase Cost (₹)">
              <input type="number" min="0" step="0.01" value={cost}
                onChange={e => setCost(e.target.value)} placeholder="per unit"
                className="w-full rounded-lg px-3 py-2.5 text-sm border outline-none" style={inputStyle} />
            </Field>
          </div>
        </div>

        <div
          className="flex items-center justify-end gap-2 px-6 py-4 border-t shrink-0"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <button type="button" onClick={onClose}
            className="btn btn-secondary">
            Cancel
          </button>
          <button type="button" onClick={handleSubmit} disabled={createMutation.isPending}
            className="btn btn-primary">
            {createMutation.isPending && <Loader2 size={13} className="animate-spin" />}
            Create Item
          </button>
        </div>
      </div>
    </div>
  );
}
