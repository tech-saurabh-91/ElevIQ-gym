import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { Check, ChevronDown, ChevronLeft, ChevronRight, Expand, Minus, Plus, Quote, Star, X } from 'lucide-react';
import { useSite } from '@/lib/site';
import { cap, DAY_NAMES, money, time } from '@/lib/format';
import { Button, cx } from '@/components/ui';
import type { PublicPlan } from '@/lib/types';
import { offerLabel } from './offers';
import { OpenNow } from './SiteLayout';
import { CountUp, Reveal, prefersReducedMotion } from './motion';

function Section({ id, eyebrow, title, intro, children, className }: { id?: string; eyebrow?: string; title?: string; intro?: string; children: ReactNode; className?: string }) {
  return (
    <section id={id} className={cx('mx-auto max-w-6xl scroll-mt-24 px-4 pt-20 sm:px-6 sm:pt-28', className)}>
      {(eyebrow || title) && (
        <Reveal className="mb-10 max-w-2xl">
          {eyebrow && <p className="text-xs font-bold uppercase tracking-[0.25em] text-link">{eyebrow}</p>}
          {title && <h2 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-5xl">{title}</h2>}
          {intro && <p className="mt-4 text-muted">{intro}</p>}
        </Reveal>
      )}
      {children}
    </section>
  );
}

/* ------------------------------------ hero ------------------------------------ */

function Hero() {
  const { site } = useSite();
  const banners = (site?.site.banners ?? []).filter((b) => b.active);
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (banners.length < 2 || paused) return;
    const t = setInterval(() => setI((x) => (x + 1) % banners.length), 7000);
    return () => clearInterval(t);
  }, [banners.length, paused]);
  if (!site) return null;
  const b = banners[i] ?? { title: site.site.brand.name, subtitle: site.site.brand.tagline, imageUrl: '', ctaLabel: 'Join now', ctaHref: '/join', id: 'x', active: true };
  const photo = Boolean(b.imageUrl);
  const cta = b.ctaLabel ? (
    b.ctaHref?.startsWith('/') ? <Link to={b.ctaHref}><Button size="lg" className="px-8">{b.ctaLabel}</Button></Link>
      : <a href={b.ctaHref} target="_blank" rel="noopener noreferrer"><Button size="lg" className="px-8">{b.ctaLabel}</Button></a>
  ) : null;

  return (
    <section className="relative isolate flex min-h-[100svh] items-center overflow-hidden" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} aria-roledescription="carousel">
      {photo ? (
        <>
          {/* Every slide stays mounted so switching cross-fades instead of flashing. */}
          {banners.map((x, k) => x.imageUrl && (
            <div key={x.id} className={cx('absolute inset-0 -z-20 transition-opacity duration-1000', k === i ? 'opacity-100' : 'opacity-0')} aria-hidden={k !== i}>
              <img src={x.imageUrl} alt="" className={cx('h-full w-full object-cover', k === i && 'kenburns')} fetchPriority={k === 0 ? 'high' : 'low'} loading={k === 0 ? 'eager' : 'lazy'} />
            </div>
          ))}
          <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/85 via-black/55 to-black/15" />
          <div className="absolute inset-x-0 bottom-0 -z-10 h-40 bg-gradient-to-t from-bg to-transparent" />
        </>
      ) : (
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/30 via-bg to-secondary/25" />
      )}
      <div className={cx('mx-auto w-full max-w-6xl px-4 pb-24 pt-32 sm:px-6', photo ? 'text-white' : 'text-ink')}>
        <div key={b.id} className="max-w-3xl animate-fade">
          <span className={cx('inline-flex rounded-full px-3 py-1.5', photo ? 'bg-white/15 backdrop-blur' : 'bg-surface')}><OpenNow /></span>
          <h1 className="mt-6 font-display text-5xl font-extrabold leading-[1.02] tracking-tight sm:text-7xl">{b.title}</h1>
          {b.subtitle && <p className={cx('mt-6 max-w-xl text-lg sm:text-xl', photo ? 'text-white/85' : 'text-muted')}>{b.subtitle}</p>}
          <div className="mt-9 flex flex-wrap gap-3">
            {cta}
            {site.plans.length > 0 && <a href="#plans"><Button size="lg" variant="outline" className={cx('px-8', photo && 'border-white/40 bg-white/10 text-white backdrop-blur hover:bg-white/20')}>View plans</Button></a>}
          </div>
        </div>
        {banners.length > 1 && (
          <div className="mt-14 flex items-center gap-3">
            <button aria-label="Previous slide" onClick={() => setI((i - 1 + banners.length) % banners.length)} className="grid h-10 w-10 place-items-center rounded-full border border-current/30 opacity-80 transition hover:opacity-100"><ChevronLeft className="h-4 w-4" /></button>
            {banners.map((x, k) => <button key={x.id} aria-label={`Slide ${k + 1}`} aria-current={k === i} onClick={() => setI(k)} className={cx('h-1.5 rounded-full bg-current transition-all', k === i ? 'w-10 opacity-100' : 'w-4 opacity-40')} />)}
            <button aria-label="Next slide" onClick={() => setI((i + 1) % banners.length)} className="grid h-10 w-10 place-items-center rounded-full border border-current/30 opacity-80 transition hover:opacity-100"><ChevronRight className="h-4 w-4" /></button>
          </div>
        )}
      </div>
      <a href="#plans" aria-label="Scroll down" className={cx('absolute bottom-6 left-1/2 hidden -translate-x-1/2 sm:block', photo ? 'text-white/80' : 'text-muted')}><ChevronDown className="h-7 w-7 animate-bob" /></a>
    </section>
  );
}

