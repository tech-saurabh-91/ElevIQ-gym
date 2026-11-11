import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { FileSpreadsheet } from 'lucide-react';
import { api, download, qs } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cap, date, daysUntil, money, num } from '@/lib/format';
import { Badge, Button, Card, ErrorNote, Field, Input, PageHeader, Select, Spinner, Stat, Table, Tabs, useLoad, useToast } from '@/components/ui';

export const css = (v: string) => `rgb(var(--c-${v}))`;
export const SERIES = ['primary', 'secondary', 'accent', 'link', 'muted'].map(css);
export const tooltip = { contentStyle: { background: css('surface'), border: `1px solid ${css('border')}`, borderRadius: 8, color: css('text') } };
export const axis = { tick: { fill: css('muted'), fontSize: 12 }, axisLine: false, tickLine: false } as const;
export const monthLabel = (k: string) => date(`${k}-01T12:00:00Z`, { month: 'short', year: '2-digit', timeZone: 'UTC' });

type Params = Record<string, string | number | undefined>;

/** "Export to Excel": downloads a .xlsx built by the server with exactly the filters on screen. */
function ExportButton({ report, params }: { report: string; params: Params }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="outline"
      loading={busy}
      icon={<FileSpreadsheet className="h-4 w-4" />}
      onClick={async () => {
        setBusy(true);
        try { toast(`Downloaded ${await download(`/admin/reports/${report}/export${qs(params)}`)}`); } catch (e) { toast((e as Error).message, 'err'); } finally { setBusy(false); }
      }}
    >
      Export to Excel
    </Button>
  );
}

/** Filters live in the URL, so dashboard charts can deep-link to the matching report view. */
function useParam(name: string, fallback: string): [string, (v: string) => void] {
  const [sp, setSp] = useSearchParams();
  return [sp.get(name) ?? fallback, (v) => setSp((p) => { const n = new URLSearchParams(p); n.set(name, v); return n; }, { replace: true })];
}

function Expiring() {
  const [days, setDays] = useParam('days', '30');
  const [fromDays, setFromDays] = useParam('fromDays', '0');
  const [lapsed, setLapsed] = useParam('lapsedDays', '0');
  const params = { days, fromDays: Number(lapsed) ? undefined : fromDays, lapsedDays: lapsed };
  const d = useLoad((s) => api.get(`/admin/reports/expiring${qs(params)}`, s).then((r) => r.data as any[]), [days, fromDays, lapsed], `rep:exp:${days}:${fromDays}:${lapsed}`);
  return (
    <Card padded={false}>
      <div className="flex flex-wrap items-end gap-3 border-b border-line p-4">
        <Field label="From (days ahead)"><Select value={fromDays} onChange={(e) => setFromDays(e.target.value)} disabled={Number(lapsed) > 0}>{['0', '7', '14', '30', '60'].map((n) => <option key={n} value={n}>{n === '0' ? 'Today' : `${n} days`}</option>)}</Select></Field>
        <Field label="Up to"><Select value={days} onChange={(e) => setDays(e.target.value)}>{['7', '14', '30', '60', '90', '180'].map((n) => <option key={n} value={n}>{n} days</option>)}</Select></Field>
        <Field label="Also include lapsed in last"><Select value={lapsed} onChange={(e) => setLapsed(e.target.value)}>{['0', '7', '30', '90'].map((n) => <option key={n} value={n}>{n === '0' ? 'None' : `${n} days`}</option>)}</Select></Field>
        <div className="ml-auto flex items-center gap-3"><span className="text-sm text-muted">{d.data?.length ?? 0} members</span><ExportButton report="expiring" params={params} /></div>
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
  const [status, setStatus] = useParam('status', 'active');
  const d = useLoad((s) => api.get(`/admin/reports/demographics?status=${status}`, s).then((r) => r.data), [status], `rep:demo:${status}`);
  const g = (d.data?.gender ?? []).map((x: any) => ({ name: cap(x._id ?? 'unspecified'), value: x.count }));
  return (
    <>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Field label="Members"><Select value={status} onChange={(e) => setStatus(e.target.value)}><option value="active">Active only</option><option value="all">Everyone</option></Select></Field>
        <div className="ml-auto"><ExportButton report="demographics" params={{ status }} /></div>
      </div>
      {d.loading ? <Spinner /> : d.error ? <ErrorNote error={d.error} /> : (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card title="Gender">
            <div className="h-64"><ResponsiveContainer><PieChart><Pie data={g} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>{g.map((_: any, i: number) => <Cell key={i} fill={SERIES[i % SERIES.length]} />)}</Pie><Tooltip {...tooltip} /><Legend /></PieChart></ResponsiveContainer></div>
          </Card>
          <Card title="Age groups" className="lg:col-span-2" actions={d.data.unknownAge > 0 && <span className="text-xs text-muted">{d.data.unknownAge} without date of birth</span>}>
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart data={d.data.ageGroups}>
                  <CartesianGrid strokeDasharray="3 3" stroke={css('border')} vertical={false} />
                  <XAxis dataKey="label" {...axis} /><YAxis allowDecimals={false} {...axis} />
                  <Tooltip {...tooltip} cursor={{ fill: css('surface2') }} /><Legend />
                  <Bar dataKey="female" stackId="a" name="Female" fill={SERIES[0]} />
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
      )}
    </>
  );
}

function Collections() {
  const [from, setFrom] = useParam('from', '');
  const [to, setTo] = useParam('to', '');
  const [groupBy, setGroupBy] = useParam('groupBy', 'day');
  const params = { from: from || undefined, to: to || undefined, groupBy };
  const d = useLoad((s) => api.get(`/admin/reports/collections${qs(params)}`, s).then((r) => r.data), [from, to, groupBy], `rep:coll:${from}:${to}:${groupBy}`);
  return (
    <>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Field label="From"><Input type="date" value={from || d.data?.from || ''} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label="To"><Input type="date" value={to || d.data?.to || ''} onChange={(e) => setTo(e.target.value)} /></Field>
        <Field label="Group by"><Select value={groupBy} onChange={(e) => setGroupBy(e.target.value)}><option value="day">Day</option><option value="month">Month</option></Select></Field>
        <div className="ml-auto"><ExportButton report="collections" params={params} /></div>
      </div>
      {d.loading ? <Spinner /> : d.error ? <ErrorNote error={d.error} /> : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat label="Net collected" value={money(d.data.net)} /><Stat label="Gross" value={money(d.data.gross)} />
            <Stat label="Refunds" value={money(d.data.refunds)} /><Stat label="Payments" value={num(d.data.count)} />
          </div>
          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            <Card title={groupBy === 'month' ? 'Monthly collections' : 'Daily collections'} className="lg:col-span-2">
              <div className="h-72">
                <ResponsiveContainer>
                  <BarChart data={d.data.series}>
                    <CartesianGrid strokeDasharray="3 3" stroke={css('border')} vertical={false} />
                    <XAxis dataKey="_id" tickFormatter={(v) => (groupBy === 'month' ? monthLabel(v) : date(`${v}T12:00:00Z`, { day: 'numeric', month: 'short', timeZone: 'UTC' }))} {...axis} />
                    <YAxis tickFormatter={(v) => money(v)} width={90} {...axis} />
                    <Tooltip {...tooltip} formatter={(v: number) => money(v)} cursor={{ fill: css('surface2') }} />
                    <Bar dataKey="total" name="Collected" fill={SERIES[0]} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card title="By payment mode" padded={false}>
              <Table rows={d.data.byMethod.map((x: any) => ({ ...x }))} empty="No payments" columns={[
                { key: 'm', header: 'Mode', render: (x: any) => cap(x._id) }, { key: 'c', header: 'Count', render: (x: any) => x.count }, { key: 't', header: 'Net', render: (x: any) => money(x.total) },
              ]} />
              <div className="border-t border-line">
                <Table rows={d.data.byKind.map((x: any) => ({ ...x }))} empty="" columns={[
                  { key: 'k', header: 'Revenue type', render: (x: any) => cap(x._id) }, { key: 't', header: 'Net', render: (x: any) => money(x.total) },
                ]} />
              </div>
            </Card>
          </div>
        </>
      )}
    </>
  );
}

