import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useLocale } from '../lib/i18n';
import { useToast } from './ui';

const COLS = [
  {
    titleKey: 'footer.product',
    links: [
      { label: 'Member management', to: '/' },
      { label: 'Class scheduling', to: '/' },
      { label: 'Equipment & maintenance', to: '/' },
      { label: 'POS & retail', to: '/' },
      { label: 'Analytics suite', to: '/' },
    ],
  },
  {
    titleKey: 'footer.company',
    links: [
      { label: 'About us', to: '/about' },
      { label: 'Gallery', to: '/gallery' },
      { label: 'Contact', to: '/contact' },
      { label: 'Careers', to: '/contact' },
      { label: 'Press kit', to: '/contact' },
    ],
  },
  {
    titleKey: 'footer.legal',
    links: [
      { label: 'Terms of service', to: '/contact' },
      { label: 'Privacy policy', to: '/contact' },
      { label: 'GDPR & CCPA', to: '/contact' },
      { label: 'Accessibility (WCAG 2.1)', to: '/contact' },
      { label: 'Security', to: '/contact' },
    ],
  },
];

const CLUBS = [
  { city: 'Bengaluru', line: '100 Ft Rd, Indiranagar', tz: 'IST' },
  { city: 'Austin', line: '2401 E Cesar Chavez St', tz: 'CT' },
  { city: 'Berlin', line: 'Oranienstraße 183', tz: 'CET' },
];

export default function Footer() {
  const { t, date } = useLocale();
  const { push } = useToast();
  const [email, setEmail] = useState('');

  return (
    <footer className="relative overflow-hidden border-t border-white/10 bg-ink">
      <div className="pointer-events-none absolute inset-x-0 -top-40 h-80 bg-[radial-gradient(ellipse_at_center,rgba(0,229,160,0.14),transparent_65%)]" />
      <div className="container-x relative py-16">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <div className="flex items-center gap-3">
              <span className="relative grid h-10 w-10 place-items-center">
                <span className="absolute inset-0 rounded-xl bg-gradient-to-br from-mint via-violet to-coral" />
                <span className="absolute inset-[2px] rounded-[10px] bg-ink" />
                <svg className="relative" width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10" stroke="#00E5A0" strokeWidth="2.2" strokeLinecap="round" />
                </svg>
              </span>
              <span className="font-display text-lg font-bold">
                GYM<span className="text-mint">FLOW</span>
              </span>
            </div>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted">{t('footer.tagline')}</p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!email.includes('@')) return push('Enter a valid email address', 'error');
                push('Subscribed to the GymFlow newsletter.');
                setEmail('');
              }}
              className="mt-6 flex max-w-sm gap-2"
            >
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@club.com"
                className="field !py-2.5"
                type="email"
              />
              <button className="btn-primary !px-4 !py-2.5" type="submit">
                Subscribe
              </button>
            </form>

            <div className="mt-6 flex flex-wrap gap-2">
              {['Instagram', 'YouTube', 'LinkedIn', 'X'].map((s) => (
                <a
                  key={s}
                  href="#"
                  onClick={(e) => e.preventDefault()}
                  className="chip transition hover:border-mint/50 hover:text-mint"
                >
                  {s}
                </a>
              ))}
            </div>
          </div>

          {COLS.map((col) => (
            <div key={col.titleKey}>
              <h4 className="mb-4 text-[11px] font-bold uppercase tracking-[0.2em] text-bone">{t(col.titleKey)}</h4>
              <ul className="space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link to={l.to} className="text-sm text-muted transition hover:translate-x-0.5 hover:text-mint">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 grid gap-4 border-t border-white/10 pt-8 sm:grid-cols-3">
          {CLUBS.map((c) => (
            <div key={c.city} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="font-display text-sm font-semibold">{c.city}</p>
              <p className="mt-1 text-xs text-muted">{c.line}</p>
              <p className="mt-2 font-mono text-[11px] text-mint">
                {new Date().toLocaleTimeString('en-US', { timeZone: c.city === 'Bengaluru' ? 'Asia/Kolkata' : c.city === 'Austin' ? 'America/Chicago' : 'Europe/Berlin', hour: '2-digit', minute: '2-digit' })}{' '}
                local · {c.tz}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-6 text-xs text-muted sm:flex-row">
          <p>
            © {new Date().getFullYear()} GymFlow Systems. {t('footer.rights')}
          </p>
          <p className="font-mono">
            {date()} · v1.0.0 · Built for 500+ member operations
          </p>
        </div>
      </div>
    </footer>
  );
}
