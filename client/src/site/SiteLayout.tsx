import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Clock, Mail, MapPin, Menu, Moon, Phone, Sun, X } from 'lucide-react';
import { useSite, isPreview } from '@/lib/site';
import { DAY_NAMES, time } from '@/lib/format';
import { Button, cx } from '@/components/ui';
import type { PublicOffer, SiteContent } from '@/lib/types';
import { offerLabel } from './offers';

export function Logo({ className = 'h-9' }: { className?: string }) {
  const { site, mode } = useSite();
  if (!site) return null;
  const b = site.site.brand;
  const src = mode === 'dark' && b.logoDarkUrl ? b.logoDarkUrl : b.logoUrl;
  return src ? (
    <img src={src} alt={b.name} className={cx('w-auto object-contain', className)} />
  ) : (
    <span className="font-display text-xl font-extrabold tracking-tight text-ink">{b.name}</span>
  );
}

const SOCIAL_PATHS: Record<keyof SiteContent['social'], string> = {
  instagram: 'M7 2h10a5 5 0 015 5v10a5 5 0 01-5 5H7a5 5 0 01-5-5V7a5 5 0 015-5zm5 5a5 5 0 100 10 5 5 0 000-10zm6-1.5a1.5 1.5 0 100 3 1.5 1.5 0 000-3z',
  facebook: 'M14 8h3V4h-3a4 4 0 00-4 4v2H8v4h2v8h4v-8h3l1-4h-4V8z',
  youtube: 'M22 8s-.2-1.6-.9-2.3c-.8-.9-1.8-.9-2.2-1C15.8 4.5 12 4.5 12 4.5s-3.8 0-6.9.2c-.4.1-1.4.1-2.2 1C2.2 6.4 2 8 2 8s-.2 1.9-.2 3.8v1.8c0 1.9.2 3.8.2 3.8s.2 1.6.9 2.3c.8.9 1.9.9 2.4 1 1.7.2 7.7.2 7.7.2s3.8 0 6.9-.2c.4-.1 1.4-.1 2.2-1 .7-.7.9-2.3.9-2.3s.2-1.9.2-3.8v-1.8C22.2 9.9 22 8 22 8zM10 15V9l5 3-5 3z',
  x: 'M4 4l7.2 9.6L4.3 20H6l6-5.4L16 20h4l-7.5-10L19.2 4h-1.7l-5.6 5.1L8 4H4z',
  tiktok: 'M16 3c.4 2.3 2 4 4.5 4.2v3.2a8 8 0 01-4.5-1.4V15a6 6 0 11-6-6v3.3A2.7 2.7 0 1012.7 15V3H16z',
  linkedin: 'M4.98 3.5a2.5 2.5 0 11-.01 5 2.5 2.5 0 01.01-5zM3 9h4v12H3zM9 9h3.8v1.7h.1c.5-1 1.8-2 3.8-2 4 0 4.8 2.6 4.8 6V21h-4v-5.4c0-1.3 0-3-1.8-3s-2.1 1.4-2.1 2.9V21H9z',
};

export function Social({ className }: { className?: string }) {
  const { site } = useSite();
  if (!site) return null;
  const s = site.site.social;
  const items = (Object.keys(SOCIAL_PATHS) as (keyof typeof SOCIAL_PATHS)[]).filter((k) => s[k]);
  if (!items.length) return null;
  return (
    <div className={cx('flex gap-2', className)}>
      {items.map((k) => (
        <a key={k} href={s[k]} target="_blank" rel="noopener noreferrer" aria-label={k} className="grid h-9 w-9 place-items-center rounded-full border border-line text-muted transition hover:border-primary hover:text-link">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden><path d={SOCIAL_PATHS[k]} /></svg>
        </a>
      ))}
    </div>
  );
}

