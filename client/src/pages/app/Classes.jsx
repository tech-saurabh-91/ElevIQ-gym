import { useCallback, useEffect, useState } from 'react';
import { Badge, Button, Empty, Field, Input, Loading, Modal, Select, Tabs, useToast } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { useLocale } from '../../lib/i18n';
import api from '../../lib/api';

const iso = (d) => new Date(d).toISOString().slice(0, 10);

export default function Classes() {
  const { user, isAdmin } = useAuth();
  const { money, date } = useLocale();
  const { push } = useToast();

  const [tab, setTab] = useState('schedule');
  const [types, setTypes] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [myBookings, setMyBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState(iso(new Date()));
  const [to, setTo] = useState(iso(Date.now() + 7 * 864e5));
  const [category, setCategory] = useState('all');
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [typeOpen, setTypeOpen] = useState(false);
  const [form, setForm] = useState({ classType: '', date: iso(new Date()), start: '06:00', durationMin: 45, capacity: 20, room: 'Studio A', trainer: '' });
  const [typeForm, setTypeForm] = useState({ name: '', category: 'group-fitness', intensity: 3, durationMin: 45, defaultCapacity: 20, color: '#00E5A0' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ty, se] = await Promise.all([
        api.get('/classes/types'),
        api.get(api.qs('/classes/sessions', { from, to, category, limit: 120 })),
      ]);
      setTypes(ty.data);
      setSessions(se.data);
      setForm((f) => ({ ...f, classType: f.classType || ty.data[0]?._id, trainer: f.trainer }));
    } catch (e) {
      push(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [from, to, category, push]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!user) return;
    api.get('/classes/my-bookings').then((r) => setMyBookings(r.data)).catch(() => {});
    if (isAdmin) api.get(api.qs('/classes/bookings', { limit: 50 })).then((r) => setBookings(r.data)).catch(() => {});
    api.get('/ops/staff?limit=50').then((r) => setTypes((t) => t)).catch(() => {});
  }, [user, isAdmin, tab]);

  const book = async (sessionId) => {
    try {
      await api.post('/classes/book', { sessionId });
      push('Seat reserved.');
      load();
      api.get('/classes/my-bookings').then((r) => setMyBookings(r.data)).catch(() => {});
    } catch (e) {
      push(e.message, 'error');
    }
  };

  const cancel = async (bookingId) => {
    try {
      await api.post(`/classes/bookings/${bookingId}/cancel`);
      push('Booking cancelled — waitlist updated.', 'info');
      load();
      api.get('/classes/my-bookings').then((r) => setMyBookings(r.data)).catch(() => {});
    } catch (e) {
      push(e.message, 'error');
    }
  };

  const createSession = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const type = types.find((t) => t._id === form.classType);
      const [h, m] = form.start.split(':').map(Number);
      const endMin = h * 60 + m + Number(form.durationMin);
      const end = `${String(Math.floor(endMin / 60) % 24).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`;
      await api.post('/classes/sessions', {
        classType: form.classType,
        title: type?.name || 'Session',
        date: form.date,
        start: form.start,
        end,
        capacity: Number(form.capacity),
        room: form.room,
        trainer: form.trainer || undefined,
        status: 'scheduled',
      });
      push('Session scheduled.');
      setOpen(false);
      load();
    } catch (err) {
      push(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const createType = async (e) => {
    e.preventDefault();
    try {
      await api.post('/classes/types', { ...typeForm, intensity: Number(typeForm.intensity), durationMin: Number(typeForm.durationMin), defaultCapacity: Number(typeForm.defaultCapacity) });
      push('Class type added.');
      setTypeOpen(false);
      load();
    } catch (err) {
      push(err.message, 'error');
    }
  };

  const removeSession = async (id) => {
    try {
      await api.del(`/classes/sessions/${id}`);
      push('Session removed.', 'info');
      load();
    } catch (e) {
      push(e.message, 'error');
    }
  };

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const tabs = [
    { value: 'schedule', label: 'Schedule' },
    ...(user?.role === 'member' ? [{ value: 'mine', label: 'My bookings' }] : []),
    ...(isAdmin ? [{ value: 'bookings', label: 'All bookings' }, { value: 'types', label: 'Class types' }] : []),
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-black tracking-tight">Class & training management</h2>
          <p className="mt-1 text-sm text-muted">{sessions.length} sessions in range · {types.length} class types · waitlists handled automatically</p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setTypeOpen(true)}>+ Class type</Button>
            <Button onClick={() => setOpen(true)}>+ Schedule session</Button>
          </div>
        )}
      </div>

      <Tabs tabs={tabs} value={tab} onChange={setTab} />

      {tab === 'schedule' && (
        <>
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-surface/60 p-4">
            <Field label="From"><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="!py-2" /></Field>
            <Field label="To"><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="!py-2" /></Field>
            <Field label="Category">
              <Select value={category} onChange={(e) => setCategory(e.target.value)} className="!py-2">
                {['all', 'group-fitness', 'strength', 'cardio', 'mind-body', 'sports', 'personal-training'].map((c) => <option key={c}>{c}</option>)}
              </Select>
            </Field>
            <div className="ms-auto flex gap-2 self-end">
              <Button variant="ghost" className="!py-2.5 !text-xs" onClick={() => { setFrom(iso(new Date())); setTo(iso(Date.now() + 7 * 864e5)); }}>
                Next 7 days
              </Button>
              <Button variant="ghost" className="!py-2.5 !text-xs" onClick={() => { setFrom(iso(Date.now() - 7 * 864e5)); setTo(iso(new Date())); }}>
                Last 7 days
              </Button>
            </div>
          </div>

          {loading ? (
            <Loading label="Loading timetable…" />
          ) : sessions.length === 0 ? (
            <Empty title="No sessions in this range" subtitle="Widen the dates or schedule a new session." />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {sessions.map((s) => {
                const left = Math.max(0, s.capacity - s.booked);
                const pct = Math.min(100, Math.round((s.booked / (s.capacity || 1)) * 100));
                const mine = myBookings.find((b) => b.session?._id === s._id && b.status !== 'cancelled');
                return (
                  <article key={s._id} className="group relative overflow-hidden rounded-3xl border border-white/10 bg-surface/60 p-5 transition hover:border-white/25">
                    <div className="absolute inset-x-0 top-0 h-1" style={{ background: s.classType?.color || '#00E5A0' }} />
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: s.classType?.color }}>
                          {s.classType?.category?.replace('-', ' ')}
                        </p>
                        <h3 className="mt-1 font-display text-base font-bold">{s.title}</h3>
                      </div>
                      <Badge tone={s.status === 'full' ? 'warn' : s.status === 'cancelled' ? 'danger' : s.status === 'completed' ? 'default' : 'success'}>
                        {s.status}
                      </Badge>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <span className="chip">{date(s.date, { year: false })}</span>
                      <span className="chip">{s.start}–{s.end}</span>
                      <span className="chip">{s.room}</span>
                      <span className="chip">{s.trainer?.jobTitle || 'Unassigned'}</span>
                    </div>

                    <div className="mt-4">
                      <div className="mb-1.5 flex justify-between text-[11px]">
                        <span className="text-muted">{left} of {s.capacity} free</span>
                        <span className="font-mono text-bone/70">{pct}%</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: left > 0 ? s.classType?.color : '#FF4D6D' }} />
                      </div>
                    </div>

                    <div className="mt-4 flex gap-2">
                      {user?.role === 'member' && (
                        mine ? (
                          <Button variant="ghost" className="flex-1 !py-2 !text-xs" onClick={() => cancel(mine._id)}>
                            Cancel booking
                          </Button>
                        ) : (
                          <Button className="flex-1 !py-2 !text-xs" onClick={() => book(s._id)} disabled={s.status === 'cancelled'}>
                            {left > 0 ? 'Book seat' : 'Join waitlist'}
                          </Button>
                        )
                      )}
                      {isAdmin && (
                        <Button variant="ghost" className="!py-2 !text-xs" onClick={() => removeSession(s._id)}>
                          Delete
                        </Button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}

      {tab === 'mine' && (
        <div className="space-y-3">
          {myBookings.length === 0 ? (
            <Empty title="No bookings yet" subtitle="Head to the schedule and grab a spot." />
          ) : (
            myBookings.map((b) => (
              <div key={b._id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-surface/60 p-4">
                <div>
                  <p className="font-display font-semibold">{b.session?.title}</p>
                  <p className="text-xs text-muted">
                    {b.session ? date(b.session.date) : ''} · {b.session?.start} · {b.session?.room}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={b.status === 'cancelled' ? 'danger' : b.status === 'waitlist' ? 'warn' : 'success'}>{b.status}</Badge>
                  {!['cancelled', 'no-show'].includes(b.status) && (
                    <Button variant="ghost" className="!py-2 !text-xs" onClick={() => cancel(b._id)}>Cancel</Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'bookings' && (
        <div className="overflow-x-auto rounded-2xl border border-white/10 bg-surface/60 scrollbar-thin">
          <table className="w-full text-sm">
            <thead className="bg-white/[0.04] text-[11px] uppercase tracking-widest text-muted">
              <tr><th className="px-4 py-3 text-start">Member</th><th className="px-4 py-3 text-start">Session</th><th className="px-4 py-3 text-start">Status</th><th className="px-4 py-3 text-start">Booked</th></tr>
            </thead>
            <tbody>
              {bookings.map((b) => (
                <tr key={b._id} className="border-t border-white/[0.06]">
                  <td className="px-4 py-3">{b.member?.firstName} {b.member?.lastName}</td>
                  <td className="px-4 py-3 text-muted">{b.session?.title} · {b.session ? date(b.session.date, { year: false }) : ''}</td>
                  <td className="px-4 py-3"><Badge tone={b.status === 'cancelled' ? 'danger' : b.status === 'waitlist' ? 'warn' : 'success'}>{b.status}</Badge></td>
                  <td className="px-4 py-3 font-mono text-xs text-muted">{new Date(b.bookedAt).toLocaleDateString('en-GB')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'types' && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {types.map((t) => (
            <div key={t._id} className="rounded-3xl border border-white/10 bg-surface/60 p-5">
              <div className="flex items-start justify-between">
                <span className="h-3 w-3 rounded-full" style={{ background: t.color }} />
                <Badge tone="default">{t.category}</Badge>
              </div>
              <h3 className="mt-3 font-display font-bold">{t.name}</h3>
              <p className="mt-1 text-xs text-muted">{t.description}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <span className="chip">{t.durationMin} min</span>
                <span className="chip">cap {t.defaultCapacity}</span>
                <span className="chip">RPE {t.intensity}/5</span>
                <span className="chip">{t.calories} kcal</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Schedule session */}
      <Modal open={open} onClose={() => setOpen(false)} title="Schedule a session">
        <form onSubmit={createSession} className="grid gap-4">
          <Field label="Class type">
            <Select value={form.classType} onChange={set('classType')} required>
              {types.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
            </Select>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Date"><Input type="date" value={form.date} onChange={set('date')} required /></Field>
            <Field label="Start"><Input type="time" value={form.start} onChange={set('start')} required /></Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Duration (min)"><Input type="number" value={form.durationMin} onChange={set('durationMin')} /></Field>
            <Field label="Capacity"><Input type="number" value={form.capacity} onChange={set('capacity')} /></Field>
            <Field label="Room"><Input value={form.room} onChange={set('room')} /></Field>
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>Schedule</Button>
          </div>
        </form>
      </Modal>

      {/* Class type */}
      <Modal open={typeOpen} onClose={() => setTypeOpen(false)} title="New class type">
        <form onSubmit={createType} className="grid gap-4">
          <Field label="Name"><Input value={typeForm.name} onChange={(e) => setTypeForm((f) => ({ ...f, name: e.target.value }))} required /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Category">
              <Select value={typeForm.category} onChange={(e) => setTypeForm((f) => ({ ...f, category: e.target.value }))}>
                {['group-fitness', 'strength', 'cardio', 'mind-body', 'sports', 'personal-training'].map((c) => <option key={c}>{c}</option>)}
              </Select>
            </Field>
            <Field label="Accent colour"><Input type="color" value={typeForm.color} onChange={(e) => setTypeForm((f) => ({ ...f, color: e.target.value }))} className="!p-1" /></Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Intensity (1-5)"><Input type="number" min="1" max="5" value={typeForm.intensity} onChange={(e) => setTypeForm((f) => ({ ...f, intensity: e.target.value }))} /></Field>
            <Field label="Minutes"><Input type="number" value={typeForm.durationMin} onChange={(e) => setTypeForm((f) => ({ ...f, durationMin: e.target.value }))} /></Field>
            <Field label="Capacity"><Input type="number" value={typeForm.defaultCapacity} onChange={(e) => setTypeForm((f) => ({ ...f, defaultCapacity: e.target.value }))} /></Field>
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <Button type="button" variant="ghost" onClick={() => setTypeOpen(false)}>Cancel</Button>
            <Button type="submit">Create</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
