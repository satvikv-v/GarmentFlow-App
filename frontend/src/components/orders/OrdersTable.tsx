/** Orders data table with skeleton loader and empty/error states. */
import {  Edit2, Trash2, Eye, ChevronLeft, ChevronRight , ShoppingCart} from 'lucide-react';
import type { Order } from '../../types';
import type { PaginatedOrderResponse } from '../../types';
import { StatusBadge, PriorityBadge } from './OrderBadges';

// ---------------------------------------------------------------------------
// Skeleton row
// ---------------------------------------------------------------------------
function SkeletonRow() {
  return (
    <tr>
      {[40, 80, 120, 60, 60, 80, 90, 80].map((w, i) => (
        <td key={i} className="px-4 py-3">
          <div
            className="h-4 rounded animate-pulse"
            style={{
              width: w,
              backgroundColor: 'var(--color-bg-elevated)',
            }}
          />
        </td>
      ))}
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------
interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
}

export function Pagination({ page, pageSize, total, onChange }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = Math.min((page - 1) * pageSize + 1, total);
  const to = Math.min(page * pageSize, total);

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
      <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
        {total === 0 ? 'No results' : `${from}–${to} of ${total}`}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
          className="p-1.5 rounded-lg transition-colors disabled:opacity-30"
          style={{ color: 'var(--color-text-secondary)' }}
          onMouseEnter={e => { if (page > 1) (e.currentTarget).style.backgroundColor = 'var(--color-bg-elevated)'; }}
          onMouseLeave={e => { (e.currentTarget).style.backgroundColor = 'transparent'; }}
        >
          <ChevronLeft size={16} />
        </button>
        <span className="px-2 text-xs min-w-[60px] text-center" style={{ color: 'var(--color-text-secondary)' }}>
          {page} / {totalPages}
        </span>
        <button
          onClick={() => onChange(page + 1)}
          disabled={page >= totalPages}
          className="p-1.5 rounded-lg transition-colors disabled:opacity-30"
          style={{ color: 'var(--color-text-secondary)' }}
          onMouseEnter={e => { if (page < totalPages) (e.currentTarget).style.backgroundColor = 'var(--color-bg-elevated)'; }}
          onMouseLeave={e => { (e.currentTarget).style.backgroundColor = 'transparent'; }}
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main table
// ---------------------------------------------------------------------------
interface OrdersTableProps {
  data: PaginatedOrderResponse | undefined;
  isLoading: boolean;
  isError: boolean;
  search: string;
  page: number;
  pageSize: number;
  canDelete: boolean;
  onView: (order: Order) => void;
  onEdit: (order: Order) => void;
  onDelete: (order: Order) => void;
  onPageChange: (page: number) => void;
}

// Client-side filter for order_number/product text search
function applySearch(orders: Order[], search: string): Order[] {
  if (!search.trim()) return orders;
  const q = search.toLowerCase();
  return orders.filter(
    o =>
      o.order_number.toLowerCase().includes(q) ||
      o.product.toLowerCase().includes(q) ||
      o.color.toLowerCase().includes(q)
  );
}

const TH_STYLE: React.CSSProperties = {
  color: 'var(--color-text-muted)',
  borderBottom: '1px solid var(--color-border)',
};

export function OrdersTable({
  data, isLoading, isError, search,
  page, pageSize, canDelete,
  onView, onEdit, onDelete, onPageChange,
}: OrdersTableProps) {
  const raw = data?.items ?? [];
  const rows = applySearch(raw, search);
  const total = search.trim() ? rows.length : (data?.total ?? 0);

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{
        backgroundColor: 'var(--color-bg-surface)',
        borderColor: 'var(--color-border)',
      }}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr>
              {['Order #', 'Product', 'Qty', 'Priority', 'Status', 'Deadline', 'Actions'].map(h => (
                <th
                  key={h}
                  className="px-4 py-3 text-xs font-medium uppercase tracking-wide"
                  style={TH_STYLE}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)}

            {isError && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-sm" style={{ color: 'var(--color-danger)' }}>
                  Failed to load orders — check network or API connection.
                </td>
              </tr>
            )}

            {!isLoading && !isError && rows.length === 0 && (
              <tr>
                  <td colSpan={7} className="px-4 py-16 text-center relative z-0">
                    <div className="absolute inset-0 pointer-events-none z-[-1]" style={{
                      backgroundImage: "url('/watermark.png')",
                      backgroundRepeat: 'repeat',
                      opacity: 0.05,
                    }} />
                    <div className="flex flex-col items-center justify-center">
                      <ShoppingCart size={48} style={{ color: 'var(--color-border)' }} className="mb-4" strokeWidth={1.5} />
                      <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                        No orders match your filters
                      </p>
                      <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>'Try adjusting the filters or search term.'</p>
                    </div>
                  </td>
                </tr>
            )}

            {!isLoading && !isError && rows.map((order, idx) => (
              <tr
                key={order.id}
                className="transition-colors cursor-default group"
                style={{
                  borderTop: idx > 0 ? '1px solid var(--color-border-subtle)' : undefined,
                }}
                onMouseEnter={e => { (e.currentTarget).style.backgroundColor = 'var(--color-bg-elevated)'; }}
                onMouseLeave={e => { (e.currentTarget).style.backgroundColor = 'transparent'; }}
              >
                <td className="px-4 py-3">
                  <button
                    onClick={() => onView(order)}
                    className="font-mono text-xs font-semibold hover:underline"
                    style={{ color: 'var(--color-accent-hover)' }}
                  >
                    {order.order_number}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <div>
                    <p className="font-medium text-sm" style={{ color: 'var(--color-text-primary)' }}>
                      {order.product}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      {order.color} · {order.fabric}
                    </p>
                  </div>
                </td>
                <td className="px-4 py-3 tabular-nums" style={{ color: 'var(--color-text-secondary)' }}>
                  {order.quantity.toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  <PriorityBadge priority={order.priority} />
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={order.status} />
                </td>
                <td className="px-4 py-3 tabular-nums text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                  {order.delivery_deadline}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <ActionBtn onClick={() => onView(order)} title="View details" icon={<Eye size={13} />} />
                    <ActionBtn onClick={() => onEdit(order)} title="Edit" icon={<Edit2 size={13} />} />
                    {canDelete && (
                      <ActionBtn
                        onClick={() => onDelete(order)}
                        title="Delete"
                        icon={<Trash2 size={13} />}
                        danger
                      />
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!isLoading && !isError && (
        <Pagination
          page={page}
          pageSize={pageSize}
          total={total}
          onChange={onPageChange}
        />
      )}
    </div>
  );
}

function ActionBtn({
  onClick, title, icon, danger = false,
}: {
  onClick: () => void;
  title: string;
  icon: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="p-1.5 rounded-md transition-colors"
      style={{ color: danger ? 'var(--color-danger)' : 'var(--color-text-secondary)' }}
      onMouseEnter={e => {
        (e.currentTarget).style.backgroundColor = danger
          ? 'var(--color-danger-subtle)'
          : 'var(--color-bg-overlay)';
      }}
      onMouseLeave={e => { (e.currentTarget).style.backgroundColor = 'transparent'; }}
    >
      {icon}
    </button>
  );
}
