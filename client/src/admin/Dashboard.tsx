import { Link } from 'react-router-dom';
import { AlertTriangle, CalendarClock, CreditCard, ScanLine, UserPlus, Users, Wallet } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { money, num, date, daysUntil } from '@/lib/format';
import { Badge, Card, ErrorNote, PageHeader, Spinner, Stat, Table, useLoad } from '@/components/ui';

export default function Dashboard() {
  const { session, can } = useAuth();
  const { data, error, loading } = useLoad((s) => api.get('/admin/reports/dashboard', s).then((r) => r.data), []);
  const expiring = useLoad((s) => (can('reports.read', 'members.read') ? api.get('/admin/reports/expiring?days=14', s).then((r) => r.data) : Promise.resolve([])), []);

  if (loading) return <Spinner />;
  return (
    <>
      <PageHeader title={`Hello, ${session!.user.name.split(' ')[0]}`} subtitle={date(new Date(), { weekday: 'long', day: 'numeric', month: 'long' })} />
      <ErrorNote error={error} />
      {data && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat label="Active members" value={num(data.active)} hint={`${num(data.newMembers)} joined this month`} icon={<Users className="h-4 w-4" />} />
          <Stat label="Expiring in 7 days" value={num(data.expiring7)} hint={`${num(data.expiredRecent)} lapsed in last 30 days`} icon={<CalendarClock className="h-4 w-4" />} tone="warn" />
          <Stat label="New leads" value={num(data.newLeads)} hint="Waiting for follow-up" icon={<UserPlus className="h-4 w-4" />} />
          <Stat label="Check-ins today" value={num(data.checkinsToday)} hint={`${num(data.inside)} inside now`} icon={<ScanLine className="h-4 w-4" />} />
          {'collectedMonth' in data && (
            <>
              <Stat label="Collected today" value={money(data.collectedToday)} icon={<Wallet className="h-4 w-4" />} />
              <Stat label="Collected this month" value={money(data.collectedMonth)} hint={`Expenses ${money(data.expensesMonth)}`} icon={<CreditCard className="h-4 w-4" />} />
              <Stat label="Outstanding" value={money(data.outstanding)} hint={`${num(data.outstandingCount)} unpaid invoices`} icon={<AlertTriangle className="h-4 w-4" />} tone="bad" />
              <Stat label="Net this month" value={money(data.collectedMonth - data.expensesMonth)} icon={<Wallet className="h-4 w-4" />} />
            </>
          )}
        </div>
      )}
      {can('reports.read', 'members.read') && (
        <Card className="mt-6" title="Memberships expiring in the next 14 days" actions={<Link to="/admin/reports" className="text-xs font-semibold text-link">All reports</Link>} padded={false}>
          <Table
            loading={expiring.loading}
            rows={(expiring.data as any[]) ?? []}
            empty="No memberships are about to expire."
            columns={[
              { key: 'n', header: 'Member', render: (m: any) => <Link className="font-semibold hover:text-link" to={`/admin/members/${m._id}`}>{m.firstName} {m.lastName}</Link> },
              { key: 'p', header: 'Plan', render: (m: any) => m.currentPlanName || '—' },
              { key: 'ph', header: 'Phone', render: (m: any) => m.phone ? <a href={`tel:${m.phone}`} className="text-link">{m.phone}</a> : '—' },
              { key: 'e', header: 'Expires', render: (m: any) => <span>{date(m.expiresAt)} <Badge tone={daysUntil(m.expiresAt) <= 3 ? 'red' : 'amber'}>{daysUntil(m.expiresAt)}d</Badge></span> },
            ]}
          />
        </Card>
      )}
    </>
  );
}
