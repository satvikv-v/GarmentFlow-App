/**
 * Production Recommendations page.
 * GET /orders/recommendations -- ranked list of schedulable orders.
 *
 * Approach: weighted-score heuristic (NOT ML). Stated plainly on the page.
 * Score = deadline urgency (0-40) + order priority (0-30)
 *        + order size (0-20) + fabric stock risk (0-10)
 */
import { useState } from 'react';
import {
  Loader2, AlertTriangle, RefreshCw, ChevronDown, ChevronUp,
  Clock, Users, Calendar, Package, TrendingUp, Info,
} from 'lucide-react';
import { useRecommendations } from '../hooks/useAI';
import type { OrderRecommendation } from '../types';
import { getGarmentImage } from '../lib/imageMap';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'var(--color-danger)',
  high:   'var(--color-warning)',
  medium: 'var(--color-accent)',
  low:    'var(--color-text-muted)',
};

const PRIORITY_BG: Record<string, string> = {
  urgent: 'var(--color-danger-subtle)',
  high:   'var(--color-warning-subtle)',
  medium: 'var(--color-accent-subtle)',
  low:    'var(--color-bg-overlay)',
};

function ScoreBar({ value, max, color }: { value: number; max: number; color: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div
        className="flex-1 h-1.5 rounded-full overflow-hidden"
        style={{ backgroundColor: 'var(--color-bg-overlay)' }}
      >
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${(value / max) * 100}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-xs tabular-nums w-6 text-right" style={{ color: 'var(--color-text-muted)' }}>
        {value}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Row
// ---------------------------------------------------------------------------
function RecommendationRow({ rec, rank }: { rec: OrderRecommendation; rank: number }) {
  const [expanded, setExpanded] = useState(false);


  const priColor  = PRIORITY_COLORS[rec.priority] ?? '#64748b';
  const priBg     = PRIORITY_BG[rec.priority]     ?? 'rgba(100,116,139,0.1)';
  const isOverdue = rec.days_to_deadline < 0;
  const isTight   = rec.buffer_days < 0;

  return (
    <div
      className="rounded-xl border overflow-hidden transition-shadow relative z-0"
      style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-surface)' }}
    >
      <div className="absolute top-0 right-0 w-64 h-full pointer-events-none z-[-1]" style={{
        backgroundImage: "url('/watermark_shirts.png')",
        backgroundRepeat: 'repeat',
        opacity: 0.05,
        maskImage: 'linear-gradient(to left, black 0%, transparent 100%)',
        WebkitMaskImage: 'linear-gradient(to left, black 0%, transparent 100%)'
      }} />
      <div className="relative z-10 flex flex-col h-full">
      {/* Main row */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-start gap-4 px-4 py-3.5 text-left hover:bg-white/3 transition-colors"
      >
        {/* Rank badge */}
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5"
          style={{
            backgroundColor: rank <= 3
              ? 'var(--color-accent)'
              : 'var(--color-bg-elevated)',
            color: rank <= 3 ? 'white' : 'var(--color-text-muted)',
          }}
        >
          {rank}
        </div>



        {/* Core info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-mono text-xs font-semibold" style={{ color: 'var(--color-accent-hover)' }}>
              {rec.order_number}
            </span>
            <span
              className="px-1.5 py-0.5 rounded-full text-xs font-medium capitalize"
              style={{ color: priColor, backgroundColor: priBg }}
            >
              {rec.priority}
            </span>
            {isOverdue && (
              <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium"
                style={{ color: 'var(--color-danger)', backgroundColor: 'var(--color-danger-subtle)' }}>
                <AlertTriangle size={10} /> OVERDUE
              </span>
            )}
            {rec.fabric_stock_sufficient === false && (
              <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium"
                style={{ color: 'var(--color-warning)', backgroundColor: 'var(--color-warning-subtle)' }}>
                <Package size={10} /> Stock Warning
              </span>
            )}
          </div>

          <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>
            {rec.product}
          </p>
          <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--color-text-muted)' }}>
            {rec.fabric} · {rec.quantity.toLocaleString()} units
          </p>
        </div>

        {/* Score + meta */}
        <div className="flex flex-col items-end gap-1 shrink-0">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm"
            style={{
              backgroundColor: rec.score >= 75
                ? 'var(--color-danger)'
                : rec.score >= 50
                ? 'var(--color-warning)'
                : 'var(--color-bg-elevated)',
              color: rec.score >= 50 ? 'white' : 'var(--color-text-primary)',
            }}
          >
            {rec.score}
          </div>
          <span className="text-xs" style={{ color: isOverdue ? '#ef4444' : 'var(--color-text-muted)' }}>
            {isOverdue
              ? `${Math.abs(rec.days_to_deadline)}d overdue`
              : `${rec.days_to_deadline}d left`}
          </span>
        </div>

        {/* Expand icon */}
        <span className="mt-1 shrink-0" style={{ color: 'var(--color-text-muted)' }}>
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </span>
      </button>

      {expanded && (
        <div
          className="px-4 pb-4 pt-1 space-y-4 border-t"
          style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-elevated)' }}
        >
          {/* Score breakdown */}
          <div>
            <p className="text-xs font-medium uppercase tracking-wide mb-2" style={{ color: 'var(--color-text-muted)' }}>
              Score breakdown (total: {rec.score}/100)
            </p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
              <div>
                <p className="text-xs mb-0.5" style={{ color: 'var(--color-text-muted)' }}>Deadline urgency /40</p>
                <ScoreBar value={rec.deadline_score} max={40} color="#ef4444" />
              </div>
              <div>
                <p className="text-xs mb-0.5" style={{ color: 'var(--color-text-muted)' }}>Order priority /30</p>
                <ScoreBar value={rec.priority_score} max={30} color={priColor} />
              </div>
              <div>
                <p className="text-xs mb-0.5" style={{ color: 'var(--color-text-muted)' }}>Order size /20</p>
                <ScoreBar value={rec.size_score} max={20} color="var(--color-accent)" />
              </div>
              <div>
                <p className="text-xs mb-0.5" style={{ color: 'var(--color-text-muted)' }}>Fabric stock risk /10</p>
                <ScoreBar value={rec.fabric_risk_score} max={10} color="#f59e0b" />
              </div>
            </div>
          </div>

          {/* Suggestions */}
          <div className="grid grid-cols-3 gap-3">
            <div
              className="rounded-lg p-2.5 flex flex-col gap-1"
              style={{ backgroundColor: 'var(--color-bg-overlay)' }}
            >
              <div className="flex items-center gap-1" style={{ color: 'var(--color-text-muted)' }}>
                <Users size={11} />
                <span className="text-xs">Suggested workers</span>
              </div>
              <span className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>
                {rec.suggested_worker_count}
              </span>
            </div>
            <div
              className="rounded-lg p-2.5 flex flex-col gap-1"
              style={{ backgroundColor: 'var(--color-bg-overlay)' }}
            >
              <div className="flex items-center gap-1" style={{ color: 'var(--color-text-muted)' }}>
                <Clock size={11} />
                <span className="text-xs">Est. days needed</span>
              </div>
              <span className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>
                {rec.days_to_complete}
              </span>
            </div>
            <div
              className="rounded-lg p-2.5 flex flex-col gap-1"
              style={{ backgroundColor: 'var(--color-bg-overlay)' }}
            >
              <div className="flex items-center gap-1" style={{ color: isTight ? '#ef4444' : 'var(--color-text-muted)' }}>
                <Calendar size={11} />
                <span className="text-xs">Buffer days</span>
              </div>
              <span
                className="text-lg font-bold"
                style={{ color: isTight ? '#ef4444' : rec.buffer_days <= 3 ? '#f59e0b' : 'var(--color-success)' }}
              >
                {rec.buffer_days}
              </span>
            </div>
          </div>

          {/* Completion vs deadline */}
          <div
            className="rounded-lg p-2.5 flex flex-wrap gap-x-6 gap-y-1 text-xs"
            style={{ backgroundColor: 'var(--color-bg-overlay)' }}
          >
            <span style={{ color: 'var(--color-text-muted)' }}>
              Est. completion: <span style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>{rec.estimated_completion_date}</span>
            </span>
            <span style={{ color: 'var(--color-text-muted)' }}>
              Deadline: <span style={{ color: isOverdue ? '#ef4444' : 'var(--color-text-primary)', fontWeight: 600 }}>{rec.delivery_deadline}</span>
            </span>
            {rec.existing_batch_status && (
              <span style={{ color: 'var(--color-text-muted)' }}>
                Existing batch: <span style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>#{rec.existing_batch_id} ({rec.existing_batch_status})</span>
              </span>
            )}
          </div>

          {/* Fabric stock */}
          {rec.fabric_item_name && (
            <div
              className="flex items-start gap-2 rounded-lg p-2.5 text-xs"
              style={{
                backgroundColor: rec.fabric_stock_sufficient === false
                  ? 'rgba(245,158,11,0.08)' : 'var(--color-bg-overlay)',
              }}
            >
              <Package size={12} className="mt-0.5 shrink-0" style={{ color: rec.fabric_stock_sufficient === false ? '#f59e0b' : 'var(--color-text-muted)' }} />
              <span style={{ color: 'var(--color-text-muted)' }}>
                Fabric matched: <span style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>{rec.fabric_item_name}</span>
                {rec.fabric_stock_sufficient === false && (
                  <span style={{ color: 'var(--color-warning)' }}> — stock below safety threshold</span>
                )}
                {rec.fabric_stock_sufficient === true && (
                  <span style={{ color: 'var(--color-success)' }}> — sufficient</span>
                )}
              </span>
            </div>
          )}
          {!rec.fabric_item_matched && (
            <div className="flex items-start gap-2 rounded-lg p-2.5 text-xs"
              style={{ backgroundColor: 'var(--color-bg-overlay)' }}>
              <Info size={12} className="mt-0.5 shrink-0" style={{ color: 'var(--color-text-muted)' }} />
              <span style={{ color: 'var(--color-text-muted)' }}>
                Fabric '{rec.fabric}' not matched in inventory — manual stock check required before batching.
              </span>
            </div>
          )}

          {/* Reason */}
          <div
            className="rounded-lg p-2.5 text-xs leading-relaxed"
            style={{ backgroundColor: 'var(--color-bg-overlay)', color: 'var(--color-text-secondary)' }}
          >
            <span className="font-medium" style={{ color: 'var(--color-text-muted)' }}>Reason: </span>
            {rec.reason}
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export function RecommendationsPage() {
  const { data, isLoading, isError, refetch } = useRecommendations();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            Production Recommendations
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
            Pending &amp; confirmed orders ranked by scheduling urgency.
          </p>
        </div>
        <button
          onClick={() => void refetch()}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs border transition-colors"
          style={{ color: 'var(--color-text-secondary)', borderColor: 'var(--color-border)' }}
          onMouseEnter={e => { (e.currentTarget).style.backgroundColor = 'var(--color-bg-elevated)'; }}
          onMouseLeave={e => { (e.currentTarget).style.backgroundColor = 'transparent'; }}
        >
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {/* Approach disclosure — always visible */}
      <div
        className="flex items-start gap-3 rounded-xl border p-3.5"
        style={{
          borderColor: 'rgba(99,102,241,0.3)',
          backgroundColor: 'rgba(99,102,241,0.06)',
        }}
      >
        <TrendingUp size={15} className="mt-0.5 shrink-0" style={{ color: 'var(--color-accent)' }} />
        <div>
          <p className="text-xs font-semibold mb-0.5" style={{ color: 'var(--color-accent)' }}>
            Heuristic scoring — not a trained ML model
          </p>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
            No ground-truth label for "correct scheduling order" exists in this dataset.
            Score = deadline urgency (0–40) + order priority (0–30) + order size (0–20) +
            fabric stock risk (0–10). Worker suggestion and completion estimate are
            rule-of-thumb — use as a triage guide, not a binding schedule.
          </p>
        </div>
      </div>

      {/* The List */}
      {!isLoading && !isError && data && (
        <ul className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-start">
          {data.items.map((rec, i) => (
            <RecommendationRow key={rec.order_id} rec={rec} rank={i + 1} />
          ))}
        </ul>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center gap-2 py-12 justify-center">
          <Loader2 size={18} className="animate-spin" style={{ color: 'var(--color-text-muted)' }} />
          <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Loading recommendations…</span>
        </div>
      )}

      {/* Error */}
      {isError && (
        <div className="py-12 text-center">
          <p className="text-sm" style={{ color: 'var(--color-danger)' }}>Failed to load recommendations.</p>
          <button onClick={() => void refetch()} className="text-xs underline mt-2"
            style={{ color: 'var(--color-text-muted)' }}>Retry</button>
        </div>
      )}

      {/* Count */}
      {data && (
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          {data.total} order{data.total !== 1 ? 's' : ''} to schedule · sorted by priority score
        </p>
      )}



      {data?.items.length === 0 && (
        <div className="py-12 text-center">
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            No pending or confirmed orders to schedule.
          </p>
        </div>
      )}
    </div>
  );
}
