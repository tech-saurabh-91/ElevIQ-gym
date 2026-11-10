import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Download } from 'lucide-react';
import { api, qs } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cap, date, daysUntil, download, money, num, toCSV } from '@/lib/format';
import { Badge, Button, Card, ErrorNote, Field, Input, PageHeader, Select, Spinner, Stat, Table, Tabs, useLoad } from '@/components/ui';

const css = (v: string) => `rgb(var(--c-${v}))`;
const SERIES = ['primary', 'secondary', 'accent', 'link', 'muted'].map(css);
const tooltip = { contentStyle: { background: css('surface'), border: `1px solid ${css('border')}`, borderRadius: 8, color: css('text') } };
const iso = (d: Date) => d.toISOString().slice(0, 10);

function Expiring() {
  const [days, setDays] = useState(30);
  const [lapsed, setLapsed] = useState(0);
  const d = useLoad((s) => api.get(`/admin/reports/expiring${qs({ days, lapsedDays: lapsed })}`, s).then((r) => r.data as any[]), [days, lapsed]);
  const exportCsv = () => download(`expiring-${iso(new Date())}.csv`, toCSV((d.data ?? []).map((m) => ({ member: m.memberNo, name: `${m.firstName} ${m.lastName}`, phone: m.phone, email: m.email, plan: m.currentPlanName, category: m.category, expires: iso(new Date(m.expiresAt)), status: m.status }))));
  return (
    <Card padded={false}>
      <div className="flex flex-wrap items-end gap-3 border-b border-line p-4">
        <Field label="Expiring within"><Select value={days} onChange={(e) => setDays(Number(e.target.value))}>{[7, 14, 30, 60, 90].map((n) => <option key={n} value={n}>{n} days</option>)}</Select></Field>
        <Field label="Also include lapsed in last"><Select value={lapsed} onChange={(e) => setLapsed(Number(e.target.value))}>{[0, 7, 30, 90].map((n) => <option key={n} value={n}>{n ? `${n} days` : 'None'}</option>)}</Select></Field>
        <Button variant="outline" className="ml-auto" icon={<Download className="h-4 w-4" />} disabled={!d.data?.length} onClick={exportCsv}>Export CSV</Button>
      </div>
      <ErrorNote error={d.error} />
      <Table
        loading={d.loading}
        rows={d.data ?? []}
        empty="Nobody in this window."
        columns={[
          { key: 'n', header: 'Member', render: (m: any) => <Link to={`/admin/members/${m._id}`} className="font-semibold hover:text-link">{m.firstName} {m.lastName}</Link> },
          { key: 'p', header: 'Phone', render: (m: any) => m.phone || '—' },
          { key: 'pl', header: 'Plan', render: (m: any) => m.currentPlanName },
          { key: 'e', header: 'Expires', render: (m: any) => { const n = daysUntil(m.expiresAt); return <span>{date(m.expiresAt)} <Badge tone={n < 0 ? 'red' : n <= 7 ? 'amber' : 'gray'}>{n < 0 ? `${-n}d ago` : `${n}d`}</Badge></span>; } },
        ]}
      />
    </Card>
  );
}

