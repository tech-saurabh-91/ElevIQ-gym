import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Empty, Loading, Modal, Reveal, SectionHeading, Tabs, useToast } from '../components/ui';
import { useLocale } from '../lib/i18n';
import api from '../lib/api';

const CATEGORIES = [
  { value: 'all', label: 'All' },
  { value: 'facility', label: 'Facility' },
  { value: 'classes', label: 'Classes' },
  { value: 'trainers', label: 'Trainers' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'events', label: 'Events' },
  { value: 'members', label: 'Members' },
];

function Fallback({ label }) {
  return (
    <div className="grid h-full w-full place-items-center bg-[linear-gradient(135deg,#10121c,#05050a_60%)]">
      <div className="text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-mint/30 bg-mint/10 text-mint">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <rect x="3" y="3" width="18" height="18" rx="3" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="M21 15l-5-5L5 21" />
          </svg>
        </div>
        <p className="mt-3 px-4 text-xs uppercase tracking-[0.2em] text-muted">{label}</p>
      </div>
    </div>
  );
}

export default function Gallery() {
  const { t } = useLocale();
  const { push } = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const [favorite, setFavorite] = useState(() => new Set());

  useEffect(() => {
    api
      .get('/gallery')
      .then((r) => setItems(r.data))
      .catch(() => push('Could not load gallery', 'error'))
      .finally(() => setLoading(false));
  }, [push]);

  const filtered = useMemo(() => (filter === 'all' ? items : items.filter((i) => i.category === filter)), [items, filter]);

  useEffect(() => {
    setActive(0);
  }, [filter]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
      if (e.key === 'ArrowRight') setActive((a) => Math.min(a + 1, filtered.length - 1));
      if (e.key === 'ArrowLeft') setActive((a) => Math.max(a - 1, 0));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, filtered.length]);

  const toggleFav = (id) => {
    setFavorite((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (loading) return <div className="min-h-screen pt-36"><Loading label="Loading gallery…" /></div>;

  return (
    <>
      {/* Hero with 3D coverflow */}
      <section className="relative overflow-hidden pb-14 pt-36">
        <div className="pointer-events-none absolute right-0 top-0 h-[380px] w-[620px] rounded-full bg-mint/15 blur-[130px]" />
        <div className="container-x relative">
          <Reveal>
            <span className="eyebrow">{t('nav.gallery')}</span>
            <h1 className="mt-6 max-w-3xl font-display text-[clamp(2.3rem,6vw,4.6rem)] font-black leading-[0.96] tracking-tight">
              {t('gallery.title')}
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted">{t('gallery.sub')}</p>
          </Reveal>

          <div className="mt-9 flex flex-wrap items-center justify-between gap-4">
            <Tabs tabs={CATEGORIES} value={filter} onChange={setFilter} />
            <div className="flex items-center gap-2 text-xs text-muted">
              <span className="chip">{filtered.length} media</span>
              <span className="chip">{favorite.size} saved</span>
            </div>
          </div>
        </div>
      </section>

      {/* Coverflow */}
      {filtered.length > 0 && (
        <section className="relative pb-16">
          <div className="container-x">
            <div className="perspective-1200 relative h-[300px] sm:h-[430px]">
              <AnimatePresence initial={false}>
                {filtered.map((item, index) => {
                  const offset = index - active;
                  if (Math.abs(offset) > 3) return null;
                  const abs = Math.abs(offset);
                  return (
                    <motion.button
                      key={item._id}
                      layout
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{
                        opacity: abs > 2 ? 0.25 : 1,
                        scale: 1 - abs * 0.12,
                        x: offset * '32%',
                        z: -abs * 160,
                        rotateY: offset * -32,
                        filter: abs ? 'brightness(0.55) saturate(0.7)' : 'none',
                      }}
                      exit={{ opacity: 0, scale: 0.7 }}
                      transition={{ type: 'spring', stiffness: 180, damping: 24 }}
                      onClick={() => {
                        setActive(index);
                        if (offset === 0) setOpen(true);
                      }}
                      style={{ transformStyle: 'preserve-3d' }}
                      className="absolute left-1/2 top-1/2 h-[240px] w-[78%] max-w-[760px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[28px] border border-white/15 shadow-card sm:h-[400px]"
                    >
                      <img
                        src={item.thumbnail || item.url}
                        alt={item.title}
                        onError={(e) => {
                          e.currentTarget.style.visibility = 'hidden';
                        }}
                        className="h-full w-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-void/95 via-void/25 to-transparent" />
                      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-6 text-start">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-mint">{item.category}</p>
                          <p className="mt-1 font-display text-lg font-bold sm:text-2xl">{item.title}</p>
                        </div>
                        <span className="hidden rounded-full border border-white/25 bg-black/40 px-3 py-1.5 text-[11px] font-semibold backdrop-blur sm:block">
                          Click to enlarge
                        </span>
                      </div>
                    </motion.button>
                  );
                })}
              </AnimatePresence>
            </div>

            <div className="mt-8 flex items-center justify-center gap-3">
              <button
                onClick={() => setActive((a) => Math.max(0, a - 1))}
                className="grid h-11 w-11 place-items-center rounded-full border border-white/15 bg-white/5 transition hover:border-mint/60 hover:text-mint"
                aria-label="previous"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
              <div className="flex max-w-[60%] flex-wrap justify-center gap-1.5">
                {filtered.map((item, i) => (
                  <button
                    key={item._id}
                    onClick={() => setActive(i)}
                    aria-label={item.title}
                    className={`h-1.5 rounded-full transition-all ${i === active ? 'w-8 bg-mint' : 'w-3 bg-white/20 hover:bg-white/40'}`}
                  />
                ))}
              </div>
              <button
                onClick={() => setActive((a) => Math.min(filtered.length - 1, a + 1))}
                className="grid h-11 w-11 place-items-center rounded-full border border-white/15 bg-white/5 transition hover:border-mint/60 hover:text-mint"
                aria-label="next"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Grid */}
      <section className="relative pb-28 pt-6">
        <div className="container-x">
          <SectionHeading eyebrow="Archive" title="Browse the full archive" sub="Filter by facility, class, coach or event — every shot captured on the floor." align="left" />
          {filtered.length === 0 ? (
            <Empty title="No media in this category" subtitle="Try another filter — the archive updates as new shots are published." />
          ) : (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
              {filtered.map((item, i) => (
                <Reveal key={item._id} delay={(i % 8) * 0.04}>
                  <button
                    onClick={() => {
                      setActive(i);
                      setOpen(true);
                    }}
                    className="group relative block aspect-square w-full overflow-hidden rounded-2xl border border-white/10 text-start"
                  >
                    <div className="absolute inset-0">
                      <img
                        src={item.thumbnail || item.url}
                        alt={item.title}
                        loading="lazy"
                        onError={(e) => {
                          e.currentTarget.style.visibility = 'hidden';
                        }}
                        className="h-full w-full object-cover transition duration-700 group-hover:scale-110"
                      />
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-t from-void via-void/40 to-transparent opacity-85" />
                    <div className="absolute inset-x-0 bottom-0 p-4">
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-mint">{item.category}</p>
                      <p className="mt-0.5 line-clamp-2 text-sm font-semibold">{item.title}</p>
                    </div>
                    <span className="absolute end-3 top-3 grid h-8 w-8 place-items-center rounded-full border border-white/20 bg-black/40 opacity-0 backdrop-blur transition group-hover:opacity-100">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                        <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                      </svg>
                    </span>
                  </button>
                </Reveal>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Lightbox */}
      <Modal open={open} onClose={() => setOpen(false)} title={filtered[active]?.title || ''} size="lg">
        {filtered[active] && (
          <div>
            <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-white/10 bg-ink">
              <img
                src={filtered[active].url}
                alt={filtered[active].title}
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-mint">{filtered[active].category}</p>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">{filtered[active].description}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {(filtered[active].tags || []).map((tag) => (
                    <span key={tag} className="chip">#{tag}</span>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => toggleFav(filtered[active]._id)}
                  className={`grid h-10 w-10 place-items-center rounded-full border transition ${
                    favorite.has(filtered[active]._id) ? 'border-coral/60 bg-coral/15 text-coral' : 'border-white/15 text-muted hover:text-bone'
                  }`}
                  aria-label="save"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill={favorite.has(filtered[active]._id) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8">
                    <path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 00-7.8 7.8l8.8 8.8 8.8-8.8a5.5 5.5 0 000-7.8z" />
                  </svg>
                </button>
                <button
                  onClick={() => setActive((a) => Math.max(0, a - 1))}
                  className="grid h-10 w-10 place-items-center rounded-full border border-white/15 text-muted transition hover:border-mint/50 hover:text-mint"
                  aria-label="previous"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="M15 18l-6-6 6-6" />
                  </svg>
                </button>
                <button
                  onClick={() => setActive((a) => Math.min(filtered.length - 1, a + 1))}
                  className="grid h-10 w-10 place-items-center rounded-full border border-white/15 text-muted transition hover:border-mint/50 hover:text-mint"
                  aria-label="next"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
