/**
 * Batch detail slide-over drawer.
 * Shows full batch info + stage timeline + assigned workers + AI delay risk badge.
 */
import { getGarmentImage } from '../../lib/imageMap';
import { useState } from 'react';
import {
  X, Users, BarChart3, Calendar, Loader2, RefreshCw,
  ChevronDown, ChevronUp, AlertTriangle, ShieldCheck, ShieldAlert,
} from 'lucide-react';
import type { DelayRisk, ProductionBatch } from '../../types';
import { BatchStatusBadge } from '../orders/OrderBadges';
import { StageTimeline } from './StageTimeline';
import { useBatch } from '../../hooks/useProduction';
import { useDelayRisk } from '../../hooks/useAI';

interface BatchDetailDrawerProps {
  batchId: number;
  canEdit: boolean;
  onClose: () => void;
}

function Stat({ label, value, accent }: { label: string; value: React.ReactNode; accent?: string }) {
  return (
    <div
      className="rounded-lg p-3 flex flex-col gap-1"
      style={{ backgroundColor: 'var(--color-bg-overlay)' }}
    >
      <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{label}</span>
      <span
        className="text-lg font-bold tabular-nums"
        style={{ color: accent ?? 'var(--color-text-primary)' }}
      >
        {value}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Risk badge + expandable panel
// ---------------------------------------------------------------------------
const RISK_CONFIG: Record<DelayRisk, { label: string; color: string; bg: string; border: string; icon: React.ReactNode }> = {
  low:    { label: 'Low Risk',    color: 'var(--color-success)', bg: 'var(--color-success-subtle)',   border: 'var(--color-success-border)',   icon: <ShieldCheck  size={11} /> },
  medium: { label: 'Medium Risk', color: 'var(--color-warning)', bg: 'var(--color-warning-subtle)', border: 'var(--color-warning-border)', icon: <AlertTriangle size={11} /> },
  high:   { label: 'High Risk',   color: 'var(--color-danger)', bg: 'var(--color-danger-subtle)',   border: 'var(--color-danger-border)',   icon: <ShieldAlert  size={11} /> },
};

function DelayRiskPanel({ batchId }: { batchId: number }) {
  const { data, isLoading, isError, error } = useDelayRisk(batchId);
  const [expanded, setExpanded] = useState(false);

  // 503 = model not loaded; hide silently — don't crash the drawer
  const is503 = isError && (error as { response?: { status?: number } })?.response?.status === 503;
  if (is503) return null;

  if (isLoading) {
    return (
      <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs"
        style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
        <Loader2 size={10} className="animate-spin" />
        Assessing delay risk…
      </div>
    );
  }

  if (isError || !data) return null;

  const cfg = RISK_CONFIG[data.risk];

  return (
    <div className="rounded-xl border overflow-hidden"
      style={{ borderColor: cfg.border, backgroundColor: cfg.bg }}>

      {/* Clickable header row */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-3 py-2.5 text-left"
      >
        <div className="flex items-center gap-2.5">
          <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: cfg.color }}>
            {cfg.icon}
            {cfg.label}
          </span>
          <span className="text-xs font-mono tabular-nums font-bold" style={{ color: cfg.color }}>
            {(data.probability * 100).toFixed(0)}%
          </span>
          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            delay probability
          </span>
        </div>
        <span style={{ color: 'var(--color-text-muted)' }}>
          {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </span>
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2.5 border-t" style={{ borderColor: cfg.border }}>
          {/* Contributing factors */}
          <div className="pt-2.5">
            <p className="text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
              Risk signals
            </p>
            {data.contributing_factors.length > 0 ? (
              <div className="space-y-1">
                {data.contributing_factors.map((f, i) => (
                  <div key={i} className="flex items-start gap-1.5">
                    <span className="mt-0.5 shrink-0 text-xs" style={{ color: cfg.color }}>•</span>
                    <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{f}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                No strong risk signals detected for this batch.
              </p>
            )}
          </div>

          {/* Model caveat */}
          <p className="text-xs italic border-t pt-2"
            style={{ color: 'var(--color-text-muted)', borderColor: cfg.border }}>
            {data.model_note}
          </p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main drawer
// ---------------------------------------------------------------------------
export function BatchDetailDrawer({ batchId, canEdit, onClose }: BatchDetailDrawerProps) {
  const { data: batch, isLoading, isError, refetch } = useBatch(batchId);
  const [localBatch, setLocalBatch] = useState<ProductionBatch | null>(null);
  const displayed = localBatch ?? batch;

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
        className="fixed top-0 right-0 bottom-0 z-50 w-full max-w-2xl flex flex-col border-l"
        style={{
          backgroundColor: 'var(--color-bg-surface)',
          borderColor: 'var(--color-border)',
        }}
      >
        {/* Cover Header */}
        <div className="relative h-48 shrink-0 w-full">
          {displayed ? (
            <img 
              src={getGarmentImage('sewing')}
              alt="Batch Cover"
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
             <div className="absolute inset-0" style={{ backgroundColor: 'var(--color-bg-elevated)' }} />
          )}
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.2) 60%, transparent 100%)' }} />
          
          <div className="absolute inset-x-0 bottom-0 p-5 flex items-end justify-between">
            <div className="min-w-0 pr-2">
              {displayed ? (
                <>
                  <p className="font-mono text-xs font-semibold text-white/80 mb-0.5">
                    {displayed.batch_number}
                  </p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-xl font-bold text-white truncate leading-tight">
                      Production Batch
                    </h2>
                  </div>
                </>
              ) : (
                <h2 className="text-xl font-bold text-white leading-tight">Batch Detail</h2>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => { setLocalBatch(null); void refetch(); }}
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
            <div className="flex items-center gap-2 py-8 justify-center">
              <Loader2 size={18} className="animate-spin" style={{ color: 'var(--color-text-muted)' }} />
              <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Loading batch…</span>
            </div>
          )}

          {isError && (
            <div className="py-8 text-center" style={{ color: 'var(--color-danger)' }}>
              <p className="text-sm">Failed to load batch details.</p>
              <button onClick={() => void refetch()} className="text-xs mt-2 underline">Retry</button>
            </div>
          )}

          {displayed && (
            <>
              {/* AI Delay Risk — sits at top of body, above the stat row */}
              <DelayRiskPanel batchId={displayed.id} />

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-3">
                <Stat label="Planned Qty" value={displayed.planned_quantity.toLocaleString()} />
                <Stat
                  label="Remaining"
                  value={displayed.remaining_production.toLocaleString()}
                  accent={
                    displayed.remaining_production === 0
                      ? 'var(--color-success)'
                      : displayed.status === 'delayed'
                      ? 'var(--color-danger)'
                      : 'var(--color-warning)'
                  }
                />
                <Stat
                  label="Daily Target"
                  value={displayed.daily_production_target > 0
                    ? displayed.daily_production_target.toLocaleString()
                    : '—'}
                />
              </div>

              {/* Meta */}
              <div
                className="rounded-xl border p-4 grid grid-cols-2 gap-x-4 gap-y-2"
                style={{ backgroundColor: 'var(--color-bg-elevated)', borderColor: 'var(--color-border)' }}
              >
                <div className="flex items-center gap-2">
                  <BarChart3 size={13} style={{ color: 'var(--color-text-muted)' }} />
                  <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Production Line:</span>
                  <span className="text-xs font-medium" style={{ color: 'var(--color-text-primary)' }}>
                    {displayed.production_line ?? '—'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar size={13} style={{ color: 'var(--color-text-muted)' }} />
                  <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Expected Done:</span>
                  <span className="text-xs font-medium" style={{ color: 'var(--color-text-primary)' }}>
                    {displayed.expected_completion_date ?? '—'}
                  </span>
                </div>
                <div className="flex items-center gap-2 col-span-2">
                  <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Order ID:</span>
                  <span className="text-xs font-mono font-semibold" style={{ color: 'var(--color-accent-hover)' }}>
                    #{displayed.order_id}
                  </span>
                </div>
              </div>

              {/* Stage timeline */}
              <div>
                <p className="text-xs font-medium uppercase tracking-wide mb-3" style={{ color: 'var(--color-text-muted)' }}>
                  Stage Pipeline
                </p>
                <StageTimeline
                  batch={displayed}
                  canEdit={canEdit}
                  onBatchUpdated={updated => setLocalBatch(updated)}
                />
              </div>

              {/* Assigned workers */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Users size={13} style={{ color: 'var(--color-text-muted)' }} />
                  <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
                    Assigned Workers ({displayed.assigned_workers.length})
                  </p>
                </div>
                {displayed.assigned_workers.length === 0 ? (
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>No workers assigned.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {displayed.assigned_workers.map(w => (
                      <div
                        key={w.id}
                        className="flex items-center gap-2 rounded-lg px-3 py-2 border"
                        style={{
                          backgroundColor: 'var(--color-bg-elevated)',
                          borderColor: 'var(--color-border)',
                        }}
                      >
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
                          style={{ backgroundColor: 'var(--color-accent)', color: 'white' }}
                        >
                          {w.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-xs font-medium" style={{ color: 'var(--color-text-primary)' }}>{w.name}</p>
                          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{w.department}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
