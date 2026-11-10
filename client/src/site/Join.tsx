import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useSite } from '@/lib/site';
import { cap, money } from '@/lib/format';
import { Button, ErrorNote, Field, Input, Select, Textarea } from '@/components/ui';
import type { Quote } from '@/lib/types';

/** "Join now" creates a LEAD for the front desk to follow up. No payment, no member record. */
export default function Join() {
  const { site } = useSite();
  const [params] = useSearchParams();
  const [planId, setPlanId] = useState(params.get('plan') ?? '');
  const [category, setCategory] = useState(params.get('category') ?? '');
  const [code, setCode] = useState('');
  const [quote, setQuote] = useState<Quote | null>(null);
  const [form, setForm] = useState({ name: '', phone: '', email: '', message: '', website: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [done, setDone] = useState('');

  const plans = site?.plans ?? [];
  const plan = plans.find((p) => p._id === planId);
  const cats = useMemo(() => (plan ? Object.keys(plan.quotes) : site?.settings.categories ?? []), [plan, site]);
  const offerId = params.get('offer') ?? undefined;

  useEffect(() => {
    if (!planId && plans.length) {
      const fromOffer = offerId && site?.offers.find((o) => o._id === offerId)?.planIds[0];
      setPlanId(fromOffer || plans.find((p) => p.highlight)?._id || plans[0]._id);
    }
  }, [plans, planId, offerId, site]);
  useEffect(() => { if (cats.length && !cats.includes(category)) setCategory(cats[0]); }, [cats, category]);

  useEffect(() => {
    if (!planId || !category) return;
    const t = setTimeout(() => {
      api.get(`/public/quote?planId=${planId}&category=${encodeURIComponent(category)}${code ? `&code=${encodeURIComponent(code)}` : ''}`)
        .then((r) => setQuote(r.data))
        .catch(() => setQuote(null));
    }, code ? 400 : 0);
    return () => clearTimeout(t);
  }, [planId, category, code]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const msg = [form.message, code && `Promo code: ${code}`].filter(Boolean).join('\n');
      const r = await api.post('/public/leads', { ...form, message: msg, source: 'join', planId: planId || undefined, category, offerId: quote?.offer?.id ?? offerId });
      setDone(r.message);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  if (!site) return null;
  if (done) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center">
        <CheckCircle2 className="mx-auto h-14 w-14 text-link" />
        <h1 className="mt-4 font-display text-3xl font-bold">You're on the list!</h1>
        <p className="mt-3 text-muted">{done}</p>
        <Link to="/" className="mt-8 inline-block"><Button variant="outline">Back to home</Button></Link>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-5">
      <div className="lg:col-span-3">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-link">Join {site.site.brand.name}</p>
        <h1 className="mt-2 font-display text-4xl font-bold tracking-tight">Start your membership</h1>
        <p className="mt-3 text-muted">Tell us a little about you. Our team will call to confirm your plan, answer questions and book your first visit. You pay at the gym - nothing is charged online.</p>
        <form onSubmit={submit} className="mt-8 grid gap-4 sm:grid-cols-2">
          <Field label="Full name" required className="sm:col-span-2"><Input required minLength={2} autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Phone" hint="We'll call or WhatsApp you"><Input type="tel" autoComplete="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          <Field label="Email"><Input type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          {plans.length > 0 && (
            <Field label="Plan"><Select value={planId} onChange={(e) => setPlanId(e.target.value)}>{plans.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}</Select></Field>
          )}
          {cats.length > 1 && (
            <Field label="Category"><Select value={category} onChange={(e) => setCategory(e.target.value)}>{cats.map((c) => <option key={c} value={c}>{cap(c)}</option>)}</Select></Field>
          )}
          <Field label="Promo code" className="sm:col-span-2" error={quote?.codeRejected ? 'This code is not valid for the selected plan' : undefined}>
            <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Optional" />
          </Field>
          <Field label="Anything we should know?" className="sm:col-span-2"><Textarea rows={3} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} /></Field>
          {/* Honeypot: hidden from people, irresistible to bots */}
          <input tabIndex={-1} autoComplete="off" aria-hidden className="hidden" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
          <div className="sm:col-span-2"><ErrorNote error={error} /></div>
          <div className="sm:col-span-2">
            <Button size="lg" type="submit" loading={busy} disabled={!form.phone && !form.email}>Request a call back</Button>
            {!form.phone && !form.email && <p className="mt-2 text-xs text-muted">Add a phone number or email so we can reach you.</p>}
          </div>
        </form>
      </div>

      {quote && plan && (
        <aside className="lg:col-span-2">
          <div className="sticky top-24 rounded-brand border border-line bg-surface p-6 shadow-soft">
            <h2 className="font-display text-lg font-bold">{plan.name} · {cap(quote.category)}</h2>
            <p className="text-sm text-muted">{plan.durationDays} days</p>
            <dl className="mt-5 space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-muted">Plan price</dt><dd>{money(quote.base, quote.currency)}</dd></div>
              {quote.joiningFee > 0 && <div className="flex justify-between"><dt className="text-muted">Joining fee</dt><dd>{money(quote.joiningFee, quote.currency)}</dd></div>}
              {quote.discount > 0 && <div className="flex justify-between text-link"><dt>{quote.offer?.title}</dt><dd>-{money(quote.discount, quote.currency)}</dd></div>}
              {quote.taxRate > 0 && <div className="flex justify-between"><dt className="text-muted">{quote.taxLabel} {quote.taxRate}%{quote.taxInclusive ? ' (included)' : ''}</dt><dd>{money(quote.tax, quote.currency)}</dd></div>}
              <div className="flex justify-between border-t border-line pt-3 text-base font-bold"><dt>Total today</dt><dd>{money(quote.total, quote.currency)}</dd></div>
            </dl>
            <p className="mt-4 text-xs text-muted">Final price is confirmed at the front desk and matches what you see here.</p>
          </div>
        </aside>
      )}
    </div>
  );
}
