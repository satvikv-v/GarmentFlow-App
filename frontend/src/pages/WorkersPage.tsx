/**
 * Workers page — list with department/active filters, detail drawer,
 * create/edit modal, and department productivity table.
 */
import {  useState, useCallback } from 'react';
import {
  Plus, RefreshCw, Loader2, ChevronLeft, ChevronRight, Eye, X, Users} from 'lucide-react';
import { useWorkersList, type WorkerListParams } from '../hooks/useWorkers';
import { useAuth } from '../lib/auth';
import { WorkerDetailDrawer } from '../components/workers/WorkerDetailDrawer';
import { WorkerForm, DepartmentProductivityTable } from '../components/workers/WorkerForm';
import type { Worker } from '../types';

const DEFAULT_PARAMS: WorkerListParams = { page: 1, page_size: 20 };
const DEPARTMENTS = ['Cutting','Printing','Embroidery','Stitching','Quality Check','Ironing','Packing'];

const selectStyle: React.CSSProperties = {
  backgroundColor: 'var(--color-bg-elevated)',
  borderColor: 'var(--color-border)',
  color: 'var(--color-text-primary)',
};

function SkeletonRow() {
  return (
    <tr>
      {[120, 90, 70, 70, 70].map((w, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 rounded animate-pulse"
            style={{ width: w, backgroundColor: 'var(--color-bg-elevated)' }} />
        </td>
      ))}
    </tr>
  );
}

