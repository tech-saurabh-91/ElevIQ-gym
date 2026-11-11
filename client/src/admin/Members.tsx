import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, KeyRound, Pencil, Plus, QrCode, Search, Wallet } from 'lucide-react';
import { api, qs } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useSite } from '@/lib/site';
import { cap, date, dateTime, daysUntil, money } from '@/lib/format';
import { Badge, Button, Card, ErrorNote, Field, Input, Modal, PageHeader, Pager, Select, Spinner, Table, Textarea, statusTone, useConfirm, useLoad, useToast } from '@/components/ui';
import { RecordPayment, SellMembership } from './billingParts';

const emptyMember = { firstName: '', lastName: '', gender: 'unspecified', dob: '', phone: '', email: '', address: '', category: 'standard', emergencyContact: { name: '', phone: '' }, healthNotes: '', notes: '', rfid: '' };

export function MemberForm({ open, onClose, initial, onSaved }: { open: boolean; onClose: () => void; initial?: any; onSaved: (m: any) => void }) {
  const toast = useToast();
  const { site } = useSite();
  const [m, setM] = useState<any>(() => initial ?? emptyMember);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  const save = async () => {
    setBusy(true); setErr(null);
    try {
      const body = {
        firstName: m.firstName, lastName: m.lastName, gender: m.gender, dob: m.dob ? new Date(m.dob).toISOString() : null, phone: m.phone, email: m.email,
        address: m.address, category: m.category, emergencyContact: m.emergencyContact, healthNotes: m.healthNotes, notes: m.notes, rfid: m.rfid,
        ...(initial?._id && m.status ? { status: m.status } : {}),
      };
      const r = initial?._id ? await api.put(`/admin/members/${initial._id}`, body) : await api.post('/admin/members', body);
      toast('Member saved'); onSaved(r.data); onClose();
    } catch (e) { setErr(e); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title={initial?._id ? 'Edit member' : 'New member'} wide footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button loading={busy} onClick={save}>Save</Button></>}>
      <div className="grid gap-4 md:grid-cols-3">
        <Field label="First name" required><Input value={m.firstName} onChange={(e) => setM({ ...m, firstName: e.target.value })} /></Field>
        <Field label="Last name"><Input value={m.lastName} onChange={(e) => setM({ ...m, lastName: e.target.value })} /></Field>
        <Field label="Gender"><Select value={m.gender} onChange={(e) => setM({ ...m, gender: e.target.value })}><option value="unspecified">Prefer not to say</option><option value="female">Female</option><option value="male">Male</option><option value="other">Other</option></Select></Field>
        <Field label="Date of birth" hint="Used for age-group reports"><Input type="date" value={m.dob ? String(m.dob).slice(0, 10) : ''} onChange={(e) => setM({ ...m, dob: e.target.value })} /></Field>
        <Field label="Phone"><Input type="tel" value={m.phone} onChange={(e) => setM({ ...m, phone: e.target.value })} /></Field>
        <Field label="Email"><Input type="email" value={m.email} onChange={(e) => setM({ ...m, email: e.target.value })} /></Field>
        <Field label="Pricing category"><Select value={m.category} onChange={(e) => setM({ ...m, category: e.target.value })}>{(site?.settings.categories ?? ['standard']).map((c) => <option key={c} value={c}>{cap(c)}</option>)}</Select></Field>
        <Field label="RFID / card no."><Input value={m.rfid} onChange={(e) => setM({ ...m, rfid: e.target.value })} /></Field>
        {initial?._id && <Field label="Status"><Select value={m.status} onChange={(e) => setM({ ...m, status: e.target.value })}>{['active', 'frozen', 'cancelled', 'expired', 'inactive'].map((s) => <option key={s} value={s}>{cap(s)}</option>)}</Select></Field>}
        <Field label="Address" className="md:col-span-3"><Input value={m.address} onChange={(e) => setM({ ...m, address: e.target.value })} /></Field>
        <Field label="Emergency contact name"><Input value={m.emergencyContact?.name ?? ''} onChange={(e) => setM({ ...m, emergencyContact: { ...m.emergencyContact, name: e.target.value } })} /></Field>
        <Field label="Emergency contact phone"><Input value={m.emergencyContact?.phone ?? ''} onChange={(e) => setM({ ...m, emergencyContact: { ...m.emergencyContact, phone: e.target.value } })} /></Field>
        <div />
        <Field label="Health notes" className="md:col-span-3"><Textarea rows={2} value={m.healthNotes} onChange={(e) => setM({ ...m, healthNotes: e.target.value })} /></Field>
        <Field label="Internal notes" className="md:col-span-3"><Textarea rows={2} value={m.notes} onChange={(e) => setM({ ...m, notes: e.target.value })} /></Field>
      </div>
      <div className="mt-3"><ErrorNote error={err} /></div>
    </Modal>
  );
}

