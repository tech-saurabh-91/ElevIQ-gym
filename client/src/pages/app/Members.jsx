import { useCallback, useEffect, useState } from 'react';
import { Badge, Button, Empty, Field, Input, Loading, Modal, Select, Tabs, Textarea, useToast } from '../../components/ui';
import DataTable from '../../components/DataTable';
import { useLocale } from '../../lib/i18n';
import api from '../../lib/api';

const STATUS_TONE = { active: 'success', expired: 'danger', cancelled: 'danger', frozen: 'info', pending: 'warn' };

const EMPTY_FORM = {
  firstName: '', lastName: '', email: '', phone: '', gender: 'other', status: 'active',
  company: '', city: '', goals: '', planName: 'Pro', notes: '',
};

export default function Members() {
  const { money, date } = useLocale();
  const { push } = useToast();
  const [rows, setRows] = useState([]);
  const [stats, setStats] = useState(null);
  const [plans, setPlans] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 12, total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState({ q: '', status: 'all' });
  const [page, setPage] = useState(1);
  const [form, setForm] = useState(EMPTY_FORM);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState(null);
  const [history, setHistory] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(api.qs('/members', { page, limit: 12, q: query.q, status: query.status }));
      setRows(res.data);
      setPagination(res.pagination);
    } catch (e) {
      push(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [page, query, push]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    api.get('/members/stats').then((r) => setStats(r.data)).catch(() => {});
    api.get('/plans/manage').then((r) => setPlans(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    const id = setTimeout(() => setPage(1), 300);
    return () => clearTimeout(id);
  }, [query.q, query.status]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        address: { city: form.city },
        goals: form.goals ? form.goals.split(',').map((g) => g.trim()).filter(Boolean) : [],
        plan: plans.find((p) => p.name === form.planName)?._id,
        planName: form.planName,
      };
      await api.post('/members', payload);
      push('Member created and welcome email queued.');
      setOpen(false);
      setForm(EMPTY_FORM);
      load();
      api.get('/members/stats').then((r) => setStats(r.data)).catch(() => {});
    } catch (err) {
      push(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const openDetail = async (row) => {
    setDetail(row);
    setHistory(null);
    try {
      const h = await api.get(`/members/${row._id}/history`);
      setHistory(h.data);
    } catch {
      setHistory({ checkIns: [], bookings: [] });
    }
  };

  const renew = async (row) => {
    try {
      const res = await api.post(`/members/${row._id}/renew`, { days: 30 });
      push(`Renewed through ${date(res.data.member.expiresAt)} · receipt issued`);
      load();
      if (detail?._id === row._id) setDetail(res.data.member);
    } catch (e) {
      push(e.message, 'error');
    }
  };

  const toggleCheckin = async (row) => {
    try {
      const res = await api.post(`/members/${row._id}/checkin`, { method: 'manual' });
      push(res.data.action === 'checkin' ? `${row.firstName} checked in` : `${row.firstName} checked out after ${res.data.checkIn.durationMin} min`, 'info');
      load();
    } catch (e) {
      push(e.message, 'error');
    }
  };

  const columns = [
    {
      key: 'name',
      label: 'Member',
      render: (r) => (
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-violet/70 to-mint/70 font-display text-[11px] font-black text-void">
            {(r.firstName?.[0] || '?') + (r.lastName?.[0] || '')}
          </span>
          <div className="min-w-0">
            <p className="truncate font-semibold text-bone">{r.firstName} {r.lastName}</p>
            <p className="truncate font-mono text-[11px] text-muted">{r.memberId}</p>
          </div>
        </div>
      ),
    },
    { key: 'planName', label: 'Plan', render: (r) => <span className="text-xs font-semibold text-violet">{r.planName || '—'}</span> },
    { key: 'status', label: 'Status', render: (r) => <Badge tone={STATUS_TONE[r.status] || 'default'}>{r.status}</Badge> },
    { key: 'expiresAt', label: 'Expires', render: (r) => <span className="text-xs text-muted">{r.expiresAt ? date(r.expiresAt) : '—'}</span> },
    { key: 'visits', label: 'Visits', render: (r) => <span className="font-mono text-xs">{r.totalVisits}</span> },
    {
      key: 'balance',
      label: 'Balance',
      render: (r) => <span className={`font-mono text-xs ${r.balance > 0 ? 'text-coral' : 'text-muted'}`}>{money(r.balance || 0)}</span>,
    },
    {
      key: 'actions',
      label: '',
      className: 'text-end',
      render: (r) => (
        <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
          <button onClick={() => toggleCheckin(r)} className="rounded-lg border border-white/12 px-2.5 py-1.5 text-[11px] text-muted transition hover:border-mint/50 hover:text-mint">
            {r.status === 'active' ? 'Check-in' : '—'}
          </button>
          <button onClick={() => renew(r)} className="rounded-lg border border-white/12 px-2.5 py-1.5 text-[11px] text-muted transition hover:border-violet/50 hover:text-violet">
            Renew
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-black tracking-tight">Member management</h2>
          <p className="mt-1 text-sm text-muted">
            {stats?.total ?? '—'} total · {stats?.active ?? '—'} active · {stats?.newThisMonth ?? '—'} joined this month · {stats?.expiring ?? '—'} expiring soon
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>+ Add member</Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {(stats?.byStatus || []).map((s) => (
          <div key={s._id} className="rounded-2xl border border-white/10 bg-surface/60 p-4">
            <p className="font-display text-2xl font-black">{s.count}</p>
            <p className="text-[11px] uppercase tracking-[0.14em] text-muted">{s._id} members</p>
          </div>
        ))}
      </div>

      <DataTable
        columns={columns}
        data={rows}
        loading={loading}
        pagination={pagination}
        onPageChange={setPage}
        onRowClick={openDetail}
        emptyTitle="No members match"
        emptySubtitle="Adjust the filters or add a new member to get started."
        toolbar={
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[220px] flex-1">
              <Input
                value={query.q}
                onChange={(e) => setQuery((q) => ({ ...q, q: e.target.value }))}
                placeholder="Search name, member ID or company…"
                className="!py-2.5"
              />
            </div>
            <Tabs
              tabs={[
                { value: 'all', label: 'All' },
                { value: 'active', label: 'Active' },
                { value: 'expired', label: 'Expired' },
                { value: 'pending', label: 'Pending' },
              ]}
              value={query.status}
              onChange={(v) => setQuery((q) => ({ ...q, status: v }))}
            />
          </div>
        }
      />

      {/* Add modal */}
      <Modal open={open} onClose={() => setOpen(false)} title="Add a new member" size="lg">
        <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
          <Field label="First name"><Input value={form.firstName} onChange={set('firstName')} required /></Field>
          <Field label="Last name"><Input value={form.lastName} onChange={set('lastName')} required /></Field>
          <Field label="Email"><Input type="email" value={form.email} onChange={set('email')} required /></Field>
          <Field label="Phone"><Input value={form.phone} onChange={set('phone')} /></Field>
          <Field label="Membership plan">
            <Select value={form.planName} onChange={set('planName')}>
              {plans.map((p) => <option key={p._id} value={p.name}>{p.name} — {money(p.price)}</option>)}
            </Select>
          </Field>
          <Field label="Status">
            <Select value={form.status} onChange={set('status')}>
              {['active', 'pending', 'frozen', 'expired', 'cancelled'].map((s) => <option key={s}>{s}</option>)}
            </Select>
          </Field>
          <Field label="City"><Input value={form.city} onChange={set('city')} placeholder="Bengaluru" /></Field>
          <Field label="Company (optional)"><Input value={form.company} onChange={set('company')} /></Field>
          <div className="sm:col-span-2">
            <Field label="Goals" hint="Comma separated — used for retention segments.">
              <Input value={form.goals} onChange={set('goals')} placeholder="Fat loss, Mobility" />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Notes"><Textarea value={form.notes} onChange={set('notes')} /></Field>
          </div>
          <div className="sm:col-span-2 flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>Create member</Button>
          </div>
        </form>
      </Modal>

      {/* Detail drawer */}
      <Modal open={Boolean(detail)} onClose={() => setDetail(null)} title={detail ? `${detail.firstName} ${detail.lastName}` : ''} size="lg">
        {detail && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-violet to-mint font-display text-lg font-black text-void">
                {(detail.firstName?.[0] || '?') + (detail.lastName?.[0] || '')}
              </span>
              <div>
                <p className="font-mono text-xs text-mint">{detail.memberId}</p>
                <p className="text-sm text-muted">{detail.planName} · joined {date(detail.joinedAt)}</p>
              </div>
              <Badge tone={STATUS_TONE[detail.status]} className="ms-auto">{detail.status}</Badge>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { k: 'Expires', v: detail.expiresAt ? date(detail.expiresAt) : '—' },
                { k: 'Total visits', v: detail.totalVisits },
                { k: 'This month', v: detail.visitsThisMonth },
                { k: 'Balance', v: money(detail.balance || 0) },
              ].map((x) => (
                <div key={x.k} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <p className="text-[10px] uppercase tracking-widest text-muted">{x.k}</p>
                  <p className="mt-1 text-sm font-semibold">{x.v}</p>
                </div>
              ))}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted">Emergency contact</p>
                <p className="mt-2 text-sm">{detail.emergencyContact?.name || '—'}</p>
                <p className="text-xs text-muted">{detail.emergencyContact?.relation} · {detail.emergencyContact?.phone}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted">Goals & tags</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {(detail.goals || []).map((g) => <span key={g} className="chip">{g}</span>)}
                  {(detail.tags || []).map((g) => <span key={g} className="chip">{g}</span>)}
                </div>
              </div>
            </div>

            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted">Recent visits</p>
              {!history ? (
                <Loading />
              ) : history.checkIns.length === 0 ? (
                <Empty title="No visits yet" />
              ) : (
                <div className="mt-2 max-h-44 overflow-y-auto scrollbar-thin rounded-2xl border border-white/10">
                  {history.checkIns.map((c) => (
                    <div key={c._id} className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2.5 text-xs last:border-0">
                      <span className="text-muted">{new Date(c.inAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                      <span className="font-mono text-bone/80">{c.durationMin ? `${c.durationMin} min` : 'inside'}</span>
                      <Badge tone={c.outAt ? 'default' : 'success'}>{c.outAt ? 'closed' : 'open'}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-3 border-t border-white/10 pt-4">
              <Button onClick={() => renew(detail)}>Renew 30 days</Button>
              <Button variant="ghost" onClick={() => toggleCheckin(detail)}>Toggle check-in</Button>
              <Button variant="ghost" onClick={() => setDetail(null)}>Close</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
