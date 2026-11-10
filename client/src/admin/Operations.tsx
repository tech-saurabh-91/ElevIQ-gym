import { useEffect, useRef, useState, type FormEvent } from 'react';
import { CalendarPlus, LogIn, LogOut, Minus, Plus, ScanLine, ShoppingCart, Trash2, Users } from 'lucide-react';
import { api, qs } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cap, date, dateTime, money, time } from '@/lib/format';
import { Badge, Button, Card, ErrorNote, Field, Input, Modal, PageHeader, Select, Spinner, Stat, Table, statusTone, useLoad, useToast } from '@/components/ui';
import SimpleCrud from './SimpleCrud';
import { METHODS } from './billingParts';

/* --------------------------------- check-in desk --------------------------------- */

export function CheckIns() {
  const toast = useToast();
  const live = useLoad((s) => api.get('/admin/ops/checkins/live', s).then((r) => r.data), []);
  const [code, setCode] = useState('');
  const [last, setLast] = useState<any>(null);
  const [err, setErr] = useState<unknown>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { input.current?.focus(); const t = setInterval(live.reload, 30000); return () => clearInterval(t); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const scan = async (e: FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setErr(null);
    try {
      const r = await api.post('/admin/ops/checkins/scan', { code: code.trim(), method: 'qr' });
      setLast(r.data);
      toast(`${r.data.member.firstName} ${r.data.action === 'checkin' ? 'checked in' : 'checked out'}`);
      live.reload();
    } catch (e2) { setErr(e2); setLast(null); }
    setCode('');
    input.current?.focus();
  };

  return (
    <>
      <PageHeader title="Check-in desk" subtitle="Scan a member's code, card or type their member number. Scanning again checks them out." />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <form onSubmit={scan} className="flex gap-2">
            <Input ref={input} value={code} onChange={(e) => setCode(e.target.value)} placeholder="Scan or type member number" className="h-12 text-lg" aria-label="Member code" />
            <Button size="lg" type="submit" icon={<ScanLine className="h-5 w-5" />}>Go</Button>
          </form>
          <div className="mt-4"><ErrorNote error={err} /></div>
          {last && (
            <div className={`mt-4 flex items-center gap-4 rounded-brand p-4 ${last.action === 'checkin' ? 'bg-emerald-500/10' : 'bg-sky-500/10'}`}>
              {last.action === 'checkin' ? <LogIn className="h-8 w-8 text-emerald-600" /> : <LogOut className="h-8 w-8 text-sky-600" />}
              <div>
                <p className="text-lg font-bold">{last.member.firstName} {last.member.lastName}</p>
                <p className="text-sm text-muted">{last.member.memberNo} · valid until {date(last.member.expiresAt)}{last.action === 'checkout' && last.checkIn.durationMin != null && ` · ${last.checkIn.durationMin} min visit`}</p>
              </div>
            </div>
          )}
        </Card>
        <div className="grid gap-4">
          <Stat label="Inside now" value={live.data?.inside ?? '—'} icon={<Users className="h-4 w-4" />} />
          <Stat label="Visits today" value={live.data?.todayCount ?? '—'} icon={<LogIn className="h-4 w-4" />} />
        </div>
      </div>
      <Card title="Today" className="mt-6" padded={false}>
        <Table loading={live.loading} rows={live.data?.recent ?? []} empty="No visits yet today." columns={[
          { key: 'm', header: 'Member', render: (c: any) => `${c.member?.firstName ?? ''} ${c.member?.lastName ?? ''}` },
          { key: 'n', header: 'No.', render: (c: any) => c.member?.memberNo },
          { key: 'i', header: 'In', render: (c: any) => dateTime(c.inAt) },
          { key: 'o', header: 'Out', render: (c: any) => (c.outAt ? dateTime(c.outAt) : <Badge tone="green">Inside</Badge>) },
        ]} />
      </Card>
    </>
  );
}

/* ------------------------------------ classes ------------------------------------ */

export function Classes() {
  const { can } = useAuth();
  const toast = useToast();
  const sessions = useLoad((s) => api.get('/admin/ops/sessions', s).then((r) => r.data as any[]), []);
  const types = useLoad((s) => api.get('/admin/ops/class-types?limit=100', s).then((r) => r.data as any[]), []);
  const trainers = useLoad((s) => api.get('/admin/staff', s).then((r) => (r.data as any[]).filter((u) => ['trainer', 'owner', 'manager'].includes(u.role))).catch(() => []), []);
  const [adding, setAdding] = useState<any>(null);
  const [newType, setNewType] = useState('');
  const [roster, setRoster] = useState<any>(null);
  const [memberQ, setMemberQ] = useState('');
  const [err, setErr] = useState<unknown>(null);
  const rosterList = useLoad((s) => (roster ? api.get(`/admin/ops/sessions/${roster._id}/bookings`, s).then((r) => r.data as any[]) : Promise.resolve([])), [roster?._id]);
  const memberSearch = useLoad((s) => (roster && memberQ.length > 1 ? api.get(`/admin/members${qs({ q: memberQ, status: 'active', limit: 6 })}`, s).then((r) => r.data as any[]) : Promise.resolve([])), [memberQ, roster?._id]);

  const createSession = async () => {
    setErr(null);
    try {
      const t = types.data?.find((x) => x._id === adding.classType);
      await api.post('/admin/ops/sessions', { ...adding, title: adding.title || t?.name, capacity: Number(adding.capacity), repeatWeeks: Number(adding.repeatWeeks), trainer: adding.trainer || undefined, date: new Date(adding.date).toISOString() });
      toast('Class scheduled'); setAdding(null); sessions.reload();
    } catch (e) { setErr(e); }
  };
  const addType = async () => {
    try { await api.post('/admin/ops/class-types', { name: newType }); setNewType(''); types.reload(); } catch (e) { toast((e as Error).message, 'err'); }
  };
  const book = async (memberId: string) => {
    try { const r = await api.post(`/admin/ops/sessions/${roster._id}/bookings`, { memberId }); toast(r.data.status === 'waitlist' ? 'Class full - added to waitlist' : 'Booked'); setMemberQ(''); rosterList.reload(); sessions.reload(); } catch (e) { toast((e as Error).message, 'err'); }
  };
  const cancel = async (id: string) => {
    try { await api.post(`/admin/ops/bookings/${id}/cancel`); rosterList.reload(); sessions.reload(); } catch (e) { toast((e as Error).message, 'err'); }
  };

  const byDay = (sessions.data ?? []).reduce<Record<string, any[]>>((acc, s) => { const k = String(s.date).slice(0, 10); (acc[k] ||= []).push(s); return acc; }, {});

  return (
    <>
      <PageHeader title="Classes" subtitle="Next 14 days. Bookings fill seats atomically and overflow to a waitlist." actions={can('classes.manage') && <Button icon={<CalendarPlus className="h-4 w-4" />} onClick={() => { setErr(null); setAdding({ classType: types.data?.[0]?._id ?? '', title: '', date: new Date().toISOString().slice(0, 10), start: '07:00', end: '08:00', capacity: 20, room: '', trainer: '', repeatWeeks: 0 }); }}>Schedule class</Button>} />
      {sessions.loading ? <Spinner /> : !Object.keys(byDay).length ? <Card><p className="text-sm text-muted">No classes scheduled.</p></Card> : (
        <div className="space-y-6">
          {Object.entries(byDay).map(([day, list]) => (
            <Card key={day} title={date(day, { weekday: 'long', day: 'numeric', month: 'short' })} padded={false}>
              <Table rows={list} onRowClick={(s: any) => setRoster(s)} columns={[
                { key: 't', header: 'Time', render: (s: any) => `${time(s.start)} - ${time(s.end)}` },
                { key: 'n', header: 'Class', render: (s: any) => <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: s.classType?.color || 'rgb(var(--c-primary))' }} />{s.title}</span> },
                { key: 'tr', header: 'Trainer', render: (s: any) => s.trainer?.name ?? '—' },
                { key: 'c', header: 'Booked', render: (s: any) => <span>{s.booked}/{s.capacity}{s.waitlist > 0 && <Badge tone="amber" className="ml-1">+{s.waitlist} waiting</Badge>}</span> },
                { key: 's', header: 'Status', render: (s: any) => <Badge tone={s.status === 'scheduled' ? (s.booked >= s.capacity ? 'amber' : 'green') : statusTone(s.status)}>{s.status === 'scheduled' && s.booked >= s.capacity ? 'full' : s.status}</Badge> },
              ]} />
            </Card>
          ))}
        </div>
      )}

      <Modal open={Boolean(adding)} onClose={() => setAdding(null)} title="Schedule a class" footer={<Button onClick={createSession}>Schedule</Button>}>
        {adding && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Class type" className="sm:col-span-2">
              <div className="flex gap-2">
                <Select value={adding.classType} onChange={(e) => setAdding({ ...adding, classType: e.target.value })}>{types.data?.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}</Select>
              </div>
            </Field>
            <div className="flex gap-2 sm:col-span-2"><Input placeholder="New class type name" value={newType} onChange={(e) => setNewType(e.target.value)} /><Button variant="secondary" disabled={newType.length < 2} onClick={addType}>Add type</Button></div>
            <Field label="Title (optional)" className="sm:col-span-2"><Input value={adding.title} onChange={(e) => setAdding({ ...adding, title: e.target.value })} /></Field>
            <Field label="Date"><Input type="date" value={adding.date} onChange={(e) => setAdding({ ...adding, date: e.target.value })} /></Field>
            <Field label="Repeat weekly for"><Select value={adding.repeatWeeks} onChange={(e) => setAdding({ ...adding, repeatWeeks: e.target.value })}>{[0, 1, 3, 7, 11].map((n) => <option key={n} value={n}>{n ? `${n + 1} weeks` : 'Just once'}</option>)}</Select></Field>
            <Field label="Starts"><Input type="time" value={adding.start} onChange={(e) => setAdding({ ...adding, start: e.target.value })} /></Field>
            <Field label="Ends"><Input type="time" value={adding.end} onChange={(e) => setAdding({ ...adding, end: e.target.value })} /></Field>
            <Field label="Capacity"><Input type="number" min={1} value={adding.capacity} onChange={(e) => setAdding({ ...adding, capacity: e.target.value })} /></Field>
            <Field label="Room"><Input value={adding.room} onChange={(e) => setAdding({ ...adding, room: e.target.value })} /></Field>
            <Field label="Trainer" className="sm:col-span-2"><Select value={adding.trainer} onChange={(e) => setAdding({ ...adding, trainer: e.target.value })}><option value="">—</option>{(trainers.data ?? []).map((t: any) => <option key={t._id} value={t._id}>{t.name}</option>)}</Select></Field>
            <div className="sm:col-span-2"><ErrorNote error={err} /></div>
          </div>
        )}
      </Modal>

      <Modal open={Boolean(roster)} onClose={() => setRoster(null)} title={roster ? `${roster.title} · ${date(roster.date)} ${time(roster.start)}` : ''} wide>
        {roster && (
          <>
            {can('classes.manage', 'checkins.manage') && (
              <div className="mb-4">
                <Input placeholder="Add a member: type a name or number" value={memberQ} onChange={(e) => setMemberQ(e.target.value)} />
                {(memberSearch.data as any[] | null)?.map((m) => (
                  <button key={m._id} onClick={() => book(m._id)} className="mt-1 flex w-full justify-between rounded-brand px-3 py-2 text-left text-sm hover:bg-surface2"><span>{m.firstName} {m.lastName}</span><span className="text-xs text-muted">{m.memberNo}</span></button>
                ))}
              </div>
            )}
            <Table loading={rosterList.loading} rows={rosterList.data ?? []} empty="Nobody booked yet." columns={[
              { key: 'm', header: 'Member', render: (b: any) => `${b.member?.firstName} ${b.member?.lastName}` },
              { key: 'p', header: 'Phone', render: (b: any) => b.member?.phone || '—' },
              { key: 's', header: 'Status', render: (b: any) => <Badge tone={statusTone(b.status)}>{b.status}</Badge> },
              { key: 'x', header: '', className: 'text-right', render: (b: any) => can('classes.manage', 'checkins.manage') && <Button size="sm" variant="ghost" onClick={() => cancel(b._id)}>Cancel</Button> },
            ]} />
          </>
        )}
      </Modal>
    </>
  );
}