function Pagination({ page, pageSize, total, onChange }: {
  page: number; pageSize: number; total: number; onChange: (p: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t"
      style={{ borderColor: 'var(--color-border)' }}>
      <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
        {total === 0 ? 'No results' : `${Math.min((page - 1) * pageSize + 1, total)}–${Math.min(page * pageSize, total)} of ${total}`}
      </span>
      <div className="flex items-center gap-1">
        <button onClick={() => onChange(page - 1)} disabled={page <= 1}
          className="p-1.5 rounded-lg disabled:opacity-30" style={{ color: 'var(--color-text-secondary)' }}>
          <ChevronLeft size={16} />
        </button>
        <span className="px-2 text-xs min-w-[60px] text-center" style={{ color: 'var(--color-text-secondary)' }}>
          {page} / {totalPages}
        </span>
        <button onClick={() => onChange(page + 1)} disabled={page >= totalPages}
          className="p-1.5 rounded-lg disabled:opacity-30" style={{ color: 'var(--color-text-secondary)' }}>
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

export function WorkersPage() {
  const { user } = useAuth();
  const canManage = user?.role === 'owner' || user?.role === 'production_manager';
  const canDelete  = user?.role === 'owner';

  const [params, setParams]       = useState<WorkerListParams>(DEFAULT_PARAMS);
  const [activeFilter, setActive] = useState<'all' | 'active' | 'inactive'>('active');

  const updateParams = useCallback((next: Partial<WorkerListParams>) =>
    setParams(p => ({ ...p, ...next })), []);

  function handleActiveFilter(val: 'all' | 'active' | 'inactive') {
    setActive(val);
    updateParams({
      is_active: val === 'all' ? null : val === 'active',
      page: 1,
    });
  }

  const [viewWorkerId, setViewWorkerId] = useState<number | null>(null);
  const [editWorker,   setEditWorker]   = useState<Worker | null>(null);
  const [showForm,     setShowForm]     = useState(false);

  const openView  = useCallback((w: Worker) => setViewWorkerId(w.id), []);
  const closeView = useCallback(() => setViewWorkerId(null), []);
  const handleEdit = useCallback((w: Worker) => {
    setViewWorkerId(null);
    setEditWorker(w);
    setShowForm(true);
  }, []);
  const closeForm = useCallback(() => { setShowForm(false); setEditWorker(null); }, []);

  const { data, isLoading, isError, isFetching, refetch } = useWorkersList(params);
  const rows = data?.items ?? [];

  const TH: React.CSSProperties = {
    color: 'var(--color-text-muted)',
    borderBottom: '1px solid var(--color-border)',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Workers</h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
            {data ? `${data.total.toLocaleString()} worker${data.total !== 1 ? 's' : ''}` : 'Loading…'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => void refetch()} disabled={isFetching}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border"
            style={{ backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-secondary)', borderColor: 'var(--color-border)' }}>
            {isFetching ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            Refresh
          </button>
          {canManage && (
            <button id="new-worker-btn" onClick={() => { setEditWorker(null); setShowForm(true); }}
              className="btn btn-primary">
              <Plus size={13} /> New Worker
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Department */}
        <select value={params.department ?? ''} onChange={e => updateParams({ department: e.target.value || undefined, page: 1 })}
          className="rounded-lg px-3 py-2 text-sm border outline-none cursor-pointer" style={selectStyle}>
          <option value="">All departments</option>
          {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
        </select>

        {/* Active toggle */}
        <div className="flex rounded-lg border overflow-hidden text-xs"
          style={{ borderColor: 'var(--color-border)' }}>
          {(['active', 'inactive', 'all'] as const).map(opt => (
            <button key={opt} onClick={() => handleActiveFilter(opt)}
              className="px-3 py-2 capitalize transition-colors"
              style={{
                backgroundColor: activeFilter === opt ? 'var(--color-accent-subtle)' : 'var(--color-bg-elevated)',
                color: activeFilter === opt ? 'var(--color-accent-hover)' : 'var(--color-text-secondary)',
                fontWeight: activeFilter === opt ? 600 : 400,
                borderRight: opt !== 'all' ? '1px solid var(--color-border)' : undefined,
              }}>
              {opt}
            </button>
          ))}
        </div>

        {(params.department || activeFilter !== 'active') && (
          <button onClick={() => { updateParams({ department: undefined, is_active: null, page: 1 }); setActive('active'); }}
            className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs border"
            style={{ color: 'var(--color-text-muted)', borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-elevated)' }}>
            <X size={12} /> Reset
          </button>
        )}
      </div>

      {/* Worker list table */}
      <div className="rounded-xl border overflow-hidden"
        style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                {['Name', 'Department', 'Skill', 'Status', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-xs font-medium uppercase tracking-wide" style={TH}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)}

              {isError && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-sm"
                    style={{ color: 'var(--color-danger)' }}>
                    Failed to load workers.
                  </td>
                </tr>
              )}

              {!isLoading && !isError && rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-16 text-center relative z-0">
                    <div className="absolute inset-0 pointer-events-none z-[-1]" style={{
                      backgroundImage: "url('/watermark.png')",
                      backgroundRepeat: 'repeat',
                      opacity: 0.05,
                    }} />
                    <div className="flex flex-col items-center justify-center">
                      <Users size={48} style={{ color: 'var(--color-border)' }} className="mb-4" strokeWidth={1.5} />
                      <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                        No workers match the current filters
                      </p>
                      
                    </div>
                  </td>
                </tr>
              )}

              {!isLoading && !isError && rows.map((worker, idx) => (
                <tr key={worker.id} className="transition-colors cursor-default group"
                  style={{
                    borderTop: idx > 0 ? '1px solid var(--color-border-subtle)' : undefined,
                    opacity: worker.is_active ? 1 : 0.6,
                  }}
                  onMouseEnter={e => { (e.currentTarget).style.backgroundColor = 'var(--color-bg-elevated)'; }}
                  onMouseLeave={e => { (e.currentTarget).style.backgroundColor = 'transparent'; }}>

                  <td className="px-4 py-3">
                    <button onClick={() => openView(worker)}
                      className="font-medium text-sm hover:underline"
                      style={{ color: 'var(--color-text-primary)' }}>
                      {worker.name}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                    {worker.department}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    {worker.skill ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium"
                      style={{
                        color: worker.is_active ? '#22c55e' : 'var(--color-text-muted)',
                        backgroundColor: worker.is_active ? 'rgba(34,197,94,0.1)' : 'var(--color-bg-overlay)',
                      }}>
                      {worker.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => openView(worker)} title="View detail"
                      className="p-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-all"
                      style={{ color: 'var(--color-text-secondary)' }}
                      onMouseEnter={e => { (e.currentTarget).style.backgroundColor = 'var(--color-bg-overlay)'; }}
                      onMouseLeave={e => { (e.currentTarget).style.backgroundColor = 'transparent'; }}>
                      <Eye size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!isLoading && !isError && (
          <Pagination page={params.page} pageSize={params.page_size} total={data?.total ?? 0}
            onChange={p => updateParams({ page: p })} />
        )}
      </div>

      {/* Department Productivity */}
      <div>
        <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>
          Productivity by Department
        </h3>
        <DepartmentProductivityTable />
      </div>

      {/* Drawers / modals */}
      {viewWorkerId !== null && (
        <WorkerDetailDrawer workerId={viewWorkerId} canManage={canManage} canDelete={canDelete}
          onClose={closeView} onEdit={handleEdit} />
      )}
      {showForm && <WorkerForm editWorker={editWorker} onClose={closeForm} />}
    </div>
  );
}
