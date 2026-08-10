import { getGarmentImage } from '../lib/imageMap';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../lib/api';
import type { DashboardSummary, DashboardLowStockItem } from '../types';
import {
  ShoppingCart,
  Clock,
  AlertTriangle,
  Send,
  Zap,
  Settings,
  Heart,
  TrendingUp,
  TrendingDown,
  PackageOpen,
  Loader2,
  RefreshCw,
  BarChart3,
} from 'lucide-react';

// ---- API fetch ---------------------------------------------------------------

async function fetchDashboard(): Promise<DashboardSummary> {
  const { data } = await apiClient.get<DashboardSummary>('/dashboard/summary');
  return data;
}

// ---- Sub-components ---------------------------------------------------------

interface KpiCardProps {
  label: string;
  value: string | number;
  icon: React.ElementType;
  sublabel?: string;
  trend?: 'up' | 'down' | 'neutral';
  isHero?: boolean;
}

function KpiCard({ label, value, icon: Icon, sublabel, trend, isHero }: KpiCardProps) {
  const textMain = isHero ? 'var(--color-accent)' : 'var(--color-text-primary)';

  return (
    <div
      className="rounded-xl border p-5 flex flex-col gap-3 transition-all duration-200 hover:border-opacity-80"
      style={{
        backgroundColor: 'var(--color-bg-surface)',
        borderColor: 'var(--color-border)',
        borderLeftWidth: isHero ? 4 : 1,
        borderLeftColor: isHero ? 'var(--color-accent)' : 'var(--color-border)',
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.borderTopColor = 'var(--color-accent-border)';
        el.style.borderRightColor = 'var(--color-accent-border)';
        el.style.borderBottomColor = 'var(--color-accent-border)';
        if (!isHero) el.style.borderLeftColor = 'var(--color-accent-border)';
        el.style.boxShadow = '0 4px 20px var(--color-accent-subtle), 0 0 0 1px var(--color-accent-subtle)';
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.borderTopColor = 'var(--color-border)';
        el.style.borderRightColor = 'var(--color-border)';
        el.style.borderBottomColor = 'var(--color-border)';
        if (!isHero) el.style.borderLeftColor = 'var(--color-border)';
        el.style.boxShadow = 'none';
      }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium tracking-wide uppercase" style={{ color: 'var(--color-text-muted)' }}>
          {label}
        </span>
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center"
          style={{ backgroundColor: 'var(--color-accent-subtle)' }}
        >
          <Icon size={15} style={{ color: 'var(--color-accent)' }} />
        </div>
      </div>
      <div>
        <p className="text-3xl font-bold tracking-tight" style={{ color: textMain }}>
          {value}
        </p>
        {sublabel && (
          <div className="flex items-center gap-1 mt-1.5">
            {trend === 'up' && <TrendingUp size={12} style={{ color: 'var(--color-success)' }} />}
            {trend === 'down' && <TrendingDown size={12} style={{ color: 'var(--color-danger)' }} />}
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {sublabel}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function LowStockRow({ item, index }: { item: DashboardLowStockItem; index: number }) {
  const pct = item.minimum_stock > 0
    ? Math.min(100, (item.current_stock / item.minimum_stock) * 100)
    : 100;

  const barColor = pct < 25
    ? 'var(--color-danger)'
    : pct < 50
    ? 'var(--color-warning)'
    : 'var(--color-success)';

  return (
    <tr
      style={{
        borderBottom: index === 0 ? undefined : '1px solid var(--color-border-subtle)',
      }}
    >
      <td className="py-3 pr-4">
        <div className="flex items-center gap-2.5">
          <PackageOpen size={14} style={{ color: 'var(--color-text-muted)' }} />
          <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
            {item.name}
          </span>
        </div>
      </td>
      <td className="py-3 pr-4 text-right">
        <span className="text-sm tabular-nums" style={{ color: 'var(--color-danger)' }}>
          {item.current_stock.toLocaleString()}
        </span>
      </td>
      <td className="py-3 pr-4 text-right">
        <span className="text-sm tabular-nums" style={{ color: 'var(--color-text-secondary)' }}>
          {item.minimum_stock.toLocaleString()}
        </span>
      </td>
      <td className="py-3 pl-2 w-28">
        <div
          className="w-full rounded-full h-1.5"
          style={{ backgroundColor: 'var(--color-bg-elevated)' }}
        >
          <div
            className="h-1.5 rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, backgroundColor: barColor }}
          />
        </div>
        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          {pct.toFixed(0)}% of min
        </span>
      </td>
    </tr>
  );
}

function EfficiencyGauge({ value, label, color }: { value: number; label: string; color: string }) {
  const circumference = 2 * Math.PI * 38; // r=38
  const dash = (value / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-24 h-24">
        <svg width="96" height="96" className="-rotate-90">
          <circle
            cx="48" cy="48" r="38"
            fill="none"
            stroke="var(--color-bg-elevated)"
            strokeWidth="8"
          />
          <circle
            cx="48" cy="48" r="38"
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference - dash}`}
            style={{ transition: 'stroke-dasharray 1s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>
            {value.toFixed(0)}%
          </span>
        </div>
      </div>
      <span className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
        {label}
      </span>
    </div>
  );
}

// ---- Skeleton ---------------------------------------------------------------

function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 7 }).map((_, i) => (
          <div
            key={i}
            className="h-28 rounded-xl"
            style={{ backgroundColor: 'var(--color-bg-surface)' }}
          />
        ))}
      </div>
      <div
        className="h-56 rounded-xl"
        style={{ backgroundColor: 'var(--color-bg-surface)' }}
      />
    </div>
  );
}

// ---- Main page --------------------------------------------------------------

export function DashboardPage() {
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['dashboard'],
    queryFn: fetchDashboard,
    refetchInterval: 30_000, // auto-refresh every 30 s
    staleTime: 10_000,
  });

  if (isLoading) return <DashboardSkeleton />;

  if (isError) {
    return (
      <div
        className="rounded-xl border p-8 flex flex-col items-center gap-4 text-center"
        style={{
          backgroundColor: 'var(--color-bg-surface)',
          borderColor: 'rgba(239,68,68,0.3)',
        }}
      >
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center"
          style={{ backgroundColor: 'var(--color-danger-subtle)' }}
        >
          <AlertTriangle size={22} style={{ color: 'var(--color-danger)' }} />
        </div>
        <div>
          <p className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            Failed to load dashboard
          </p>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
            {(error as Error)?.message ?? 'Network error — check that the backend is running.'}
          </p>
        </div>
        <button
          onClick={() => void refetch()}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          style={{
            backgroundColor: 'var(--color-bg-elevated)',
            color: 'var(--color-text-primary)',
            border: '1px solid var(--color-border)',
          }}
        >
          <RefreshCw size={14} />
          Retry
        </button>
      </div>
    );
  }

  const d = data!;
  const heroKey = d.delayed_orders_count > 0 ? 'delayed' : 'near_deadline';

  return (
    <div className="space-y-6">
      {/* ── Main Dashboard Layout ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        
        {/* Left Content Column */}
        <div className="xl:col-span-3 space-y-6">
          
          {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
            Dashboard
          </h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
            Factory snapshot &mdash; live data
          </p>
        </div>
        <button
          onClick={() => void refetch()}
          disabled={isFetching}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border"
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
      </div>

      {/* ── KPI Cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Active Orders"
          value={d.active_orders_count}
          icon={ShoppingCart}
          sublabel="not delivered or cancelled"
        />
        <KpiCard
          label="Near Deadline"
          value={d.orders_near_deadline}
          icon={Clock}
          sublabel="due in ≤ 3 days"
          trend={d.orders_near_deadline > 5 ? 'down' : 'neutral'}
          isHero={heroKey === 'near_deadline'}
        />
        <KpiCard
          label="Delayed Orders"
          value={d.delayed_orders_count}
          icon={AlertTriangle}
          sublabel="batch or stage delayed"
          trend={d.delayed_orders_count > 0 ? 'down' : 'neutral'}
          isHero={heroKey === 'delayed'}
        />
        <KpiCard
          label="Pending Dispatch"
          value={d.pending_dispatch_count}
          icon={Send}
          sublabel="ready for dispatch"
        />
      </div>

      {/* ── Production row ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <KpiCard
          label="Today's Production"
          value={d.todays_production.toLocaleString()}
          icon={Zap}
          sublabel="units completed today"
        />
        <KpiCard
          label="Weekly Production"
          value={d.weekly_production.toLocaleString()}
          icon={BarChart3}
          sublabel="last 7 days"
        />
        <KpiCard
          label="Monthly Production"
          value={d.monthly_production.toLocaleString()}
          icon={TrendingUp}
          sublabel="last 30 days"
        />
      </div>

        </div> {/* End of space-y-6 left column */}
        
        {/* Right Hero Image Column */}
        <div className="hidden xl:block rounded-2xl overflow-hidden relative shadow-sm border h-full min-h-[400px]" style={{ borderColor: 'var(--color-border)' }}>
          <img 
            src="/img_colourful.png"
            alt="Factory Operations" 
            className="absolute inset-0 w-full h-full object-cover"
          />
          {/* Gradient Overlay for text readability */}
          <div 
            className="absolute inset-0" 
            style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.2) 50%, transparent 100%)' }}
          />
          {/* Editorial Content */}
          <div className="absolute inset-x-0 bottom-0 p-6 flex flex-col justify-end">
            <span className="text-xs font-bold tracking-wider uppercase text-white/70 mb-2">Operations</span>
            <h3 className="text-white font-bold text-2xl mb-1.5 leading-tight">Winter Collection Active</h3>
            <p className="text-white/80 text-sm leading-relaxed">
              Factory throughput is optimized. Expecting high volume over the next 14 days as seasonal batches ramp up.
            </p>
          </div>
        </div>

      </div> {/* End of main grid layout */}

      {/* ── Quality + Low Stock ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Efficiency gauges */}
        <div
          className="rounded-xl border p-5 flex flex-col gap-4"
          style={{
            backgroundColor: 'var(--color-bg-surface)',
            borderColor: 'var(--color-border)',
          }}
        >
          <div className="flex items-center gap-2">
            <Settings size={14} style={{ color: 'var(--color-text-muted)' }} />
            <span className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
              Quality Indicators
            </span>
          </div>
          <div className="flex justify-around py-2">
            <EfficiencyGauge
              value={d.factory_efficiency}
              label="Factory Efficiency"
              color={d.factory_efficiency >= 80 ? 'var(--color-success)' : d.factory_efficiency >= 60 ? 'var(--color-warning)' : 'var(--color-danger)'}
            />
            <EfficiencyGauge
              value={d.inventory_health}
              label="Inventory Health"
              color={d.inventory_health >= 80 ? 'var(--color-success)' : d.inventory_health >= 60 ? 'var(--color-warning)' : 'var(--color-danger)'}
            />
          </div>
        </div>

        {/* Low stock table */}
        <div
          className="rounded-xl border p-5 col-span-1 lg:col-span-2"
          style={{
            backgroundColor: 'var(--color-bg-surface)',
            borderColor: 'var(--color-border)',
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Heart size={14} style={{ color: 'var(--color-danger)' }} />
              <span className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
                Low Stock Materials
              </span>
            </div>
            <span
              className="text-xs px-2 py-0.5 rounded-full"
              style={{
                backgroundColor: 'var(--color-danger-subtle)',
                color: 'var(--color-danger)',
              }}
            >
              {d.low_stock_materials.length} item{d.low_stock_materials.length !== 1 ? 's' : ''}
            </span>
          </div>

          {d.low_stock_materials.length === 0 ? (
            <div className="flex flex-col items-center py-6 gap-2">
              <PackageOpen size={28} style={{ color: 'var(--color-text-muted)' }} />
              <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                All inventory items are well-stocked
              </p>
            </div>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr>
                  {['Item', 'Current', 'Minimum', 'Level'].map((h) => (
                    <th
                      key={h}
                      className={`pb-2 text-xs font-medium uppercase tracking-wide ${h !== 'Item' ? 'text-right' : ''}`}
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {d.low_stock_materials.map((item, i) => (
                  <LowStockRow key={item.id} item={item} index={i} />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
