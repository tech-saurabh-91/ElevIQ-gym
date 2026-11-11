import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle, ArrowDownRight, ArrowRight, ArrowUpRight, CalendarClock, CreditCard, Minus, ScanLine, UserPlus, Users, Wallet } from 'lucide-react';
import { api, qs } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cap, date, money, num } from '@/lib/format';
import { Card, ErrorNote, PageHeader, Spinner, cx, useLoad } from '@/components/ui';
import { axis, css, monthLabel, SERIES, tooltip } from './Reports';

type Trend = { value: number; prev: number; change: number | null; period: string };

/** KPI card with a period-over-period trend arrow. Clicking opens the related page. */
function Kpi({ label, value, hint, icon, trend, to, tone }: { label: string; value: ReactNode; hint?: ReactNode; icon: ReactNode; trend?: Trend; to?: string; tone?: 'warn' | 'bad' }) {
  const up = trend?.change != null && trend.change > 0.005;
  const down = trend?.change != null && trend.change < -0.005;
  const body = (
    <div className="h-full rounded-brand border border-line bg-surface p-4 shadow-soft transition hover:border-primary/50 hover:shadow-md">
      <div className="flex items-center justify-between text-xs font-semibold text-muted">
        {label}
        <span className={cx('grid h-8 w-8 place-items-center rounded-full', tone === 'bad' ? 'bg-red-500/10 text-red-600' : tone === 'warn' ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300' : 'bg-primary/10 text-link')}>{icon}</span>
      </div>
      <div className="mt-2 font-display text-2xl font-bold text-ink">{value}</div>
      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
        {trend && (
          <span
            className={cx('inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-semibold', up ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : down ? 'bg-red-500/15 text-red-700 dark:text-red-300' : 'bg-surface2 text-muted')}
            title={`${trend.period}: ${num(trend.prev)} before`}
          >
            {up ? <ArrowUpRight className="h-3 w-3" /> : down ? <ArrowDownRight className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
            {trend.change == null ? 'new' : `${Math.abs(Math.round(trend.change * 100))}%`}
          </span>
        )}
        <span>{trend ? trend.period : hint}</span>
      </div>
    </div>
  );
  return to ? <Link to={to} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-brand">{body}</Link> : body;
}

/** Chart card: the whole card is a link to the matching report with the same filters. */
function ChartCard({ title, to, children, className, note }: { title: string; to: string; children: ReactNode; className?: string; note?: ReactNode }) {
  return (
    <Card title={title} className={className} actions={<Link to={to} className="inline-flex items-center gap-1 text-xs font-semibold text-link hover:underline">Open report <ArrowRight className="h-3 w-3" /></Link>}>
      {children}
      {note && <p className="mt-2 text-xs text-muted">{note}</p>}
    </Card>
  );
}

const addMonths = (ym: string, n: number) => {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
};
const report = (tab: string, p: Record<string, unknown>) => `/admin/reports${qs({ tab, ...p })}`;
const EXPIRY_BUCKETS = [[0, 7, 'Next 7 days'], [7, 14, '8-14 days'], [14, 30, '15-30 days'], [30, 60, '31-60 days'], [60, 90, '61-90 days']] as const;

export default function Dashboard() {
  const nav = useNavigate();
  const { session, can } = useAuth();
  const k = useLoad((s) => api.get('/admin/reports/dashboard', s).then((r) => r.data), []);
  const canMoney = can('billing.read');
  const canReports = can('reports.read');
  const canExpiry = can('reports.read', 'members.read');

  // Filters are computed from the gym's own "today" (server returns it in the gym's time zone).
  const today: string | undefined = k.data?.today;
  const monthStart: string | undefined = k.data?.monthStart;
  const revenueParams = today && monthStart ? { from: `${addMonths(monthStart.slice(0, 7), -11)}-01`, to: today, groupBy: 'month' } : null;
  const modeParams = today && monthStart ? { from: monthStart, to: today, groupBy: 'day' } : null;

  const revenue = useLoad((s) => (canMoney && revenueParams ? api.get(`/admin/reports/collections${qs(revenueParams)}`, s).then((r) => r.data) : Promise.resolve(null)), [canMoney, revenueParams?.from, revenueParams?.to]);
  const modes = useLoad((s) => (canMoney && modeParams ? api.get(`/admin/reports/collections${qs(modeParams)}`, s).then((r) => r.data) : Promise.resolve(null)), [canMoney, modeParams?.from, modeParams?.to]);
  const movement = useLoad((s) => (canReports ? api.get('/admin/reports/movement?months=6', s).then((r) => r.data as any[]) : Promise.resolve(null)), [canReports]);
  const demo = useLoad((s) => (canReports ? api.get('/admin/reports/demographics?status=active', s).then((r) => r.data) : Promise.resolve(null)), [canReports]);
  const expiry = useLoad((s) => (canExpiry ? api.get('/admin/reports/expiring?days=90', s).then((r) => r.data as any[]) : Promise.resolve(null)), [canExpiry]);

  if (k.loading) return <Spinner />;
  const d = k.data;
  const t = d?.trends ?? {};

  // Same windows as the expiring report's fromDays/days filter, so clicking a bar shows the same members.
  const now = Date.now();
  const expiryBars = EXPIRY_BUCKETS.map(([a, b, label]) => ({
    label, from: a, to: b,
    count: (expiry.data ?? []).filter((m) => { const t2 = new Date(m.expiresAt).getTime(); return t2 >= now + a * 864e5 && t2 <= now + b * 864e5 && (a === 0 || t2 > now + a * 864e5); }).length,
  }));
  const gender = (demo.data?.gender ?? []).map((x: any) => ({ name: cap(x._id ?? 'unspecified'), value: x.count }));

  return (
    <>
      <PageHeader title={`Hello, ${session!.user.name.split(' ')[0]}`} subtitle={date(new Date(), { weekday: 'long', day: 'numeric', month: 'long' })} />
      <ErrorNote error={k.error} />
      {d && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Kpi label="Active members" value={num(d.active)} icon={<Users className="h-4 w-4" />} to="/admin/members?status=active" hint={`${num(d.newMembers)} joined this month`} />
          <Kpi label="New joiners this month" value={num(d.newMembers)} icon={<UserPlus className="h-4 w-4" />} trend={t.newMembers} to={canReports ? report('movement', { months: 6 }) : undefined} />
          <Kpi label="Expiring in 7 days" value={num(d.expiring7)} icon={<CalendarClock className="h-4 w-4" />} tone="warn" hint={`${num(d.expiredRecent)} lapsed in last 30 days`} to={canExpiry ? report('expiring', { fromDays: 0, days: 7 }) : undefined} />
          <Kpi label="Visits (7 days)" value={num(t.visits?.value ?? 0)} icon={<ScanLine className="h-4 w-4" />} trend={t.visits} to={can('checkins.manage') ? '/admin/checkins' : undefined} />
          {canMoney && 'collectedMonth' in d && (
            <>
              <Kpi label="Collected this month" value={money(d.collectedMonth)} icon={<CreditCard className="h-4 w-4" />} trend={t.collected} to={modeParams ? report('collections', modeParams) : undefined} />
              <Kpi label="Collected today" value={money(d.collectedToday)} icon={<Wallet className="h-4 w-4" />} hint={`Expenses this month ${money(d.expensesMonth)}`} to={today ? report('collections', { from: today, to: today }) : undefined} />
              <Kpi label="Outstanding" value={money(d.outstanding)} icon={<AlertTriangle className="h-4 w-4" />} tone="bad" hint={`${num(d.outstandingCount)} unpaid invoices`} to="/admin/billing" />
            </>
          )}
          <Kpi label="New leads" value={num(d.newLeads)} icon={<UserPlus className="h-4 w-4" />} trend={t.leads} to={can('leads.read', 'leads.manage') ? '/admin/leads' : undefined} />
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {canMoney && revenueParams && (
          <ChartCard title="Revenue - last 12 months" to={report('collections', revenueParams)} className="lg:col-span-2" note="Net collections (payments minus refunds) per month.">
            {revenue.loading ? <Spinner /> : (
              <div className="h-72">
                <ResponsiveContainer>
                  <AreaChart data={revenue.data?.series ?? []} onClick={() => nav(report('collections', revenueParams))} style={{ cursor: 'pointer' }}>
                    <defs><linearGradient id="rev" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={SERIES[0]} stopOpacity={0.35} /><stop offset="100%" stopColor={SERIES[0]} stopOpacity={0} /></linearGradient></defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={css('border')} vertical={false} />
                    <XAxis dataKey="_id" tickFormatter={monthLabel} {...axis} />
                    <YAxis tickFormatter={(v) => money(v)} width={90} {...axis} />
                    <Tooltip {...tooltip} labelFormatter={monthLabel} formatter={(v: number) => money(v)} />
                    <Area type="monotone" dataKey="total" name="Collected" stroke={SERIES[0]} strokeWidth={2.5} fill="url(#rev)" dot={{ r: 3 }} activeDot={{ r: 5 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </ChartCard>
        )}

        {canMoney && modeParams && (
          <ChartCard title="Collections by payment mode - this month" to={report('collections', modeParams)}>
            {modes.loading ? <Spinner /> : (
              <div className="h-72">
                <ResponsiveContainer>
                  <BarChart data={(modes.data?.byMethod ?? []).map((x: any) => ({ ...x, name: cap(x._id) }))} layout="vertical" onClick={() => nav(report('collections', modeParams))} style={{ cursor: 'pointer' }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={css('border')} horizontal={false} />
                    <XAxis type="number" tickFormatter={(v) => money(v)} {...axis} />
                    <YAxis type="category" dataKey="name" width={90} {...axis} />
                    <Tooltip {...tooltip} formatter={(v: number) => money(v)} cursor={{ fill: css('surface2') }} />
                    <Bar dataKey="total" name="Net" radius={[0, 4, 4, 0]}>{(modes.data?.byMethod ?? []).map((_: any, i: number) => <Cell key={i} fill={SERIES[i % SERIES.length]} />)}</Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </ChartCard>
        )}

        {canReports && (
          <ChartCard title="New joiners vs expired - 6 months" to={report('movement', { months: 6 })} className="lg:col-span-2">
            {movement.loading ? <Spinner /> : (
              <div className="h-72">
                <ResponsiveContainer>
                  <BarChart data={movement.data ?? []} onClick={() => nav(report('movement', { months: 6 }))} style={{ cursor: 'pointer' }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={css('border')} vertical={false} />
                    <XAxis dataKey="month" tickFormatter={monthLabel} {...axis} /><YAxis allowDecimals={false} {...axis} />
                    <Tooltip {...tooltip} labelFormatter={monthLabel} cursor={{ fill: css('surface2') }} /><Legend />
                    <Bar dataKey="joined" name="New joiners" fill={SERIES[0]} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="expired" name="Expired" fill={SERIES[2]} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </ChartCard>
        )}

        {canReports && (
          <ChartCard title="Members by gender" to={report('demographics', { status: 'active' })} note="Active members">
            {demo.loading ? <Spinner /> : (
              <div className="h-72">
                <ResponsiveContainer>
                  <PieChart onClick={() => nav(report('demographics', { status: 'active' }))} style={{ cursor: 'pointer' }}>
                    <Pie data={gender} dataKey="value" nameKey="name" innerRadius={60} outerRadius={95} paddingAngle={2}>{gender.map((_: any, i: number) => <Cell key={i} fill={SERIES[i % SERIES.length]} />)}</Pie>
                    <Tooltip {...tooltip} /><Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </ChartCard>
        )}

        {canReports && (
          <ChartCard title="Members by age group" to={report('demographics', { status: 'active' })} className="lg:col-span-2" note={demo.data?.unknownAge ? `${demo.data.unknownAge} active members have no date of birth` : 'Active members'}>
            {demo.loading ? <Spinner /> : (
              <div className="h-64">
                <ResponsiveContainer>
                  <BarChart data={demo.data?.ageGroups ?? []} onClick={() => nav(report('demographics', { status: 'active' }))} style={{ cursor: 'pointer' }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={css('border')} vertical={false} />
                    <XAxis dataKey="label" {...axis} /><YAxis allowDecimals={false} {...axis} />
                    <Tooltip {...tooltip} cursor={{ fill: css('surface2') }} />
                    <Bar dataKey="count" name="Members" fill={SERIES[1]} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </ChartCard>
        )}

        {canExpiry && (
          <ChartCard title="Expiry outlook - next 90 days" to={report('expiring', { fromDays: 0, days: 90 })} note="Click a bar to see exactly those members.">
            {expiry.loading ? <Spinner /> : (
              <div className="h-64">
                <ResponsiveContainer>
                  <BarChart data={expiryBars}>
                    <CartesianGrid strokeDasharray="3 3" stroke={css('border')} vertical={false} />
                    <XAxis dataKey="label" {...axis} tick={{ ...axis.tick, fontSize: 11 }} interval={0} /><YAxis allowDecimals={false} {...axis} />
                    <Tooltip {...tooltip} cursor={{ fill: css('surface2') }} />
                    <Bar dataKey="count" name="Members" radius={[4, 4, 0, 0]} style={{ cursor: 'pointer' }} onClick={(b: any) => nav(report('expiring', { fromDays: b.from, days: b.to }))}>
                      {expiryBars.map((b, i) => <Cell key={b.label} fill={i === 0 ? css('accent') : SERIES[0]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </ChartCard>
        )}
      </div>
    </>
  );
}
