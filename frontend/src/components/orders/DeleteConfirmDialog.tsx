/** Confirmation dialog for hard-deleting an order. */
import { AlertTriangle, Loader2, X } from 'lucide-react';
import type { Order } from '../../types';
import { useDeleteOrder } from '../../hooks/useOrders';
import { useState } from 'react';

interface DeleteConfirmDialogProps {
  order: Order;
  onClose: () => void;
}

export function DeleteConfirmDialog({ order, onClose }: DeleteConfirmDialogProps) {
  const deleteMutation = useDeleteOrder();
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setError(null);
    try {
      await deleteMutation.mutateAsync(order.id);
      onClose();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail ?? 'Failed to delete the order.');
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-sm rounded-2xl border p-6"
        style={{
          backgroundColor: 'var(--color-bg-surface)',
          borderColor: 'rgba(239,68,68,0.3)',
        }}
      >
        {/* Close */}
        <div className="flex items-start justify-between mb-4">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ backgroundColor: 'var(--color-danger-subtle)' }}
          >
            <AlertTriangle size={18} style={{ color: 'var(--color-danger)' }} />
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg"
            style={{ color: 'var(--color-text-muted)' }}
            onMouseEnter={e => { (e.currentTarget).style.backgroundColor = 'var(--color-bg-elevated)'; }}
            onMouseLeave={e => { (e.currentTarget).style.backgroundColor = 'transparent'; }}
          >
            <X size={15} />
          </button>
        </div>

        <h3 className="text-base font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>
          Delete {order.order_number}?
        </h3>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          This will permanently delete the order <strong>{order.product}</strong> for customer&nbsp;
          #{order.customer_id}. This action cannot be undone.
        </p>

        {/* Conflict warning */}
        <div
          className="mt-3 rounded-lg px-3 py-2 text-xs border"
          style={{
            backgroundColor: 'var(--color-warning-subtle)',
            borderColor: 'var(--color-warning-border)',
            color: 'var(--color-warning)',
          }}
        >
          If this order has linked production batches or dispatch records, deletion will be blocked.
          Cancel the order instead.
        </div>

        {/* Backend error */}
        {error && (
          <div
            className="mt-3 rounded-lg px-3 py-2 text-xs border"
            style={{
              backgroundColor: 'var(--color-danger-subtle)',
              borderColor: 'var(--color-danger-border)',
              color: 'var(--color-danger)',
            }}
          >
            {error}
          </div>
        )}

        <div className="flex gap-2 mt-5">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg text-sm border transition-colors"
            style={{
              color: 'var(--color-text-secondary)',
              borderColor: 'var(--color-border)',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={deleteMutation.isPending}
            className="btn btn-destructive flex-1"
          >
            {deleteMutation.isPending && <Loader2 size={13} className="animate-spin" />}
            Delete Order
          </button>
        </div>
      </div>
    </div>
  );
}
