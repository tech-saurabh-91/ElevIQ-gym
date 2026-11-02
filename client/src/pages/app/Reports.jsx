import { useEffect, useState } from 'react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { Button, Loading, Tabs, useToast } from '../../components/ui';
import { useLocale } from '../../lib/i18n';
import api from '../../lib/api';

const COLORS = ['#00E5A0', '#7B61FF', '#FF4D6D', '#38BDF8', '#FBBF24', '#64748b'];
const tooltipStyle = {
  contentStyle: { background: 'rgba(10,11,18,0.95)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 14, fontSize: 12, color: '#EDEFF5' },
  labelStyle: { color: '#8A8FA3', fontSize: 11 },
  itemStyle: { color: '#EDEFF5' },
};

function Panel({ title, sub, children, className = '' }) {
  return (
    <section className={`rounded-3xl border border-white/10 bg-surface/60 p-5 ${className}`}>
      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted">{title}</p>
      {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default function Reports() {
  const { money } = useLocale();
  const { push } = useToast();
  const [tab, setTab] = useState('members');
  const [members, setMembers] = useState(null);
  const [classes, setClasses] = useState(null);
  const [equipment, setEquipment] = useState(null);
  const [staff, setStaff] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/dashboard/members-analytics'),
      api.get('/dashboard/classes-analytics'),
      api.get('/dashboard/equipment-analytics'),
      api.get('/dashboard/staff-analytics'),
    ])
      .then(([m, c, e, s]) => {
        setMembers(m.data);
        setClasses(c.data);
        setEquipment(e.data);
        setStaff(s.data);
      })
      .catch((e) => push(e.message, 'error'))
      .finally(() => setLoading(false));
  }, [push]);

  const exportCsv = () => {
    const rows = [
      ['Metric', 'Value'],
      ['Active members', members?.retention ?? ''],
      ['Churned members', members?.churn ?? ''],
      ['Class occupancy', `${classes?.occupancyRate ?? 0}%`],
      ['Equipment safety score', equipment?.safetyScore ?? ''],
    ];
    const csv = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gymflow-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    push('Report exported as CSV.');
  };

  if (loading) return <Loading label="Building analytics…" />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-black tracking-tight">Analytics & reporting</h2>
          <p className="mt-1 text-sm text-muted">Retention, class demand, asset utilisation and staff performance in one place.</p>
        </div>
        <Button variant="ghost" onClick={exportCsv}>Export CSV</Button>
      </div>

      <Tabs
        tabs={[
          { value: 'members', label: 'Members' },
          { value: 'classes', label: 'Classes' },
          { value: 'equipment', label: 'Equipment' },
          { value: 'staff', label: 'Staff' },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'members' && (
        <div className="grid gap-4 xl:grid-cols-3">
          <Panel title="New member cohort" sub="Sign-ups per month, last 12 months" className="xl:col-span-2">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={members?.cohorts || []} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis dataKey="label" stroke="#8A8FA3" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#8A8FA3" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip {...tooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                  <Bar dataKey="count" name="Sign-ups" fill="#00E5A0" radius={[7, 7, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <Panel title="Retention snapshot">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-mint/25 bg-mint/[0.07] p-4 text-center">
                <p className="font-display text-3xl font-black text-mint">{members?.retention ?? 0}</p>
                <p className="mt-1 text-[10px] uppercase tracking-widest text-muted">Active</p>
              </div>
              <div className="rounded-2xl border border-coral/25 bg-coral/[0.07] p-4 text-center">
                <p className="font-display text-3xl font-black text-coral">{members?.churn ?? 0}</p>
                <p className="mt-1 text-[10px] uppercase tracking-widest text-muted">Lapsed</p>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              <div>
                <p className="mb-1.5 text-[11px] uppercase tracking-widest text-muted">Plan mix</p>
                {(members?.byPlan || []).filter((p) => p._id).map((p, i) => {
                  const max = Math.max(...members.byPlan.map((x) => x.count), 1);
                  return (
                    <div key={p._id} className="mb-2">
                      <div className="mb-1 flex justify-between text-xs">
                        <span className="text-bone/85">{p._id}</span>
                        <span className="font-mono text-muted">{p.count}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
                        <div className="h-full rounded-full" style={{ width: `${(p.count / max) * 100}%`, background: COLORS[i % COLORS.length] }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </Panel>

          <Panel title="Age distribution" className="xl:col-span-1">
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={(members?.byAge || []).map((b, i) => ({ name: b._id === 'other' ? 'other' : `${b._id}–${Number(b._id) + 9}`, value: b.count.count ?? b.count, fill: COLORS[i % COLORS.length] }))}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={44}
                    outerRadius={72}
                    paddingAngle={4}
                    stroke="none"
                  />
                  <Tooltip {...tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <Panel title="Goals members set" className="xl:col-span-2">
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={members?.byGoal || []} layout="vertical" margin={{ top: 4, right: 16, left: 44, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" horizontal={false} />
                  <XAxis type="number" stroke="#8A8FA3" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="_id" stroke="#8A8FA3" fontSize={11} tickLine={false} axisLine={false} width={90} />
                  <Tooltip {...tooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                  <Bar dataKey="count" radius={[0, 7, 7, 0]}>
                    {(members?.byGoal || []).map((entry, i) => <Cell key={entry._id} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        </div>
      )}

      {tab === 'classes' && (
        <div className="grid gap-4 xl:grid-cols-3">
          <Panel title="Class popularity" sub="Booked seats by class type" className="xl:col-span-2">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={classes?.popularity || []} margin={{ top: 4, right: 8, left: -18, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis dataKey="_id" stroke="#8A8FA3" fontSize={10} tickLine={false} axisLine={false} interval={0} angle={-20} textAnchor="end" height={60} />
                  <YAxis stroke="#8A8FA3" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip {...tooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="booked" name="Booked" fill="#00E5A0" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="capacity" name="Capacity" fill="#3a3f55" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <div className="space-y-4">
            <div className="rounded-3xl border border-mint/30 bg-mint/[0.07] p-6 text-center">
              <p className="font-display text-5xl font-black text-mint">{classes?.occupancyRate ?? 0}%</p>
              <p className="mt-2 text-[11px] uppercase tracking-[0.2em] text-muted">Overall occupancy</p>
            </div>
            <Panel title="Booking funnel">
              <div className="space-y-2.5">
                {(classes?.attendance || []).map((a, i) => (
                  <div key={a._id} className="flex items-center justify-between rounded-xl border border-white/8 bg-white/[0.03] px-3.5 py-2.5">
                    <span className="flex items-center gap-2 text-xs capitalize text-muted">
                      <span className="h-2 w-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                      {a._id}
                    </span>
                    <span className="font-mono text-sm">{a.count}</span>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        </div>
      )}

      {tab === 'equipment' && (
        <div className="grid gap-4 xl:grid-cols-3">
          <Panel title="Fleet status">
            <div className="space-y-3">
              {(equipment?.byStatus || []).map((s, i) => (
                <div key={s._id}>
                  <div className="mb-1 flex justify-between text-xs capitalize">
                    <span className="text-bone/85">{s._id}</span>
                    <span className="font-mono text-muted">{s.count}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/8">
                    <div className="h-full rounded-full" style={{ width: `${(s.count / Math.max(1, (equipment?.byStatus || []).reduce((a, b) => a + b.count, 0))) * 100}%`, background: COLORS[i % COLORS.length] }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-center">
              <p className="font-display text-3xl font-black text-mint">{equipment?.safetyScore ?? 0}</p>
              <p className="text-[10px] uppercase tracking-widest text-muted">Fleet safety score</p>
            </div>
          </Panel>

          <Panel title="Usage by category" className="xl:col-span-2">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={(equipment?.byCategory || []).map((c) => ({ name: c._id, count: c.count, usage: c.usage }))} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gUsage" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#7B61FF" stopOpacity={0.55} />
                      <stop offset="100%" stopColor="#7B61FF" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="name" stroke="#8A8FA3" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#8A8FA3" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip {...tooltipStyle} />
                  <Area type="monotone" dataKey="usage" stroke="#7B61FF" strokeWidth={2.4} fill="url(#gUsage)" name="Usage count" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        </div>
      )}

      {tab === 'staff' && (
        <div className="grid gap-4 xl:grid-cols-3">
          <Panel title="Headcount by department">
            <div className="space-y-3">
              {(staff?.byDept || []).map((d, i) => (
                <div key={d._id} className="flex items-center justify-between rounded-xl border border-white/8 bg-white/[0.03] px-3.5 py-3">
                  <span className="flex items-center gap-2 text-xs capitalize text-muted">
                    <span className="h-2 w-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                    {d._id}
                  </span>
                  <div className="text-end">
                    <p className="font-mono text-sm">{d.count}</p>
                    <p className="text-[10px] text-muted">{money(d.payroll)}</p>
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Top performers" className="xl:col-span-2">
            <div className="grid gap-3 sm:grid-cols-2">
              {(staff?.top || []).map((s) => (
                <div key={s._id} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">{s.user?.name}</p>
                    <span className="font-mono text-xs text-mint">{s.performanceScore}</span>
                  </div>
                  <p className="text-[11px] uppercase tracking-widest text-violet">{s.jobTitle}</p>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/8">
                    <div className="h-full rounded-full bg-gradient-to-r from-mint to-violet" style={{ width: `${s.performanceScore}%` }} />
                  </div>
                  <p className="mt-2 text-[11px] text-muted">{s.kpis?.sessionsCompleted} sessions · {s.kpis?.attendanceRate}% attendance · NPS {s.kpis?.nps}</p>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}
