import { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '../../lib/auth';
import { useLocale } from '../../lib/i18n';
import { Logo, LocaleMenu } from '../../components/Navbar';
import api from '../../lib/api';

const NAV = [
  { to: '/app', label: 'Overview', icon: 'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z', roles: ['admin', 'trainer'] },
  { to: '/app/membership', label: 'My membership', icon: 'M12 12a5 5 0 100-10 5 5 0 000 10zm0 2c-5 0-9 2.5-9 6v2h18v-2c0-3.5-4-6-9-6z', roles: ['member'] },
  { to: '/app/members', label: 'Members', icon: 'M17 20v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9.5 10a4 4 0 100-8 4 4 0 000 8zM22 20v-2a4 4 0 00-3-3.9M16 2.1a4 4 0 010 7.8', roles: ['admin', 'trainer'] },
  { to: '/app/staff', label: 'Staff', icon: 'M20 7h-4V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2zM10 5h4v2h-4V5z', roles: ['admin'] },
  { to: '/app/classes', label: 'Classes', icon: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z', roles: ['admin', 'trainer', 'member'] },
  { to: '/app/my-classes', label: 'My bookings', icon: 'M20 6L9 17l-5-5', roles: ['member'] },
  { to: '/app/equipment', label: 'Equipment', icon: 'M6.5 6.5l11 11M4 10l-1-1 4-4 1 1M14 20l1 1-4 4-1-1M2 6l4-4 4 4-1 1', roles: ['admin', 'trainer'] },
  { to: '/app/finance', label: 'Finance', icon: 'M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6', roles: ['admin'] },
  { to: '/app/checkins', label: 'Check-ins', icon: 'M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11', roles: ['admin', 'trainer'] },
  { to: '/app/reports', label: 'Reports', icon: 'M3 3v18h18M7 15l4-4 3 3 5-6', roles: ['admin', 'trainer'] },
  { to: '/app/inbox', label: 'Inbox & campaigns', icon: 'M4 4h16v16H4zM4 7l8 6 8-6', roles: ['admin'] },
  { to: '/app/settings', label: 'Settings', icon: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.6 1.6 0 00-1.8-.3 1.6 1.6 0 00-1 1.5V21a2 2 0 11-4 0v-.1A1.6 1.6 0 007 19.4a1.6 1.6 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.6 1.6 0 00.3-1.8 1.6 1.6 0 00-1.5-1H1a2 2 0 110-4h.1A1.6 1.6 0 002.6 7a1.6 1.6 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.6 1.6 0 001.8.3H7a1.6 1.6 0 001-1.5V1a2 2 0 114 0v.1a1.6 1.6 0 001 1.5 1.6 1.6 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.6 1.6 0 00-.3 1.8V7a1.6 1.6 0 001.5 1H21a2 2 0 110 4h-.1a1.6 1.6 0 00-1.5 1z', roles: ['admin', 'trainer', 'member'] },
];

function Icon({ d }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

export default function DashboardLayout() {
  const { user, logout, loading } = useAuth();
  const { t, money } = useLocale();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!user) return;
    api.get('/notifications').then((r) => setNotifications(r.data)).catch(() => {});
  }, [user, location.pathname]);

  useEffect(() => setOpen(false), [location.pathname]);

  const items = useMemo(() => NAV.filter((n) => !n.roles || n.roles.includes(user?.role)), [user]);

  if (loading) return <div className="grid min-h-screen place-items-center bg-void text-muted">Restoring session…</div>;
  if (!user) return <Navigate to="/signin" replace />;
  if (location.pathname === '/app' && user.role === 'member') return <Navigate to="/app/membership" replace />;

  const unread = notifications.filter((n) => !n.read).length;
  const initials = user.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="px-5 py-5">
        <Logo />
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4 scrollbar-thin">
        {items.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.to === '/app'}
            className={({ isActive }) =>
              `group flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition ${
                isActive ? 'bg-mint/12 text-mint shadow-[inset_0_0_0_1px_rgba(0,229,160,0.25)]' : 'text-muted hover:bg-white/5 hover:text-bone'
              }`
            }
          >
            <span className="transition group-hover:scale-110">
              <Icon d={n.icon} />
            </span>
            {n.label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-white/10 p-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-mint to-violet font-display text-xs font-black text-void">
              {initials}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{user.name}</p>
              <p className="truncate text-[11px] uppercase tracking-widest text-mint">{user.role}</p>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <Link to="/app/settings" className="flex-1 rounded-lg border border-white/10 px-2 py-1.5 text-center text-[11px] text-muted transition hover:border-mint/40 hover:text-bone">
              Settings
            </Link>
            <button
              onClick={() => {
                logout();
                navigate('/');
              }}
              className="flex-1 rounded-lg border border-white/10 px-2 py-1.5 text-[11px] text-muted transition hover:border-coral/50 hover:text-coral"
            >
              Log out
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const page = items.find((n) => location.pathname.startsWith(n.to) && n.to !== '/app')?.label || 'Overview';

  return (
    <div className="relative min-h-screen bg-void">
      <div className="pointer-events-none fixed inset-0 bg-radial-fade opacity-40" />

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 start-0 z-40 hidden w-[250px] border-e border-white/10 bg-ink/90 backdrop-blur-xl lg:block">
        {sidebar}
      </aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              className="fixed inset-y-0 start-0 z-50 w-[270px] border-e border-white/10 bg-ink lg:hidden"
            >
              {sidebar}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="lg:ps-[250px]">
        {/* Topbar */}
        <header className="sticky top-0 z-30 border-b border-white/10 bg-void/85 backdrop-blur-xl">
          <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
            <button
              onClick={() => setOpen((v) => !v)}
              className="grid h-9 w-9 place-items-center rounded-xl border border-white/12 bg-white/5 lg:hidden"
              aria-label="menu"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </button>

            <div className="hidden sm:block">
              <p className="text-[10px] uppercase tracking-[0.24em] text-muted">GymFlow Console</p>
              <h1 className="font-display text-lg font-bold leading-tight">{page}</h1>
            </div>

            <div className="ms-auto flex items-center gap-2.5">
              <span className="hidden font-mono text-xs text-muted md:block">
                {now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} local
              </span>

              <LocaleMenu />

              <div className="relative">
                <button
                  onClick={() => setNotifOpen((v) => !v)}
                  className="relative grid h-9 w-9 place-items-center rounded-xl border border-white/12 bg-white/5 text-muted transition hover:text-bone"
                  aria-label="notifications"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0" />
                  </svg>
                  {unread > 0 && (
                    <span className="absolute -end-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-coral px-1 text-[9px] font-bold text-white">
                      {unread}
                    </span>
                  )}
                </button>
                <AnimatePresence>
                  {notifOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setNotifOpen(false)} />
                      <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        className="glass-strong absolute end-0 z-50 mt-3 w-[320px] overflow-hidden rounded-2xl shadow-card"
                      >
                        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                          <p className="text-sm font-semibold">Notifications</p>
                          <button
                            onClick={() => api.post('/notifications/read').then(() => setNotifications((n) => n.map((x) => ({ ...x, read: true }))))}
                            className="text-[11px] text-mint hover:underline"
                          >
                            Mark all read
                          </button>
                        </div>
                        <div className="max-h-80 overflow-y-auto scrollbar-thin">
                          {notifications.length === 0 && <p className="p-6 text-center text-xs text-muted">You are all caught up.</p>}
                          {notifications.map((n) => (
                            <div key={n._id} className={`border-b border-white/[0.06] px-4 py-3 ${n.read ? '' : 'bg-mint/[0.05]'}`}>
                              <p className="text-sm font-medium">{n.title}</p>
                              <p className="mt-1 text-xs text-muted">{n.body}</p>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>

              <Link
                to="/"
                className="hidden rounded-xl border border-white/12 bg-white/5 px-3 py-2 text-xs font-semibold text-muted transition hover:border-mint/50 hover:text-bone sm:block"
              >
                View site
              </Link>
            </div>
          </div>
        </header>

        <main className="relative px-4 py-6 sm:px-6 sm:py-8">
          <Outlet context={{ money, t }} />
        </main>
      </div>
    </div>
  );
}
