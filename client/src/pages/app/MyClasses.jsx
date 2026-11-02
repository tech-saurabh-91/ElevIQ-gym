import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Button, Empty, Loading, Tabs, useToast } from '../../components/ui';
import { useLocale } from '../../lib/i18n';
import api from '../../lib/api';

export default function MyClasses() {
  const { date } = useLocale();
  const { push } = useToast();
  const [bookings, setBookings] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('upcoming');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [b, s] = await Promise.all([
        api.get('/classes/my-bookings'),
        api.get(`/classes/sessions?from=${new Date().toISOString().slice(0, 10)}&limit=24`),
      ]);
      setBookings(b.data);
      setSessions(s.data);
    } catch (e) {
      push(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [push]);

  useEffect(() => {
    load();
  }, [load]);

  const cancel = async (id) => {
    try {
      await api.post(`/classes/bookings/${id}/cancel`);
      push('Booking cancelled — waitlist advanced.', 'info');
      load();
    } catch (e) {
      push(e.message, 'error');
    }
  };

  const book = async (id) => {
    try {
      await api.post('/classes/book', { sessionId: id });
      push('Seat reserved.');
      load();
    } catch (e) {
      push(e.message, 'error');
    }
  };

  if (loading) return <Loading label="Loading your classes…" />;

  const now = Date.now();
  const upcoming = bookings.filter((b) => b.session && new Date(b.session.date).getTime() + 0 >= now - 864e5 && !['cancelled'].includes(b.status));
  const past = bookings.filter((b) => !upcoming.includes(b));
  const bookedIds = new Set(bookings.filter((b) => b.status !== 'cancelled').map((b) => b.session?._id));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.24em] text-mint">My bookings</p>
          <h2 className="mt-1 font-display text-3xl font-black tracking-tight">Your training schedule</h2>
          <p className="mt-1 text-sm text-muted">{upcoming.length} upcoming · {past.length} in history</p>
        </div>
        <Link to="/app/classes" className="btn-ghost">Open full timetable</Link>
      </div>

      <Tabs
        tabs={[
          { value: 'upcoming', label: 'Upcoming' },
          { value: 'history', label: 'History' },
          { value: 'book', label: 'Book a class' },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'upcoming' && (
        <div className="space-y-3">
          {upcoming.length === 0 ? (
            <Empty title="Nothing booked yet" subtitle="Jump to the timetable and grab a seat.">
              <Link to="/app/classes" className="btn-primary mt-2">Browse schedule</Link>
            </Empty>
          ) : (
            upcoming.map((b) => (
              <div key={b._id} className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-white/10 bg-surface/60 p-5">
                <div className="flex items-center gap-4">
                  <div className="grid h-14 w-14 place-items-center rounded-2xl border border-white/10 bg-white/5 text-center">
                    <span className="font-mono text-[11px] leading-tight text-mint">
                      {new Date(b.session.date).getDate()}
                      <br />
                      {new Date(b.session.date).toLocaleString('en-US', { month: 'short' })}
                    </span>
                  </div>
                  <div>
                    <p className="font-display text-base font-bold">{b.session.title}</p>
                    <p className="text-xs text-muted">
                      {b.session.start}–{b.session.end} · {b.session.room} · {b.session.trainer?.jobTitle || 'Coach'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge tone={b.status === 'waitlist' ? 'warn' : 'success'}>{b.status}</Badge>
                  <Button variant="ghost" className="!py-2 !text-xs" onClick={() => cancel(b._id)}>Cancel</Button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'history' && (
        <div className="space-y-3">
          {past.length === 0 ? (
            <Empty title="No past bookings" subtitle="Completed classes will appear here." />
          ) : (
            past.map((b) => (
              <div key={b._id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 opacity-80">
                <div>
                  <p className="text-sm font-semibold">{b.session?.title || 'Class'}</p>
                  <p className="text-xs text-muted">{b.session ? date(b.session.date) : ''} · {b.session?.start}</p>
                </div>
                <Badge tone={b.status === 'cancelled' ? 'danger' : b.status === 'no-show' ? 'danger' : b.status === 'checked-in' ? 'success' : 'default'}>
                  {b.status}
                </Badge>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'book' && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {sessions.map((s) => {
            const left = Math.max(0, s.capacity - s.booked);
            const already = bookedIds.has(s._id);
            return (
              <article key={s._id} className="relative overflow-hidden rounded-3xl border border-white/10 bg-surface/60 p-5">
                <div className="absolute inset-x-0 top-0 h-1" style={{ background: s.classType?.color || '#00E5A0' }} />
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: s.classType?.color }}>
                      {s.classType?.category?.replace('-', ' ')}
                    </p>
                    <h3 className="mt-1 font-display text-base font-bold">{s.title}</h3>
                  </div>
                  <Badge tone={s.status === 'full' ? 'warn' : 'success'}>{s.status}</Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <span className="chip">{date(s.date, { year: false })}</span>
                  <span className="chip">{s.start}</span>
                  <span className="chip">{left} free</span>
                </div>
                <Button
                  className="mt-4 w-full !py-2.5 !text-xs"
                  variant={already ? 'ghost' : 'primary'}
                  disabled={already || s.status === 'cancelled'}
                  onClick={() => book(s._id)}
                >
                  {already ? 'You are booked' : left > 0 ? 'Book seat' : 'Join waitlist'}
                </Button>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