function Demographics() {
  const [status, setStatus] = useState('active');
  const d = useLoad((s) => api.get(`/admin/reports/demographics?status=${status}`, s).then((r) => r.data), [status]);
  if (d.loading) return <Spinner />;
  if (d.error) return <ErrorNote error={d.error} />;
  const g = d.data.gender.map((x: any) => ({ name: cap(x._id ?? 'unspecified'), value: x.count }));
  const exportCsv = () => download('demographics.csv', toCSV([
    ...d.data.gender.map((x: any) => ({ group: 'gender', label: x._id, count: x.count })),
    ...d.data.ageGroups.map((x: any) => ({ group: 'age', label: x.label, count: x.count })),
    ...d.data.category.map((x: any) => ({ group: 'category', label: x._id, count: x.count })),
  ]));
  return (
    <>
      <div className="mb-4 flex items-end gap-3">
        <Field label="Members"><Select value={status} onChange={(e) => setStatus(e.target.value)}><option value="active">Active only</option><option value="all">Everyone</option></Select></Field>
        <Button variant="outline" icon={<Download className="h-4 w-4" />} onClick={exportCsv}>Export CSV</Button>
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Gender">
          <div className="h-64">
            <ResponsiveContainer><PieChart><Pie data={g} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>{g.map((_: any, i: number) => <Cell key={i} fill={SERIES[i % SERIES.length]} />)}</Pie><Tooltip {...tooltip} /><Legend /></PieChart></ResponsiveContainer>
          </div>
        </Card>
        <Card title="Age groups" className="lg:col-span-2" actions={d.data.unknownAge > 0 && <span className="text-xs text-muted">{d.data.unknownAge} without date of birth</span>}>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={d.data.ageGroups}>
                <CartesianGrid strokeDasharray="3 3" stroke={css('border')} vertical={false} />
                <XAxis dataKey="label" tick={{ fill: css('muted'), fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: css('muted'), fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip {...tooltip} cursor={{ fill: css('surface2') }} />
                <Legend />
                <Bar dataKey="female" stackId="a" name="Female" fill={SERIES[0]} radius={[0, 0, 0, 0]} />
                <Bar dataKey="male" stackId="a" name="Male" fill={SERIES[1]} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="By pricing category" className="lg:col-span-3" padded={false}>
          <Table rows={d.data.category.map((x: any) => ({ ...x, _id: x._id ?? 'none' }))} columns={[
            { key: 'c', header: 'Category', render: (x: any) => cap(x._id) },
            { key: 'n', header: 'Members', render: (x: any) => num(x.count) },
          ]} />
        </Card>
      </div>
    </>
  );
}

function Collections() {
  const [from, setFrom] = useState(iso(new Date(Date.now() - 29 * 864e5)));
  const [to, setTo] = useState(iso(new Date()));
  const d = useLoad((s) => api.get(`/admin/reports/collections${qs({ from, to })}`, s).then((r) => r.data), [from, to]);
  const exportCsv = () => download(`collections-${from}-to-${to}.csv`, toCSV(d.data.byDay.map((x: any) => ({ date: x._id, payments: x.count, net: x.total }))));
  return (
    <>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Field label="From"><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label="To"><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
        <Button variant="outline" icon={<Download className="h-4 w-4" />} disabled={!d.data} onClick={exportCsv}>Export CSV</Button>
      </div>
      {d.loading ? <Spinner /> : d.error ? <ErrorNote error={d.error} /> : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat label="Net collected" value={money(d.data.net)} />
            <Stat label="Gross" value={money(d.data.gross)} />
            <Stat label="Refunds" value={money(d.data.refunds)} />
            <Stat label="Payments" value={num(d.data.count)} />
          </div>
          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            <Card title="Daily collections" className="lg:col-span-2">
              <div className="h-72">
                <ResponsiveContainer>
                  <BarChart data={d.data.byDay}>
                    <CartesianGrid strokeDasharray="3 3" stroke={css('border')} vertical={false} />
                    <XAxis dataKey="_id" tickFormatter={(v) => date(v, { day: 'numeric', month: 'short' })} tick={{ fill: css('muted'), fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={(v) => money(v)} width={90} tick={{ fill: css('muted'), fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip {...tooltip} formatter={(v: number) => money(v)} labelFormatter={(v) => date(v)} cursor={{ fill: css('surface2') }} />
                    <Bar dataKey="total" name="Collected" fill={SERIES[0]} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card title="By method" padded={false}>
              <Table rows={d.data.byMethod.map((x: any) => ({ ...x, _id: x._id }))} empty="No payments" columns={[
                { key: 'm', header: 'Method', render: (x: any) => cap(x._id) },
                { key: 'c', header: 'Count', render: (x: any) => x.count },
                { key: 't', header: 'Net', render: (x: any) => money(x.total) },
              ]} />
              <div className="border-t border-line">
                <Table rows={d.data.byKind.map((x: any) => ({ ...x, _id: x._id }))} empty="" columns={[
                  { key: 'k', header: 'Revenue type', render: (x: any) => cap(x._id) },
                  { key: 't', header: 'Net', render: (x: any) => money(x.total) },
                ]} />
              </div>
            </Card>
          </div>
        </>
      )}
    </>
  );
}

export default function Reports() {
  const { can } = useAuth();
  const tabs = [
    can('reports.read', 'members.read') && { value: 'expiring', label: 'Expiring memberships' },
    can('reports.read') && { value: 'demographics', label: 'Gender & age' },
    can('billing.read') && { value: 'collections', label: 'Collections' },
  ].filter(Boolean) as { value: string; label: string }[];
  const [tab, setTab] = useState(tabs[0]?.value ?? 'expiring');
  return (
    <>
      <PageHeader title="Reports" subtitle="Export any report to CSV for Excel or Google Sheets." />
      <div className="mb-5"><Tabs value={tab} onChange={setTab} items={tabs} /></div>
      {tab === 'expiring' && <Expiring />}
      {tab === 'demographics' && <Demographics />}
      {tab === 'collections' && <Collections />}
    </>
  );
}
