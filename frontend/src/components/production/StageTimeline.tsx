/**
 * Stage timeline — the visual centrepiece of the Production page.
 *
 * Renders the 9 stages in STAGE_SEQUENCE order with per-stage visual states:
 *   completed  → solid green circle + green connector
 *   in_progress → pulsing accent ring
 *   delayed    → solid red circle
 *   skipped    → dashed grey circle (embroidery when not applicable)
 *   pending    → empty grey circle
 *
 * Clicking an active / completed / delayed stage opens an inline panel
 * showing stage details and (for owner/production_manager) an update form.
 */
import { useState } from 'react';
import {
  CheckCircle2, Circle, Clock, AlertTriangle,
  SkipForward, ChevronDown, ChevronUp, Loader2,
} from 'lucide-react';
import type { ProductionBatch, ProductionStage, StageName, StageStatus } from '../../types';
import { useUpdateStage, type StageUpdatePayload } from '../../hooks/useProduction';
import { STAGE_SEQUENCE, STAGE_LABELS } from './stageConstants';


// ---------------------------------------------------------------------------
// Status visual config
// ---------------------------------------------------------------------------
interface StageVisual {
  iconColor: string;
  connectorColor: string;
  label: string;
  pulse?: boolean;
}

function stageVisual(status: StageStatus): StageVisual {
  switch (status) {
    case 'completed':   return { iconColor: 'var(--color-success)',         connectorColor: 'var(--color-success)',       label: 'Completed' };
    case 'in_progress': return { iconColor: 'var(--color-accent)',           connectorColor: 'var(--color-border)',         label: 'In Progress', pulse: true };
    case 'delayed':     return { iconColor: 'var(--color-danger)',           connectorColor: 'var(--color-danger)',         label: 'Delayed' };
    case 'skipped':     return { iconColor: 'var(--color-text-muted)',       connectorColor: 'var(--color-border-subtle)', label: 'Skipped' };
    default:            return { iconColor: 'var(--color-border)',           connectorColor: 'var(--color-border-subtle)', label: 'Pending' };
  }
}

function StageIcon({ status, size = 28 }: { status: StageStatus; size?: number }) {
  const visual = stageVisual(status);
  const base = { color: visual.iconColor };

  if (status === 'completed')
    return <CheckCircle2 size={size} style={base} />;
  if (status === 'delayed')
    return <AlertTriangle size={size} style={base} />;
  if (status === 'skipped')
    return <SkipForward size={size} style={base} />;
  if (status === 'in_progress')
    return (
      <div className="relative" style={{ width: size, height: size }}>
        <div
          className="absolute inset-0 rounded-full animate-ping opacity-30"
          style={{ backgroundColor: visual.iconColor }}
        />
        <Clock size={size} style={base} className="relative z-10" />
      </div>
    );
  return <Circle size={size} style={base} />;
}

