/** Order list filters bar — status, priority dropdowns + order number search. */
import { type ChangeEvent } from 'react';
import { Search, X } from 'lucide-react';
import type { OrderStatus, OrderPriority } from '../../types';
import type { OrderListParams } from '../../hooks/useOrders';

interface OrderFiltersProps {
  params: OrderListParams;
  search: string;
  onSearch: (val: string) => void;
  onChange: (next: Partial<OrderListParams>) => void;
  onReset: () => void;
}

const STATUS_OPTIONS: { value: OrderStatus | ''; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'pending',            label: 'Pending' },
  { value: 'confirmed',          label: 'Confirmed' },
  { value: 'in_production',      label: 'In Production' },
  { value: 'quality_check',      label: 'Quality Check' },
  { value: 'ready_for_dispatch', label: 'Ready to Dispatch' },
  { value: 'dispatched',         label: 'Dispatched' },
  { value: 'delivered',          label: 'Delivered' },
  { value: 'cancelled',          label: 'Cancelled' },
];

const PRIORITY_OPTIONS: { value: OrderPriority | ''; label: string }[] = [
  { value: '', label: 'All priorities' },
  { value: 'low',    label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high',   label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

const selectStyle: React.CSSProperties = {
  backgroundColor: 'var(--color-bg-elevated)',
  borderColor: 'var(--color-border)',
  color: 'var(--color-text-primary)',
};

export function OrderFilters({ params, search, onSearch, onChange, onReset }: OrderFiltersProps) {
  const hasFilters = !!(params.status || params.priority || search);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Search */}
      <div className="relative">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
          style={{ color: 'var(--color-text-muted)' }}
        />
        <input
          type="text"
          placeholder="Order # or product…"
          value={search}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onSearch(e.target.value)}
          className="rounded-lg pl-9 pr-3 py-2 text-sm border outline-none w-52"
          style={selectStyle}
          onFocus={e => { e.target.style.borderColor = 'var(--color-accent)'; }}
          onBlur={e => { e.target.style.borderColor = 'var(--color-border)'; }}
        />
      </div>

      {/* Status */}
      <select
        value={params.status ?? ''}
        onChange={(e: ChangeEvent<HTMLSelectElement>) =>
          onChange({ status: e.target.value as OrderStatus | '', page: 1 })
        }
        className="rounded-lg px-3 py-2 text-sm border outline-none cursor-pointer"
        style={selectStyle}
      >
        {STATUS_OPTIONS.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

      {/* Priority */}
      <select
        value={params.priority ?? ''}
        onChange={(e: ChangeEvent<HTMLSelectElement>) =>
          onChange({ priority: e.target.value as OrderPriority | '', page: 1 })
        }
        className="rounded-lg px-3 py-2 text-sm border outline-none cursor-pointer"
        style={selectStyle}
      >
        {PRIORITY_OPTIONS.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

      {/* Clear */}
      {hasFilters && (
        <button
          onClick={onReset}
          className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs border transition-colors"
          style={{
            color: 'var(--color-text-muted)',
            borderColor: 'var(--color-border)',
            backgroundColor: 'var(--color-bg-elevated)',
          }}
          onMouseEnter={e => { (e.currentTarget).style.color = 'var(--color-text-primary)'; }}
          onMouseLeave={e => { (e.currentTarget).style.color = 'var(--color-text-muted)'; }}
        >
          <X size={12} /> Clear
        </button>
      )}
    </div>
  );
}
