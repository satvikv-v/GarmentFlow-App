import { NavLink, Outlet } from 'react-router-dom';
import { useMemo } from 'react';
import {
  LayoutDashboard,
  ShoppingCart,
  Factory,
  Package,
  Truck,
  Users,
  Send,
  LogOut,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { cn } from '../lib/utils';

const NAV_ITEMS = [
  { to: '/dashboard',      label: 'Dashboard',          icon: LayoutDashboard },
  { to: '/orders',         label: 'Orders',             icon: ShoppingCart },
  { to: '/production',     label: 'Production',         icon: Factory },
  { to: '/inventory',      label: 'Inventory',          icon: Package },
  { to: '/suppliers',      label: 'Suppliers',          icon: Truck },
  { to: '/workers',        label: 'Workers',            icon: Users },
  { to: '/dispatch',       label: 'Dispatch',           icon: Send },
  { to: '/recommendations',label: 'AI Recommendations', icon: Sparkles },
];

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  production_manager: 'Production Mgr',
  inventory_manager: 'Inventory Mgr',
  sales_executive: 'Sales Exec',
};

export function AppShell() {
  const { user, logout } = useAuth();

  // Randomly rotate the global page background watermark across garment types
  const bgImage = useMemo(() => {
    const bgs = [
      '/watermark_shirts.png',
      '/watermark_pants.png',
      '/watermark_mixed.png',
      '/watermark.png'
    ];
    return bgs[Math.floor(Math.random() * bgs.length)];
  }, []);

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: 'var(--color-bg-base)' }}>
      {/* ── Sidebar ────────────────────────────────────────────────────── */}
      <aside
        className="flex flex-col w-56 shrink-0 border-r"
        style={{
          backgroundColor: 'var(--color-bg-surface)',
          borderColor: 'var(--color-border)',
          boxShadow: '1px 0 0 var(--color-border)',
        }}
      >
        {/* Brand */}
        <div
          className="flex items-center gap-2.5 px-4 py-4 border-b"
          style={{ borderColor: 'var(--color-border)' }}
        >
          {/* Monogram uses accent color */}
          <div
            className="w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold text-white shrink-0"
            style={{ backgroundColor: 'var(--color-accent)' }}
          >
            GF
          </div>
          <div>
            <p
              className="font-semibold tracking-tight leading-none"
              style={{ fontSize: '0.875rem', color: 'var(--color-text-primary)' }}
            >
              GarmentFlow
            </p>
            <p style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', marginTop: 1 }}>
              Factory Management
            </p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-2 px-2 space-y-0.5 overflow-y-auto relative z-0">
          <div className="absolute inset-0 pointer-events-none z-[-1]" style={{
            backgroundImage: "url('/watermark.png')",
            backgroundRepeat: 'repeat',
            opacity: 0.2,
            maskImage: 'linear-gradient(to top, black 0%, transparent 60%)',
            WebkitMaskImage: 'linear-gradient(to top, black 0%, transparent 60%)'
          }} />
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors duration-100',
                  isActive ? 'nav-link-active' : 'nav-link-hover'
                )
              }
              style={({ isActive }) =>
                isActive ? undefined : { color: 'var(--color-text-secondary)' }
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    size={15}
                    strokeWidth={isActive ? 2 : 1.75}
                    style={{ color: isActive ? 'var(--color-accent)' : 'var(--color-text-muted)', flexShrink: 0 }}
                  />
                  <span className="flex-1" style={{ fontSize: '0.8125rem' }}>{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User */}
        <div className="p-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
          <div
            className="flex items-center gap-2.5 px-2.5 py-2 rounded-md mb-1"
            style={{ backgroundColor: 'var(--color-bg-elevated)' }}
          >
            {/* Avatar initials */}
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 text-white"
              style={{ backgroundColor: 'var(--color-accent)' }}
            >
              {user?.full_name?.charAt(0) ?? '?'}
            </div>
            <div className="overflow-hidden flex-1">
              <p
                className="text-xs font-medium truncate"
                style={{ color: 'var(--color-text-primary)' }}
              >
                {user?.full_name}
              </p>
              <p className="text-caption truncate">
                {user?.role ? ROLE_LABELS[user.role] : ''}
              </p>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs transition-colors hover:bg-[var(--color-bg-elevated)]"
            style={{ color: 'var(--color-text-muted)' }}
          >
            <LogOut size={13} />
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Main ───────────────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Top bar */}
        <header
          className="flex items-center justify-between px-6 py-3 border-b shrink-0 relative z-0"
          style={{
            backgroundColor: 'var(--color-bg-surface)',
            borderColor: 'var(--color-border)',
          }}
        >
          {/* Top header watermark fading out on left/right to avoid UI elements */}
          <div className="absolute inset-0 pointer-events-none z-[-1]" style={{
            backgroundImage: "url('/watermark_mixed.png')",
            backgroundRepeat: 'repeat',
            opacity: 0.2,
            maskImage: 'linear-gradient(to right, transparent 5%, black 40%, black 60%, transparent 95%)',
            WebkitMaskImage: 'linear-gradient(to right, transparent 5%, black 40%, black 60%, transparent 95%)'
          }} />
          <div />
          <div className="flex items-center gap-3">
            <span
              className="badge badge-accent"
              style={{ fontSize: '0.6875rem' }}
            >
              {user?.role ? ROLE_LABELS[user.role] : ''}
            </span>
            <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
              {user?.full_name}
            </span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6 relative z-0" style={{ backgroundColor: 'var(--color-bg-base)' }}>
          {/* Global page background watermark */}
          <div className="absolute inset-0 pointer-events-none z-[-1]" style={{
            backgroundImage: `url('${bgImage}')`,
            backgroundRepeat: 'repeat',
            opacity: 0.15,
          }} />
          <Outlet />
        </main>
      </div>
    </div>
  );
}