function Movement() {
  const [months, setMonths] = useParam('months', '6');
  const d = useLoad((s) => api.get(`/admin/reports/movement?months=${months}`, s).then((r) => r.data as any[]), [months], `rep:move:${months}`);
  return (
    <>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Field label="Period"><Select value={months} onChange={(e) => setMonths(e.target.value)}>{['3', '6', '12', '24'].map((n) => <option key={n} value={n}>Last {n} months</option>)}</Select></Field>
        <p className="pb-2 text-xs text-muted">Expired = membership ended that month and was not renewed since.</p>
        <div className="ml-auto"><ExportButton report="movement" params={{ months }} /></div>
      </div>
      {d.loading ? <Spinner /> : d.error ? <ErrorNote error={d.error} /> : (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card title="New joiners vs expired" className="lg:col-span-2">
            <div className="h-72">
              <ResponsiveContainer>
                <BarChart data={d.data ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke={css('border')} vertical={false} />
                  <XAxis dataKey="month" tickFormatter={monthLabel} {...axis} /><YAxis allowDecimals={false} {...axis} />
                  <Tooltip {...tooltip} labelFormatter={monthLabel} cursor={{ fill: css('surface2') }} /><Legend />
                  <Bar dataKey="joined" name="New joiners" fill={SERIES[0]} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expired" name="Expired" fill={SERIES[2]} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card title="By month" padded={false}>
            <Table rows={(d.data ?? []).map((x) => ({ ...x, _id: x.month }))} columns={[
              { key: 'm', header: 'Month', render: (x: any) => monthLabel(x.month) }, { key: 'j', header: 'Joined', render: (x: any) => x.joined },
              { key: 'e', header: 'Expired', render: (x: any) => x.expired }, { key: 'n', header: 'Net', render: (x: any) => <span className={x.net < 0 ? 'text-red-600' : 'text-emerald-600'}>{x.net > 0 ? '+' : ''}{x.net}</span> },
            ]} />
          </Card>
        </div>
      )}
    </>
  );
}

export default function Reports() {
  const { can } = useAuth();
  const [sp, setSp] = useSearchParams();
  const tabs = [
    can('reports.read', 'members.read') && { value: 'expiring', label: 'Expiring memberships' },
    can('reports.read') && { value: 'movement', label: 'Joiners vs expired' },
    can('reports.read') && { value: 'demographics', label: 'Gender & age' },
    can('billing.read') && { value: 'collections', label: 'Collections' },
  ].filter(Boolean) as { value: string; label: string }[];
  const tab = tabs.some((t) => t.value === sp.get('tab')) ? sp.get('tab')! : tabs[0]?.value ?? 'expiring';
  return (
    <>
      <PageHeader title="Reports" subtitle="Every report can be exported to Excel with the filters you have applied." />
      <div className="mb-5"><Tabs value={tab} onChange={(v) => setSp({ tab: v })} items={tabs} /></div>
      {tab === 'expiring' && <Expiring />}
      {tab === 'movement' && <Movement />}
      {tab === 'demographics' && <Demographics />}
      {tab === 'collections' && <Collections />}
    </>
  );
}
