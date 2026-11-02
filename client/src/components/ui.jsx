import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useInView } from 'framer-motion';

/* ------------------------------- Feedback ------------------------------- */

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const push = useCallback((message, tone = 'success') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, message, tone }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4200);
  }, []);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-6 right-6 z-[100] flex w-[min(92vw,360px)] flex-col gap-3">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 24, rotateX: -30 }}
              animate={{ opacity: 1, y: 0, rotateX: 0 }}
              exit={{ opacity: 0, x: 40 }}
              transition={{ type: 'spring', stiffness: 320, damping: 26 }}
              className={`pointer-events-auto flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm shadow-card backdrop-blur-xl ${
                t.tone === 'error'
                  ? 'border-coral/40 bg-coral/15 text-coral'
                  : t.tone === 'info'
                    ? 'border-sky/40 bg-sky/15 text-sky'
                    : 'border-mint/40 bg-mint/15 text-mint'
              }`}
            >
              <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-current" />
              <span className="text-bone/90">{t.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
};

/* -------------------------------- Primitives ------------------------------- */

export function Spinner({ className = '' }) {
  return (
    <span
      className={`inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-mint ${className}`}
      aria-label="loading"
    />
  );
}

export function Loading({ label = 'Loading…', className = '' }) {
  return (
    <div className={`flex items-center justify-center gap-3 py-16 text-muted ${className}`}>
      <Spinner className="h-5 w-5" />
      <span className="text-sm tracking-wide">{label}</span>
    </div>
  );
}

export function Badge({ children, tone = 'default', className = '' }) {
  const tones = {
    default: 'border-white/12 bg-white/6 text-muted',
    success: 'border-mint/35 bg-mint/12 text-mint',
    danger: 'border-coral/35 bg-coral/12 text-coral',
    warn: 'border-amber/35 bg-amber/12 text-amber',
    info: 'border-sky/35 bg-sky/12 text-sky',
    violet: 'border-violet/35 bg-violet/12 text-violet',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider ${tones[tone]} ${className}`}>
      {children}
    </span>
  );
}

export function Field({ label, hint, children }) {
  return (
    <label className="block">
      {label && <span className="label">{label}</span>}
      {children}
      {hint && <span className="mt-1.5 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function Input({ className = '', ...props }) {
  return <input className={`field ${className}`} {...props} />;
}

export function Select({ className = '', children, ...props }) {
  return (
    <select className={`field appearance-none bg-[#0d0f17] ${className}`} {...props}>
      {children}
    </select>
  );
}

export function Textarea({ className = '', ...props }) {
  return <textarea className={`field min-h-[120px] resize-y ${className}`} {...props} />;
}

export function Button({ variant = 'primary', className = '', loading, children, ...props }) {
  const map = { primary: 'btn-primary', ghost: 'btn-ghost', coral: 'btn-coral', subtle: 'btn bg-white/8 text-bone hover:bg-white/14' };
  return (
    <button className={`${map[variant] || map.primary} ${className}`} disabled={loading || props.disabled} {...props}>
      {loading && <Spinner className="h-3.5 w-3.5" />}
      {children}
    </button>
  );
}

export function Modal({ open, onClose, title, children, size = 'md' }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[90] flex items-end justify-center bg-black/70 p-4 backdrop-blur-md sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}
        >
          <motion.div
            initial={{ opacity: 0, y: 40, rotateX: -14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, rotateX: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            className={`glass-strong w-full ${size === 'lg' ? 'max-w-3xl' : size === 'sm' ? 'max-w-md' : 'max-w-xl'} max-h-[88vh] overflow-y-auto rounded-3xl p-6 shadow-card`}
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <h3 className="font-display text-xl font-bold">{title}</h3>
              <button onClick={onClose} className="rounded-full border border-white/10 p-1.5 text-muted transition hover:border-coral/50 hover:text-coral" aria-label="close">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Empty({ title = 'Nothing here yet', subtitle, action }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-2xl border border-white/10 bg-white/5 text-muted">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <rect x="3" y="3" width="18" height="18" rx="4" />
          <path d="M8 12h8M12 8v8" />
        </svg>
      </div>
      <p className="font-display text-lg font-semibold">{title}</p>
      {subtitle && <p className="max-w-sm text-sm text-muted">{subtitle}</p>}
      {action}
    </div>
  );
}

/* --------------------------------- Motion --------------------------------- */

export function Reveal({ children, delay = 0, y = 28, className = '', once = true }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once, margin: '-60px' });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y, rotateX: -12 }}
      animate={inView ? { opacity: 1, y: 0, rotateX: 0 } : {}}
      transition={{ duration: 0.7, delay, ease: [0.2, 0.8, 0.2, 1] }}
      style={{ transformPerspective: 1200 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function Tilt({ children, className = '', max = 12 }) {
  const ref = useRef(null);

  const onMove = (e) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(1100px) rotateY(${px * max}deg) rotateX(${-py * max}deg) translateZ(14px)`;
  };

  const onLeave = () => {
    const el = ref.current;
    if (el) el.style.transform = 'perspective(1100px) rotateY(0deg) rotateX(0deg) translateZ(0)';
  };

  return (
    <div ref={ref} onMouseMove={onMove} onMouseLeave={onLeave} className={`card-3d will-change-transform ${className}`}>
      {children}
    </div>
  );
}

export function SectionHeading({ eyebrow, title, sub, align = 'center', className = '' }) {
  const alignCls = align === 'center' ? 'items-center text-center' : 'items-start text-left';
  return (
    <div className={`mb-14 flex flex-col gap-4 ${alignCls} ${className}`}>
      {eyebrow && <span className="eyebrow">{eyebrow}</span>}
      <h2 className="section-title max-w-3xl">{title}</h2>
      {sub && <p className="max-w-2xl text-base leading-relaxed text-muted">{sub}</p>}
    </div>
  );
}

export function CountUp({ to = 0, duration = 1.6, suffix = '' }) {
  const [val, setVal] = useState(0);
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });

  useEffect(() => {
    if (!inView) return undefined;
    let raf;
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min((now - start) / (duration * 1000), 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(to * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, to, duration]);

  return (
    <span ref={ref}>
      {val.toLocaleString()}
      {suffix}
    </span>
  );
}

export function Tabs({ tabs, value, onChange, className = '' }) {
  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {tabs.map((tab) => (
        <button
          key={tab.value}
          onClick={() => onChange(tab.value)}
          className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wider transition ${
            value === tab.value ? 'bg-mint text-void shadow-glow' : 'border border-white/10 bg-white/5 text-muted hover:border-white/25 hover:text-bone'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
