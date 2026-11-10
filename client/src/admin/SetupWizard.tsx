import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ChevronLeft, ChevronRight, Rocket } from 'lucide-react';
import { api } from '@/lib/api';
import { extractPalette } from '@/lib/theme';
import { useAuth } from '@/lib/auth';
import { useSite } from '@/lib/site';
import { cap, uid } from '@/lib/format';
import { Button, Card, ErrorNote, Field, Input, Select, Spinner, Textarea, cx, useToast } from '@/components/ui';
import { ImageInput } from '@/components/ImageInput';
import { CURRENCIES, HoursEditor, LOCALES, useSettings } from './Settings';
import { PLAN_TEMPLATES } from './Plans';

const STEPS = ['Brand', 'Business', 'Contact & hours', 'Plans', 'Homepage', 'Go live'];

/** Empty gym -> live branded site in a few minutes. Every step saves as you go. */
export default function SetupWizard() {
  const nav = useNavigate();
  const toast = useToast();
  const { refresh } = useAuth();
  const { reload } = useSite();
  const { s, setS, save, error } = useSettings();
  const [draft, setDraft] = useState<any>(null);
  const [plans, setPlans] = useState<any[] | null>(null);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  const [prices, setPrices] = useState<Record<string, Record<string, string>>>({});

  useEffect(() => {
    api.get('/admin/website/draft').then((r) => setDraft(r.data.content)).catch(setErr);
    api.get('/admin/plans?limit=100').then((r) => setPlans(r.data)).catch(setErr);
  }, []);

  if (error || (err && !draft)) return <ErrorNote error={error || err} />;
  if (!s || !draft || !plans) return <Spinner />;

  const saveDraft = async (d = draft) => {
    const { theme: _t, ...content } = d;
    void _t;
    const r = await api.put('/admin/website/draft', { content });
    setDraft(r.data.content);
  };

  const next = async () => {
    setBusy(true); setErr(null);
    try {
      if (step === 0 || step === 2 || step === 4) await saveDraft();
      if (step === 1 || step === 2) await save();
      if (step === 3) {
        for (const t of PLAN_TEMPLATES) {
          const p = prices[t.name];
          if (!p || !Number(p.standard)) continue;
          if (plans.some((x) => x.name === t.name)) continue;
          const r = await api.post('/admin/plans', { ...t, prices: s.categories.filter((c: string) => Number(p[c])).map((c: string) => ({ category: c, amount: Number(p[c]) })) });
          setPlans((x) => [...(x ?? []), r.data]);
        }
      }
      setStep((x) => x + 1);
    } catch (e) { setErr(e); } finally { setBusy(false); }
  };

  const finish = async () => {
    setBusy(true); setErr(null);
    try {
      await saveDraft();
      await api.post('/admin/website/publish', { note: 'Launch' });
      await api.post('/admin/settings/setup-complete');
      await refresh();
      await reload();
      toast('Your website is live!');
      nav('/admin');
    } catch (e) { setErr(e); } finally { setBusy(false); }
  };

  const b = draft.brand;
  const fromLogo = async (url: string, colors?: string[]) => {
    try {
      const p = await extractPalette(url).catch(() => (colors?.length ? { primary: colors[0], secondary: colors[1], accent: colors[2], swatches: colors } : null));
      setDraft({ ...draft, brand: { ...b, logoUrl: url, ...(p && { seed: { primary: p.primary, secondary: p.secondary, accent: p.accent } }) } });
    } catch { setDraft({ ...draft, brand: { ...b, logoUrl: url } }); }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-display text-2xl font-bold">Set up your gym</h1>
      <p className="mt-1 text-sm text-muted">About 10 minutes. You can change everything later.</p>
      <ol className="my-6 flex flex-wrap gap-2">
        {STEPS.map((t, i) => (
          <li key={t} className={cx('flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold', i === step ? 'bg-primary text-on-primary' : i < step ? 'bg-primary/15 text-link' : 'bg-surface2 text-muted')}>
            {i < step ? <Check className="h-3 w-3" /> : <span>{i + 1}</span>} {t}
          </li>
        ))}
      </ol>
      <Card>
        {step === 0 && (
          <div className="grid gap-4">
            <Field label="Gym name"><Input value={b.name} onChange={(e) => setDraft({ ...draft, brand: { ...b, name: e.target.value } })} /></Field>
            <Field label="Tagline"><Input value={b.tagline} onChange={(e) => setDraft({ ...draft, brand: { ...b, tagline: e.target.value } })} /></Field>
            <ImageInput kind="logo" label="Upload your logo - we'll build your colour theme from it" aspect="aspect-[3/1]" value={b.logoUrl} onChange={(v) => setDraft({ ...draft, brand: { ...b, logoUrl: v } })} onUploaded={(u) => fromLogo(u.url, u.colors)} />
            <div className="flex items-center gap-3 text-xs text-muted">
              Theme colours:
              {[b.seed.primary, b.seed.secondary, b.seed.accent].filter(Boolean).map((c: string) => <span key={c} className="h-6 w-6 rounded-full border border-line" style={{ background: c }} title={c} />)}
              <span>(fine-tune later in Website → Branding)</span>
            </div>
          </div>
        )}
        {step === 1 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Legal name (on invoices)" className="sm:col-span-2"><Input value={s.legalName} onChange={(e) => setS({ ...s, legalName: e.target.value })} /></Field>
            <Field label="Currency"><Select value={s.currency} onChange={(e) => setS({ ...s, currency: e.target.value })}>{[...new Set([s.currency, ...CURRENCIES])].map((c) => <option key={c}>{c}</option>)}</Select></Field>
            <Field label="Format"><Select value={s.locale} onChange={(e) => setS({ ...s, locale: e.target.value })}>{[...new Set([s.locale, ...LOCALES])].map((c) => <option key={c}>{c}</option>)}</Select></Field>
            <Field label="Tax name"><Input value={s.tax.label} onChange={(e) => setS({ ...s, tax: { ...s.tax, label: e.target.value } })} /></Field>
            <Field label="Tax rate (%)"><Input type="number" min={0} max={100} value={s.tax.rate} onChange={(e) => setS({ ...s, tax: { ...s.tax, rate: Number(e.target.value) } })} /></Field>
            <Field label="Time zone" className="sm:col-span-2"><Input value={s.timezone} onChange={(e) => setS({ ...s, timezone: e.target.value })} /></Field>
          </div>
        )}
        {step === 2 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Phone"><Input value={draft.contact.phone} onChange={(e) => setDraft({ ...draft, contact: { ...draft.contact, phone: e.target.value } })} /></Field>
            <Field label="WhatsApp"><Input value={draft.contact.whatsapp} onChange={(e) => setDraft({ ...draft, contact: { ...draft.contact, whatsapp: e.target.value } })} /></Field>
            <Field label="Email" className="sm:col-span-2"><Input value={draft.contact.email} onChange={(e) => setDraft({ ...draft, contact: { ...draft.contact, email: e.target.value } })} /></Field>
            <Field label="Address" className="sm:col-span-2"><Input value={draft.contact.address} onChange={(e) => setDraft({ ...draft, contact: { ...draft.contact, address: e.target.value, mapQuery: draft.contact.mapQuery || `${b.name}, ${e.target.value}` } })} /></Field>
            <div className="sm:col-span-2"><p className="mb-2 text-xs font-semibold">Opening hours</p><HoursEditor hours={s.hours} onChange={(hours) => setS({ ...s, hours })} /></div>
          </div>
        )}
        {step === 3 && (
          <div>
            {plans.length > 0 && <p className="mb-4 rounded-brand bg-surface2 p-3 text-sm">You already have {plans.length} plan(s): {plans.map((p) => p.name).join(', ')}.</p>}
            <p className="mb-4 text-sm text-muted">Enter prices for the plans you offer. Leave a plan blank to skip it. Prices are before {s.tax.label}.</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-muted"><th className="py-2">Plan</th>{s.categories.map((c: string) => <th key={c} className="px-1 py-2">{cap(c)}</th>)}</tr></thead>
                <tbody>
                  {PLAN_TEMPLATES.map((t) => (
                    <tr key={t.name}>
                      <td className="py-1.5 pr-2 font-semibold">{t.name}</td>
                      {s.categories.map((c: string) => (
                        <td key={c} className="px-1 py-1.5"><Input type="number" min={0} aria-label={`${t.name} ${c}`} value={prices[t.name]?.[c] ?? ''} onChange={(e) => setPrices({ ...prices, [t.name]: { ...prices[t.name], [c]: e.target.value } })} /></td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {step === 4 && (
          <div className="grid gap-4">
            <ImageInput kind="banner" label="Main banner photo" value={draft.banners[0]?.imageUrl ?? ''} onChange={(v) => setDraft({ ...draft, banners: [{ ...(draft.banners[0] ?? { id: uid(), ctaLabel: 'Join now', ctaHref: '/join', active: true, subtitle: '' }), title: draft.banners[0]?.title || `Welcome to ${b.name}`, imageUrl: v }, ...draft.banners.slice(1)] })} />
            <Field label="Headline"><Input value={draft.banners[0]?.title ?? ''} onChange={(e) => setDraft({ ...draft, banners: [{ ...draft.banners[0], title: e.target.value }, ...draft.banners.slice(1)] })} /></Field>
            <Field label="About your gym"><Textarea rows={5} value={draft.about.body} onChange={(e) => setDraft({ ...draft, about: { ...draft.about, body: e.target.value } })} /></Field>
          </div>
        )}
        {step === 5 && (
          <div className="text-center">
            <Rocket className="mx-auto h-12 w-12 text-link" />
            <h2 className="mt-3 font-display text-xl font-bold">Ready to go live</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted">Preview first if you like. Publishing makes the site visible to everyone. You can keep editing and re-publish at any time.</p>
            <div className="mt-6 flex justify-center gap-2">
              <Button variant="outline" onClick={async () => { await saveDraft(); window.open('/?preview=draft', '_blank', 'noopener'); }}>Preview</Button>
              <Button loading={busy} icon={<Rocket className="h-4 w-4" />} onClick={finish}>Publish my website</Button>
            </div>
          </div>
        )}
        <div className="mt-4"><ErrorNote error={err} /></div>
        {step < 5 && (
          <div className="mt-6 flex justify-between border-t border-line pt-4">
            <Button variant="ghost" disabled={step === 0} icon={<ChevronLeft className="h-4 w-4" />} onClick={() => setStep(step - 1)}>Back</Button>
            <Button loading={busy} onClick={next}>Save & continue <ChevronRight className="h-4 w-4" /></Button>
          </div>
        )}
      </Card>
    </div>
  );
}
