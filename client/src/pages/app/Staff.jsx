import { useCallback, useEffect, useState } from 'react';
import { Badge, Button, Field, Input, Loading, Modal, Select, Tabs, useToast } from '../../components/ui';
import DataTable from '../../components/DataTable';
import { useLocale } from '../../lib/i18n';
import api from '../../lib/api';

export default function Staff() {
  const { money } = useLocale();
  const { push } = useToast();
  const [tab, setTab] = useState('people');
  const [rows, setRows] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState('');
  const [form, setForm] = useState({ jobTitle: 'Personal Trainer', department: 'training', salary: 3500, employmentType: 'full-time', shift: 'Morning', specializations: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, sh, an] = await Promise.all([
        api.get(api.qs('/ops/staff', { q, limit: 50 })),
        api.get(api.qs('/ops/shifts', { limit: 40 })),
        api.get('/dashboard/staff-analytics'),
      ]);
      setRows(s.data);
      setShifts(sh.data);
      setAnalytics(an.data);
    } catch (e) {
      push(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [q, push]);

  useEffect(() => {
    const id = setTimeout(load, 250);
    return () => clearTimeout(id);
  }, [load]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/ops/staff', {
        ...form,
        specializations: form.specializations.split(',').map((s) => s.trim()).filter(Boolean),
        employeeId: `GF-E${Math.floor(300 + Math.random() * 699)}`,
      });
      push('Staff profile created.');
      setOpen(false);
      load();
    } catch (err) {
      push(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    {
      key: 'name',
      label: 'Employee',
      render: (r) => (
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-sky to-violet font-display text-[11px] font-black text-void">
            {(r.user?.name || '?').split(' ').map((w) => w[0]).join('').slice(0, 2)}
          </span>
          <div>
            <p className="font-semibold text-bone">{r.user?.name}</p>
            <p className="font-mono text-[11px] text-muted">{r.employeeId} · {r.user?.email}</p>
          </div>
        </div>
      ),
    },
    { key: 'jobTitle', label: 'Role', render: (r) => <span className="text-xs">{r.jobTitle}</span> },
    { key: 'department', label: 'Dept', render: (r) => <Badge tone="info">{r.department}</Badge> },
    { key: 'certs', label: 'Certifications', render: (r) => <span className="text-xs text-muted">{(r.certifications || []).length} on file</span> },
    { key: 'rating', label: 'Rating', render: (r) => <span className="font-mono text-xs text-amber">★ {r.rating || '—'}</span> },
    { key: 'score', label: 'Score', render: (r) => (
      <div className="flex items-center gap-2">
        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-gradient-to-r from-mint to-violet" style={{ width: `${r.performanceScore || 0}%` }} />
        </div>
        <span className="font-mono text-[11px] text-muted">{r.performanceScore}</span>
      </div>
    )},
    { key: 'salary', label: 'Salary', render: (r) => <span className="font-mono text-xs">{money(r.salary || 0)}</span> },
    { key: 'status', label: 'Status', render: (r) => <Badge tone={r.status === 'active' ? 'success' : r.status === 'on-leave' ? 'warn' : 'danger'}>{r.status}</Badge> },
  ];

  const shiftColumns = [
    { key: 'staff', label: 'Staff', render: (r) => <span className="text-xs font-semibold">{r.staff?.employeeId} · {r.staff?.jobTitle}</span> },
    { key: 'date', label: 'Date', render: (r) => <span className="text-xs">{new Date(r.date).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' })}</span> },
    { key: 'slot', label: 'Shift', render: (r) => <span className="font-mono text-xs">{r.start} → {r.end}</span> },
    { key: 'location', label: 'Club', render: (r) => <span className="text-xs text-muted">{r.location?.name || '—'}</span> },
    { key: 'status', label: 'Status', render: (r) => <Badge tone={r.status === 'confirmed' ? 'success' : r.status === 'absent' ? 'danger' : r.status === 'swapped' ? 'warn' : 'default'}>{r.status}</Badge> },
  ];

  if (loading && !rows.length) return <Loading label="Loading staff…" />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-black tracking-tight">Staff & scheduling</h2>
          <p className="mt-1 text-sm text-muted">
            {rows.length} employees · {analytics?.byDept?.length || 0} departments · payroll tracked monthly
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>+ Add employee</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {(analytics?.byDept || []).slice(0, 3).map((d) => (
          <div key={d._id} className="rounded-2xl border border-white/10 bg-surface/60 p-4">
            <p className="font-display text-2xl font-black">{d.count}</p>
            <p className="text-[11px] uppercase tracking-[0.14em] text-muted">{d._id} · {money(d.payroll)} payroll</p>
          </div>
        ))}
      </div>

      <Tabs
        tabs={[
          { value: 'people', label: 'People' },
          { value: 'shifts', label: 'Shift roster' },
          { value: 'top', label: 'Performance' },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'people' && (
        <DataTable
          columns={columns}
          data={rows}
          loading={loading}
          emptyTitle="No staff found"
          toolbar={
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by employee ID, role or specialisation…" className="!py-2.5" />
          }
        />
      )}

      {tab === 'shifts' && (
        <DataTable columns={shiftColumns} data={shifts} loading={loading} emptyTitle="No shifts scheduled" emptySubtitle="Shifts appear as managers build the roster." />
      )}

      {tab === 'top' && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(analytics?.top || []).map((s) => (
            <div key={s._id} className="rounded-3xl border border-white/10 bg-surface/60 p-5">
              <div className="flex items-center justify-between">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-mint to-violet font-display text-sm font-black text-void">
                  {(s.user?.name || '?').split(' ').map((w) => w[0]).join('').slice(0, 2)}
                </span>
                <Badge tone="violet">{s.performanceScore}</Badge>
              </div>
              <p className="mt-3 font-display font-semibold">{s.user?.name}</p>
              <p className="text-[11px] uppercase tracking-widest text-mint">{s.jobTitle}</p>
              <div className="mt-4 grid grid-cols-2 gap-2 text-center">
                {[
                  { k: 'Sessions', v: s.kpis?.sessionsCompleted },
                  { k: 'Members', v: s.kpis?.membersCoached },
                  { k: 'Attendance', v: `${s.kpis?.attendanceRate}%` },
                  { k: 'Revenue', v: money(s.kpis?.revenueGenerated || 0) },
                ].map((x) => (
                  <div key={x.k} className="rounded-xl border border-white/8 bg-white/[0.03] p-2.5">
                    <p className="text-sm font-bold">{x.v}</p>
                    <p className="text-[9px] uppercase tracking-widest text-muted">{x.k}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Add employee">
        <form onSubmit={save} className="grid gap-4">
          <Field label="Job title"><Input value={form.jobTitle} onChange={set('jobTitle')} required /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Department">
              <Select value={form.department} onChange={set('department')}>
                {['training', 'front-desk', 'operations', 'finance', 'marketing', 'management'].map((d) => <option key={d}>{d}</option>)}
              </Select>
            </Field>
            <Field label="Employment type">
              <Select value={form.employmentType} onChange={set('employmentType')}>
                {['full-time', 'part-time', 'contract', 'intern'].map((d) => <option key={d}>{d}</option>)}
              </Select>
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Monthly salary (USD)"><Input type="number" value={form.salary} onChange={set('salary')} /></Field>
            <Field label="Default shift">
              <Select value={form.shift} onChange={set('shift')}>
                {['Morning', 'Evening', 'Split'].map((d) => <option key={d}>{d}</option>)}
              </Select>
            </Field>
          </div>
          <Field label="Specialisations" hint="Comma separated."><Input value={form.specializations} onChange={set('specializations')} placeholder="Strength, Rehab" /></Field>
          <div className="flex justify-end gap-3 pt-1">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>Create</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
