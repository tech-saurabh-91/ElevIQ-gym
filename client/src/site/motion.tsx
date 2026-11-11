import { useEffect, useRef, useState, type ElementType, type ReactNode } from 'react';

/**
 * Tiny, dependency-free motion helpers. Everything uses IntersectionObserver + CSS transitions,
 * runs once per element and is disabled for people who prefer reduced motion.
 */
export const prefersReducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function useInView<T extends Element>(options: IntersectionObserverInit = { rootMargin: '0px 0px -10% 0px', threshold: 0.12 }) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || inView) return;
    if (!('IntersectionObserver' in window) || prefersReducedMotion()) { setInView(true); return; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setInView(true); io.disconnect(); } }, options);
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView]);
  return { ref, inView };
}

/** Fades/slides children in when they scroll into view. `delay` in ms staggers siblings. */
export function Reveal({ children, className = '', delay = 0, as: Tag = 'div' }: { children: ReactNode; className?: string; delay?: number; as?: ElementType }) {
  const { ref, inView } = useInView<HTMLElement>();
  return (
    <Tag ref={ref} className={`reveal ${inView ? 'reveal-in' : ''} ${className}`} style={delay ? { transitionDelay: `${delay}ms` } : undefined}>
      {children}
    </Tag>
  );
}

/**
 * Animated counter for values like "1,200+", "40+", "9", "4.9/5". The leading number counts up;
 * any prefix/suffix text is kept as typed. Non-numeric values are shown unchanged.
 */
export function CountUp({ value, duration = 1400 }: { value: string; duration?: number }) {
  const m = value.match(/^(\D*?)(\d[\d,]*(?:\.\d+)?)(.*)$/);
  const { ref, inView } = useInView<HTMLSpanElement>();
  const target = m ? parseFloat(m[2].replace(/,/g, '')) : 0;
  const decimals = m && m[2].includes('.') ? m[2].split('.')[1].length : 0;
  const grouped = Boolean(m && m[2].includes(','));
  const [n, setN] = useState(() => (prefersReducedMotion() ? target : 0));
  useEffect(() => {
    if (!m || !inView || prefersReducedMotion()) { setN(target); return; }
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      setN(target * (1 - (1 - p) ** 3)); // ease-out cubic
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, target]);
  if (!m) return <span>{value}</span>;
  const shown = decimals ? n.toFixed(decimals) : grouped ? Math.round(n).toLocaleString('en-US') : String(Math.round(n));
  return <span ref={ref} aria-label={value}>{m[1]}{shown}{m[3]}</span>;
}

/** True once the page has scrolled past `offset` px. */
export function useScrolled(offset = 24) {
  const [scrolled, setScrolled] = useState(() => typeof window !== 'undefined' && window.scrollY > offset);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > offset);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, [offset]);
  return scrolled;
}