/* ----------------------------------- offers ----------------------------------- */

function OfferBanners() {
  const { site } = useSite();
  const offers = (site?.offers ?? []).filter((o) => o.display.banner);
  if (!offers.length) return null;
  return (
    <Section className="pt-12 sm:pt-16">
      <div className="grid gap-5 md:grid-cols-2">
        {offers.map((o, k) => (
          <Reveal key={o._id} delay={k * 100} className="relative overflow-hidden rounded-brand bg-secondary p-8 text-on-secondary shadow-soft">
            {o.imageUrl && <img src={o.imageUrl} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-20" />}
            <span className="ribbon bg-accent text-on-accent">{offerLabel(o)}</span>
            <div className="relative max-w-sm">
              <h3 className="font-display text-2xl font-bold sm:text-3xl">{o.title}</h3>
              {o.description && <p className="mt-2 text-sm opacity-90">{o.description}</p>}
              <p className="mt-3 text-xs opacity-80">Ends {new Date(o.endsAt).toLocaleDateString()}{o.code && !o.autoApply ? ` · Code ${o.code}` : ''}</p>
              <Link to={`/join?offer=${o._id}`} className="mt-6 inline-block"><Button variant="secondary">Claim now</Button></Link>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

/* ------------------------------------ plans ------------------------------------ */

function PlanCard({ plan, category, delay }: { plan: PublicPlan; category: string; delay: number }) {
  const q = plan.quotes[category] ?? Object.values(plan.quotes)[0];
  if (!q) return null;
  const price = q.base - q.discount;
  const popular = plan.highlight;
  return (
    <Reveal delay={delay} className={cx('relative', popular && 'md:-my-4')}>
      <div className={cx(
        'relative flex h-full flex-col overflow-hidden rounded-brand border bg-surface p-7 transition duration-300 hover:-translate-y-1 hover:shadow-2xl',
        popular ? 'border-primary shadow-2xl ring-2 ring-primary/40 md:py-10' : 'border-line shadow-soft'
      )}>
        {popular && <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-primary via-accent to-secondary" />}
        {q.offer && <span className="ribbon bg-accent text-on-accent">{q.offer.badgeText || 'Offer'}</span>}
        {popular && <span className="mb-4 inline-flex w-fit items-center gap-1 rounded-full bg-primary px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-on-primary"><Star className="h-3 w-3 fill-current" /> Most popular</span>}
        <h3 className="font-display text-2xl font-bold">{plan.name}</h3>
        {plan.description && <p className="mt-2 text-sm text-muted">{plan.description}</p>}
        <div className="mt-6 flex items-end gap-2">
          <span className="font-display text-5xl font-extrabold tracking-tight">{money(price, q.currency)}</span>
          <span className="pb-1.5 text-sm text-muted">/ {plan.billingLabel}</span>
        </div>
        {q.discount > 0 && <p className="mt-1 text-sm"><s className="text-muted">{money(q.base, q.currency)}</s> <span className="font-semibold text-link">Save {money(q.discount, q.currency)}</span></p>}
        <p className="mt-1 text-xs text-muted">
          {q.taxRate > 0 ? (q.taxInclusive ? `Incl. ${q.taxLabel}` : `+ ${q.taxRate}% ${q.taxLabel}`) : ''}
          {plan.joiningFee > 0 && ` · One-time joining fee ${money(plan.joiningFee, q.currency)}`}
        </p>
        <ul className="mt-6 flex-1 space-y-3 text-sm">
          {plan.features.map((f) => <li key={f} className="flex gap-2.5"><span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-primary/15"><Check className="h-3 w-3 text-link" /></span>{f}</li>)}
        </ul>
        <Link to={`/join?plan=${plan._id}&category=${q.category}`} className="mt-8"><Button className="w-full" variant={popular ? 'primary' : 'outline'} size="lg">Choose {plan.name}</Button></Link>
      </div>
    </Reveal>
  );
}

function Plans() {
  const { site } = useSite();
  const categories = useMemo(() => {
    const s = new Set<string>();
    site?.plans.forEach((p) => Object.keys(p.quotes).forEach((c) => s.add(c)));
    return (site?.settings.categories ?? []).filter((c) => s.has(c));
  }, [site]);
  const [cat, setCat] = useState('');
  const current = cat || categories[0] || 'standard';
  if (!site?.plans.length) return null;
  const shown = site.plans.filter((p) => p.quotes[current]);
  return (
    <Section id="plans" eyebrow="Membership" title="Plans that fit your life" intro="Clear prices, no hidden fees. Pay at the front desk when you start.">
      {categories.length > 1 && (
        <Reveal>
          <div role="tablist" aria-label="Pricing category" className="-mt-2 mb-10 inline-flex flex-wrap gap-1 rounded-full border border-line bg-surface p-1 shadow-soft">
            {categories.map((c) => (
              <button key={c} role="tab" aria-selected={current === c} onClick={() => setCat(c)} className={cx('rounded-full px-5 py-2 text-sm font-semibold transition', current === c ? 'bg-primary text-on-primary shadow' : 'text-muted hover:text-ink')}>{cap(c)}</button>
            ))}
          </div>
        </Reveal>
      )}
      <div className={cx('grid items-stretch gap-6 md:grid-cols-2', shown.length >= 3 && 'lg:grid-cols-3', shown.length >= 4 && 'xl:grid-cols-4')}>
        {shown.map((p, k) => <PlanCard key={p._id} plan={p} category={current} delay={k * 90} />)}
      </div>
    </Section>
  );
}

/* ------------------------------------ about ------------------------------------ */

function About() {
  const { site } = useSite();
  const a = site!.site.about;
  if (!a.title && !a.body) return null;
  return (
    <Section id="about">
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <Reveal>
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-link">About us</p>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-5xl">{a.title}</h2>
          <div className="mt-6 space-y-4 whitespace-pre-line text-muted">{a.body}</div>
        </Reveal>
        {a.imageUrl && (
          <Reveal delay={120} className="relative">
            <div className="absolute -inset-3 -z-10 rounded-[calc(var(--radius)+12px)] bg-gradient-to-br from-primary/30 to-secondary/30 blur-2xl" />
            <img src={a.imageUrl} alt="" loading="lazy" className="aspect-[4/3] w-full rounded-brand object-cover shadow-2xl" />
          </Reveal>
        )}
      </div>
      {a.highlights.length > 0 && (
        <dl className="mt-14 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {a.highlights.map((h, k) => (
            <Reveal key={h.id} delay={k * 90} className="rounded-brand border border-line bg-surface p-6 text-center shadow-soft">
              <dd className="font-display text-4xl font-extrabold text-link sm:text-5xl"><CountUp value={h.value} /></dd>
              <dt className="mt-2 text-sm text-muted">{h.label}</dt>
            </Reveal>
          ))}
        </dl>
      )}
    </Section>
  );
}

/* ----------------------------------- gallery ----------------------------------- */

function Lightbox({ items, index, onClose, onIndex }: { items: { url: string; caption: string }[]; index: number; onClose: () => void; onIndex: (i: number) => void }) {
  const go = useCallback((d: number) => onIndex((index + d + items.length) % items.length), [index, items.length, onIndex]);
  const touch = useRef<number | null>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    closeBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; prev?.focus?.(); };
  }, [go, onClose]);
  const item = items[index];
  return createPortal(
    <div
      role="dialog" aria-modal="true" aria-label={`Photo ${index + 1} of ${items.length}`}
      className="fixed inset-0 z-[70] flex animate-fade items-center justify-center bg-black/95 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      onTouchStart={(e) => { touch.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => { if (touch.current === null) return; const dx = e.changedTouches[0].clientX - touch.current; if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1); touch.current = null; }}
    >
      <img key={item.url} src={item.url.replace(/w=\d+/, 'w=1800')} alt={item.caption || ''} className="max-h-[82vh] max-w-full animate-fade rounded-brand object-contain shadow-2xl" />
      <button ref={closeBtn} onClick={onClose} aria-label="Close" className="absolute right-4 top-4 grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"><X className="h-5 w-5" /></button>
      {items.length > 1 && (
        <>
          <button onClick={() => go(-1)} aria-label="Previous photo" className="absolute left-3 top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"><ChevronLeft className="h-6 w-6" /></button>
          <button onClick={() => go(1)} aria-label="Next photo" className="absolute right-3 top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"><ChevronRight className="h-6 w-6" /></button>
        </>
      )}
      <div className="absolute bottom-5 left-0 right-0 text-center text-sm text-white/80">
        {item.caption && <p className="mb-1">{item.caption}</p>}
        <p className="text-xs text-white/60">{index + 1} / {items.length}</p>
      </div>
    </div>,
    document.body
  );
}

function Gallery() {
  const { site } = useSite();
  const g = site!.site.gallery;
  const [open, setOpen] = useState<number | null>(null);
  if (!g.length) return null;
  return (
    <Section id="gallery" eyebrow="Inside" title="Take a look around">
      <div className="grid auto-rows-[160px] grid-cols-2 gap-3 sm:auto-rows-[220px] md:grid-cols-4">
        {g.map((x, i) => (
          <Reveal key={x.id} delay={(i % 4) * 70} className={cx(i % 5 === 0 && 'col-span-2 row-span-2')}>
            <button onClick={() => setOpen(i)} aria-label={`Open photo ${i + 1}${x.caption ? `: ${x.caption}` : ''}`} className="group relative h-full w-full overflow-hidden rounded-brand">
              <img src={x.url} alt={x.caption || ''} loading="lazy" className="h-full w-full object-cover transition duration-700 group-hover:scale-110" />
              <span className="absolute inset-0 grid place-items-center bg-black/0 text-white opacity-0 transition group-hover:bg-black/35 group-hover:opacity-100"><Expand className="h-6 w-6" /></span>
            </button>
          </Reveal>
        ))}
      </div>
      {open !== null && <Lightbox items={g} index={open} onIndex={setOpen} onClose={() => setOpen(null)} />}
    </Section>
  );
}

/* -------------------------------- testimonials -------------------------------- */

function Testimonials() {
  const { site } = useSite();
  const t = site!.site.testimonials;
  const track = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  const scrollTo = useCallback((i: number) => {
    const el = track.current;
    const card = el?.children[i] as HTMLElement | undefined;
    if (el && card) el.scrollTo({ left: card.offsetLeft - el.offsetLeft, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  }, []);
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const on = () => {
      const w = (el.children[0] as HTMLElement | undefined)?.offsetWidth ?? 1;
      setActive(Math.round(el.scrollLeft / (w + 20)));
    };
    el.addEventListener('scroll', on, { passive: true });
    return () => el.removeEventListener('scroll', on);
  }, []);
  useEffect(() => {
    if (t.length < 2 || paused || prefersReducedMotion()) return;
    const id = setInterval(() => {
      const el = track.current;
      if (!el) return;
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 8;
      scrollTo(atEnd ? 0 : active + 1);
    }, 6000);
    return () => clearInterval(id);
  }, [t.length, paused, active, scrollTo]);
  if (!t.length) return null;

  return (
    <Section eyebrow="Members" title="What our members say">
      <div onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocusCapture={() => setPaused(true)} onBlurCapture={() => setPaused(false)} aria-roledescription="carousel">
        <div ref={track} className="snap-track pb-4">
          {t.map((x) => (
            <figure key={x.id} className="flex w-[85%] flex-col rounded-brand border border-line bg-surface p-7 shadow-soft sm:w-[46%] lg:w-[31.5%]">
              <Quote className="h-8 w-8 text-link" />
              <div className="mt-4 flex gap-0.5" aria-label={`${x.rating} out of 5`}>{Array.from({ length: 5 }, (_, i) => <Star key={i} className={cx('h-4 w-4', i < x.rating ? 'fill-accent text-accent' : 'text-line')} />)}</div>
              <blockquote className="mt-4 flex-1 text-base leading-relaxed">“{x.quote}”</blockquote>
              <figcaption className="mt-6 flex items-center gap-3">
                {x.photoUrl ? <img src={x.photoUrl} alt="" loading="lazy" className="h-11 w-11 rounded-full object-cover" /> : <span className="grid h-11 w-11 place-items-center rounded-full bg-primary/15 font-bold text-link">{x.name[0]}</span>}
                <div><div className="text-sm font-semibold">{x.name}</div>{x.role && <div className="text-xs text-muted">{x.role}</div>}</div>
              </figcaption>
            </figure>
          ))}
        </div>
        {t.length > 1 && (
          <div className="mt-4 flex items-center justify-center gap-3">
            <button aria-label="Previous review" onClick={() => scrollTo(Math.max(0, active - 1))} className="grid h-10 w-10 place-items-center rounded-full border border-line hover:bg-surface2"><ChevronLeft className="h-4 w-4" /></button>
            {t.map((x, k) => <button key={x.id} aria-label={`Review ${k + 1}`} aria-current={k === active} onClick={() => scrollTo(k)} className={cx('h-2 rounded-full transition-all', k === active ? 'w-8 bg-primary' : 'w-2 bg-line')} />)}
            <button aria-label="Next review" onClick={() => scrollTo(Math.min(t.length - 1, active + 1))} className="grid h-10 w-10 place-items-center rounded-full border border-line hover:bg-surface2"><ChevronRight className="h-4 w-4" /></button>
          </div>
        )}
      </div>
    </Section>
  );
}

/* ------------------------------------- faq ------------------------------------- */

function Faq() {
  const { site } = useSite();
  const f = site!.site.faq;
  const [open, setOpen] = useState<string | null>(f[0]?.id ?? null);
  if (!f.length) return null;
  return (
    <Section id="faq" eyebrow="FAQ" title="Questions, answered">
      <Reveal className="divide-y divide-line rounded-brand border border-line bg-surface shadow-soft">
        {f.map((x) => (
          <div key={x.id}>
            <button onClick={() => setOpen(open === x.id ? null : x.id)} aria-expanded={open === x.id} className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left font-semibold">
              {x.q}
              <span className={cx('grid h-7 w-7 shrink-0 place-items-center rounded-full transition', open === x.id ? 'bg-primary text-on-primary' : 'bg-surface2')}>{open === x.id ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}</span>
            </button>
            <div className={cx('grid transition-all duration-300', open === x.id ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0')}>
              <p className="overflow-hidden whitespace-pre-line px-6 text-sm text-muted"><span className="block pb-5">{x.a}</span></p>
            </div>
          </div>
        ))}
      </Reveal>
    </Section>
  );
}

/* ------------------------------- hours and map ------------------------------- */

function HoursAndMap() {
  const { site } = useSite();
  const s = site!;
  const c = s.site.contact;
  const showHours = s.site.sections.hours;
  const showMap = s.site.sections.contact && c.mapQuery;
  if (!showHours && !showMap) return null;
  return (
    <Section eyebrow="Visit us" title="Opening hours & location">
      <div className="grid gap-6 lg:grid-cols-5">
        {showHours && (
          <Reveal className="rounded-brand border border-line bg-surface p-6 shadow-soft lg:col-span-2">
            <OpenNow />
            <ul className="mt-4 divide-y divide-line text-sm">
              {s.settings.hours.slice().sort((a, b) => ((a.day + 6) % 7) - ((b.day + 6) % 7)).map((h) => (
                <li key={h.day} className="flex justify-between py-2.5"><span className="font-medium">{DAY_NAMES()[h.day]}</span><span className={h.closed ? 'text-muted' : ''}>{h.closed ? 'Closed' : `${time(h.open)} - ${time(h.close)}`}</span></li>
              ))}
            </ul>
          </Reveal>
        )}
        {showMap && (
          <Reveal delay={100} className="lg:col-span-3">
            <iframe title="Map" loading="lazy" referrerPolicy="no-referrer-when-downgrade" className="h-full min-h-[320px] w-full rounded-brand border border-line" src={`https://www.google.com/maps?q=${encodeURIComponent(c.mapQuery)}&output=embed`} />
          </Reveal>
        )}
      </div>
    </Section>
  );
}

export default function Home() {
  const { site } = useSite();
  if (!site) return null;
  const s = site.site.sections;
  return (
    <>
      <Hero />
      {s.offers && <OfferBanners />}
      {s.plans && <Plans />}
      {s.about && <About />}
      {s.gallery && <Gallery />}
      {s.testimonials && <Testimonials />}
      {s.faq && <Faq />}
      <HoursAndMap />
      <section className="mx-auto mt-24 max-w-6xl px-4 sm:mt-32 sm:px-6">
        <Reveal className="relative overflow-hidden rounded-brand bg-gradient-to-br from-primary to-secondary p-10 text-on-primary shadow-2xl sm:p-14">
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
          <div className="relative flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
            <div>
              <h2 className="font-display text-3xl font-bold sm:text-4xl">Ready to start?</h2>
              <p className="mt-2 opacity-90">Leave your details and our team will get you set up.</p>
            </div>
            <Link to="/join"><Button size="lg" variant="secondary" className="px-8">Join {site.site.brand.name}</Button></Link>
          </div>
        </Reveal>
      </section>
    </>
  );
}
