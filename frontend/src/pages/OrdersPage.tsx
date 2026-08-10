/**
 * Orders page — full list view with filters, pagination, create/edit modal,
 * detail drawer, and delete confirmation dialog.
 *
 * Role visibility:
 *   "New Order" button — owner, sales_executive only (hidden for others)
 *   "Delete" action    — owner only
 */
import { useState, useCallback } from 'react';
import { Plus, RefreshCw, Loader2 } from 'lucide-react';
import { useOrders, type OrderListParams } from '../hooks/useOrders';
import { useAuth } from '../lib/auth';
import { OrderFilters } from '../components/orders/OrderFilters';
import { OrdersTable } from '../components/orders/OrdersTable';
import { OrderForm } from '../components/orders/OrderForm';
import { OrderDetailDrawer } from '../components/orders/OrderDetailDrawer';
import { DeleteConfirmDialog } from '../components/orders/DeleteConfirmDialog';
import type { Order } from '../types';

const DEFAULT_PARAMS: OrderListParams = {
  page: 1,
  page_size: 20,
  status: '',
  priority: '',
  customer_id: '',
};

export function OrdersPage() {
  const { user } = useAuth();
  const canCreate = user?.role === 'owner' || user?.role === 'sales_executive';
  const canDelete = user?.role === 'owner';

  // ---- Filter / pagination state ----------------------------------------
  const [params, setParams] = useState<OrderListParams>(DEFAULT_PARAMS);
  const [search, setSearch] = useState('');

  const updateParams = useCallback((next: Partial<OrderListParams>) => {
    setParams(prev => ({ ...prev, ...next }));
  }, []);

  const resetFilters = useCallback(() => {
    setParams(DEFAULT_PARAMS);
    setSearch('');
  }, []);

  // ---- Modal / drawer state ---------------------------------------------
  const [showForm, setShowForm] = useState(false);
  const [editOrder, setEditOrder] = useState<Order | null>(null);
  const [viewOrder, setViewOrder] = useState<Order | null>(null);
  const [deleteOrder, setDeleteOrder] = useState<Order | null>(null);

  const openCreate = useCallback(() => { setEditOrder(null); setShowForm(true); }, []);
  const openEdit = useCallback((order: Order) => { setEditOrder(order); setShowForm(true); setViewOrder(null); }, []);
  const openView = useCallback((order: Order) => setViewOrder(order), []);
  const openDelete = useCallback((order: Order) => { setDeleteOrder(order); setViewOrder(null); }, []);

  const closeForm = useCallback(() => { setShowForm(false); setEditOrder(null); }, []);
  const closeView = useCallback(() => setViewOrder(null), []);
  const closeDelete = useCallback(() => setDeleteOrder(null), []);

  // ---- Data fetching ----------------------------------------------------
  const { data, isLoading, isError, isFetching, refetch } = useOrders(params);

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
            Orders
          </h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
            {data
              ? `${data.total.toLocaleString()} order${data.total !== 1 ? 's' : ''} total`
              : 'Loading orders…'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Refresh */}
          <button
            onClick={() => void refetch()}
            disabled={isFetching}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all"
            style={{
              backgroundColor: 'var(--color-bg-surface)',
              color: 'var(--color-text-secondary)',
              borderColor: 'var(--color-border)',
            }}
          >
            {isFetching
              ? <Loader2 size={12} className="animate-spin" />
              : <RefreshCw size={12} />
            }
            Refresh
          </button>

          {/* New Order — role-gated */}
          {canCreate && (
            <button
              id="new-order-btn"
              onClick={openCreate}
              className="btn btn-primary"
            >
              <Plus size={13} />
              New Order
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <OrderFilters
        params={params}
        search={search}
        onSearch={val => { setSearch(val); updateParams({ page: 1 }); }}
        onChange={updateParams}
        onReset={resetFilters}
      />

      {/* Table */}
      <OrdersTable
        data={data}
        isLoading={isLoading}
        isError={isError}
        search={search}
        page={params.page}
        pageSize={params.page_size}
        canDelete={canDelete}
        onView={openView}
        onEdit={openEdit}
        onDelete={openDelete}
        onPageChange={page => updateParams({ page })}
      />

      {/* Modals / drawers */}
      {showForm && (
        <OrderForm
          editOrder={editOrder}
          onClose={closeForm}
        />
      )}

      {viewOrder && (
        <OrderDetailDrawer
          order={viewOrder}
          onClose={closeView}
          onEdit={openEdit}
        />
      )}

      {deleteOrder && (
        <DeleteConfirmDialog
          order={deleteOrder}
          onClose={closeDelete}
        />
      )}
    </div>
  );
}
