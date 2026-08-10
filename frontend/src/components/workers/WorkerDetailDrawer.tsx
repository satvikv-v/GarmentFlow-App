/**
 * Worker detail drawer — productivity stats + paginated attendance history.
 * Also houses the delete confirmation (handles soft-delete messaging).
 */
import { getGarmentImage } from '../../lib/imageMap';
import { useState } from 'react';
import {
  X, RefreshCw, Loader2, Edit2, Trash2, AlertTriangle,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import type { Worker, AttendanceStatus } from '../../types';
import {
  useWorkerDetail,
  useWorkerAttendance,
  useDeleteWorker,
} from '../../hooks/useWorkers';

// ---------------------------------------------------------------------------
// Attendance status badge config
// ---------------------------------------------------------------------------
const ATT_CFG: Record<AttendanceStatus, { label: string; color: string; bg: string }> = {
  present:  { label: 'Present',  color: 'var(--color-success)', bg: 'var(--color-success-subtle)' },
  absent:   { label: 'Absent',   color: 'var(--color-danger)',  bg: 'var(--color-danger-subtle)' },
  half_day: { label: 'Half Day', color: 'var(--color-warning)', bg: 'var(--color-warning-subtle)' },
  leave:    { label: 'Leave',    color: 'var(--color-info)',    bg: 'var(--color-info-subtle)' },
};

// ---------------------------------------------------------------------------
// Delete section — explains soft-delete
// ---------------------------------------------------------------------------
function DeleteSection({ worker, onDeleted }: { worker: Worker; onDeleted: () => void }) {
  const deleteMutation = useDeleteWorker();
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setError(null);
    try {
      const res = await deleteMutation.mutateAsync(worker.id);
      // Backend returns { message: '... soft-deleted ...' } or '... deleted'
      setResult(res.message);
      setTimeout(onDeleted, 1500); // close after showing message
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail ?? 'Failed to delete worker.');
      setConfirming(false);
    }
  }

  if (result) {
    return (
      <div className="rounded-lg px-3 py-2.5 text-xs"
        style={{ backgroundColor: 'rgba(34,197,94,0.1)', color: '#22c55e' }}>
        {result}
      </div>
    );
  }

  if (!confirming) {
    return (
      <div>
        <button onClick={() => setConfirming(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs border"
          style={{ color: 'var(--color-danger)', borderColor: 'rgba(239,68,68,0.3)', backgroundColor: 'var(--color-danger-subtle)' }}>
          <Trash2 size={13} /> Delete Worker
        </button>
        {error && (
          <div className="mt-2 flex items-start gap-2 rounded-lg px-3 py-2 text-xs border"
            style={{ backgroundColor: 'var(--color-danger-subtle)', borderColor: 'rgba(239,68,68,0.3)', color: '#fca5a5' }}>
            <AlertTriangle size={13} className="mt-0.5 shrink-0" />{error}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl border p-3 space-y-2"
      style={{ borderColor: 'rgba(239,68,68,0.4)', backgroundColor: 'var(--color-danger-subtle)' }}>
      <p className="text-xs font-semibold" style={{ color: '#fca5a5' }}>
        Delete "{worker.name}"?
      </p>
      <p className="text-xs" style={{ color: '#fca5a5', opacity: 0.8 }}>
        If this worker has attendance or production history, they will be{' '}
        <strong>deactivated (soft-deleted)</strong> — not removed. They'll still appear in the
        inactive filter. If they have no history, they'll be permanently removed.
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
          Confirm
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main drawer
// ---------------------------------------------------------------------------
interface WorkerDetailDrawerProps {
  workerId: number;
  canManage: boolean;
  canDelete: boolean;
  onClose: () => void;
  onEdit: (worker: Worker) => void;
}

export function WorkerDetailDrawer({ workerId, canManage, canDelete, onClose, onEdit }: WorkerDetailDrawerProps) {
  const { data: worker, isLoading, isError, refetch } = useWorkerDetail(workerId);
  const [attPage, setAttPage] = useState(1);
  const { data: attData, isLoading: attLoading } = useWorkerAttendance(workerId, attPage);

  const att = attData?.items ?? [];
  const attTotal = attData?.total ?? 0;
  const attTotalPages = Math.max(1, Math.ceil(attTotal / 15));

  function StatCard({ label, value, color }: { label: string; value: React.ReactNode; color?: string }) {
    return (
      <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--color-bg-overlay)' }}>
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{label}</p>
        <p className="text-lg font-bold tabular-nums mt-1" style={{ color: color ?? 'var(--color-text-primary)' }}>
          {value}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="fixed inset-0 z-40" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={onClose} />
      <div className="fixed top-0 right-0 bottom-0 z-50 w-full max-w-lg flex flex-col border-l"
        style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}>

        {/* Cover Header */}
        <div className="relative h-48 shrink-0 w-full">
          {worker ? (
            <img 
              src={getGarmentImage('worker')}
              alt="Worker Cover"
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
             <div className="absolute inset-0" style={{ backgroundColor: 'var(--color-bg-elevated)' }} />
          )}
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.2) 60%, transparent 100%)' }} />
          
          <div className="absolute inset-x-0 bottom-0 p-5 flex items-end justify-between">
            <div className="min-w-0 pr-2">
              {worker ? (
                <>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-xl font-bold text-white truncate leading-tight">
                      {worker.name}
                    </h2>
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium backdrop-blur-md"
                      style={{
                        color: worker.is_active ? '#4ade80' : 'white',
                        backgroundColor: worker.is_active ? 'rgba(34,197,94,0.25)' : 'rgba(255,255,255,0.15)',
                        border: worker.is_active ? '1px solid rgba(34,197,94,0.4)' : '1px solid rgba(255,255,255,0.2)'
                      }}>
                      {worker.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p className="text-xs font-medium text-white/70 mt-1 tracking-wide">
                    {worker.department}{worker.skill ? ` · ${worker.skill}` : ''}
                  </p>
                </>
              ) : (
                <h2 className="text-xl font-bold text-white leading-tight">Worker Detail</h2>
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
              {canManage && worker && (
                <button
                  onClick={() => onEdit(worker)}
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
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {isLoading && (
            <div className="flex items-center justify-center gap-2 py-12">
              <Loader2 size={18} className="animate-spin" style={{ color: 'var(--color-text-muted)' }} />
              <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Loading…</span>
            </div>
          )}
          {isError && (
            <p className="text-sm text-center py-12" style={{ color: 'var(--color-danger)' }}>
              Failed to load worker.
            </p>
          )}

          {worker && (
            <>
              {/* Computed productivity stats — fetched from /workers/{id} detail endpoint */}
              <div>
                <p className="text-xs font-medium uppercase tracking-wide mb-3"
                  style={{ color: 'var(--color-text-muted)' }}>
                  Productivity (last 30 days)
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <StatCard
                    label="Attendance Rate"
                    value={worker.attendance_rate != null ? `${worker.attendance_rate}%` : '—'}
                    color={
                      worker.attendance_rate == null ? undefined :
                      worker.attendance_rate >= 90 ? 'var(--color-success)' :
                      worker.attendance_rate >= 75 ? 'var(--color-warning)' :
                      'var(--color-danger)'
                    }
                  />
                  <StatCard
                    label="Total Output"
                    value={worker.total_output_last_30_days ?? '—'}
                  />
                  <StatCard
                    label="Avg Daily"
                    value={worker.average_daily_output != null
                      ? worker.average_daily_output.toFixed(1)
                      : '—'}
                  />
                </div>
              </div>

              {/* Attendance history */}
              <div>
                <p className="text-xs font-medium uppercase tracking-wide mb-3"
                  style={{ color: 'var(--color-text-muted)' }}>
                  Attendance History ({attTotal} records, most recent first)
                </p>
                {attLoading ? (
                  <div className="flex items-center gap-2 py-4">
                    <Loader2 size={14} className="animate-spin" style={{ color: 'var(--color-text-muted)' }} />
                    <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Loading…</span>
                  </div>
                ) : att.length === 0 ? (
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>No attendance records.</p>
                ) : (
                  <>
                    <div className="rounded-xl border overflow-hidden"
                      style={{ borderColor: 'var(--color-border)' }}>
                      <table className="w-full text-left">
                        <thead>
                          <tr>
                            {['Date', 'Status', 'Output', 'Overtime'].map(h => (
                              <th key={h} className="px-3 py-2 text-xs font-medium"
                                style={{ color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border)' }}>
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {att.map((a, idx) => {
                            const cfg = ATT_CFG[a.status];
                            return (
                              <tr key={a.id}
                                style={{ borderTop: idx > 0 ? '1px solid var(--color-border-subtle)' : undefined }}>
                                <td className="px-3 py-2 text-xs tabular-nums"
                                  style={{ color: 'var(--color-text-secondary)' }}>
                                  {a.date}
                                </td>
                                <td className="px-3 py-2">
                                  <span className="px-1.5 py-0.5 rounded-full text-xs font-medium"
                                    style={{ color: cfg.color, backgroundColor: cfg.bg }}>
                                    {cfg.label}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-xs tabular-nums"
                                  style={{ color: 'var(--color-text-secondary)' }}>
                                  {a.output_quantity ?? '—'}
                                </td>
                                <td className="px-3 py-2 text-xs tabular-nums"
                                  style={{ color: 'var(--color-text-muted)' }}>
                                  {a.overtime_hours > 0 ? `${a.overtime_hours}h` : '—'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    {/* Attendance pagination */}
                    {attTotalPages > 1 && (
                      <div className="flex items-center justify-between mt-2 text-xs"
                        style={{ color: 'var(--color-text-muted)' }}>
                        <span>Page {attPage} of {attTotalPages}</span>
                        <div className="flex gap-1">
                          <button onClick={() => setAttPage(p => p - 1)} disabled={attPage <= 1}
                            className="p-1 rounded disabled:opacity-30">
                            <ChevronLeft size={14} />
                          </button>
                          <button onClick={() => setAttPage(p => p + 1)} disabled={attPage >= attTotalPages}
                            className="p-1 rounded disabled:opacity-30">
                            <ChevronRight size={14} />
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Delete section */}
              {canDelete && (
                <DeleteSection worker={worker} onDeleted={onClose} />
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
