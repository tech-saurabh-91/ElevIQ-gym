import { useEffect, useState } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import {
  BarChart3, Boxes, CalendarDays, ClipboardList, CreditCard, Dumbbell, ExternalLink, Gauge, Globe, History, LogOut, Menu,
  Moon, Package, ScanLine, Settings, ShieldCheck, Sparkles, Tag, UserPlus, Users, X, Sun, Wand2,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useAdminTheme, useSite } from '@/lib/site';
import { cx } from '@/components/ui';
import { Logo } from '@/site/SiteLayout';
import type { Permission } from '@/lib/types';

type Item = { to: string; label: string; icon: React.ElementType; perms: Permission[]; end?: boolean };
type Group = { label: string; items: Item[] };

/** Menus are drawn from the server-issued permission list. The server enforces the same rules. */
export const NAV: Group[] = [
  { label: '', items: [{ to: '/admin', label: 'Dashboard', icon: Gauge, perms: ['dashboard.view'], end: true }] },
  {
    label: 'Website',
    items: [
      { to: '/admin/website', label: 'Branding & content', icon: Globe, perms: ['website.manage'], end: true },
      { to: '/admin/website/publish', label: 'Publish & history', icon: History, perms: ['website.manage'] },
      { to: '/admin/offers', label: 'Offers', icon: Tag, perms: ['offers.manage'] },
    ],
  },
  {
    label: 'Gym',
    items: [
      { to: '/admin/members', label: 'Members', icon: Users, perms: ['members.read'] },
      { to: '/admin/leads', label: 'Leads', icon: UserPlus, perms: ['leads.read', 'leads.manage'] },
      { to: '/admin/plans', label: 'Plans & pricing', icon: Sparkles, perms: ['plans.manage'] },
      { to: '/admin/checkins', label: 'Check-in desk', icon: ScanLine, perms: ['checkins.manage'] },
      { to: '/admin/classes', label: 'Classes', icon: CalendarDays, perms: ['classes.read', 'classes.manage'] },
      { to: '/admin/equipment', label: 'Equipment', icon: Dumbbell, perms: ['equipment.manage'] },
      { to: '/admin/retail', label: 'Retail / POS', icon: Package, perms: ['retail.manage'] },
    ],
  },
  {
    label: 'Money',
    items: [
      { to: '/admin/billing', label: 'Invoices & payments', icon: CreditCard, perms: ['billing.read', 'payments.record'] },
      { to: '/admin/expenses', label: 'Expenses', icon: Boxes, perms: ['expenses.manage'] },
      { to: '/admin/reports', label: 'Reports', icon: BarChart3, perms: ['reports.read', 'billing.read'] },
    ],
  },
  {
    label: 'Admin',
    items: [
      { to: '/admin/staff', label: 'Staff & roles', icon: ShieldCheck, perms: ['staff.manage'] },
      { to: '/admin/settings', label: 'Business settings', icon: Settings, perms: ['settings.manage'] },
      { to: '/admin/setup', label: 'Setup wizard', icon: Wand2, perms: ['settings.manage'] },
      { to: '/admin/audit', label: 'Activity log', icon: ClipboardList, perms: ['audit.read'] },
    ],
  },
];

export function firstAllowed(can: (...p: Permission[]) => boolean) {
  for (const g of NAV) for (const i of g.items) if (can(...i.perms)) return i.to;
  return '/admin/account';
}

export default function AdminLayout() {
  const { session, loading, can, logout } = useAuth();
  const { mode, toggleMode, site } = useSite();
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => setOpen(false), [loc.pathname]);
  // The admin panel always uses the standard scheme; only the gym's logo and name are shown.
  useAdminTheme();
  const brand = site?.site.brand;

  if (loading) return null;
  if (!session) return <Navigate to="/login" state={{ from: loc.pathname }} replace />;
  if (session.user.role === 'member') return <Navigate to="/portal" replace />;
  if (loc.pathname === '/admin' && !can('dashboard.view')) return <Navigate to={firstAllowed(can)} replace />;

  const sidebar = (
    <nav className="flex h-full flex-col" aria-label="Admin">
      <div className="flex h-16 items-center justify-between gap-2 px-5">
        <Link to="/admin" className="flex min-w-0 items-center gap-2.5" aria-label={`${brand?.name ?? 'Gym'} admin home`}>
          {brand?.logoUrl ? <img src={mode === 'dark' && brand.logoDarkUrl ? brand.logoDarkUrl : brand.logoUrl} alt="" className="h-8 w-auto max-w-[96px] object-contain" /> : null}
          <span className="truncate text-sm font-bold text-ink">{brand?.name}</span>
        </Link>
        <button className="lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu"><X className="h-5 w-5" /></button>
      </div>
      <div className="flex-1 overflow-y-auto px-3 pb-4">
        {NAV.map((g) => {
          const items = g.items.filter((i) => can(...i.perms));
          if (!items.length) return null;
          return (
            <div key={g.label || 'main'} className="mt-4">
              {g.label && <p className="px-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-muted">{g.label}</p>}
              {items.map((i) => (
                <NavLink
                  key={i.to}
                  to={i.to}
                  end={i.end}
                  className={({ isActive }) => cx('flex items-center gap-3 rounded-brand px-3 py-2 text-sm font-medium transition', isActive ? 'bg-primary/10 text-link' : 'text-muted hover:bg-surface2 hover:text-ink')}
                >
                  <i.icon className="h-4 w-4" /> {i.label}
                </NavLink>
              ))}
            </div>
          );
        })}
      </div>
      <div className="border-t border-line p-3">
        <Link to="/admin/account" className="flex items-center gap-3 rounded-brand px-3 py-2 hover:bg-surface2">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-primary text-xs font-bold text-on-primary">{session.user.name.slice(0, 1)}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-ink">{session.user.name}</span>
            <span className="block truncate text-xs text-muted">{session.user.roleLabel}</span>
          </span>
        </Link>
        <div className="mt-2 flex gap-1">
          <a href="/" target="_blank" rel="noopener" className="flex flex-1 items-center justify-center gap-1.5 rounded-brand py-2 text-xs text-muted hover:bg-surface2 hover:text-ink"><ExternalLink className="h-3.5 w-3.5" />Site</a>
          <button onClick={toggleMode} className="flex flex-1 items-center justify-center gap-1.5 rounded-brand py-2 text-xs text-muted hover:bg-surface2 hover:text-ink">{mode === 'dark' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}Theme</button>
          <button onClick={logout} className="flex flex-1 items-center justify-center gap-1.5 rounded-brand py-2 text-xs text-muted hover:bg-surface2 hover:text-ink"><LogOut className="h-3.5 w-3.5" />Sign out</button>
        </div>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-bg text-ink">
      {session.impersonatedBy && (
        <div className="bg-amber-400 px-4 py-1.5 text-center text-xs font-bold text-black">Support session by {session.impersonatedBy} - every action is logged.</div>
      )}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-line bg-surface lg:block">{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-surface shadow-xl">{sidebar}</aside>
        </div>
      )}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-line bg-bg/90 px-4 backdrop-blur lg:hidden">
          <button onClick={() => setOpen(true)} aria-label="Open menu"><Menu className="h-5 w-5" /></button>
          <Logo className="h-7" />
        </header>
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8"><Outlet /></main>
      </div>
    </div>
  );
}

export function RequirePerm({ perms, children }: { perms: Permission[]; children: React.ReactNode }) {
  const { can } = useAuth();
  if (!can(...perms)) return <div className="py-20 text-center text-sm text-muted">You don't have access to this page.</div>;
  return <>{children}</>;
}
