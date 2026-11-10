import { Navigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cap, date, daysUntil, money, time } from '@/lib/format';
import { Badge, Button, Card, ErrorNote, Spinner, Table, statusTone, useLoad, useToast } from '@/components/ui';
import { Logo } from '@/site/SiteLayout';

/** Member self-service: membership status, check-in code, invoices and class bookings. */
export default function Portal() {
  const { session, loading, logout } = useAuth();
  const toast = useToast();
  const me = useLoad((s) => (session?.user.role === 'member' ? api.get('/portal/me', s).then((r) => r.data) : Promise.resolve(null)), [session?.user._id]);
  const classes = useLoad((s) => (session?.user.role === 'member' ? api.get('/portal/classes', s).then((r) => r.data as any[]) : Promise.resolve([])), [session?.user._id]);

  if (loading) return <Spinner />;
  if (!session) return <Navigate to="/login" replace />;
  if (session.user.role !== 'member') return <Navigate to="/admin" replace />;

  const book = async (id: string) => {
    try { const r = await api.post('/portal/bookings', { sessionId: id }); toast(r.data.status === 'waitlist' ? 'Class is full - you are on the waitlist' : 'Booked!'); me.reload(); classes.reload(); } catch (e) { toast((e as Error).message, 'err'); }
  };
  const cancel = async (id: string) => {
    try { await api.post(`/portal/bookings/${id}/cancel`); toast('Booking cancelled'); me.reload(); classes.reload(); } catch (e) { toast((e as Error).message, 'err'); }
  };

  const m = me.data?.member;
  const booked = new Map<string, any>((me.data?.bookings ?? []).map((b: any) => [String(b.session?._id), b]));

  return (
    <div className="min-h-screen bg-bg text-ink">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
          <Logo className="h-8" />
          <Button variant="ghost" size="sm" icon={<LogOut className="h-4 w-4" />} onClick={logout}>Sign out</Button>
        </div>
      </header>
      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
        <ErrorNote error={me.error} />
        {!m ? <Spinner /> : (
          <>
            <div className="grid gap-6 md:grid-cols-3">
              <Card className="md:col-span-2">
                <p className="text-sm text-muted">Hello</p>
                <h1 className="font-display text-3xl font-bold">{m.firstName} {m.lastName}</h1>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <Badge tone={statusTone(m.status)}>{m.status}</Badge>
                  <span className="text-sm">{m.currentPlanName || 'No active plan'}</span>
                  {m.expiresAt && <span className="text-sm text-muted">valid until {date(m.expiresAt)}{m.status === 'active' && ` (${daysUntil(m.expiresAt)} days left)`}</span>}
                </div>
                {m.status !== 'active' && <p className="mt-4 rounded-brand bg-amber-500/10 p-3 text-sm">Your membership is not active. Visit the front desk to renew.</p>}
              </Card>
              <Card>
                <p className="text-xs font-semibold text-muted">Check-in code</p>
                <p className="mt-2 select-all rounded-brand bg-surface2 p-3 text-center font-mono text-2xl font-bold tracking-wider">{m.memberNo}</p>
                <p className="mt-2 text-xs text-muted">Show or say this at the front desk.</p>
              </Card>
            </div>

            <Card title="Classes in the next 2 weeks" padded={false}>
              <Table loading={classes.loading} rows={classes.data ?? []} empty="No classes scheduled." columns={[
                { key: 'd', header: 'When', render: (s: any) => `${date(s.date, { weekday: 'short', day: 'numeric', month: 'short' })} · ${time(s.start)}` },
                { key: 'n', header: 'Class', render: (s: any) => s.title },
                { key: 't', header: 'Coach', render: (s: any) => s.trainer?.name ?? '—' },
                { key: 's', header: 'Spots', render: (s: any) => (s.booked >= s.capacity ? <Badge tone="amber">Full</Badge> : `${s.capacity - s.booked} left`) },
                { key: 'a', header: '', className: 'text-right', render: (s: any) => { const b = booked.get(String(s._id)); return b ? <Button size="sm" variant="outline" onClick={() => cancel(b._id)}>{b.status === 'waitlist' ? 'Leave waitlist' : 'Cancel'}</Button> : <Button size="sm" disabled={m.status !== 'active'} onClick={() => book(s._id)}>{s.booked >= s.capacity ? 'Join waitlist' : 'Book'}</Button>; } },
              ]} />
            </Card>

            <Card title="Invoices" padded={false}>
              <Table rows={me.data.invoices} empty="No invoices yet." columns={[
                { key: 'n', header: 'Invoice', render: (i: any) => i.number },
                { key: 'd', header: 'Date', render: (i: any) => date(i.issuedAt) },
                { key: 'l', header: 'For', render: (i: any) => i.lines?.[0]?.description },
                { key: 't', header: 'Total', render: (i: any) => money(i.total, i.currency) },
                { key: 's', header: 'Status', render: (i: any) => <Badge tone={statusTone(i.status)}>{cap(i.status)}</Badge> },
              ]} />
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