/* ----------------------------------- equipment ----------------------------------- */

export function EquipmentPage() {
  return (
    <SimpleCrud
      title="Equipment"
      subtitle="Asset register and service dates."
      endpoint="/admin/ops/equipment"
      fields={[
        { key: 'assetTag', label: 'Asset tag', required: true }, { key: 'name', label: 'Name', required: true },
        { key: 'category', label: 'Category', type: 'select', options: ['cardio', 'strength', 'free-weights', 'functional', 'studio', 'recovery'] },
        { key: 'brand', label: 'Brand' }, { key: 'zone', label: 'Zone' },
        { key: 'status', label: 'Status', type: 'select', options: ['in-use', 'maintenance', 'out-of-order', 'retired'] },
        { key: 'condition', label: 'Condition', type: 'select', options: ['good', 'excellent', 'fair', 'poor'] },
        { key: 'cost', label: 'Cost', type: 'number' }, { key: 'purchasedAt', label: 'Purchased', type: 'date' }, { key: 'nextServiceAt', label: 'Next service', type: 'date' },
        { key: 'notes', label: 'Notes', type: 'textarea' },
      ]}
      columns={[
        { key: 'a', header: 'Tag', render: (e: any) => <span className="font-mono text-xs">{e.assetTag}</span> },
        { key: 'n', header: 'Name', render: (e: any) => <span className="font-semibold">{e.name}</span> },
        { key: 'c', header: 'Category', render: (e: any) => cap(e.category) },
        { key: 'z', header: 'Zone', render: (e: any) => e.zone || '—' },
        { key: 'sv', header: 'Next service', render: (e: any) => (e.nextServiceAt ? date(e.nextServiceAt) : '—') },
        { key: 's', header: 'Status', render: (e: any) => <Badge tone={statusTone(e.status)}>{e.status}</Badge> },
      ]}
    />
  );
}

