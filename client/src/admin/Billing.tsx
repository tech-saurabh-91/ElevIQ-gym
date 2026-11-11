import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Ban, Printer, Search, Undo2, Wallet } from 'lucide-react';
import { api, qs } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useSite } from '@/lib/site';
import { cap, date, dateTime, money } from '@/lib/format';
import { Badge, Button, Card, ErrorNote, Field, Input, Modal, PageHeader, Pager, Select, Spinner, Table, Tabs, statusTone, useLoad, useToast } from '@/components/ui';
import { Logo } from '@/site/SiteLayout';
import { RecordPayment } from './billingParts';

export default function Billing() {
  const { can } = useAuth();
  const nav = useNavigate();
  const [tab, setTab] = useState<'invoices' | 'payments'>('invoices');
  const [status, setStatus] = useState('all');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const inv = useLoad((s) => (tab === 'invoices' ? api.get(`/admin/billing/invoices${qs({ status, q, page, limit: 25 })}`, s) : Promise.resolve(null)), [tab, status, q, page], `invoices:${tab}:${status}:${q}:${page}`);
  const pay = useLoad((s) => (tab === 'payments' && can('billing.read') ? api.get(`/admin/billing/payments${qs({ page, limit: 25 })}`, s) : Promise.resolve(null)), [tab, page], `payments:${tab}:${page}`);

  return (
    <>
      <PageHeader title="Invoices & payments" subtitle="Every membership sale creates a numbered invoice with tax and any offer applied." />
      {can('billing.read') && <div className="mb-4"><Tabs value={tab} onChange={(v) => { setTab(v); setPage(1); }} items={[{ value: 'invoices', label: 'Invoices' }, { value: 'payments', label: 'Payments' }]} /></div>}
      {tab === 'invoices' ? (
        <Card padded={false}>
          <div className="flex flex-wrap gap-3 border-b border-line p-4">
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <Input className="pl-9" placeholder="Invoice number or name" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
            </div>
            <Select className="w-40" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
              {['all', 'unpaid', 'partial', 'paid', 'void'].map((s) => <option key={s} value={s}>{s === 'all' ? 'All' : cap(s)}</option>)}
            </Select>
          </div>
          <ErrorNote error={inv.error} />
          <Table
            loading={inv.loading}
            rows={inv.data?.data ?? []}
            onRowClick={(i: any) => nav(`/admin/billing/${i._id}`)}
            empty="No invoices."
            columns={[
              { key: 'n', header: 'Invoice', render: (i: any) => <span className="font-semibold">{i.number}</span> },
              { key: 'm', header: 'Billed to', render: (i: any) => i.billTo?.name ?? '—' },
              { key: 'k', header: 'Type', render: (i: any) => <Badge>{i.kind}</Badge> },
              { key: 'd', header: 'Date', render: (i: any) => date(i.issuedAt) },
              { key: 't', header: 'Total', render: (i: any) => money(i.total, i.currency) },
              { key: 'b', header: 'Balance', render: (i: any) => (i.status === 'void' ? '—' : money(i.total - i.paid, i.currency)) },
              { key: 's', header: 'Status', render: (i: any) => <Badge tone={statusTone(i.status)}>{i.status}</Badge> },
            ]}
          />
          {inv.data && <Pager page={page} pages={inv.data.pagination.pages} total={inv.data.pagination.total} onPage={setPage} />}
        </Card>
      ) : (
        <Card padded={false}>
          <ErrorNote error={pay.error} />
          <Table
            loading={pay.loading}
            rows={pay.data?.data ?? []}
            empty="No payments."
            columns={[
              { key: 'r', header: 'Receipt', render: (p: any) => <span className="font-semibold">{p.receiptNo}</span> },
              { key: 'i', header: 'Invoice', render: (p: any) => (p.invoice ? <Link className="text-link" to={`/admin/billing/${p.invoice._id}`}>{p.invoice.number}</Link> : '—') },
              { key: 'm', header: 'Member', render: (p: any) => (p.member ? `${p.member.firstName} ${p.member.lastName}` : '—') },
              { key: 'd', header: 'Paid', render: (p: any) => dateTime(p.paidAt) },
              { key: 'me', header: 'Method', render: (p: any) => cap(p.method) },
              { key: 'a', header: 'Amount', render: (p: any) => <span>{money(p.amount, p.currency)}{p.refundedAmount > 0 && <span className="ml-1 text-xs text-red-600">-{money(p.refundedAmount, p.currency)}</span>}</span> },
            ]}
          />
          {pay.data && <Pager page={page} pages={pay.data.pagination.pages} total={pay.data.pagination.total} onPage={setPage} />}
        </Card>
      )}
    </>
  );
}