// ---------------------------------------------------------------------------
// Stage detail + update panel
// ---------------------------------------------------------------------------
function fmt(dt: string | null | undefined) {
  if (!dt) return '—';
  return new Date(dt).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

interface StagePanelProps {
  stage: ProductionStage;
  batchId: number;
  canEdit: boolean;
  isCurrentStage: boolean;
  onUpdated: (batch: ProductionBatch) => void;
}

function StagePanel({ stage, batchId, canEdit, isCurrentStage, onUpdated }: StagePanelProps) {
  const updateMutation = useUpdateStage(batchId);

  const [qtyInput, setQtyInput] = useState(String(stage.quantity_completed));
  const [statusInput, setStatusInput] = useState<StageStatus>(stage.status);
  const [delayReason, setDelayReason] = useState(stage.delay_reason ?? '');
  const [notes, setNotes] = useState(stage.notes ?? '');
  const [saveError, setSaveError] = useState<string | null>(null);

  const STATUS_OPTIONS: StageStatus[] = ['pending', 'in_progress', 'completed', 'delayed', 'skipped'];

  async function handleSave() {
    setSaveError(null);
    const payload: StageUpdatePayload = {
      quantity_completed: Number(qtyInput),
      status: statusInput,
    };
    if (delayReason) payload.delay_reason = delayReason;
    if (notes) payload.notes = notes;
    try {
      const updated = await updateMutation.mutateAsync({ stageId: stage.id, payload });
      onUpdated(updated);
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setSaveError(detail ?? 'Failed to save stage update.');
    }
  }

  const inputStyle: React.CSSProperties = {
    backgroundColor: 'var(--color-bg-base)',
    borderColor: 'var(--color-border)',
    color: 'var(--color-text-primary)',
  };

  return (
    <div
      className="mt-3 rounded-xl border p-4 space-y-3"
      style={{ backgroundColor: 'var(--color-bg-elevated)', borderColor: 'var(--color-border)' }}
    >
      {/* Info rows */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        <div>
          <span style={{ color: 'var(--color-text-muted)' }}>Started: </span>
          <span style={{ color: 'var(--color-text-secondary)' }}>{fmt(stage.start_time)}</span>
        </div>
        <div>
          <span style={{ color: 'var(--color-text-muted)' }}>Completed: </span>
          <span style={{ color: 'var(--color-text-secondary)' }}>{fmt(stage.completion_time)}</span>
        </div>
        <div>
          <span style={{ color: 'var(--color-text-muted)' }}>Qty done: </span>
          <span className="font-semibold tabular-nums" style={{ color: 'var(--color-text-primary)' }}>
            {stage.quantity_completed.toLocaleString()}
          </span>
        </div>
        {stage.delay_reason && (
          <div className="col-span-2">
            <span style={{ color: 'var(--color-text-muted)' }}>Delay reason: </span>
            <span style={{ color: 'var(--color-danger)' }}>{stage.delay_reason}</span>
          </div>
        )}
        {stage.notes && (
          <div className="col-span-2">
            <span style={{ color: 'var(--color-text-muted)' }}>Notes: </span>
            <span style={{ color: 'var(--color-text-secondary)' }}>{stage.notes}</span>
          </div>
        )}
      </div>

      {/* Edit form — only for current in-progress/pending stage + authorised role */}
      {canEdit && isCurrentStage && stage.status !== 'completed' && stage.status !== 'skipped' && (
        <div className="border-t pt-3 space-y-2" style={{ borderColor: 'var(--color-border)' }}>
          <p className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
            Update stage
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Status</label>
              <select
                value={statusInput}
                onChange={e => setStatusInput(e.target.value as StageStatus)}
                className="w-full rounded-lg px-2.5 py-1.5 text-xs border outline-none"
                style={inputStyle}
              >
                {STATUS_OPTIONS.map(s => (
                  <option key={s} value={s}>
                    {s.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Qty Completed</label>
              <input
                type="number"
                min={0}
                value={qtyInput}
                onChange={e => setQtyInput(e.target.value)}
                className="w-full rounded-lg px-2.5 py-1.5 text-xs border outline-none"
                style={inputStyle}
              />
            </div>
          </div>
          {(statusInput === 'delayed') && (
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Delay Reason</label>
              <input
                type="text"
                value={delayReason}
                onChange={e => setDelayReason(e.target.value)}
                placeholder="e.g. Machine breakdown"
                className="w-full rounded-lg px-2.5 py-1.5 text-xs border outline-none"
                style={inputStyle}
              />
            </div>
          )}
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Notes</label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Optional notes…"
              className="w-full rounded-lg px-2.5 py-1.5 text-xs border outline-none"
              style={inputStyle}
            />
          </div>
          {saveError && (
            <p className="text-xs" style={{ color: 'var(--color-danger)' }}>{saveError}</p>
          )}
          <button
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="btn btn-primary"
          >
            {updateMutation.isPending && <Loader2 size={12} className="animate-spin" />}
            Save
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main StageTimeline export
// ---------------------------------------------------------------------------
interface StageTimelineProps {
  batch: ProductionBatch;
  canEdit: boolean;
  onBatchUpdated: (batch: ProductionBatch) => void;
}

export function StageTimeline({ batch, canEdit, onBatchUpdated }: StageTimelineProps) {
  const [openStageName, setOpenStageName] = useState<StageName | null>(null);

  // Build a map of stageName -> StageOut from the batch (which may be 8 or 9 stages)
  const stageMap = new Map<StageName, ProductionStage>();
  for (const s of batch.stages) {
    stageMap.set(s.stage_name, s);
  }

  // Find the "current" stage: first in_progress, or if none, first pending
  const currentStage =
    batch.stages.find(s => s.status === 'in_progress') ??
    batch.stages.find(s => s.status === 'pending');

  return (
    <div className="w-full">
      {/* Horizontal scroller on small screens */}
      <div className="overflow-x-auto pb-2">
        <div className="flex items-start min-w-max gap-0">
          {STAGE_SEQUENCE.map((stageName, idx) => {
            const stage = stageMap.get(stageName);
            // When a stage is physically absent from the API response it means
            // skip_embroidery=True was set at batch creation — treat as 'skipped',
            // NOT 'pending'. Using 'pending' would be misleading.
            const isMissing = !stage;
            const status: StageStatus = stage?.status ?? 'skipped';
            const visual = stageVisual(status);
            const isOpen = openStageName === stageName;
            const isLast = idx === STAGE_SEQUENCE.length - 1;
            const isCurrentStageName = currentStage?.stage_name === stageName;

            return (
              <div key={stageName} className="flex items-start">
                {/* Stage node + label */}
                <div className="flex flex-col items-center w-24">
                  {/* Circle button */}
                  <button
                    onClick={() => setOpenStageName(isOpen ? null : stageName)}
                    disabled={isMissing}
                    className="flex flex-col items-center focus:outline-none group"
                    title={STAGE_LABELS[stageName]}
                  >
                    <div className="relative">
                      {/* Outer glow for current stage */}
                      {isCurrentStageName && (
                        <div
                          className="absolute -inset-1.5 rounded-full"
                          style={{ backgroundColor: 'var(--color-accent-subtle)' }}
                        />
                      )}
                      <div className="relative z-10">
                        <StageIcon status={status} size={26} />
                      </div>
                    </div>
                    <span
                      className="text-center mt-1.5 leading-tight"
                      style={{
                        fontSize: '10px',
                        color: isCurrentStageName
                          ? 'var(--color-text-primary)'
                          : status === 'completed'
                          ? 'var(--color-success)'
                          : status === 'delayed'
                          ? 'var(--color-danger)'
                          : 'var(--color-text-muted)',
                        fontWeight: isCurrentStageName ? 600 : 400,
                      }}
                    >
                      {STAGE_LABELS[stageName]}
                    </span>
                    {/* Status label */}
                    <span
                      className="text-center"
                      style={{ fontSize: '9px', color: visual.iconColor, marginTop: 2 }}
                    >
                      {visual.label}
                    </span>
                    {/* Expand indicator */}
                    {stage && (
                      <div style={{ color: 'var(--color-text-muted)', marginTop: 2 }}>
                        {isOpen ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                      </div>
                    )}
                  </button>
                </div>

                {/* Connector bar between stages */}
                {!isLast && (
                  <div className="flex-1 flex items-center mt-3" style={{ minWidth: 8 }}>
                    <div
                      className="h-0.5 w-full transition-colors duration-500"
                      style={{
                        backgroundColor:
                          status === 'completed'
                            ? 'var(--color-success)'
                            : status === 'delayed'
                            ? 'var(--color-danger)'
                            : 'var(--color-border-subtle)',
                        // Dashed for skipped
                        backgroundImage:
                          status === 'skipped'
                            ? 'repeating-linear-gradient(90deg, var(--color-text-muted) 0 4px, transparent 4px 8px)'
                            : undefined,
                        background: status === 'skipped' ? undefined : undefined,
                      }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Expanded stage detail panel — renders below the timeline */}
      {openStageName && stageMap.has(openStageName) && (
        <StagePanel
          stage={stageMap.get(openStageName)!}
          batchId={batch.id}
          canEdit={canEdit}
          isCurrentStage={currentStage?.stage_name === openStageName}
          onUpdated={onBatchUpdated}
        />
      )}
    </div>
  );
}