function OfferBar({ offer }: { offer: PublicOffer }) {
  const [hidden, setHidden] = useState(() => sessionStorage.getItem(`bar:${offer._id}`) === '1');
  if (hidden) return null;
  return (
    <div className="relative bg-secondary px-10 py-2 text-center text-sm font-medium text-on-secondary">
      <span className="font-bold">{offerLabel(offer)}</span> · {offer.title}
      {offer.code && !offer.autoApply && <> · Use code <b className="font-mono">{offer.code}</b></>}{' '}
      <Link to={`/join?offer=${offer._id}`} className="underline underline-offset-2">Claim</Link>
      <button aria-label="Dismiss" onClick={() => { sessionStorage.setItem(`bar:${offer._id}`, '1'); setHidden(true); }} className="absolute right-3 top-1/2 -translate-y-1/2 opacity-80 hover:opacity-100"><X className="h-4 w-4" /></button>
    </div>
  );
}

function OfferPopup({ offer }: { offer: PublicOffer }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (sessionStorage.getItem(`pop:${offer._id}`)) return;
    const t = setTimeout(() => setOpen(true), 4000);
    return () => clearTimeout(t);
  }, [offer._id]);
  if (!open) return null;
  const close = () => { sessionStorage.setItem(`pop:${offer._id}`, '1'); setOpen(false); };
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div role="dialog" aria-modal="true" aria-label={offer.title} className="relative w-full max-w-md overflow-hidden rounded-brand bg-surface shadow-2xl">
        {offer.imageUrl && <img src={offer.imageUrl} alt="" className="h-44 w-full object-cover" />}
        <button onClick={close} aria-label="Close" className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-black/50 text-white"><X className="h-4 w-4" /></button>
        <div className="p-6">
          <span className="inline-block rounded-full bg-accent px-3 py-1 text-xs font-bold text-on-accent">{offerLabel(offer)}</span>
          <h3 className="mt-3 font-display text-2xl font-bold text-ink">{offer.title}</h3>
          {offer.description && <p className="mt-2 text-sm text-muted">{offer.description}</p>}
          <div className="mt-5 flex gap-2">
            <Link to={`/join?offer=${offer._id}`} onClick={close}><Button size="lg">Claim offer</Button></Link>
            <Button size="lg" variant="ghost" onClick={close}>Maybe later</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function OpenNow() {
  const { site } = useSite();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(t); }, []);
  if (!site) return null;
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: site.settings.timezone, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.find((p) => p.type === 'weekday')!.value);
  const hm = `${parts.find((p) => p.type === 'hour')!.value}:${parts.find((p) => p.type === 'minute')!.value}`;
  const today = site.settings.hours.find((h) => h.day === wd);
  const open = today && !today.closed && hm >= today.open && hm < today.close;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
      <span className={cx('h-2 w-2 rounded-full', open ? 'bg-emerald-500' : 'bg-red-500')} />
      {open ? `Open now · until ${time(today!.close)}` : 'Closed now'}
    </span>
  );
}

