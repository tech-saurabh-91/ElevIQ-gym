import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Badge, Button, Field, Input, Loading, Modal, Select, Tabs, useToast } from '../../components/ui';
import DataTable from '../../components/DataTable';
import { useLocale } from '../../lib/i18n';
import api from '../../lib/api';

const COLORS = ['#00E5A0', '#7B61FF', '#FF4D6D', '#38BDF8', '#FBBF24'];
const tooltipStyle = {
  contentStyle: { background: 'rgba(10,11,18,0.95)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 14, fontSize: 12, color: '#EDEFF5' },
  labelStyle: { color: '#8A8FA3', fontSize: 11 },
  itemStyle: { color: '#EDEFF5' },
};

export default function Finance() {
  const { money, date } = useLocale();
  const { push } = useToast();
  const [tab, setTab] = useState('overview');
  const [revenue, setRevenue] = useState(null);
  const [summary, setSummary] = useState(null);
  const [payments, setPayments] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [products, setProducts] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, pages: 1 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [cart, setCart] = useState([]);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expenseForm, setExpenseForm] = useState({ title: '', category: 'other', amount: 500, vendor: '' });
  const [invoiceForm, setInvoiceForm] = useState({ email: '', itemName: 'Pro membership', qty: 1, price: 69, taxRate: 8 });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rv, sm, pay, inv, exp, prod] = await Promise.all([
        api.get('/dashboard/revenue?months=12'),
        api.get('/finance/payments/summary'),
        api.get(api.qs('/finance/payments', { page, limit: 15, q })),
        api.get(api.qs('/finance/invoices', { limit: 30 })),
        api.get(api.qs('/finance/expenses', { limit: 30 })),
        api.get(api.qs('/finance/products', { limit: 60 })),
      ]);
      setRevenue(rv.data);
      setSummary(sm.data);
      setPayments(pay.data);
      setPagination(pay.pagination);
      setInvoices(inv.data);
      setExpenses(exp.data);
      setProducts(prod.data);
    } catch (e) {
      push(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [page, q, push]);

  useEffect(() => {
    load();
  }, [load]);

  const addExpense = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/finance/expenses', { ...expenseForm, amount: Number(expenseForm.amount) });
      push('Expense recorded.');
      setExpenseOpen(false);
      load();
    } catch (err) {
      push(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const addInvoice = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/finance/invoices', {
        email: invoiceForm.email,
        items: [{ name: invoiceForm.itemName, qty: Number(invoiceForm.qty), price: Number(invoiceForm.price) }],
        taxRate: Number(invoiceForm.taxRate),
      });
      push('Invoice issued.');
      setInvoiceOpen(false);
      load();
    } catch (err) {
      push(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const refund = async (id) => {
    try {
      await api.post(`/finance/payments/${id}/refund`, { reason: 'Customer request' });
      push('Refund processed.', 'info');
      load();
    } catch (e) {
      push(e.message, 'error');
    }
  };

  const addToCart = (p) => {
    if (p.stock <= 0) return push('Out of stock.', 'error');
    setCart((c) => {
      const found = c.find((x) => x.productId === p._id);
      if (found) return c.map((x) => (x.productId === p._id ? { ...x, qty: x.qty + 1 } : x));
      return [...c, { productId: p._id, qty: 1, price: p.price, name: p.name, sku: p.sku, stock: p.stock }];
    });
  };

  const cartTotal = useMemo(() => cart.reduce((s, l) => s + l.qty * l.price, 0), [cart]);

  const checkout = async (method = 'card') => {
    if (!cart.length) return push('Cart is empty.', 'error');
    try {
      const res = await api.post('/finance/sales', { items: cart, paymentMethod: method });
      push(`Sale ${res.data.saleNo} completed · ${money(res.data.total)}`);
      setCart([]);
      load();
    } catch (e) {
      push(e.message, 'error');
    }
  };

  const paymentColumns = [
    { key: 'receiptNo', label: 'Receipt', render: (r) => <span className="font-mono text-xs text-mint">{r.receiptNo}</span> },
    { key: 'payerName', label: 'Payer', render: (r) => <span className="text-sm">{r.payerName}</span> },
    { key: 'category', label: 'Category', render: (r) => <Badge tone="violet">{r.category}</Badge> },
    { key: 'method', label: 'Method', render: (r) => <span className="text-xs capitalize text-muted">{r.method}</span> },
    { key: 'amount', label: 'Amount', render: (r) => <span className="font-mono text-sm font-semibold">{money(r.amount)}</span> },
    { key: 'paidAt', label: 'Date', render: (r) => <span className="text-xs text-muted">{date(r.paidAt)}</span> },
    { key: 'status', label: 'Status', render: (r) => <Badge tone={r.status === 'paid' ? 'success' : r.status === 'refunded' ? 'warn' : r.status === 'failed' ? 'danger' : 'default'}>{r.status}</Badge> },
    {
      key: 'actions', label: '', className: 'text-end',
      render: (r) => r.status === 'paid'
        ? <button onClick={() => refund(r._id)} className="rounded-lg border border-white/12 px-2.5 py-1.5 text-[11px] text-muted hover:border-coral/50 hover:text-coral">Refund</button>
        : null,
    },
  ];

  if (loading && !revenue) return <Loading label="Loading financials…" />;

  const byCategory = (revenue?.byCategory || []).map((c, i) => ({ name: c._id, value: c.total, fill: COLORS[i % COLORS.length] }));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-black tracking-tight">Financial management</h2>
          <p className="mt-1 text-sm text-muted">
            MTD revenue {money(summary?.thisMonth?.total || 0)} · {summary?.thisMonth?.count || 0} transactions · refunds {money(summary?.refunds || 0)}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => setExpenseOpen(true)}>+ Expense</Button>
          <Button onClick={() => setInvoiceOpen(true)}>+ Invoice</Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { k: 'Revenue (MTD)', v: money(summary?.thisMonth?.total || 0), tone: 'text-mint' },
          { k: 'Last month', v: money(summary?.lastMonth || 0), tone: 'text-violet' },
          { k: 'Transactions', v: summary?.thisMonth?.count || 0, tone: 'text-sky' },
          { k: 'Refunds', v: money(summary?.refunds || 0), tone: 'text-coral' },
        ].map((s) => (
          <div key={s.k} className="rounded-2xl border border-white/10 bg-surface/60 p-4">
            <p className={`font-display text-2xl font-black ${s.tone}`}>{s.v}</p>
            <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-muted">{s.k}</p>
          </div>
        ))}
      </div>

      <Tabs
        tabs={[
          { value: 'overview', label: 'Overview' },
          { value: 'payments', label: 'Payments' },
          { value: 'invoices', label: 'Invoices' },
          { value: 'expenses', label: 'Expenses' },
          { value: 'pos', label: 'POS / Retail' },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'overview' && (
        <div className="grid gap-4 xl:grid-cols-3">
          <div className="rounded-3xl border border-white/10 bg-surface/60 p-5 xl:col-span-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted">Income vs cost</p>
            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenue?.series || []} margin={{ top: 4, right: 8, left: -14, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis dataKey="label" stroke="#8A8FA3" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#8A8FA3" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `$${Math.round(v / 1000)}k`} />
                  <Tooltip {...tooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.05)' }} formatter={(v) => money(v)} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="income" name="Income" fill="#00E5A0" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="cost" name="Cost" fill="#FF4D6D" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-surface/60 p-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted">Revenue by category</p>
            <div className="mt-4 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={byCategory} dataKey="value" nameKey="name" innerRadius={48} outerRadius={76} paddingAngle={4} stroke="none">
                    {byCategory.map((entry, i) => <Cell key={entry.name} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip {...tooltipStyle} formatter={(v) => money(v)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-1.5">
              {byCategory.map((c, i) => (
                <div key={c.name} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2 text-muted"><span className="h-2 w-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />{c.name}</span>
                  <span className="font-mono text-bone/85">{money(c.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'payments' && (
        <DataTable
          columns={paymentColumns}
          data={payments}
          loading={loading}
          pagination={pagination}
          onPageChange={setPage}
          emptyTitle="No payments"
          toolbar={<Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search receipt, payer or description…" className="!py-2.5" />}
        />
      )}

      {tab === 'invoices' && (
        <DataTable
          columns={[
            { key: 'invoiceNo', label: 'Invoice', render: (r) => <span className="font-mono text-xs text-mint">{r.invoiceNo}</span> },
            { key: 'email', label: 'Billed to', render: (r) => <span className="text-xs text-muted">{r.email}</span> },
            { key: 'items', label: 'Items', render: (r) => <span className="text-xs">{(r.items || []).map((i) => i.name).join(', ')}</span> },
            { key: 'total', label: 'Total', render: (r) => <span className="font-mono text-sm">{money(r.total)}</span> },
            { key: 'taxRate', label: 'Tax', render: (r) => <span className="text-xs text-muted">{r.taxRate}%</span> },
            { key: 'dueAt', label: 'Due', render: (r) => <span className="text-xs text-muted">{date(r.dueAt)}</span> },
            { key: 'status', label: 'Status', render: (r) => <Badge tone={r.status === 'paid' ? 'success' : r.status === 'overdue' ? 'danger' : r.status === 'issued' ? 'warn' : 'default'}>{r.status}</Badge> },
          ]}
          data={invoices}
          loading={loading}
          emptyTitle="No invoices"
        />
      )}

      {tab === 'expenses' && (
        <DataTable
          columns={[
            { key: 'title', label: 'Expense', render: (r) => <span className="text-sm font-semibold">{r.title}</span> },
            { key: 'category', label: 'Category', render: (r) => <Badge tone="violet">{r.category}</Badge> },
            { key: 'vendor', label: 'Vendor', render: (r) => <span className="text-xs text-muted">{r.vendor}</span> },
            { key: 'amount', label: 'Amount', render: (r) => <span className="font-mono text-sm text-coral">-{money(r.amount)}</span> },
            { key: 'paidAt', label: 'Date', render: (r) => <span className="text-xs text-muted">{date(r.paidAt)}</span> },
          ]}
          data={expenses}
          loading={loading}
          emptyTitle="No expenses"
        />
      )}

      {tab === 'pos' && (
        <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
          <div>
            <div className="mb-3 flex flex-wrap gap-2">
              {[...new Set(products.map((p) => p.category))].map((c) => (
                <span key={c} className="chip capitalize">{c}</span>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {products.map((p) => (
                <button
                  key={p._id}
                  onClick={() => addToCart(p)}
                  className={`rounded-2xl border p-4 text-start transition ${p.stock <= p.lowStockAt ? 'border-amber/35 bg-amber/[0.06]' : 'border-white/10 bg-surface/60 hover:border-mint/40'}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold">{p.name}</p>
                    <span className="font-mono text-sm font-bold text-mint">{money(p.price)}</span>
                  </div>
                  <p className="mt-1 font-mono text-[11px] text-muted">{p.sku} · {p.stock} in stock</p>
                  {p.stock <= p.lowStockAt && <Badge tone="warn" className="mt-2">Low stock</Badge>}
                </button>
              ))}
            </div>
          </div>

          <div className="h-fit rounded-3xl border border-white/10 bg-surface/60 p-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted">Current sale</p>
            <div className="mt-4 max-h-72 space-y-2 overflow-y-auto scrollbar-thin">
              {cart.length === 0 && <p className="py-8 text-center text-xs text-muted">Tap a product to add it.</p>}
              {cart.map((l) => (
                <div key={l.productId} className="flex items-center justify-between gap-2 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold">{l.name}</p>
                    <p className="font-mono text-[10px] text-muted">{money(l.price)} × {l.qty}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => setCart((c) => c.map((x) => (x.productId === l.productId ? { ...x, qty: Math.max(1, x.qty - 1) } : x)))} className="h-6 w-6 rounded-md border border-white/12 text-xs text-muted hover:text-bone">−</button>
                    <span className="w-5 text-center font-mono text-xs">{l.qty}</span>
                    <button onClick={() => setCart((c) => c.map((x) => (x.productId === l.productId ? { ...x, qty: x.qty + 1 } : x)))} className="h-6 w-6 rounded-md border border-white/12 text-xs text-muted hover:text-bone">+</button>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-4">
              <span className="text-xs text-muted">Total</span>
              <span className="font-display text-xl font-black">{money(cartTotal)}</span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button onClick={() => checkout('card')} className="!py-2.5 !text-xs">Card</Button>
              <Button variant="ghost" onClick={() => checkout('cash')} className="!py-2.5 !text-xs">Cash</Button>
              <Button variant="ghost" onClick={() => checkout('wallet')} className="!py-2.5 !text-xs col-span-2">Wallet / QR</Button>
            </div>
          </div>
        </div>
      )}

      <Modal open={expenseOpen} onClose={() => setExpenseOpen(false)} title="Record an expense">
        <form onSubmit={addExpense} className="grid gap-4">
          <Field label="Title"><Input value={expenseForm.title} onChange={(e) => setExpenseForm((f) => ({ ...f, title: e.target.value }))} required /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Category">
              <Select value={expenseForm.category} onChange={(e) => setExpenseForm((f) => ({ ...f, category: e.target.value }))}>
                {['rent', 'utilities', 'payroll', 'equipment', 'marketing', 'supplies', 'maintenance', 'other'].map((c) => <option key={c}>{c}</option>)}
              </Select>
            </Field>
            <Field label="Amount (USD)"><Input type="number" value={expenseForm.amount} onChange={(e) => setExpenseForm((f) => ({ ...f, amount: e.target.value }))} /></Field>
          </div>
          <Field label="Vendor"><Input value={expenseForm.vendor} onChange={(e) => setExpenseForm((f) => ({ ...f, vendor: e.target.value }))} /></Field>
          <div className="flex justify-end gap-3 pt-1">
            <Button type="button" variant="ghost" onClick={() => setExpenseOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>Record</Button>
          </div>
        </form>
      </Modal>

      <Modal open={invoiceOpen} onClose={() => setInvoiceOpen(false)} title="Issue an invoice">
        <form onSubmit={addInvoice} className="grid gap-4">
          <Field label="Billed to (email)"><Input type="email" value={invoiceForm.email} onChange={(e) => setInvoiceForm((f) => ({ ...f, email: e.target.value }))} required /></Field>
          <Field label="Line item"><Input value={invoiceForm.itemName} onChange={(e) => setInvoiceForm((f) => ({ ...f, itemName: e.target.value }))} /></Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Qty"><Input type="number" value={invoiceForm.qty} onChange={(e) => setInvoiceForm((f) => ({ ...f, qty: e.target.value }))} /></Field>
            <Field label="Unit price"><Input type="number" value={invoiceForm.price} onChange={(e) => setInvoiceForm((f) => ({ ...f, price: e.target.value }))} /></Field>
            <Field label="Tax %"><Input type="number" value={invoiceForm.taxRate} onChange={(e) => setInvoiceForm((f) => ({ ...f, taxRate: e.target.value }))} /></Field>
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <Button type="button" variant="ghost" onClick={() => setInvoiceOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>Issue</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
