import {
  createContext, forwardRef, useCallback, useContext, useEffect, useId, useRef, useState,
  type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes,
} from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, CheckCircle2, Loader2, X } from 'lucide-react';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

/* --------------------------------- buttons --------------------------------- */

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'; size?: 'sm' | 'md' | 'lg'; loading?: boolean; icon?: ReactNode };
export const Button = forwardRef<HTMLButtonElement, BtnProps>(function Button({ variant = 'primary', size = 'md', loading, icon, className, children, disabled, ...rest }, ref) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-brand font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap',
        size === 'sm' && 'h-8 px-3 text-xs',
        size === 'md' && 'h-10 px-4 text-sm',
        size === 'lg' && 'h-12 px-6 text-base',
        variant === 'primary' && 'bg-primary text-on-primary hover:brightness-110 shadow-sm',
        variant === 'secondary' && 'bg-surface2 text-ink hover:bg-line',
        variant === 'outline' && 'border border-line bg-surface text-ink hover:bg-surface2',
        variant === 'ghost' && 'text-ink hover:bg-surface2',
        variant === 'danger' && 'bg-red-600 text-white hover:bg-red-700',
        className
      )}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {children}
    </button>
  );
});

/* ---------------------------------- inputs ---------------------------------- */

const inputCls = 'w-full rounded-brand border border-line bg-surface px-3 text-sm text-ink placeholder:text-muted/80 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25 disabled:opacity-60';

export function Field({ label, hint, error, children, className, required }: { label?: ReactNode; hint?: ReactNode; error?: string; children: ReactNode; className?: string; required?: boolean }) {
  return (
    <label className={cx('block', className)}>
      {label && <span className="mb-1.5 block text-xs font-semibold text-ink">{label}{required && <span className="text-red-500"> *</span>}</span>}
      {children}
      {error ? <span className="mt-1 block text-xs text-red-600">{error}</span> : hint ? <span className="mt-1 block text-xs text-muted">{hint}</span> : null}
    </label>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...p }, ref) {
  return <input ref={ref} className={cx(inputCls, 'h-10', className)} {...p} />;
});
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, rows = 4, ...p }, ref) {
  return <textarea ref={ref} rows={rows} className={cx(inputCls, 'py-2', className)} {...p} />;
});
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...p }, ref) {
  return <select ref={ref} className={cx(inputCls, 'h-10 pr-8', className)} {...p}>{children}</select>;
});

export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label?: ReactNode; disabled?: boolean }) {
  const id = useId();
  return (
    <label htmlFor={id} className={cx('inline-flex cursor-pointer select-none items-center gap-2 text-sm', disabled && 'opacity-50')}>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cx('relative h-6 w-11 shrink-0 rounded-full transition', checked ? 'bg-primary' : 'bg-line')}
      >
        <span className={cx('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition', checked ? 'left-[22px]' : 'left-0.5')} />
      </button>
      {label}
    </label>
  );
}

/* --------------------------------- surfaces --------------------------------- */

export function Card({ children, className, title, actions, padded = true }: { children: ReactNode; className?: string; title?: ReactNode; actions?: ReactNode; padded?: boolean }) {
  return (
    <section className={cx('rounded-brand border border-line bg-surface shadow-soft', className)}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          <h3 className="text-sm font-bold text-ink">{title}</h3>
          <div className="flex items-center gap-2">{actions}</div>
        </header>
      )}
      <div className={padded ? 'p-5' : ''}>{children}</div>
    </section>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