export default function SiteLayout() {
  const { site, mode, toggleMode } = useSite();
  const [menu, setMenu] = useState(false);
  const loc = useLocation();
  useEffect(() => setMenu(false), [loc.pathname, loc.hash]);
  useEffect(() => {
    if (loc.hash) document.getElementById(loc.hash.slice(1))?.scrollIntoView({ behavior: 'smooth' });
    else window.scrollTo({ top: 0 });
  }, [loc.pathname, loc.hash]);
  if (!site) return null;
  const c = site.site;
  const bar = c.sections.offers ? site.offers.find((o) => o.display.bar) : undefined;
  const popup = c.sections.offers ? site.offers.find((o) => o.display.popup) : undefined;
  const nav = [
    c.sections.plans && site.plans.length > 0 && { to: '/#plans', label: 'Plans' },
    c.sections.about && { to: '/#about', label: 'About' },
    c.sections.gallery && c.gallery.length > 0 && { to: '/#gallery', label: 'Gallery' },
    c.sections.faq && c.faq.length > 0 && { to: '/#faq', label: 'FAQ' },
    { to: '/contact', label: 'Contact' },
  ].filter(Boolean) as { to: string; label: string }[];

  return (
    <div className="min-h-screen bg-bg font-sans text-ink">
      {isPreview() && (
        <div className="sticky top-0 z-50 bg-amber-400 px-4 py-1.5 text-center text-xs font-bold text-black">
          Preview of unpublished changes. Visitors still see the live site.
        </div>
      )}
      {bar && <OfferBar offer={bar} />}
      <header className="sticky top-0 z-40 border-b border-line/70 bg-bg/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2" aria-label={`${c.brand.name} home`}><Logo /></Link>
          <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
            {nav.map((n) => (
              <NavLink key={n.to} to={n.to} className="rounded-full px-3 py-2 text-sm font-medium text-muted transition hover:text-ink">{n.label}</NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <button onClick={toggleMode} aria-label={`Switch to ${mode === 'dark' ? 'light' : 'dark'} mode`} className="grid h-9 w-9 place-items-center rounded-full text-muted hover:bg-surface2 hover:text-ink">
              {mode === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <Link to="/login" className="hidden text-sm font-medium text-muted hover:text-ink sm:block">Sign in</Link>
            <Link to="/join" className="hidden sm:block"><Button>Join now</Button></Link>
            <button className="grid h-9 w-9 place-items-center rounded-full hover:bg-surface2 md:hidden" aria-label="Menu" aria-expanded={menu} onClick={() => setMenu((m) => !m)}>
              {menu ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
        {menu && (
          <nav className="border-t border-line bg-bg px-4 py-3 md:hidden" aria-label="Mobile">
            {nav.map((n) => <Link key={n.to} to={n.to} className="block rounded-brand px-3 py-2.5 text-sm font-medium hover:bg-surface2">{n.label}</Link>)}
            <Link to="/login" className="block rounded-brand px-3 py-2.5 text-sm font-medium hover:bg-surface2">Sign in</Link>
            <Link to="/join" className="mt-2 block"><Button className="w-full">Join now</Button></Link>
          </nav>
        )}
      </header>

      <main><Outlet /></main>

      <footer className="mt-24 border-t border-line bg-surface">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-4">
          <div className="md:col-span-1">
            <Logo className="h-10" />
            {c.brand.tagline && <p className="mt-3 text-sm text-muted">{c.brand.tagline}</p>}
            <Social className="mt-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted">Visit</h4>
            <ul className="mt-4 space-y-3 text-sm">
              {c.contact.address && <li className="flex gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-link" />{c.contact.address}</li>}
              {c.contact.phone && <li className="flex gap-2"><Phone className="mt-0.5 h-4 w-4 shrink-0 text-link" /><a href={`tel:${c.contact.phone.replace(/\s/g, '')}`} className="hover:text-link">{c.contact.phone}</a></li>}
              {c.contact.email && <li className="flex gap-2"><Mail className="mt-0.5 h-4 w-4 shrink-0 text-link" /><a href={`mailto:${c.contact.email}`} className="hover:text-link">{c.contact.email}</a></li>}
            </ul>
          </div>
          <div>
            <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted"><Clock className="h-3.5 w-3.5" /> Hours</h4>
            <ul className="mt-4 space-y-1.5 text-sm">
              {site.settings.hours.slice().sort((a, b) => ((a.day + 6) % 7) - ((b.day + 6) % 7)).map((h) => (
                <li key={h.day} className="flex justify-between gap-4"><span className="text-muted">{DAY_NAMES(true)[h.day]}</span><span>{h.closed ? 'Closed' : `${time(h.open)} - ${time(h.close)}`}</span></li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted">Explore</h4>
            <ul className="mt-4 space-y-2 text-sm">
              {nav.map((n) => <li key={n.to}><Link to={n.to} className="text-muted hover:text-ink">{n.label}</Link></li>)}
              <li><Link to="/join" className="text-muted hover:text-ink">Join</Link></li>
              <li><Link to="/login" className="text-muted hover:text-ink">Member & staff sign in</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-line py-5 text-center text-xs text-muted">© {new Date().getFullYear()} {c.brand.name}. All rights reserved.</div>
      </footer>
      {popup && !isPreview() && <OfferPopup offer={popup} />}
    </div>
  );
}
