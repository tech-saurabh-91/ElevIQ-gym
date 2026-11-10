import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, ChevronLeft, ChevronRight, Minus, Plus, Quote, Star } from 'lucide-react';
import { useSite } from '@/lib/site';
import { cap, DAY_NAMES, money, time } from '@/lib/format';
import { Button, cx } from '@/components/ui';
import type { PublicPlan } from '@/lib/types';
import { offerLabel } from './offers';
import { OpenNow } from './SiteLayout';

function Section({ id, eyebrow, title, children, className }: { id?: string; eyebrow?: string; title?: string; children: React.ReactNode; className?: string }) {
  return (
    <section id={id} className={cx('mx-auto max-w-6xl scroll-mt-24 px-4 pt-24 sm:px-6', className)}>
      {(eyebrow || title) && (
        <div className="mb-10 max-w-2xl">
          {eyebrow && <p className="text-xs font-bold uppercase tracking-[0.2em] text-link">{eyebrow}</p>}
          {title && <h2 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">{title}</h2>}
        </div>
      )}
      {children}
    </section>
  );
}

function Hero() {
  const { site } = useSite();
  const banners = (site?.site.banners ?? []).filter((b) => b.active);
  const [i, setI] = useState(0);
  useEffect(() => {
    if (banners.length < 2) return;
    const t = setInterval(() => setI((x) => (x + 1) % banners.length), 7000);
    return () => clearInterval(t);
  }, [banners.length]);
  if (!site) return null;
  const b = banners[i] ?? { title: site.site.brand.name, subtitle: site.site.brand.tagline, imageUrl: '', ctaLabel: 'Join now', ctaHref: '/join', id: 'x' };
  const internal = b.ctaHref?.startsWith('/');
  const cta = b.ctaLabel ? (
    internal ? <Link to={b.ctaHref}><Button size="lg">{b.ctaLabel}</Button></Link> : <a href={b.ctaHref} target="_blank" rel="noopener noreferrer"><Button size="lg">{b.ctaLabel}</Button></a>
  ) : null;
  return (
    <section className="relative isolate overflow-hidden">
      {b.imageUrl ? (
        <>
          <img key={b.id} src={b.imageUrl} alt="" className="absolute inset-0 -z-10 h-full w-full object-cover" />
          <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/80 via-black/55 to-black/10" />
        </>
      ) : (
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/25 via-bg to-secondary/20" />
      )}
      <div className={cx('mx-auto flex min-h-[78vh] max-w-6xl flex-col justify-center px-4 py-24 sm:px-6', b.imageUrl ? 'text-white' : 'text-ink')}>
        <div className="mb-5"><span className={cx('rounded-full px-3 py-1.5', b.imageUrl ? 'bg-white/15 backdrop-blur' : 'bg-surface')}><OpenNow /></span></div>
        <h1 className="max-w-3xl font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">{b.title}</h1>
        {b.subtitle && <p className={cx('mt-5 max-w-xl text-lg', b.imageUrl ? 'text-white/85' : 'text-muted')}>{b.subtitle}</p>}
        <div className="mt-8 flex flex-wrap gap-3">
          {cta}
          {site.plans.length > 0 && <a href="#plans"><Button size="lg" variant="outline" className={b.imageUrl ? 'border-white/40 bg-white/10 text-white hover:bg-white/20' : ''}>View plans</Button></a>}
        </div>
        {banners.length > 1 && (
          <div className="mt-12 flex items-center gap-3">
            <button aria-label="Previous slide" onClick={() => setI((i - 1 + banners.length) % banners.length)} className="grid h-9 w-9 place-items-center rounded-full border border-current/30 opacity-80 hover:opacity-100"><ChevronLeft className="h-4 w-4" /></button>
            {banners.map((x, k) => <button key={x.id} aria-label={`Slide ${k + 1}`} onClick={() => setI(k)} className={cx('h-1.5 rounded-full bg-current transition-all', k === i ? 'w-8 opacity-100' : 'w-3 opacity-40')} />)}
            <button aria-label="Next slide" onClick={() => setI((i + 1) % banners.length)} className="grid h-9 w-9 place-items-center rounded-full border border-current/30 opacity-80 hover:opacity-100"><ChevronRight className="h-4 w-4" /></button>
          </div>
        )}
      </div>
    </section>
  );
}

function OfferBanners() {
  const { site } = useSite();
  const offers = (site?.offers ?? []).filter((o) => o.display.banner);
  if (!offers.length) return null;
  return (
    <Section className="pt-12">
      <div className="grid gap-4 md:grid-cols-2">
        {offers.map((o) => (
          <div key={o._id} className="relative overflow-hidden rounded-brand bg-secondary p-7 text-on-secondary shadow-soft">
            {o.imageUrl && <img src={o.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-20" />}
            <div className="relative">
              <span className="rounded-full bg-accent px-3 py-1 text-xs font-bold text-on-accent">{offerLabel(o)}</span>
              <h3 className="mt-3 font-display text-2xl font-bold">{o.title}</h3>
              {o.description && <p className="mt-2 text-sm opacity-90">{o.description}</p>}
              <p className="mt-3 text-xs opacity-80">Ends {new Date(o.endsAt).toLocaleDateString()}{o.code && !o.autoApply ? ` · Code ${o.code}` : ''}</p>
              <Link to={`/join?offer=${o._id}`} className="mt-5 inline-block"><Button variant="secondary">Claim now</Button></Link>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

function PlanCard({ plan, category }: { plan: PublicPlan; category: string }) {
  const q = plan.quotes[category] ?? Object.values(plan.quotes)[0];
  if (!q) return null;
  const price = q.base - q.discount;
  return (
    <div className={cx('relative flex flex-col rounded-brand border bg-surface p-7 shadow-soft', plan.highlight ? 'border-primary ring-2 ring-primary/30' : 'border-line')}>
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-display text-xl font-bold">{plan.name}</h3>
        {q.offer?.badgeText ? <span className="rounded-full bg-accent px-2.5 py-1 text-[11px] font-bold text-on-accent">{q.offer.badgeText}</span>
          : plan.highlight ? <span className="rounded-full bg-primary px-2.5 py-1 text-[11px] font-bold text-on-primary">Most popular</span> : null}
      </div>
      {plan.description && <p className="mt-2 text-sm text-muted">{plan.description}</p>}
      <div className="mt-6 flex items-end gap-2">
        <span className="font-display text-4xl font-extrabold">{money(price, q.currency)}</span>
        <span className="pb-1 text-sm text-muted">/ {plan.billingLabel}</span>
      </div>
      {q.discount > 0 && <p className="mt-1 text-sm"><s className="text-muted">{money(q.base, q.currency)}</s> <span className="font-semibold text-link">Save {money(q.discount, q.currency)}</span></p>}
      <p className="mt-1 text-xs text-muted">
        {q.taxRate > 0 ? (q.taxInclusive ? `Incl. ${q.taxLabel}` : `+ ${q.taxRate}% ${q.taxLabel}`) : ''}
        {plan.joiningFee > 0 && ` · One-time joining fee ${money(plan.joiningFee, q.currency)}`}
      </p>
      <ul className="mt-6 flex-1 space-y-2.5 text-sm">
        {plan.features.map((f) => <li key={f} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-link" />{f}</li>)}
      </ul>
      <Link to={`/join?plan=${plan._id}&category=${q.category}`} className="mt-7"><Button className="w-full" variant={plan.highlight ? 'primary' : 'outline'} size="lg">Choose {plan.name}</Button></Link>
    </div>
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
  return (
    <Section id="plans" eyebrow="Membership" title="Plans that fit your life">
      {categories.length > 1 && (
        <div role="tablist" aria-label="Pricing category" className="-mt-4 mb-8 inline-flex flex-wrap gap-1 rounded-full border border-line bg-surface p-1">
          {categories.map((c) => (
            <button key={c} role="tab" aria-selected={current === c} onClick={() => setCat(c)} className={cx('rounded-full px-4 py-1.5 text-sm font-semibold transition', current === c ? 'bg-primary text-on-primary' : 'text-muted hover:text-ink')}>{cap(c)}</button>
          ))}
        </div>
      )}
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {site.plans.filter((p) => p.quotes[current]).map((p) => <PlanCard key={p._id} plan={p} category={current} />)}
      </div>
    </Section>
  );
}

function About() {
  const { site } = useSite();
  const a = site!.site.about;
  if (!a.title && !a.body) return null;
  return (
    <Section id="about">
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-link">About us</p>
          <h2 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">{a.title}</h2>
          <div className="mt-5 space-y-4 whitespace-pre-line text-muted">{a.body}</div>
          {a.highlights.length > 0 && (
            <dl className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {a.highlights.map((h) => (
                <div key={h.id} className="rounded-brand border border-line bg-surface p-4">
                  <dt className="text-xs text-muted">{h.label}</dt>
                  <dd className="mt-1 font-display text-2xl font-bold text-link">{h.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
        {a.imageUrl && <img src={a.imageUrl} alt="" loading="lazy" className="aspect-[4/3] w-full rounded-brand object-cover shadow-soft" />}
      </div>
    </Section>
  );
}

function Gallery() {
  const { site } = useSite();
  const g = site!.site.gallery;
  const [open, setOpen] = useState<number | null>(null);
  if (!g.length) return null;
  return (
    <Section id="gallery" eyebrow="Inside" title="Take a look around">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {g.map((x, i) => (
          <button key={x.id} onClick={() => setOpen(i)} className={cx('group overflow-hidden rounded-brand', i % 5 === 0 && 'md:col-span-2 md:row-span-2')}>
            <img src={x.url} alt={x.caption || ''} loading="lazy" className="aspect-square h-full w-full object-cover transition duration-500 group-hover:scale-105" />
          </button>
        ))}
      </div>
      {open !== null && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/90 p-4" onClick={() => setOpen(null)} role="dialog" aria-modal="true">
          <img src={g[open].url} alt={g[open].caption} className="max-h-[85vh] max-w-full rounded-brand object-contain" />
          {g[open].caption && <p className="absolute bottom-6 text-sm text-white/80">{g[open].caption}</p>}
        </div>
      )}
    </Section>
  );
}

function Testimonials() {
  const { site } = useSite();
  const t = site!.site.testimonials;
  if (!t.length) return null;
  return (
    <Section eyebrow="Members" title="What our members say">
      <div className="grid gap-5 md:grid-cols-3">
        {t.map((x) => (
          <figure key={x.id} className="flex flex-col rounded-brand border border-line bg-surface p-6 shadow-soft">
            <Quote className="h-6 w-6 text-link" />
            <div className="mt-3 flex gap-0.5" aria-label={`${x.rating} out of 5`}>{Array.from({ length: 5 }, (_, i) => <Star key={i} className={cx('h-4 w-4', i < x.rating ? 'fill-accent text-accent' : 'text-line')} />)}</div>
            <blockquote className="mt-3 flex-1 text-sm leading-relaxed">“{x.quote}”</blockquote>
            <figcaption className="mt-5 flex items-center gap-3">
              {x.photoUrl ? <img src={x.photoUrl} alt="" className="h-10 w-10 rounded-full object-cover" /> : <span className="grid h-10 w-10 place-items-center rounded-full bg-primary/15 font-bold text-link">{x.name[0]}</span>}
              <div><div className="text-sm font-semibold">{x.name}</div>{x.role && <div className="text-xs text-muted">{x.role}</div>}</div>
            </figcaption>
          </figure>
        ))}
      </div>
    </Section>
  );
}

function Faq() {
  const { site } = useSite();
  const f = site!.site.faq;
  const [open, setOpen] = useState<string | null>(f[0]?.id ?? null);
  if (!f.length) return null;
  return (
    <Section id="faq" eyebrow="FAQ" title="Questions, answered">
      <div className="divide-y divide-line rounded-brand border border-line bg-surface">
        {f.map((x) => (
          <div key={x.id}>
            <button onClick={() => setOpen(open === x.id ? null : x.id)} aria-expanded={open === x.id} className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left font-semibold">
              {x.q}{open === x.id ? <Minus className="h-4 w-4 shrink-0" /> : <Plus className="h-4 w-4 shrink-0" />}
            </button>
            {open === x.id && <p className="whitespace-pre-line px-6 pb-5 text-sm text-muted">{x.a}</p>}
          </div>
        ))}
      </div>
    </Section>
  );
}

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
          <div className="rounded-brand border border-line bg-surface p-6 lg:col-span-2">
            <OpenNow />
            <ul className="mt-4 divide-y divide-line text-sm">
              {s.settings.hours.slice().sort((a, b) => ((a.day + 6) % 7) - ((b.day + 6) % 7)).map((h) => (
                <li key={h.day} className="flex justify-between py-2.5"><span className="font-medium">{DAY_NAMES()[h.day]}</span><span className={h.closed ? 'text-muted' : ''}>{h.closed ? 'Closed' : `${time(h.open)} - ${time(h.close)}`}</span></li>
              ))}
            </ul>
          </div>
        )}
        {showMap && (
          <iframe
            title="Map"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="min-h-[320px] w-full rounded-brand border border-line lg:col-span-3"
            src={`https://www.google.com/maps?q=${encodeURIComponent(c.mapQuery)}&output=embed`}
          />
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
      <section className="mx-auto mt-24 max-w-6xl px-4 sm:px-6">
        <div className="flex flex-col items-start justify-between gap-6 rounded-brand bg-primary p-10 text-on-primary sm:flex-row sm:items-center">
          <div>
            <h2 className="font-display text-3xl font-bold">Ready to start?</h2>
            <p className="mt-2 opacity-90">Leave your details and our team will get you set up.</p>
          </div>
          <Link to="/join"><Button size="lg" variant="secondary">Join {site.site.brand.name}</Button></Link>
        </div>
      </section>
    </>
  );
}
