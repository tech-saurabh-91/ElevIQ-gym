import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { cap, date, money } from '@/lib/format';
import { useSite } from '@/lib/site';
import { Button, ErrorNote, Field, Input, Modal, Select, Toggle, useLoad, useToast } from '@/components/ui';
import type { Quote } from '@/lib/types';

export const METHODS = ['cash', 'upi', 'card', 'bank-transfer', 'wallet', 'other'];

/** Sell or renew a membership. The price comes from the server's quote(), same as the website. */
export function SellMembership({ member, open, onClose, onDone }: { member: any; open: boolean; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const { site } = useSite();
  const plans = useLoad((s) => api.get('/admin/plans?active=true&limit=200', s).then((r) => r.data as any[]), []);
  const [planId, setPlanId] = useState('');
  const [category, setCategory] = useState(member?.category ?? 'standard');
  const [code, setCode] = useState('');
  const [q, setQ] = useState<Quote | null>(null);
  const [qErr, setQErr] = useState<unknown>(null);
  const [pay, setPay] = useState(true);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('upi');
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);

  useEffect(() => { if (!planId && plans.data?.length) setPlanId(plans.data[0]._id); }, [plans.data, planId]);
  useEffect(() => {
    if (!open || !planId) return;
    const t = setTimeout(() => {
      api.post('/admin/billing/quote', { memberId: member._id, planId, category, code: code || undefined })
        .then((r) => { setQ(r.data); setQErr(null); setAmount(String(r.data.total)); })
        .catch((e) => { setQ(null); setQErr(e); });
    }, code ? 350 : 0);
    return () => clearTimeout(t);
  }, [open, planId, category, code, member?._id]);

  const submit = async () => {
    setBusy(true); setErr(null);
    try {
      await api.post('/admin/billing/memberships', {
        memberId: member._id, planId, category, code: code || undefined,
        payment: pay && Number(amount) > 0 ? { amount: Number(amount), method, reference: reference || undefined } : undefined,
      });
      toast('Membership saved and invoice created');
      onDone(); onClose();
    } catch (e) { setErr(e); } finally { setBusy(false); }
  };

  const plan = plans.data?.find((p) => p._id === planId);
  const cats = plan ? plan.prices.map((p: any) => p.category) : site?.settings.categories ?? [];

  return (
    <Modal open={open} onClose={onClose} title={`Membership for ${member?.firstName ?? ''}`} wide footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button loading={busy} disabled={!q || (q.codeRejected && Boolean(code))} onClick={submit}>{pay ? 'Create invoice & take payment' : 'Create invoice'}</Button></>}>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="grid content-start gap-4">
          <Field label="Plan"><Select value={planId} onChange={(e) => setPlanId(e.target.value)}>{plans.data?.map((p) => <option key={p._id} value={p._id}>{p.name} · {p.durationDays} days</option>)}</Select></Field>
          <Field label="Category"><Select value={category} onChange={(e) => setCategory(e.target.value)}>{cats.map((c: string) => <option key={c} value={c}>{cap(c)}</option>)}</Select></Field>
          <Field label="Promo code" error={q?.codeRejected && code ? 'Not valid for this plan' : undefined}><Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Optional" /></Field>
          <Toggle checked={pay} onChange={setPay} label="Record a payment now" />
          {pay && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Amount received"><Input type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
              <Field label="Method"><Select value={method} onChange={(e) => setMethod(e.target.value)}>{METHODS.map((m) => <option key={m} value={m}>{cap(m.replace('-', ' '))}</option>)}</Select></Field>
              <Field label="Reference" className="col-span-2" hint="UPI / card ref (optional)"><Input value={reference} onChange={(e) => setReference(e.target.value)} /></Field>
            </div>
          )}
        </div>
        <div className="rounded-brand border border-line bg-surface2 p-5">
          <ErrorNote error={qErr} />
          {q && (
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-muted">Period</dt><dd>{date(q.startsAt)} → {date(q.endsAt)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">{q.planName} ({cap(q.category)})</dt><dd>{money(q.base, q.currency)}</dd></div>
              {q.joiningFee > 0 && <div className="flex justify-between"><dt className="text-muted">Joining fee</dt><dd>{money(q.joiningFee, q.currency)}</dd></div>}
              {q.discount > 0 && <div className="flex justify-between text-link"><dt>{q.offer?.title}</dt><dd>-{money(q.discount, q.currency)}</dd></div>}
              {q.taxRate > 0 && <div className="flex justify-between"><dt className="text-muted">{q.taxLabel} {q.taxRate}%{q.taxInclusive ? ' (incl.)' : ''}</dt><dd>{money(q.tax, q.currency)}</dd></div>}
              <div className="flex justify-between border-t border-line pt-3 text-lg font-bold"><dt>Total</dt><dd>{money(q.total, q.currency)}</dd></div>
            </dl>
          )}
          <p className="mt-4 text-xs text-muted">Any live offer is applied automatically. Renewing an active member starts the new period when the current one ends.</p>
        </div>
      </div>
      <div className="mt-4"><ErrorNote error={err} /></div>
    </Modal>
  );
}

export function RecordPayment({ invoice, open, onClose, onDone }: { invoice: any; open: boolean; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const due = invoice ? Math.round((invoice.total - invoice.paid) * 100) / 100 : 0;
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('upi');
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  useEffect(() => { if (open) { setAmount(String(due)); setErr(null); } }, [open, due]);
  const submit = async () => {
    setBusy(true); setErr(null);
    try {
      await api.post(`/admin/billing/invoices/${invoice._id}/payments`, { amount: Number(amount), method, reference: reference || undefined });
      toast('Payment recorded'); onDone(); onClose();
    } catch (e) { setErr(e); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title={`Payment for ${invoice?.number ?? ''}`} footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button loading={busy} onClick={submit}>Record payment</Button></>}>
      <p className="mb-4 text-sm text-muted">Outstanding: <b className="text-ink">{money(due, invoice?.currency)}</b></p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Amount"><Input type="number" min={0} max={due} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
        <Field label="Method"><Select value={method} onChange={(e) => setMethod(e.target.value)}>{METHODS.map((m) => <option key={m} value={m}>{cap(m.replace('-', ' '))}</option>)}</Select></Field>
        <Field label="Reference" className="col-span-2"><Input value={reference} onChange={(e) => setReference(e.target.value)} /></Field>
      </div>
      <div className="mt-3"><ErrorNote error={err} /></div>
    </Modal>
  );
}