export default function Members() {
  const { can } = useAuth();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState(() => new URLSearchParams(window.location.search).get('status') ?? 'all');
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const list = useLoad((s) => api.get(`/admin/members${qs({ q, status, page, limit: 25 })}`, s), [q, status, page]);

  return (
    <>
      <PageHeader title="Members" subtitle="Your members master list." actions={can('members.write') && <Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>Add member</Button>} />
      <Card padded={false}>
        <div className="flex flex-wrap gap-3 border-b border-line p-4">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <Input className="pl-9" placeholder="Search name, number, phone, email" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
          </div>
          <Select className="w-44" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            {['all', 'active', 'expired', 'inactive', 'frozen', 'cancelled'].map((s) => <option key={s} value={s}>{s === 'all' ? 'All statuses' : cap(s)}</option>)}
          </Select>
        </div>
        <ErrorNote error={list.error} />
        <Table
          loading={list.loading}
          rows={list.data?.data ?? []}
          onRowClick={(m: any) => nav(`/admin/members/${m._id}`)}
          empty="No members match."
          columns={[
            { key: 'n', header: 'Member', render: (m: any) => <div><div className="font-semibold">{m.firstName} {m.lastName}</div><div className="text-xs text-muted">{m.memberNo}</div></div> },
            { key: 'c', header: 'Contact', render: (m: any) => <div className="text-xs"><div>{m.phone || '—'}</div><div className="text-muted">{m.email}</div></div> },
            { key: 'p', header: 'Plan', render: (m: any) => <div className="text-xs"><div>{m.currentPlanName || '—'}</div><div className="text-muted">{cap(m.category)}</div></div> },
            { key: 'e', header: 'Expires', render: (m: any) => (m.expiresAt ? <span className="text-xs">{date(m.expiresAt)}{m.status === 'active' && daysUntil(m.expiresAt) <= 7 && <Badge tone="amber" className="ml-1">{daysUntil(m.expiresAt)}d</Badge>}</span> : '—') },
            { key: 's', header: 'Status', render: (m: any) => <Badge tone={statusTone(m.status)}>{m.status}</Badge> },
          ]}
        />
        {list.data && <Pager page={page} pages={list.data.pagination.pages} total={list.data.pagination.total} onPage={setPage} />}
      </Card>
      {creating && <MemberForm open onClose={() => setCreating(false)} onSaved={(m) => nav(`/admin/members/${m._id}`)} />}
    </>
  );
}