export function ExpensesPage() {
  return (
    <SimpleCrud
      title="Expenses"
      subtitle="Costs that feed the net figure on the dashboard."
      endpoint="/admin/billing/expenses"
      fields={[
        { key: 'title', label: 'Title', required: true, span: true },
        { key: 'category', label: 'Category', type: 'select', options: ['rent', 'utilities', 'payroll', 'equipment', 'marketing', 'supplies', 'maintenance', 'other'] },
        { key: 'amount', label: 'Amount', type: 'number', required: true }, { key: 'vendor', label: 'Vendor' },
        { key: 'paidAt', label: 'Paid on', type: 'date', default: new Date().toISOString().slice(0, 10) }, { key: 'notes', label: 'Notes', type: 'textarea' },
      ]}
      columns={[
        { key: 'd', header: 'Date', render: (e: any) => date(e.paidAt) },
        { key: 't', header: 'Title', render: (e: any) => <span className="font-semibold">{e.title}</span> },
        { key: 'c', header: 'Category', render: (e: any) => cap(e.category) },
        { key: 'v', header: 'Vendor', render: (e: any) => e.vendor || '—' },
        { key: 'a', header: 'Amount', render: (e: any) => money(e.amount) },
      ]}
    />
  );
}

/* ------------------------------------- retail ------------------------------------- */

