/**
 * Shared badge components for order status, priority, and batch status.
 * All colors reference the design-system CSS variables from index.css —
 * no hardcoded hex values here.
 */
import type { OrderStatus, OrderPriority, BatchStatus } from '../../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type BadgeConfig = { label: string; className: string };

function Badge({ cfg }: { cfg: BadgeConfig }) {
  return (
    <span className={`badge ${cfg.className}`}>
      {cfg.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Order Status
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<OrderStatus, BadgeConfig> = {
  pending:            { label: 'Pending',           className: 'badge-warning'  },
  confirmed:          { label: 'Confirmed',          className: 'badge-info'     },
  in_production:      { label: 'In Production',      className: 'badge-accent'   },
  quality_check:      { label: 'Quality Check',      className: 'badge-info'     },
  ready_for_dispatch: { label: 'Ready to Dispatch',  className: 'badge-success'  },
  dispatched:         { label: 'Dispatched',         className: 'badge-accent'   },
  delivered:          { label: 'Delivered',          className: 'badge-success'  },
  cancelled:          { label: 'Cancelled',          className: 'badge-neutral'  },
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, className: 'badge-neutral' };
  return <Badge cfg={cfg} />;
}

// ---------------------------------------------------------------------------
// Order Priority
// ---------------------------------------------------------------------------

const PRIORITY_CONFIG: Record<OrderPriority, BadgeConfig> = {
  low:    { label: 'Low',    className: 'badge-neutral'  },
  medium: { label: 'Medium', className: 'badge-warning'  },
  high:   { label: 'High',   className: 'badge-danger'   },
  urgent: { label: 'Urgent', className: 'badge-danger'   },
};

export function PriorityBadge({ priority }: { priority: OrderPriority }) {
  const cfg = PRIORITY_CONFIG[priority];
  return <Badge cfg={cfg} />;
}

// ---------------------------------------------------------------------------
// Batch Status
// ---------------------------------------------------------------------------

const BATCH_STATUS_CONFIG: Record<BatchStatus, BadgeConfig> = {
  planned:     { label: 'Planned',     className: 'badge-neutral'  },
  in_progress: { label: 'In Progress', className: 'badge-info'     },
  completed:   { label: 'Completed',   className: 'badge-success'  },
  delayed:     { label: 'Delayed',     className: 'badge-danger'   },
  on_hold:     { label: 'On Hold',     className: 'badge-warning'  },
};

export function BatchStatusBadge({ status }: { status: BatchStatus }) {
  const cfg = BATCH_STATUS_CONFIG[status];
  return <Badge cfg={cfg} />;
}

// Re-export raw configs for use in filter dropdowns / legend labels
export { STATUS_CONFIG, PRIORITY_CONFIG, BATCH_STATUS_CONFIG };
