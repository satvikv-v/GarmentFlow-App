/** Supplier create/edit modal. */
import { useState, useEffect } from 'react';
import { X, Loader2, AlertCircle, Star } from 'lucide-react';
import {
  useCreateSupplier,
  useUpdateSupplier,
  type SupplierCreatePayload,
} from '../../hooks/useSuppliers';
import type { Supplier } from '../../types';

interface SupplierFormProps {
  editSupplier?: Supplier | null;
  onClose: () => void;
}

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
      <label className="block text-xs font-medium mb-1.5"
        style={{ color: 'var(--color-text-secondary)' }}>
        {label}
      </label>
      {children}
      {error && <p className="text-xs mt-1" style={{ color: 'var(--color-danger)' }}>{error}</p>}
    </div>
  );
}

/** Interactive star-rating input (1–5). */
function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n === value ? 0 : n)}
          onMouseEnter={() => setHovered(n)}
          onMouseLeave={() => setHovered(0)}
          className="transition-transform hover:scale-110"
        >
          <Star
            size={20}
            style={{
              color: n <= (hovered || value) ? '#f59e0b' : 'var(--color-border)',
              fill: n <= (hovered || value) ? '#f59e0b' : 'none',
              transition: 'color 0.1s, fill 0.1s',
            }}
          />
        </button>
      ))}
      {value > 0 && (
        <span className="text-xs ml-1" style={{ color: 'var(--color-text-muted)' }}>
          {value}/5
        </span>
      )}
    </div>
  );
}

export function SupplierForm({ editSupplier, onClose }: SupplierFormProps) {
  const isEdit = !!editSupplier;
  const createMutation = useCreateSupplier();
  const updateMutation = useUpdateSupplier(editSupplier?.id ?? 0);
  const isPending = createMutation.isPending || updateMutation.isPending;

  const [name,            setName]            = useState(editSupplier?.name ?? '');
  const [contactPerson,   setContactPerson]   = useState(editSupplier?.contact_person ?? '');
  const [contactPhone,    setContactPhone]    = useState(editSupplier?.contact_phone ?? '');
  const [contactEmail,    setContactEmail]    = useState(editSupplier?.contact_email ?? '');
  const [materials,       setMaterials]       = useState(editSupplier?.materials_supplied ?? '');
  const [avgDays,         setAvgDays]         = useState(String(editSupplier?.average_delivery_days ?? ''));
  const [qualityRating,   setQualityRating]   = useState(editSupplier?.quality_rating ?? 0);
  const [errors,          setErrors]          = useState<Record<string, string>>({});
  const [globalError,     setGlobalError]     = useState<string | null>(null);

  // Sync fields if editSupplier prop changes
  useEffect(() => {
    if (editSupplier) {
      setName(editSupplier.name);
      setContactPerson(editSupplier.contact_person ?? '');
      setContactPhone(editSupplier.contact_phone ?? '');
      setContactEmail(editSupplier.contact_email ?? '');
      setMaterials(editSupplier.materials_supplied ?? '');
      setAvgDays(String(editSupplier.average_delivery_days ?? ''));
      setQualityRating(editSupplier.quality_rating ?? 0);
    }
  }, [editSupplier]);

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Supplier name is required.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit() {
    setGlobalError(null);
    if (!validate()) return;

    const payload: SupplierCreatePayload = {
      name: name.trim(),
      contact_person: contactPerson.trim() || null,
      contact_phone: contactPhone.trim() || null,
      contact_email: contactEmail.trim() || null,
      materials_supplied: materials.trim() || null,
      average_delivery_days: avgDays ? Number(avgDays) : null,
      quality_rating: qualityRating > 0 ? qualityRating : null,
    };

    try {
      if (isEdit) {
        await updateMutation.mutateAsync(payload);
      } else {
        await createMutation.mutateAsync(payload);
      }
      onClose();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setGlobalError(detail ?? 'Failed to save supplier.');
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
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0"
          style={{ borderColor: 'var(--color-border)' }}>
          <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            {isEdit ? `Edit ${editSupplier.name}` : 'New Supplier'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg" style={{ color: 'var(--color-text-muted)' }}
            onMouseEnter={e => { (e.currentTarget).style.backgroundColor = 'var(--color-bg-elevated)'; }}
            onMouseLeave={e => { (e.currentTarget).style.backgroundColor = 'transparent'; }}>
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
          {globalError && (
            <div className="flex items-start gap-2 rounded-lg px-3 py-2.5 text-xs border"
              style={{ backgroundColor: 'var(--color-danger-subtle)', borderColor: 'var(--color-danger-border)', color: 'var(--color-danger)' }}>
              <AlertCircle size={14} className="mt-0.5 shrink-0" />{globalError}
            </div>
          )}

          <Field label="Supplier Name *" error={errors.name}>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="e.g. Rajesh Textiles Ltd."
              className="w-full rounded-lg px-3 py-2.5 text-sm border outline-none"
              style={{ ...inputStyle, borderColor: errors.name ? 'rgba(239,68,68,0.5)' : 'var(--color-border)' }} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Contact Person">
              <input type="text" value={contactPerson} onChange={e => setContactPerson(e.target.value)}
                placeholder="Full name"
                className="w-full rounded-lg px-3 py-2.5 text-sm border outline-none" style={inputStyle} />
            </Field>
            <Field label="Phone">
              <input type="tel" value={contactPhone} onChange={e => setContactPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full rounded-lg px-3 py-2.5 text-sm border outline-none" style={inputStyle} />
            </Field>
          </div>

          <Field label="Email">
            <input type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)}
              placeholder="contact@supplier.com"
              className="w-full rounded-lg px-3 py-2.5 text-sm border outline-none" style={inputStyle} />
          </Field>

          <Field label="Materials Supplied">
            <input type="text" value={materials} onChange={e => setMaterials(e.target.value)}
              placeholder="e.g. Cotton fabric, Zippers, Buttons"
              className="w-full rounded-lg px-3 py-2.5 text-sm border outline-none" style={inputStyle} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Avg. Delivery Days">
              <input type="number" min="1" value={avgDays} onChange={e => setAvgDays(e.target.value)}
                placeholder="e.g. 7"
                className="w-full rounded-lg px-3 py-2.5 text-sm border outline-none" style={inputStyle} />
            </Field>
            <Field label="Quality Rating">
              <div className="pt-1">
                <StarRating value={qualityRating} onChange={setQualityRating} />
              </div>
            </Field>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t shrink-0"
          style={{ borderColor: 'var(--color-border)' }}>
          <button type="button" onClick={onClose}
            className="btn btn-secondary">
            Cancel
          </button>
          <button type="button" onClick={handleSubmit} disabled={isPending}
            className="btn btn-primary">
            {isPending && <Loader2 size={13} className="animate-spin" />}
            {isEdit ? 'Save Changes' : 'Create Supplier'}
          </button>
        </div>
      </div>
    </div>
  );
}
