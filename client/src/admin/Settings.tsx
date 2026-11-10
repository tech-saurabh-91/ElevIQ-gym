import { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { api } from '@/lib/api';
import { useSite } from '@/lib/site';
import { configureFormat, DAY_NAMES, money } from '@/lib/format';
import { Button, Card, ErrorNote, Field, Input, PageHeader, Select, Spinner, Toggle, useToast } from '@/components/ui';
import type { Hours } from '@/lib/types';

export const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'AUD', 'CAD', 'SGD', 'ZAR', 'JPY', 'BRL', 'MXN', 'SAR', 'NZD', 'MYR', 'PHP', 'IDR', 'NGN', 'KES', 'PKR', 'BDT', 'LKR', 'NPR'];
export const LOCALES = ['en-IN', 'hi-IN', 'en-US', 'en-GB', 'en-AU', 'en-CA', 'en-SG', 'en-ZA', 'ar-AE', 'es-ES', 'es-MX', 'fr-FR', 'de-DE', 'pt-BR', 'ja-JP'];

export function HoursEditor({ hours, onChange }: { hours: Hours[]; onChange: (h: Hours[]) => void }) {
  const ordered = [1, 2, 3, 4, 5, 6, 0].map((d) => hours.find((h) => h.day === d) ?? { day: d, open: '06:00', close: '22:00', closed: true });
  const set = (day: number, patch: Partial<Hours>) => onChange(ordered.map((h) => (h.day === day ? { ...h, ...patch } : h)));
  return (
    <div className="space-y-2">
      {ordered.map((h) => (
        <div key={h.day} className="grid grid-cols-[110px_1fr_1fr_auto] items-center gap-3">
          <span className="text-sm font-medium">{DAY_NAMES()[h.day]}</span>
          <Input type="time" aria-label="Opens" value={h.open} disabled={h.closed} onChange={(e) => set(h.day, { open: e.target.value })} />
          <Input type="time" aria-label="Closes" value={h.close} disabled={h.closed} onChange={(e) => set(h.day, { close: e.target.value })} />
          <Toggle checked={!h.closed} onChange={(v) => set(h.day, { closed: !v })} label={h.closed ? 'Closed' : 'Open'} />
        </div>
      ))}
    </div>
  );
}

export function useSettings() {
  const [s, setS] = useState<any>(null);
  const [error, setError] = useState<unknown>(null);
  useEffect(() => { api.get('/admin/settings').then((r) => setS(r.data)).catch(setError); }, []);
  const save = async (next = s) => {
    const { setupCompleted: _x, ...body } = next;
    void _x;
    const r = await api.put('/admin/settings', body);
    setS({ ...next, ...r.data });
    configureFormat(r.data);
    return r.data;
  };
  return { s, setS, save, error };
}

/** Currency, tax, hours, categories: shared by billing and the public website. */
export default function Settings() {
  const toast = useToast();
  const { reload } = useSite();
  const { s, setS, save, error } = useSettings();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  const [cat, setCat] = useState('');
  if (error) return <ErrorNote error={error} />;
  if (!s) return <Spinner />;

  const submit = async () => {
    setBusy(true); setErr(null);
    try { await save(); toast('Settings saved - website and billing updated'); void reload(); } catch (e) { setErr(e); } finally { setBusy(false); }
  };

  return (
    <>
      <PageHeader title="Business settings" subtitle="One source of truth: the website, invoices and reports all use these values." actions={<Button loading={busy} onClick={submit}>Save settings</Button>} />
      <ErrorNote error={err} />
      <div className="mt-2 grid gap-6 lg:grid-cols-2">
        <Card title="Business">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Gym name" className="sm:col-span-2"><Input value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })} /></Field>
            <Field label="Legal name (on invoices)" className="sm:col-span-2"><Input value={s.legalName} onChange={(e) => setS({ ...s, legalName: e.target.value })} /></Field>
            <Field label="Currency" hint={`Preview: ${(() => { try { return new Intl.NumberFormat(s.locale, { style: 'currency', currency: s.currency }).format(1999); } catch { return money(1999); } })()}`}>
              <Select value={s.currency} onChange={(e) => setS({ ...s, currency: e.target.value })}>{[...new Set([s.currency, ...CURRENCIES])].map((c) => <option key={c}>{c}</option>)}</Select>
            </Field>
            <Field label="Number & date format"><Select value={s.locale} onChange={(e) => setS({ ...s, locale: e.target.value })}>{[...new Set([s.locale, ...LOCALES])].map((c) => <option key={c}>{c}</option>)}</Select></Field>
            <Field label="Time zone" className="sm:col-span-2" hint="e.g. Asia/Kolkata, Europe/London">
              <Input list="tz-list" value={s.timezone} onChange={(e) => setS({ ...s, timezone: e.target.value })} />
              <datalist id="tz-list">{(Intl as any).supportedValuesOf?.('timeZone')?.map((z: string) => <option key={z} value={z} />)}</datalist>
            </Field>
            <Field label="Invoice prefix"><Input value={s.invoicePrefix} onChange={(e) => setS({ ...s, invoicePrefix: e.target.value.toUpperCase() })} /></Field>
            <Field label="Member number prefix"><Input value={s.memberIdPrefix} onChange={(e) => setS({ ...s, memberIdPrefix: e.target.value.toUpperCase() })} /></Field>
          </div>
        </Card>
        <Card title="Tax">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tax name" hint="GST, VAT, Sales tax…"><Input value={s.tax.label} onChange={(e) => setS({ ...s, tax: { ...s.tax, label: e.target.value } })} /></Field>
            <Field label="Rate (%)"><Input type="number" min={0} max={100} step="0.01" value={s.tax.rate} onChange={(e) => setS({ ...s, tax: { ...s.tax, rate: Number(e.target.value) } })} /></Field>
            <Field label="Tax registration no." className="sm:col-span-2"><Input value={s.tax.registrationNo} onChange={(e) => setS({ ...s, tax: { ...s.tax, registrationNo: e.target.value } })} /></Field>
            <div className="sm:col-span-2"><Toggle checked={s.tax.inclusive} onChange={(v) => setS({ ...s, tax: { ...s.tax, inclusive: v } })} label="Prices already include tax" /></div>
          </div>
          <div className="mt-6 border-t border-line pt-5">
            <p className="mb-2 text-xs font-semibold">Pricing categories</p>
            <div className="flex flex-wrap gap-2">
              {s.categories.map((c: string) => (
                <span key={c} className="inline-flex items-center gap-1 rounded-full bg-surface2 px-3 py-1 text-xs font-semibold">
                  {c}{c !== 'standard' && <button aria-label={`Remove ${c}`} onClick={() => setS({ ...s, categories: s.categories.filter((x: string) => x !== c) })}><X className="h-3 w-3" /></button>}
                </span>
              ))}
            </div>
            <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); const v = cat.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-'); if (v && !s.categories.includes(v)) setS({ ...s, categories: [...s.categories, v] }); setCat(''); }}>
              <Input placeholder="e.g. corporate" value={cat} onChange={(e) => setCat(e.target.value)} />
              <Button type="submit" variant="secondary" icon={<Plus className="h-4 w-4" />}>Add</Button>
            </form>
          </div>
        </Card>
        <Card title="Working days & hours" className="lg:col-span-2">
          <HoursEditor hours={s.hours} onChange={(hours) => setS({ ...s, hours })} />
        </Card>
      </div>
    </>
  );
}