const TONES: Record<string, string> = {
  green: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  red: 'bg-red-500/15 text-red-700 dark:text-red-300',
  amber: 'bg-amber-500/15 text-amber-800 dark:text-amber-300',
  blue: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
  gray: 'bg-surface2 text-muted',
  primary: 'bg-primary/15 text-link',
};
export function Badge({ children, tone = 'gray', className }: { children: ReactNode; tone?: keyof typeof TONES | string; className?: string }) {
  return <span className={cx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize', TONES[tone] ?? TONES.gray, className)}>{children}</span>;
}
export const statusTone = (s: string) =>
  ({ active: 'green', paid: 'green', converted: 'green', done: 'green', booked: 'green', 'in-use': 'green', published: 'green',
     expired: 'red', void: 'red', lost: 'red', cancelled: 'red', 'out-of-order': 'red', disabled: 'red', suspended: 'red', critical: 'red',
     partial: 'amber', unpaid: 'amber', frozen: 'blue', contacted: 'blue', trial: 'blue', waitlist: 'amber', maintenance: 'amber', 'in-progress': 'blue', high: 'amber',
     new: 'primary', open: 'primary' } as Record<string, string>)[s] ?? 'gray';

export function Stat({ label, value, hint, icon, tone }: { label: string; value: ReactNode; hint?: ReactNode; icon?: ReactNode; tone?: 'primary' | 'warn' | 'bad' }) {
  return (
    <div className="rounded-brand border border-line bg-surface p-4 shadow-soft">
      <div className="flex items-center justify-between text-xs font-semibold text-muted">
        {label}
        {icon && <span className={cx('grid h-8 w-8 place-items-center rounded-full', tone === 'bad' ? 'bg-red-500/10 text-red-600' : tone === 'warn' ? 'bg-amber-500/15 text-amber-700' : 'bg-primary/10 text-link')}>{icon}</span>}
      </div>
      <div className="mt-2 font-display text-2xl font-bold text-ink">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted">
      <Loader2 className="h-4 w-4 animate-spin" /> {label ?? 'Loading…'}
    </div>
  );
}

export function Empty({ title, children, icon }: { title: string; children?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      {icon && <div className="text-muted">{icon}</div>}
      <p className="text-sm font-semibold text-ink">{title}</p>
      {children && <div className="max-w-sm text-sm text-muted">{children}</div>}
    </div>
  );
}

export function ErrorNote({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <div role="alert" className="flex items-start gap-2 rounded-brand border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {(error as Error).message ?? String(error)}
    </div>
  );
}

/* ---------------------------------- tables ---------------------------------- */

export type Column<T> = { key: string; header: ReactNode; render: (row: T) => ReactNode; className?: string };
export function Table<T extends { _id?: string }>({ columns, rows, onRowClick, empty = 'Nothing here yet', loading }: { columns: Column<T>[]; rows: T[]; onRowClick?: (r: T) => void; empty?: ReactNode; loading?: boolean }) {
  if (loading) return <Spinner />;
  if (!rows.length) return <Empty title={typeof empty === 'string' ? empty : 'Nothing here yet'}>{typeof empty === 'string' ? null : empty}</Empty>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-line text-xs font-semibold uppercase tracking-wide text-muted">
            {columns.map((c) => <th key={c.key} className={cx('px-4 py-3', c.className)}>{c.header}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr
              key={r._id ?? i}
              onClick={onRowClick ? () => onRowClick(r) : undefined}
              onKeyDown={onRowClick ? (e) => { if (e.key === 'Enter') onRowClick(r); } : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              className={cx('border-b border-line/70 last:border-0', onRowClick && 'cursor-pointer hover:bg-surface2 focus:bg-surface2 focus:outline-none')}
            >
              {columns.map((c) => <td key={c.key} className={cx('px-4 py-3 align-middle text-ink', c.className)}>{c.render(r)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Pager({ page, pages, onPage, total }: { page: number; pages: number; total?: number; onPage: (p: number) => void }) {
  if (pages <= 1) return total !== undefined ? <div className="px-4 py-3 text-xs text-muted">{total} total</div> : null;
  return (
    <div className="flex items-center justify-between px-4 py-3 text-xs text-muted">
      <span>Page {page} of {pages}{total !== undefined && ` · ${total} total`}</span>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</Button>
        <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</Button>
      </div>
    </div>
  );
}

export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { value: T; label: ReactNode }[] }) {
  return (
    <div role="tablist" className="inline-flex flex-wrap gap-1 rounded-brand border border-line bg-surface2 p-1">
      {items.map((i) => (
        <button
          key={i.value}
          role="tab"
          aria-selected={value === i.value}
          onClick={() => onChange(i.value)}
          className={cx('rounded-[calc(var(--radius)-4px)] px-3 py-1.5 text-xs font-semibold transition', value === i.value ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink')}
        >
          {i.label}
        </button>
      ))}
    </div>
  );
}

/* ---------------------------------- modal ---------------------------------- */

export function Modal({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  // Keep the latest onClose in a ref. Parents usually pass an inline arrow function, which is a new
  // function on every render; depending on it re-ran this effect on every keystroke and moved focus
  // back to the first field.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeRef.current(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    // Focus the first field once, when the dialog opens - never while the user is typing.
    const t = setTimeout(() => {
      if (!ref.current?.contains(document.activeElement)) {
        ref.current?.querySelector<HTMLElement>('input:not([type=hidden]),select,textarea,button:not([data-close])')?.focus();
      }
    }, 30);
    return () => { clearTimeout(t); document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; prev?.focus?.(); };
  }, [open]);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={ref} role="dialog" aria-modal="true" className={cx('flex max-h-[92vh] w-full flex-col rounded-t-2xl border border-line bg-surface shadow-2xl sm:rounded-brand', wide ? 'sm:max-w-3xl' : 'sm:max-w-lg')}>
        <header className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-base font-bold text-ink">{title}</h2>
          <button data-close onClick={onClose} aria-label="Close" className="rounded-full p-1 text-muted hover:bg-surface2 hover:text-ink"><X className="h-5 w-5" /></button>
        </header>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && <footer className="flex justify-end gap-2 border-t border-line px-5 py-3">{footer}</footer>}
      </div>
    </div>,
    document.body
  );
}

/* ---------------------------------- toasts ---------------------------------- */

type Toast = { id: number; text: string; tone: 'ok' | 'err' };
const ToastCtx = createContext<(text: string, tone?: 'ok' | 'err') => void>(() => {});
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((text: string, tone: 'ok' | 'err' = 'ok') => {
    const id = Date.now() + Math.random();
    setItems((x) => [...x, { id, text, tone }]);
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), 4200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2">
        {items.map((t) => (
          <div key={t.id} className={cx('pointer-events-auto flex items-start gap-2 rounded-brand border px-4 py-3 text-sm shadow-lg', t.tone === 'ok' ? 'border-line bg-surface text-ink' : 'border-red-500/40 bg-red-600 text-white')}>
            {t.tone === 'ok' ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

/* ---------------------------------- hooks ---------------------------------- */

/** Fetch helper: re-runs when `deps` change; exposes reload. */
export function useLoad<T>(fn: (signal: AbortSignal) => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const ac = new AbortController();
    setLoading(true);
    fn(ac.signal)
      .then((d) => { setData(d); setError(null); })
      .catch((e) => { if (e.name !== 'AbortError') setError(e); })
      .finally(() => { if (!ac.signal.aborted) setLoading(false); });
    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  return { data, error, loading, reload: () => setTick((t) => t + 1), setData };
}

export function useConfirm() {
  const [state, setState] = useState<{ text: string; resolve: (v: boolean) => void } | null>(null);
  const confirm = (text: string) => new Promise<boolean>((resolve) => setState({ text, resolve }));
  const dialog = (
    <Modal
      open={Boolean(state)}
      onClose={() => { state?.resolve(false); setState(null); }}
      title="Please confirm"
      footer={
        <>
          <Button variant="outline" onClick={() => { state?.resolve(false); setState(null); }}>Cancel</Button>
          <Button variant="danger" onClick={() => { state?.resolve(true); setState(null); }}>Confirm</Button>
        </>
      }
    >
      <p className="text-sm text-ink">{state?.text}</p>
    </Modal>
  );
  return { confirm, dialog };
}