export function Retail() {
  const toast = useToast();
  const [pos, setPos] = useState(false);
  const products = useLoad((s) => (pos ? api.get('/admin/ops/products?active=true&limit=200', s).then((r) => r.data as any[]) : Promise.resolve([])), [pos]);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [method, setMethod] = useState('cash');
  const [busy, setBusy] = useState(false);
  const items = Object.entries(cart).filter(([, q]) => q > 0).map(([id, qty]) => ({ p: products.data?.find((x) => x._id === id), qty })).filter((x) => x.p);
  const subtotal = items.reduce((s, x) => s + x.p.price * x.qty, 0);

  const checkout = async () => {
    setBusy(true);
    try {
      const r = await api.post('/admin/ops/sales', { items: items.map((x) => ({ productId: x.p._id, qty: x.qty })), method });
      toast(`Sale complete - ${r.data.invoice.number}`); setCart({}); setPos(false);
    } catch (e) { toast((e as Error).message, 'err'); } finally { setBusy(false); }
  };

  return (
    <>
      <SimpleCrud
        title="Retail / POS"
        subtitle="Products and stock. Sales create a paid retail invoice."
        endpoint="/admin/ops/products"
        extraActions={<Button variant="outline" icon={<ShoppingCart className="h-4 w-4" />} onClick={() => setPos(true)}>New sale</Button>}
        fields={[
          { key: 'sku', label: 'SKU', required: true }, { key: 'name', label: 'Name', required: true }, { key: 'category', label: 'Category' },
          { key: 'price', label: 'Price', type: 'number', required: true }, { key: 'cost', label: 'Cost', type: 'number' }, { key: 'stock', label: 'Stock', type: 'number' },
        ]}
        columns={[
          { key: 's', header: 'SKU', render: (p: any) => <span className="font-mono text-xs">{p.sku}</span> },
          { key: 'n', header: 'Product', render: (p: any) => <span className="font-semibold">{p.name}</span> },
          { key: 'p', header: 'Price', render: (p: any) => money(p.price) },
          { key: 'st', header: 'Stock', render: (p: any) => <span>{p.stock}{p.stock <= 5 && <Badge tone="amber" className="ml-1">low</Badge>}</span> },
        ]}
      />
      <Modal open={pos} onClose={() => setPos(false)} title="New sale" wide footer={<><Select className="w-40" value={method} onChange={(e) => setMethod(e.target.value)}>{METHODS.map((m) => <option key={m} value={m}>{cap(m)}</option>)}</Select><Button loading={busy} disabled={!items.length} onClick={checkout}>Charge {money(subtotal)} + tax</Button></>}>
        {products.loading ? <Spinner /> : (
          <div className="grid gap-2">
            {(products.data ?? []).map((p) => (
              <div key={p._id} className="flex items-center justify-between rounded-brand border border-line px-3 py-2">
                <div><div className="text-sm font-semibold">{p.name}</div><div className="text-xs text-muted">{money(p.price)} · {p.stock} in stock</div></div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" aria-label="Less" onClick={() => setCart({ ...cart, [p._id]: Math.max(0, (cart[p._id] ?? 0) - 1) })}><Minus className="h-3 w-3" /></Button>
                  <span className="w-6 text-center text-sm">{cart[p._id] ?? 0}</span>
                  <Button size="sm" variant="outline" aria-label="More" disabled={(cart[p._id] ?? 0) >= p.stock} onClick={() => setCart({ ...cart, [p._id]: (cart[p._id] ?? 0) + 1 })}><Plus className="h-3 w-3" /></Button>
                  {cart[p._id] ? <button aria-label="Remove" onClick={() => setCart({ ...cart, [p._id]: 0 })}><Trash2 className="h-4 w-4 text-muted" /></button> : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </>
  );
}

export function Account() {
  const { session, refresh } = useAuth();
  const toast = useToast();
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });
  const [err, setErr] = useState<unknown>(null);
  const change = async (e: FormEvent) => {
    e.preventDefault(); setErr(null);
    try {
      const r = await api.put('/auth/password', pw);
      const { tokens } = await import('@/lib/api');
      tokens.set(r.token);
      toast('Password changed. Other devices were signed out.'); setPw({ currentPassword: '', newPassword: '' }); await refresh();
    } catch (e2) { setErr(e2); }
  };
  return (
    <>
      <PageHeader title="My account" subtitle={`${session?.user.email} · ${session?.user.roleLabel}`} />
      <Card title="Change password" className="max-w-md">
        <form onSubmit={change} className="grid gap-3">
          <Field label="Current password"><Input type="password" autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} /></Field>
          <Field label="New password" hint="At least 8 characters"><Input type="password" autoComplete="new-password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} /></Field>
          <ErrorNote error={err} />
          <Button type="submit">Update password</Button>
        </form>
      </Card>
    </>
  );
}
