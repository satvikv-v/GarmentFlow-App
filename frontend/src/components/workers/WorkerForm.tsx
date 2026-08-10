/** Worker create/edit form + department productivity table. */
import { useState, useEffect } from 'react';
import { X, Loader2, AlertCircle } from 'lucide-react';
import {
  useCreateWorker,
  useUpdateWorker,
  useDepartmentProductivity,
  type WorkerCreatePayload,
} from '../../hooks/useWorkers';
import type { Worker } from '../../types';

// Seeded departments from WorkerCreate docstring
const DEPARTMENTS = [
  'Cutting', 'Printing', 'Embroidery', 'Stitching',
  'Quality Check', 'Ironing', 'Packing',
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
      <label className="block text-xs font-medium mb-1.5"
        style={{ color: 'var(--color-text-secondary)' }}>
        {label}
      </label>
      {children}
      {error && <p className="text-xs mt-1" style={{ color: 'var(--color-danger)' }}>{error}</p>}
    </div>
  );
}

interface WorkerFormProps {
  editWorker?: Worker | null;
  onClose: () => void;
}

export function WorkerForm({ editWorker, onClose }: WorkerFormProps) {
  const isEdit = !!editWorker;
  const createMutation = useCreateWorker();
  const updateMutation = useUpdateWorker(editWorker?.id ?? 0);
  const isPending = createMutation.isPending || updateMutation.isPending;

  const [name,       setName]       = useState(editWorker?.name ?? '');
  const [department, setDepartment] = useState(editWorker?.department ?? DEPARTMENTS[0]);
  const [skill,      setSkill]      = useState(editWorker?.skill ?? '');
  const [isActive,   setIsActive]   = useState(editWorker?.is_active ?? true);
  const [errors,     setErrors]     = useState<Record<string, string>>({});
  const [globalError, setGlobalError] = useState<string | null>(null);

  useEffect(() => {
    if (editWorker) {
      setName(editWorker.name);
      setDepartment(editWorker.department);
      setSkill(editWorker.skill ?? '');
      setIsActive(editWorker.is_active);
    }
  }, [editWorker]);

  function validate() {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Name is required.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit() {
    setGlobalError(null);
    if (!validate()) return;
    const payload: WorkerCreatePayload = {
      name: name.trim(),
      department,
      skill: skill.trim() || null,
      is_active: isActive,
    };
    try {
      if (isEdit) await updateMutation.mutateAsync(payload);
      else        await createMutation.mutateAsync(payload);
      onClose();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setGlobalError(detail ?? 'Failed to save worker.');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-md rounded-2xl border overflow-hidden flex flex-col"
        style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}>

        <div className="flex items-center justify-between px-6 py-4 border-b"
          style={{ borderColor: 'var(--color-border)' }}>
          <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            {isEdit ? `Edit ${editWorker.name}` : 'New Worker'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg" style={{ color: 'var(--color-text-muted)' }}
            onMouseEnter={e => { (e.currentTarget).style.backgroundColor = 'var(--color-bg-elevated)'; }}
            onMouseLeave={e => { (e.currentTarget).style.backgroundColor = 'transparent'; }}>
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {globalError && (
            <div className="flex items-start gap-2 rounded-lg px-3 py-2.5 text-xs border"
              style={{ backgroundColor: 'var(--color-danger-subtle)', borderColor: 'var(--color-danger-border)', color: 'var(--color-danger)' }}>
              <AlertCircle size={14} className="mt-0.5 shrink-0" />{globalError}
            </div>
          )}

          <Field label="Full Name *" error={errors.name}>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="e.g. Ravi Kumar"
              className="w-full rounded-lg px-3 py-2.5 text-sm border outline-none"
              style={{ ...inputStyle, borderColor: errors.name ? 'rgba(239,68,68,0.5)' : 'var(--color-border)' }} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Department">
              <select value={department} onChange={e => setDepartment(e.target.value)}
                className="w-full rounded-lg px-3 py-2.5 text-sm border outline-none cursor-pointer"
                style={inputStyle}>
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </Field>
            <Field label="Skill">
              <input type="text" value={skill} onChange={e => setSkill(e.target.value)}
                placeholder="e.g. Embroidery"
                className="w-full rounded-lg px-3 py-2.5 text-sm border outline-none"
                style={inputStyle} />
            </Field>
          </div>

          {isEdit && (
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setIsActive(v => !v)}
                className="w-10 h-5 rounded-full transition-colors relative shrink-0"
                style={{ backgroundColor: isActive ? 'var(--color-accent)' : 'var(--color-border)' }}>
                <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform"
                  style={{ transform: isActive ? 'translateX(20px)' : 'translateX(2px)' }} />
              </button>
              <span className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
                {isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t"
          style={{ borderColor: 'var(--color-border)' }}>
          <button onClick={onClose} className="btn btn-secondary">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={isPending}
            className="btn btn-primary">
            {isPending && <Loader2 size={13} className="animate-spin" />}
            {isEdit ? 'Save Changes' : 'Create Worker'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Productivity by Department — standalone table component
// ---------------------------------------------------------------------------
export function DepartmentProductivityTable() {
  const { data: depts = [], isLoading } = useDepartmentProductivity();

  if (isLoading) return (
    <div className="flex items-center gap-2 py-4">
      <Loader2 size={14} className="animate-spin" style={{ color: 'var(--color-text-muted)' }} />
      <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Loading…</span>
    </div>
  );

  // Find max attendance and max output for bar scaling
  const maxAtt = Math.max(...depts.map(d => d.average_attendance_rate ?? 0), 1);
  const maxOut = Math.max(...depts.map(d => d.average_daily_output ?? 0), 1);

  return (
    <div className="rounded-xl border overflow-hidden"
      style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}>
      <table className="w-full text-left">
        <thead>
          <tr>
            {['Department', 'Workers', 'Attendance Rate', 'Avg Daily Output'].map(h => (
              <th key={h} className="px-4 py-3 text-xs font-medium uppercase tracking-wide"
                style={{ color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border)' }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {depts.map((d, idx) => (
            <tr key={d.department}
              style={{ borderTop: idx > 0 ? '1px solid var(--color-border-subtle)' : undefined }}>
              <td className="px-4 py-3 text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                {d.department}
              </td>
              <td className="px-4 py-3 text-sm tabular-nums" style={{ color: 'var(--color-text-secondary)' }}>
                {d.active_workers}
              </td>
              {/* Attendance bar */}
              <td className="px-4 py-3" style={{ minWidth: 160 }}>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full overflow-hidden"
                    style={{ backgroundColor: 'var(--color-bg-overlay)' }}>
                    <div className="h-full rounded-full"
                      style={{
                        width: `${((d.average_attendance_rate ?? 0) / maxAtt) * 100}%`,
                        backgroundColor:
                          (d.average_attendance_rate ?? 0) >= 95 ? 'var(--color-success)' :
                          (d.average_attendance_rate ?? 0) >= 85 ? 'var(--color-warning)' :
                          'var(--color-danger)',
                      }} />
                  </div>
                  <span className="text-xs tabular-nums w-12 text-right"
                    style={{ color: 'var(--color-text-secondary)' }}>
                    {d.average_attendance_rate != null ? `${d.average_attendance_rate}%` : '—'}
                  </span>
                </div>
              </td>
              {/* Output bar */}
              <td className="px-4 py-3" style={{ minWidth: 160 }}>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full overflow-hidden"
                    style={{ backgroundColor: 'var(--color-bg-overlay)' }}>
                    <div className="h-full rounded-full"
                      style={{
                        width: `${((d.average_daily_output ?? 0) / maxOut) * 100}%`,
                        backgroundColor: 'var(--color-accent)',
                      }} />
                  </div>
                  <span className="text-xs tabular-nums w-10 text-right"
                    style={{ color: 'var(--color-text-secondary)' }}>
                    {d.average_daily_output != null ? d.average_daily_output.toFixed(1) : '—'}
                  </span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
