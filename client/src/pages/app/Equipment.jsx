import { useCallback, useEffect, useState } from 'react';
import { Badge, Button, Field, Input, Loading, Modal, Select, Tabs, Textarea, useToast } from '../../components/ui';
import DataTable from '../../components/DataTable';
import { useLocale } from '../../lib/i18n';
import api from '../../lib/api';

const EQ_TONE = { 'in-use': 'success', maintenance: 'warn', 'out-of-order': 'danger', retired: 'default' };
const TICKET_TONE = { open: 'warn', 'in-progress': 'info', done: 'success', deferred: 'default' };

export default function Equipment() {
  const { money, date } = useLocale();
  const { push } = useToast();
  const [tab, setTab] = useState('assets');
  const [assets, setAssets] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [assetOpen, setAssetOpen] = useState(false);
  const [ticketOpen, setTicketOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [assetForm, setAssetForm] = useState({ name: '', category: 'cardio', brand: '', cost: 1200, zone: 'Cardio Deck', vendor: '' });
  const [ticketForm, setTicketForm] = useState({ title: '', priority: 'medium', type: 'preventive', description: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [a, m, s] = await Promise.all([
        api.get(api.qs('/ops/equipment', { q, status, limit: 60 })),
        api.get(api.qs('/ops/maintenance', { limit: 50 })),
        api.get('/ops/equipment/stats/summary'),
      ]);
      setAssets(a.data);
      setTickets(m.data);
      setSummary(s.data);
    } catch (e) {
      push(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [q, status, push]);

  useEffect(() => {
    const id = setTimeout(load, 250);
    return () => clearTimeout(id);
  }, [load]);

  const createAsset = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/ops/equipment', {
        ...assetForm,
        cost: Number(assetForm.cost),
        assetTag: `AST-${Math.floor(2000 + Math.random() * 7999)}`,
        status: 'in-use',
      });
      push('Asset registered.');
      setAssetOpen(false);
      load();
    } catch (err) {
      push(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const createTicket = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/ops/maintenance', { ...ticketForm, equipment: ticketForm.equipment || assets[0]?._id });
      push('Ticket raised — technician notified.');
      setTicketOpen(false);
      load();
    } catch (err) {
      push(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const advance = async (id, next) => {
    try {
      await api.post(`/ops/maintenance/${id}/progress`, { status: next });
      push(`Ticket moved to ${next}.`, 'info');
      load();
    } catch (e) {
      push(e.message, 'error');
    }
  };

  const assetColumns = [
    {
      key: 'name',
      label: 'Asset',
      render: (r) => (
        <div>
          <p className="font-semibold text-bone">{r.name}</p>
          <p className="font-mono text-[11px] text-muted">{r.assetTag} · {r.brand}</p>
        </div>
      ),
    },
    { key: 'category', label: 'Category', render: (r) => <span className="text-xs capitalize text-violet">{r.category}</span> },
    { key: 'zone', label: 'Zone', render: (r) => <span className="text-xs text-muted">{r.zone}</span> },
    { key: 'condition', label: 'Condition', render: (r) => <Badge tone={r.condition === 'excellent' || r.condition === 'good' ? 'success' : r.condition === 'fair' ? 'warn' : 'danger'}>{r.condition}</Badge> },
    { key: 'usageCount', label: 'Usage', render: (r) => <span className="font-mono text-xs">{r.usageCount.toLocaleString()}×</span> },
    { key: 'safetyScore', label: 'Safety', render: (r) => (
      <div className="flex items-center gap-2">
        <div className="h-1.5 w-14 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full" style={{ width: `${r.safetyScore}%`, background: r.safetyScore > 85 ? '#00E5A0' : r.safetyScore > 70 ? '#FBBF24' : '#FF4D6D' }} />
        </div>
        <span className="font-mono text-[11px] text-muted">{r.safetyScore}</span>
      </div>
    )},
    { key: 'nextServiceAt', label: 'Next service', render: (r) => <span className="text-xs text-muted">{r.nextServiceAt ? date(r.nextServiceAt) : '—'}</span> },
    { key: 'status', label: 'Status', render: (r) => <Badge tone={EQ_TONE[r.status]}>{r.status}</Badge> },
  ];

  const ticketColumns = [
    { key: 'title', label: 'Ticket', render: (r) => (
      <div>
        <p className="font-semibold text-bone">{r.title}</p>
        <p className="text-[11px] text-muted">{r.equipment?.name} · {r.equipment?.assetTag}</p>
      </div>
    )},
    { key: 'type', label: 'Type', render: (r) => <span className="text-xs capitalize text-sky">{r.type}</span> },
    { key: 'priority', label: 'Priority', render: (r) => <Badge tone={r.priority === 'critical' || r.priority === 'high' ? 'danger' : r.priority === 'medium' ? 'warn' : 'default'}>{r.priority}</Badge> },
    { key: 'cost', label: 'Cost', render: (r) => <span className="font-mono text-xs">{money(r.cost || 0)}</span> },
    { key: 'downtimeHours', label: 'Downtime', render: (r) => <span className="font-mono text-xs text-coral">{r.downtimeHours}h</span> },
    { key: 'status', label: 'Status', render: (r) => <Badge tone={TICKET_TONE[r.status]}>{r.status}</Badge> },
    {
      key: 'actions',
      label: '',
      className: 'text-end',
      render: (r) => (
        <div className="flex justify-end gap-2">
          {r.status === 'open' && <button onClick={() => advance(r._id, 'in-progress')} className="rounded-lg border border-white/12 px-2.5 py-1.5 text-[11px] text-muted hover:border-sky/50 hover:text-sky">Start</button>}
          {(r.status === 'in-progress' || r.status === 'deferred') && <button onClick={() => advance(r._id, 'done')} className="rounded-lg border border-white/12 px-2.5 py-1.5 text-[11px] text-muted hover:border-mint/50 hover:text-mint">Resolve</button>}
          {r.status === 'done' && <span className="text-[11px] text-muted">✓ {r.completedAt ? date(r.completedAt, { year: false }) : ''}</span>}
        </div>
      ),
    },
  ];

  if (loading && !assets.length) return <Loading label="Loading asset registry…" />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-black tracking-tight">Equipment & maintenance</h2>
          <p className="mt-1 text-sm text-muted">
            {summary?.total ?? assets.length} assets · {summary?.openTickets ?? tickets.filter((t) => t.status !== 'done').length} open tickets · safety score {summary?.safetyScore ?? '—'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => setTicketOpen(true)}>+ Raise ticket</Button>
          <Button onClick={() => setAssetOpen(true)}>+ Register asset</Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {(summary?.byStatus || []).map((s) => (
          <div key={s._id} className="rounded-2xl border border-white/10 bg-surface/60 p-4">
            <p className="font-display text-2xl font-black">{s.count}</p>
            <p className="text-[11px] uppercase tracking-[0.14em] text-muted">{s._id}</p>
          </div>
        ))}
      </div>

      <Tabs
        tabs={[
          { value: 'assets', label: 'Asset registry' },
          { value: 'tickets', label: 'Maintenance tickets' },
          { value: 'utilisation', label: 'Utilisation' },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'assets' && (
        <DataTable
          columns={assetColumns}
          data={assets}
          loading={loading}
          emptyTitle="No assets match"
          toolbar={
            <div className="flex flex-wrap gap-3">
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search asset tag, name or brand…" className="!py-2.5 flex-1 min-w-[220px]" />
              <Select value={status} onChange={(e) => setStatus(e.target.value)} className="!py-2.5 !w-auto">
                {['all', 'in-use', 'maintenance', 'out-of-order', 'retired'].map((s) => <option key={s}>{s}</option>)}
              </Select>
            </div>
          }
        />
      )}

      {tab === 'tickets' && (
        <DataTable columns={ticketColumns} data={tickets} loading={loading} emptyTitle="No tickets" emptySubtitle="Raise one when the floor walk finds a problem." />
      )}

      {tab === 'utilisation' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-surface/60 p-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted">Usage by category</p>
            <div className="mt-4 space-y-3">
              {(summary?.byCategory || []).map((c) => {
                const max = Math.max(...(summary.byCategory.map((x) => x.usage) || [1]), 1);
                return (
                  <div key={c._id}>
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="capitalize text-bone/85">{c._id}</span>
                      <span className="font-mono text-muted">{c.usage.toLocaleString()} uses · {c.count} units</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/8">
                      <div className="h-full rounded-full bg-gradient-to-r from-mint to-violet" style={{ width: `${(c.usage / max) * 100}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="rounded-3xl border border-white/10 bg-surface/60 p-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted">Most used assets</p>
            <div className="mt-4 space-y-2.5">
              {(summary?.topUsed || []).map((a) => (
                <div key={a._id} className="flex items-center justify-between rounded-xl border border-white/8 bg-white/[0.03] px-3.5 py-2.5">
                  <div>
                    <p className="text-sm font-semibold">{a.name}</p>
                    <p className="font-mono text-[11px] text-muted">{a.assetTag}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm text-mint">{a.usageCount.toLocaleString()}</span>
                    <Badge tone={EQ_TONE[a.status]}>{a.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <Modal open={assetOpen} onClose={() => setAssetOpen(false)} title="Register an asset">
        <form onSubmit={createAsset} className="grid gap-4">
          <Field label="Equipment name"><Input value={assetForm.name} onChange={(e) => setAssetForm((f) => ({ ...f, name: e.target.value }))} required /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Category">
              <Select value={assetForm.category} onChange={(e) => setAssetForm((f) => ({ ...f, category: e.target.value }))}>
                {['cardio', 'strength', 'free-weights', 'functional', 'studio', 'recovery'].map((c) => <option key={c}>{c}</option>)}
              </Select>
            </Field>
            <Field label="Brand"><Input value={assetForm.brand} onChange={(e) => setAssetForm((f) => ({ ...f, brand: e.target.value }))} /></Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Cost (USD)"><Input type="number" value={assetForm.cost} onChange={(e) => setAssetForm((f) => ({ ...f, cost: e.target.value }))} /></Field>
            <Field label="Zone"><Input value={assetForm.zone} onChange={(e) => setAssetForm((f) => ({ ...f, zone: e.target.value }))} /></Field>
          </div>
          <Field label="Vendor"><Input value={assetForm.vendor} onChange={(e) => setAssetForm((f) => ({ ...f, vendor: e.target.value }))} /></Field>
          <div className="flex justify-end gap-3 pt-1">
            <Button type="button" variant="ghost" onClick={() => setAssetOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>Register</Button>
          </div>
        </form>
      </Modal>

      <Modal open={ticketOpen} onClose={() => setTicketOpen(false)} title="Raise a maintenance ticket">
        <form onSubmit={createTicket} className="grid gap-4">
          <Field label="Asset">
            <Select value={ticketForm.equipment || ''} onChange={(e) => setTicketForm((f) => ({ ...f, equipment: e.target.value }))}>
              {assets.map((a) => <option key={a._id} value={a._id}>{a.assetTag} — {a.name}</option>)}
            </Select>
          </Field>
          <Field label="Title"><Input value={ticketForm.title} onChange={(e) => setTicketForm((f) => ({ ...f, title: e.target.value }))} required /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Type">
              <Select value={ticketForm.type} onChange={(e) => setTicketForm((f) => ({ ...f, type: e.target.value }))}>
                {['preventive', 'corrective', 'inspection', 'safety'].map((c) => <option key={c}>{c}</option>)}
              </Select>
            </Field>
            <Field label="Priority">
              <Select value={ticketForm.priority} onChange={(e) => setTicketForm((f) => ({ ...f, priority: e.target.value }))}>
                {['low', 'medium', 'high', 'critical'].map((c) => <option key={c}>{c}</option>)}
              </Select>
            </Field>
          </div>
          <Field label="Description"><Textarea value={ticketForm.description} onChange={(e) => setTicketForm((f) => ({ ...f, description: e.target.value }))} /></Field>
          <div className="flex justify-end gap-3 pt-1">
            <Button type="button" variant="ghost" onClick={() => setTicketOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>Raise ticket</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
