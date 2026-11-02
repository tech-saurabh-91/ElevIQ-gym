import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { Badge, CountUp, Loading, Reveal } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { useLocale } from '../../lib/i18n';
import api from '../../lib/api';

const PIE_COLORS = ['#00E5A0', '#7B61FF', '#FF4D6D', '#38BDF8', '#FBBF24', '#64748b'];

const tooltipStyle = {
  contentStyle: {
    background: 'rgba(10,11,18,0.95)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 14,
    fontSize: 12,
    color: '#EDEFF5',
  },
  labelStyle: { color: '#8A8FA3', fontSize: 11 },
  itemStyle: { color: '#EDEFF5' },
};

function Panel({ title, action, children, className = '' }) {
  return (
    <section className={`rounded-3xl border border-white/10 bg-surface/60 p-5 ${className}`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function Stat({ label, value, delta, tone = 'mint', money: fmt, prefix }) {
  const tones = { mint: 'text-mint', violet: 'text-violet', coral: 'text-coral', sky: 'text-sky', amber: 'text-amber' };
  return (
    <div className="group relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-surface to-ink p-5">
      <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-white/5 transition group-hover:bg-white/10" />
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted">{label}</p>
      <p className={`mt-2.5 font-display text-3xl font-black ${tones[tone]}`}>
        {typeof value === 'number' ? (
          <>
            {value < 0 ? '-' : ''}
            {prefix}
            <CountUp to={Math.abs(value)} />
          </>
        ) : (
          <>
            {prefix}
            {value}
          </>
        )}
      </p>
      {delta !== undefined && (
        <p className={`mt-1 text-[11px] ${delta >= 0 ? 'text-mint' : 'text-coral'}`}>
          {delta >= 0 ? '▲' : '▼'} {Math.abs(delta)}% vs last month
        </p>
      )}
    </div>
  );
}

export default function Overview() {
  const { user } = useAuth();
  const { money, t, date } = useLocale();
  const [data, setData] = useState(null);
  const [revenue, setRevenue] = useState(null);
  const [activity, setActivity] = useState([]);
  const [classes, setClasses] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [o, r, a, c] = await Promise.all([
          api.get('/dashboard/overview'),
          api.get('/dashboard/revenue?months=12'),
          api.get('/dashboard/activity'),
          api.get('/dashboard/classes-analytics'),
        ]);
        setData(o.data);
        setRevenue(r.data);
        setActivity(a.data);
        setClasses(c.data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading || !data) return <Loading label="Crunching the numbers…" />;

  const statusData = (data.byStatus || []).map((s) => ({ name: s._id, value: s.count }));
  const revenueSeries = revenue?.series || [];
  const monthDelta = revenueSeries.length > 1
    ? Math.round(((revenueSeries[revenueSeries.length - 1].income - revenueSeries[revenueSeries.length - 2].income) / (revenueSeries[revenueSeries.length - 2].income || 1)) * 100)
    : 0;

  return (
    <div className="space-y-5">
      {/* Greeting */}
      <Reveal>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.24em] text-mint">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
            <h2 className="mt-1.5 font-display text-3xl font-black tracking-tight">
              Welcome back, {user.name.split(' ')[0]}.
            </h2>
            <p className="mt-1.5 text-sm text-muted">
              {data.insideNow} members on the floor · {data.upcomingClasses} classes scheduled today · {data.openTickets} open equipment tickets
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/app/checkins" className="btn-ghost !py-2.5 !text-xs">Open check-in</Link>
            <Link to="/app/reports" className="btn-primary !py-2.5 !text-xs">Full reports</Link>
          </div>
        </div>
      </Reveal>

      {/* KPI grid */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Revenue (MTD)" value={data.revenue} delta={monthDelta} tone="mint" prefix="$" />
        <Stat label="Active members" value={data.activeMembers} delta={8} tone="violet" />
        <Stat label="Today's visits" value={data.todayVisits} delta={12} tone="sky" />
        <Stat label="Net (MTD)" value={data.net} delta={monthDelta - 3} tone="coral" prefix="$" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="New this month" value={data.newMembers} tone="mint" />
        <Stat label="Expiring in 30 days" value={data.expiringSoon} tone="amber" />
        <Stat label="Outstanding invoices" value={data.outstanding} tone="coral" prefix="$" />
        <Stat label="Floor occupancy" value={`${data.occupancy}%`} tone="sky" />
      </div>

      {/* Charts */}
      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title="Revenue vs cost — last 12 months" className="xl:col-span-2">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueSeries} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="gIncome" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00E5A0" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#00E5A0" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gCost" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#FF4D6D" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#FF4D6D" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="label" stroke="#8A8FA3" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#8A8FA3" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `$${Math.round(v / 1000)}k`} />
                <Tooltip {...tooltipStyle} formatter={(v) => money(v)} />
                <Area type="monotone" dataKey="income" stroke="#00E5A0" strokeWidth={2.4} fill="url(#gIncome)" name="Income" />
                <Area type="monotone" dataKey="cost" stroke="#FF4D6D" strokeWidth={2} fill="url(#gCost)" name="Cost" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Member status mix">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={54} outerRadius={82} paddingAngle={4} stroke="none">
                  {statusData.map((entry, i) => (
                    <Cell key={entry.name} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip {...tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
            <div className="-mt-2 flex flex-wrap justify-center gap-2">
              {statusData.map((s, i) => (
                <span key={s.name} className="chip">
                  <span className="h-2 w-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                  {s.name} · {s.value}
                </span>
              ))}
            </div>
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title="Top classes by bookings" className="xl:col-span-2">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={classes?.popularity || []} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="_id" stroke="#8A8FA3" fontSize={10} tickLine={false} axisLine={false} interval={0} angle={-16} textAnchor="end" height={54} />
                <YAxis stroke="#8A8FA3" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip {...tooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                <Bar dataKey="booked" radius={[7, 7, 0, 0]} name="Booked">
                  {(classes?.popularity || []).map((entry, i) => (
                    <Cell key={entry._id} fill={entry.color || PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Live activity">
          <div className="max-h-64 space-y-3 overflow-y-auto scrollbar-thin pe-1">
            {activity.map((a, i) => (
              <motion.div
                key={`${a.type}-${i}`}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                className="flex items-start gap-3"
              >
                <span
                  className="mt-1 h-2 w-2 shrink-0 rounded-full"
                  style={{
                    background:
                      a.type === 'payment' ? '#00E5A0' : a.type === 'checkin' ? '#38BDF8' : a.type === 'booking' ? '#7B61FF' : a.type === 'maintenance' ? '#FF4D6D' : '#FBBF24',
                  }}
                />
                <div className="min-w-0">
                  <p className="truncate text-xs text-bone/85">{a.text}</p>
                  <p className="text-[10px] text-muted">
                    {new Date(a.at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </Panel>
      </div>

      {/* Quick tickets */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { k: 'Pending contact enquiries', v: data.pendingMessages, to: '/app/inbox', tone: 'sky' },
          { k: 'Low stock SKUs', v: data.lowStock, to: '/app/finance', tone: 'amber' },
          { k: 'Open maintenance tickets', v: data.openTickets, to: '/app/equipment', tone: 'coral' },
          { k: 'Memberships expiring', v: data.expiringSoon, to: '/app/members', tone: 'violet' },
        ].map((q, i) => (
          <Reveal key={q.k} delay={i * 0.05}>
            <Link
              to={q.to}
              className="flex h-full items-center justify-between rounded-3xl border border-white/10 bg-surface/60 p-5 transition hover:border-white/25"
            >
              <div>
                <p className="font-display text-2xl font-black">{q.v}</p>
                <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-muted">{q.k}</p>
              </div>
              <Badge tone={q.tone}>Review</Badge>
            </Link>
          </Reveal>
        ))}
      </div>
    </div>
  );
}