export function MemberDetail() {
  const { id } = useParams();
  const { can } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const { confirm, dialog } = useConfirm();
  const d = useLoad((s) => api.get(`/admin/members/${id}`, s).then((r) => r.data), [id]);
  const [editing, setEditing] = useState(false);
  const [selling, setSelling] = useState(false);
  const [paying, setPaying] = useState<any>(null);
  const [portal, setPortal] = useState(false);
  const [login, setLogin] = useState({ email: '', password: '' });
  const [showQr, setShowQr] = useState(false);

  if (d.loading && !d.data) return <Spinner />;
  if (d.error) return <ErrorNote error={d.error} />;
  const { member: m, memberships, invoices, payments, checkIns, portalLogin } = d.data;

  const remove = async () => {
    if (!(await confirm(`Delete ${m.firstName}? This only works for members without billing history.`))) return;
    try { await api.del(`/admin/members/${m._id}`); toast('Member deleted'); nav('/admin/members'); } catch (e) { toast((e as Error).message, 'err'); }
  };
  const savePortal = async () => {
    try { await api.post(`/admin/members/${m._id}/portal-login`, login); toast('Portal login saved'); setPortal(false); d.reload(); } catch (e) { toast((e as Error).message, 'err'); }
  };

  return (
    <>
      {dialog}
      <Link to="/admin/members" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" /> Members</Link>
      <PageHeader
        title={<span className="flex items-center gap-3">{m.firstName} {m.lastName} <Badge tone={statusTone(m.status)}>{m.status}</Badge></span>}
        subtitle={`${m.memberNo} · ${cap(m.category)} · joined ${date(m.joinedAt)}`}
        actions={
          <>
            <Button variant="outline" icon={<QrCode className="h-4 w-4" />} onClick={() => setShowQr(true)}>Check-in code</Button>
            {can('members.write') && <Button variant="outline" icon={<Pencil className="h-4 w-4" />} onClick={() => setEditing(true)}>Edit</Button>}
            {can('payments.record') && <Button icon={<Wallet className="h-4 w-4" />} onClick={() => setSelling(true)}>{m.status === 'active' ? 'Renew' : 'Sell membership'}</Button>}
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Profile">
          <dl className="space-y-2.5 text-sm">
            {[
              ['Plan', m.currentPlanName || '—'], ['Valid', m.expiresAt ? `${date(m.startsAt)} → ${date(m.expiresAt)}` : '—'], ['Phone', m.phone || '—'], ['Email', m.email || '—'],
              ['Gender', cap(m.gender)], ['Date of birth', m.dob ? date(m.dob) : '—'], ['Visits', m.totalVisits], ['Last visit', m.lastVisitAt ? dateTime(m.lastVisitAt) : '—'],
              ['Emergency', m.emergencyContact?.name ? `${m.emergencyContact.name} ${m.emergencyContact.phone}` : '—'],
            ].map(([k, v]) => <div key={k as string} className="flex justify-between gap-4"><dt className="text-muted">{k}</dt><dd className="text-right">{v}</dd></div>)}
          </dl>
          {m.healthNotes && <p className="mt-4 rounded-brand bg-amber-500/10 p-3 text-xs">{m.healthNotes}</p>}
          <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-4">
            {can('members.write') && <Button size="sm" variant="outline" icon={<KeyRound className="h-3.5 w-3.5" />} onClick={() => { setLogin({ email: portalLogin?.email ?? m.email, password: '' }); setPortal(true); }}>{portalLogin ? 'Reset portal login' : 'Give portal login'}</Button>}
            {can('members.delete') && <Button size="sm" variant="ghost" onClick={remove}>Delete</Button>}
          </div>
        </Card>
        <div className="space-y-6 lg:col-span-2">
          <Card title="Invoices" padded={false}>
            <Table
              rows={invoices}
              empty="No invoices yet."
              columns={[
                { key: 'n', header: 'Invoice', render: (i: any) => <Link className="font-semibold hover:text-link" to={`/admin/billing/${i._id}`}>{i.number}</Link> },
                { key: 'd', header: 'Date', render: (i: any) => date(i.issuedAt) },
                { key: 't', header: 'Total', render: (i: any) => money(i.total, i.currency) },
                { key: 'p', header: 'Paid', render: (i: any) => money(i.paid, i.currency) },
                { key: 's', header: 'Status', render: (i: any) => <Badge tone={statusTone(i.status)}>{i.status}</Badge> },
                { key: 'a', header: '', className: 'text-right', render: (i: any) => can('payments.record') && ['unpaid', 'partial'].includes(i.status) && <Button size="sm" onClick={() => setPaying(i)}>Take payment</Button> },
              ]}
            />
          </Card>
          <Card title="Membership history" padded={false}>
            <Table rows={memberships} empty="No memberships yet." columns={[
              { key: 'p', header: 'Plan', render: (x: any) => `${x.planName} (${cap(x.category)})` },
              { key: 'd', header: 'Period', render: (x: any) => `${date(x.startsAt)} → ${date(x.endsAt)}` },
              { key: 's', header: 'Status', render: (x: any) => <Badge tone={statusTone(x.status)}>{x.status}</Badge> },
            ]} />
          </Card>
          <div className="grid gap-6 md:grid-cols-2">
            <Card title="Payments" padded={false}>
              <Table rows={payments} empty="No payments." columns={[
                { key: 'r', header: 'Receipt', render: (p: any) => <span className="text-xs">{p.receiptNo}</span> },
                { key: 'a', header: 'Amount', render: (p: any) => money(p.amount, p.currency) },
                { key: 'm', header: 'Method', render: (p: any) => cap(p.method) },
              ]} />
            </Card>
            <Card title="Recent visits" padded={false}>
              <Table rows={checkIns} empty="No visits yet." columns={[
                { key: 'i', header: 'In', render: (c: any) => dateTime(c.inAt) },
                { key: 'd', header: 'Duration', render: (c: any) => (c.durationMin ? `${c.durationMin} min` : c.outAt ? '—' : <Badge tone="green">Inside</Badge>) },
              ]} />
            </Card>
          </div>
        </div>
      </div>

      {editing && <MemberForm open initial={m} onClose={() => setEditing(false)} onSaved={() => d.reload()} />}
      {selling && <SellMembership open member={m} onClose={() => setSelling(false)} onDone={d.reload} />}
      <RecordPayment open={Boolean(paying)} invoice={paying} onClose={() => setPaying(null)} onDone={d.reload} />
      <Modal open={portal} onClose={() => setPortal(false)} title="Member portal login" footer={<><Button variant="outline" onClick={() => setPortal(false)}>Cancel</Button><Button onClick={savePortal}>Save</Button></>}>
        <p className="mb-4 text-sm text-muted">The member signs in on the same page as staff and sees only their own membership, invoices and class bookings.</p>
        <div className="grid gap-3">
          <Field label="Email"><Input type="email" value={login.email} onChange={(e) => setLogin({ ...login, email: e.target.value })} /></Field>
          <Field label="Password" hint="At least 8 characters. Share it with the member securely."><Input type="text" value={login.password} onChange={(e) => setLogin({ ...login, password: e.target.value })} /></Field>
        </div>
      </Modal>
      <Modal open={showQr} onClose={() => setShowQr(false)} title="Check-in code">
        <p className="text-sm text-muted">Scan or type this at the check-in desk.</p>
        <p className="mt-4 select-all break-all rounded-brand bg-surface2 p-4 text-center font-mono text-lg">{m.memberNo}</p>
      </Modal>
    </>
  );
}
