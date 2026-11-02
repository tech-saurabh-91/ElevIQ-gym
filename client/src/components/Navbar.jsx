import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useLocale, LANGUAGES, CURRENCIES } from '../lib/i18n';
import { useAuth } from '../lib/auth';

function Logo({ compact = false }) {
  return (
    <Link to="/" className="group flex items-center gap-3">
      <span className="relative grid h-10 w-10 place-items-center">
        <span className="absolute inset-0 rounded-xl bg-gradient-to-br from-mint via-violet to-coral opacity-90 transition group-hover:opacity-100" />
        <span className="absolute inset-[2px] rounded-[10px] bg-void" />
        <svg className="relative" width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10" stroke="url(#lg)" strokeWidth="2.2" strokeLinecap="round" />
          <defs>
            <linearGradient id="lg" x1="4" y1="7" x2="20" y2="17" gradientUnits="userSpaceOnUse">
              <stop stopColor="#00E5A0" />
              <stop offset="1" stopColor="#FF4D6D" />
            </linearGradient>
          </defs>
        </svg>
      </span>
      {!compact && (
        <span className="font-display text-lg font-bold tracking-tight">
          GYM<span className="text-mint">FLOW</span>
        </span>
      )}
    </Link>
  );
}

function LocaleMenu({ compact = false }) {
  const { lang, currency, setLocale, t, languages, currencies, country } = useLocale();
  const [open, setOpen] = useState(false);
  const langLabel = languages.find((l) => l.code === lang)?.flag || 'EN';

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-2 rounded-full border border-white/12 bg-white/5 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted transition hover:border-mint/50 hover:text-bone ${compact ? '' : ''}`}
        aria-label={t('common.country')}
      >
        <span className="text-mint">{langLabel}</span>
        <span className="h-3 w-px bg-white/15" />
        <span>{currency}</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -8, rotateX: -12 }}
              animate={{ opacity: 1, y: 0, rotateX: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              style={{ transformPerspective: 900 }}
              className="glass-strong absolute end-0 z-50 mt-3 w-[300px] overflow-hidden rounded-2xl p-3 shadow-card"
            >
              <p className="label px-2 pt-1">{t('common.language')}</p>
              <div className="grid grid-cols-2 gap-1.5">
                {languages.map((l) => (
                  <button
                    key={l.code}
                    onClick={() => setLocale({ lang: l.code })}
                    className={`rounded-lg px-3 py-2 text-start text-xs font-medium transition ${
                      lang === l.code ? 'bg-mint text-void' : 'bg-white/5 text-muted hover:bg-white/10 hover:text-bone'
                    }`}
                    dir={l.dir}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
              <p className="label px-2 pb-1 pt-4">{t('common.country')}</p>
              <div className="max-h-[190px] overflow-y-auto scrollbar-thin">
                {currencies.map((c) => (
                  <button
                    key={c.code}
                    onClick={() => setLocale({ currency: c.code })}
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs transition ${
                      currency === c.code ? 'bg-violet/25 text-bone' : 'text-muted hover:bg-white/8 hover:text-bone'
                    }`}
                  >
                    <span>{c.country}</span>
                    <span className="font-mono">
                      {c.symbol} {c.code}
                    </span>
                  </button>
                ))}
              </div>
              <p className="mt-3 border-t border-white/10 px-2 pt-3 text-[10px] leading-relaxed text-muted">
                Prices are converted from a USD base rate for display. {country ? `Detected: ${country}.` : ''}
              </p>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Navbar() {
  const { t } = useLocale();
  const { user, isAuthenticated, logout } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => setOpen(false), [location.pathname]);

  const links = [
    { to: '/', label: t('nav.home') },
    { to: '/about', label: t('nav.about') },
    { to: '/gallery', label: t('nav.gallery') },
    { to: '/contact', label: t('nav.contact') },
  ];

  const appLink = user?.role === 'member' ? '/app/membership' : '/app';

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-[80] transition-all duration-500 ${
          scrolled ? 'glass-strong border-b border-white/10 py-2.5 shadow-card' : 'border-b border-transparent py-4'
        }`}
      >
        <div className="container-x flex items-center justify-between gap-4">
          <Logo />

          <nav className="hidden items-center gap-1 lg:flex">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.to === '/'}
                className={({ isActive }) =>
                  `relative rounded-full px-4 py-2 text-sm font-medium transition ${
                    isActive ? 'text-mint' : 'text-muted hover:text-bone'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {l.label}
                    {isActive && (
                      <motion.span layoutId="navdot" className="absolute inset-x-4 -bottom-0.5 h-px bg-mint shadow-glow" />
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2.5">
            <LocaleMenu />
            {isAuthenticated ? (
              <button onClick={() => navigate(appLink)} className="btn-primary hidden !px-5 !py-2.5 sm:inline-flex">
                {t('nav.dashboard')}
              </button>
            ) : (
              <>
                <Link to="/signin" className="hidden text-sm font-medium text-muted transition hover:text-bone sm:block">
                  {t('nav.signin')}
                </Link>
                <Link to="/register" className="btn-primary hidden !px-5 !py-2.5 sm:inline-flex">
                  {t('nav.register')}
                </Link>
              </>
            )}
            {isAuthenticated && (
              <button
                onClick={() => {
                  logout();
                  navigate('/');
                }}
                className="hidden rounded-full border border-white/12 px-4 py-2 text-xs font-semibold text-muted transition hover:border-coral/50 hover:text-coral sm:block"
              >
                {t('nav.logout')}
              </button>
            )}
            <button
              onClick={() => setOpen((v) => !v)}
              className="grid h-10 w-10 place-items-center rounded-xl border border-white/12 bg-white/5 text-bone lg:hidden"
              aria-label={t('nav.menu')}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                {open ? <path d="M18 6L6 18M6 6l12 12" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
              </svg>
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -18 }}
            transition={{ duration: 0.24 }}
            className="glass-strong fixed inset-x-3 top-[74px] z-[79] rounded-3xl p-5 shadow-card lg:hidden"
          >
            <div className="flex flex-col gap-1">
              {links.map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  end={l.to === '/'}
                  className={({ isActive }) =>
                    `rounded-xl px-4 py-3 text-base font-medium transition ${
                      isActive ? 'bg-mint/12 text-mint' : 'text-muted hover:bg-white/5 hover:text-bone'
                    }`
                  }
                >
                  {l.label}
                </NavLink>
              ))}
            </div>
            <div className="mt-4 flex flex-col gap-2 border-t border-white/10 pt-4">
              {isAuthenticated ? (
                <>
                  <Link to={appLink} className="btn-primary w-full">
                    {t('nav.dashboard')}
                  </Link>
                  <button
                    onClick={() => {
                      logout();
                      navigate('/');
                    }}
                    className="btn-ghost w-full"
                  >
                    {t('nav.logout')}
                  </button>
                </>
              ) : (
                <>
                  <Link to="/register" className="btn-primary w-full">
                    {t('nav.register')}
                  </Link>
                  <Link to="/signin" className="btn-ghost w-full">
                    {t('nav.signin')}
                  </Link>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export { Logo, LocaleMenu };