export function InvoiceDetail() {
  const { id } = useParams();
  const { can } = useAuth();
  const { site } = useSite();
  const toast = useToast();
  const d = useLoad((s) => api.get(`/admin/billing/invoices/${id}`, s).then((r) => r.data), [id]);
  const settings = useLoad((s) => api.get('/admin/settings', s).then((r) => r.data), []);
  const [paying, setPaying] = useState(false);
  const [voiding, setVoiding] = useState(false);
  const [refund, setRefund] = useState<any>(null);
  const [reason, setReason] = useState('');
  const [amount, setAmount] = useState('');

  if (d.loading && !d.data) return <Spinner />;
  if (d.error) return <ErrorNote error={d.error} />;
  const { invoice: i, payments } = d.data;
  const s = settings.data;
  const c = site?.site.contact;

  const doVoid = async () => {
    try { await api.post(`/admin/billing/invoices/${i._id}/void`, { reason }); toast('Invoice voided'); setVoiding(false); d.reload(); } catch (e) { toast((e as Error).message, 'err'); }
  };
  const doRefund = async () => {
    try { await api.post(`/admin/billing/payments/${refund._id}/refund`, { amount: Number(amount), reason }); toast('Refund recorded'); setRefund(null); d.reload(); } catch (e) { toast((e as Error).message, 'err'); }
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link to="/admin/billing" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" /> Invoices</Link>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" icon={<Printer className="h-4 w-4" />} onClick={() => window.print()}>Print / PDF</Button>
          {can('payments.record') && ['unpaid', 'partial'].includes(i.status) && <Button icon={<Wallet className="h-4 w-4" />} onClick={() => setPaying(true)}>Take payment</Button>}
          {can('billing.manage') && i.paid === 0 && i.status !== 'void' && <Button variant="outline" icon={<Ban className="h-4 w-4" />} onClick={() => { setReason(''); setVoiding(true); }}>Void</Button>}
        </div>
      </div>

      <article className="mx-auto max-w-3xl rounded-brand border border-line bg-surface p-8 shadow-soft print:border-0 print:shadow-none">
        <header className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <Logo className="h-12" />
            <div className="mt-3 text-xs leading-relaxed text-muted">
              <div className="font-semibold text-ink">{s?.legalName || s?.name}</div>
              {c?.address && <div>{c.address}</div>}
              {c?.phone && <div>{c.phone}</div>}
              {s?.tax?.registrationNo && <div>{s.tax.label} no: {s.tax.registrationNo}</div>}
            </div>
          </div>
          <div className="text-right">
            <h1 className="font-display text-2xl font-bold">Invoice</h1>
            <p className="font-mono text-sm">{i.number}</p>
            <p className="mt-1 text-xs text-muted">Issued {date(i.issuedAt)}</p>
            <Badge tone={statusTone(i.status)} className="mt-2">{i.status}</Badge>
          </div>
        </header>
        <div className="mt-8 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Bill to</p>
          <p className="mt-1 font-semibold">{i.billTo?.name}</p>
          {i.member && <p className="text-xs text-muted">Member {i.member.memberNo}</p>}
          {i.billTo?.phone && <p className="text-xs text-muted">{i.billTo.phone}</p>}
        </div>
        <table className="mt-8 w-full text-sm">
          <thead><tr className="border-b border-line text-left text-xs uppercase text-muted"><th className="py-2">Description</th><th className="py-2 text-right">Qty</th><th className="py-2 text-right">Price</th><th className="py-2 text-right">Amount</th></tr></thead>
          <tbody>{i.lines.map((l: any, k: number) => <tr key={k} className="border-b border-line/60"><td className="py-2.5">{l.description}</td><td className="py-2.5 text-right">{l.qty}</td><td className="py-2.5 text-right">{money(l.unitPrice, i.currency)}</td><td className="py-2.5 text-right">{money(l.amount, i.currency)}</td></tr>)}</tbody>
        </table>
        <dl className="ml-auto mt-4 w-full max-w-xs space-y-1.5 text-sm">
          <div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd>{money(i.subtotal, i.currency)}</dd></div>
          {i.discount > 0 && <div className="flex justify-between"><dt className="text-muted">Discount{i.offer?.title ? ` (${i.offer.title})` : ''}</dt><dd>-{money(i.discount, i.currency)}</dd></div>}
          {i.taxRate > 0 && <div className="flex justify-between"><dt className="text-muted">{i.taxLabel} {i.taxRate}%{i.taxInclusive ? ' (included)' : ''}</dt><dd>{money(i.tax, i.currency)}</dd></div>}
          <div className="flex justify-between border-t border-line pt-2 text-base font-bold"><dt>Total</dt><dd>{money(i.total, i.currency)}</dd></div>
          <div className="flex justify-between"><dt className="text-muted">Paid</dt><dd>{money(i.paid, i.currency)}</dd></div>
          {i.status !== 'void' && <div className="flex justify-between font-semibold"><dt>Balance due</dt><dd>{money(i.total - i.paid, i.currency)}</dd></div>}
        </dl>
        {i.voidReason && <p className="mt-6 text-sm text-red-600">Voided: {i.voidReason}</p>}
        {payments.length > 0 && (
          <div className="mt-8">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Payments</p>
            <ul className="mt-2 divide-y divide-line text-sm">
              {payments.map((p: any) => (
                <li key={p._id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span>{p.receiptNo} · {cap(p.method)} · {dateTime(p.paidAt)}</span>
                  <span className="flex items-center gap-2">
                    {money(p.amount, p.currency)}{p.refundedAmount > 0 && <span className="text-xs text-red-600">refunded {money(p.refundedAmount, p.currency)}</span>}
                    {can('billing.manage') && p.refundedAmount < p.amount && <Button size="sm" variant="ghost" className="print:hidden" icon={<Undo2 className="h-3.5 w-3.5" />} onClick={() => { setRefund(p); setAmount(String(p.amount - p.refundedAmount)); setReason(''); }}>Refund</Button>}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </article>

      <RecordPayment open={paying} invoice={i} onClose={() => setPaying(false)} onDone={d.reload} />
      <Modal open={voiding} onClose={() => setVoiding(false)} title="Void invoice" footer={<Button variant="danger" disabled={reason.trim().length < 3} onClick={doVoid}>Void invoice</Button>}>
        <Field label="Reason" required><Input value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
      </Modal>
      <Modal open={Boolean(refund)} onClose={() => setRefund(null)} title="Refund payment" footer={<Button variant="danger" disabled={reason.trim().length < 3} onClick={doRefund}>Refund</Button>}>
        <div className="grid gap-3">
          <Field label="Amount"><Input type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
          <Field label="Reason" required><Input value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
        </div>
      </Modal>
    </>
  );
}
