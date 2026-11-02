import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Badge, Button, CountUp, Loading, Tabs, useToast } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { useLocale } from '../../lib/i18n';
import api from '../../lib/api';

function PseudoQR({ seed = 'GF', size = 17 }) {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const cells = [];
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const corner = (x < 4 && y < 4) || (x > size - 5 && y < 4) || (x < 4 && y > size - 5);
      h = (h * 1103515245 + 12345) >>> 0;
      const on = corner ? !(x === 1 && y === 1) && (x % 3 !== 2 || y % 3 !== 2) : (h >> 7) % 100 > 48;
      if (on) cells.push(<rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill="#05050A" />);
    }
  }
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full" shapeRendering="crispEdges">
      <rect width={size} height={size} fill="#EDEFF5" />
      {cells}
    </svg>
  );
}

export default function MyMembership() {
  const { user, refresh } = useAuth();
  const { money, date, t } = useLocale();
  const { push } = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState([]);
  const [tab, setTab] = useState('overview');

  const load = useCallback(async () => {
    try {
      const r = await api.get('/members/me/profile');
      setData(r.data);
    } catch (e) {
      push(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [push]);

  useEffect(() => {
    load();
    api.get('/plans').then((r) => setPlans(r.data)).catch(() => {});
  }, [load]);

  const renew = async (plan) => {
    if (!data?.member) return;
    try {
      const r = await api.post(`/members/${data.member._id}/renew`, { planId: plan?._id, days: plan?.durationDays || 30, amount: plan?.price });
      push(`Membership renewed through ${date(r.data.member.expiresAt)}.`);
      load();
    } catch (e) {
      push(e.message, 'error');
    }
  };

  if (loading) return <Loading label="Loading your membership…" />;
  if (!data?.member) {
    return (
      <div className="rounded-3xl border border-white/10 bg-surface/60 p-10 text-center">
        <p className="font-display text-xl font-bold">No membership linked</p>
        <p className="mt-2 text-sm text-muted">Ask the front desk to link your account to a member profile.</p>
        <Link to="/contact" className="btn-primary mt-5 inline-flex">Contact the club</Link>
      </div>
    );
  }

  const { member, upcoming, payments } = data;
  const daysLeft = member.expiresAt ? Math.ceil((new Date(member.expiresAt) - Date.now()) / 864e5) : 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.24em] text-mint">Member portal</p>
          <h2 className="mt-1 font-display text-3xl font-black tracking-tight">Hey {member.firstName}, your membership</h2>
          <p className="mt-1 text-sm text-muted">{member.memberId} · {member.planName} · home club {member.homeLocation?.name || '—'}</p>
        </div>
        <Badge tone={member.status === 'active' ? 'success' : member.status === 'expired' ? 'danger' : 'warn'}>{member.status}</Badge>
      </div>

      {/* Pass card */}
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <motion.div
          initial={{ opacity: 0, rotateX: -14, y: 20 }}
          animate={{ opacity: 1, rotateX: 0, y: 0 }}
          transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
          style={{ transformPerspective: 1200 }}
          className="relative overflow-hidden rounded-[30px] border border-white/12 bg-gradient-to-br from-violet/30 via-ink to-mint/20 p-6"
        >
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-mint/25 blur-3xl" />
          <div className="relative flex flex-wrap items-start justify-between gap-6">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-mint">GymFlow access pass</p>
              <p className="mt-3 font-display text-3xl font-black">{member.firstName} {member.lastName}</p>
              <p className="font-mono text-sm text-bone/70">{member.memberId}</p>

              <div className="mt-5 grid grid-cols-3 gap-3">
                {[
                  { k: 'Plan', v: member.planName },
                  { k: 'Valid till', v: member.expiresAt ? date(member.expiresAt) : '—' },
                  { k: 'Days left', v: daysLeft > 0 ? daysLeft : '—' },
                ].map((x) => (
                  <div key={x.k} className="rounded-xl border border-white/12 bg-black/25 p-3">
                    <p className="text-[9px] uppercase tracking-widest text-muted">{x.k}</p>
                    <p className="mt-1 text-xs font-semibold">{x.v}</p>
                  </div>
                ))}
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <span className="chip">RFID {member.rfid || 'not issued'}</span>
                <span className="chip">{member.autoRenew ? 'auto-renew on' : 'manual renewal'}</span>
              </div>
            </div>

            <div className="grid gap-2 text-center">
              <div className="h-32 w-32 rounded-2xl border border-white/20 bg-white p-2 shadow-card">
                <PseudoQR seed={member.qrToken || member.memberId} />
              </div>
              <p className="text-[10px] uppercase tracking-[0.16em] text-muted">Show at turnstile</p>
            </div>
          </div>

          {daysLeft <= 14 && daysLeft > -60 && (
            <div className="relative mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber/40 bg-amber/10 p-4">
              <p className="text-sm text-amber">
                {daysLeft > 0 ? `Your plan expires in ${daysLeft} days.` : 'Your membership has expired.'} Renew to keep your rate.
              </p>
              <Button onClick={() => renew(member.plan)} className="!py-2.5 !text-xs">Renew now</Button>
            </div>
          )}
        </motion.div>

        <div className="grid grid-cols-2 gap-3">
          {[
            { k: 'Total visits', v: member.totalVisits, tone: 'text-mint' },
            { k: 'This month', v: member.visitsThisMonth, tone: 'text-violet' },
            { k: 'Balance', v: money(member.balance || 0), tone: 'text-coral' },
            { k: 'Referral code', v: member.referralCode || '—', tone: 'text-sky' },
          ].map((s) => (
            <div key={s.k} className="rounded-2xl border border-white/10 bg-surface/60 p-5">
              <p className={`font-display text-2xl font-black ${s.tone}`}>
                {typeof s.v === 'number' ? <CountUp to={s.v} /> : s.v}
              </p>
              <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-muted">{s.k}</p>
            </div>
          ))}
        </div>
      </div>

      <Tabs
        tabs={[
          { value: 'overview', label: 'Upcoming classes' },
          { value: 'payments', label: 'Payment history' },
          { value: 'upgrade', label: 'Change plan' },
          { value: 'profile', label: 'Profile' },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'overview' && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {upcoming.length === 0 && (
            <div className="col-span-full rounded-3xl border border-white/10 bg-surface/60 p-10 text-center">
              <p className="font-display text-lg font-bold">No upcoming classes</p>
              <p className="mt-2 text-sm text-muted">Grab a spot from the timetable.</p>
              <Link to="/app/classes" className="btn-primary mt-5 inline-flex">Browse schedule</Link>
            </div>
          )}
          {upcoming.map((b) => (
            <div key={b._id} className="rounded-3xl border border-white/10 bg-surface/60 p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: b.session?.classType?.color || '#00E5A0' }}>
                    {b.session?.classType?.category?.replace('-', ' ') || 'class'}
                  </p>
                  <p className="mt-1 font-display font-bold">{b.session?.title}</p>
                </div>
                <Badge tone={b.status === 'cancelled' ? 'danger' : 'success'}>{b.status}</Badge>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <span className="chip">{b.session ? date(b.session.date, { year: false }) : ''}</span>
                <span className="chip">{b.session?.start}</span>
                <span className="chip">{b.session?.room}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'payments' && (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-surface/60">
          <table className="w-full text-sm">
            <thead className="bg-white/[0.04] text-[11px] uppercase tracking-widest text-muted">
              <tr>
                <th className="px-4 py-3 text-start">Receipt</th>
                <th className="px-4 py-3 text-start">Description</th>
                <th className="px-4 py-3 text-start">Method</th>
                <th className="px-4 py-3 text-start">Amount</th>
                <th className="px-4 py-3 text-start">Date</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p._id} className="border-t border-white/[0.06]">
                  <td className="px-4 py-3 font-mono text-xs text-mint">{p.receiptNo}</td>
                  <td className="px-4 py-3 text-muted">{p.description}</td>
                  <td className="px-4 py-3 text-xs capitalize text-muted">{p.method}</td>
                  <td className="px-4 py-3 font-mono">{money(p.amount)}</td>
                  <td className="px-4 py-3 text-xs text-muted">{date(p.paidAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'upgrade' && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {plans.map((p) => (
            <div key={p._id} className={`flex flex-col rounded-3xl border p-5 ${p.name === member.planName ? 'border-mint/50 bg-mint/[0.07]' : 'border-white/10 bg-surface/60'}`}>
              <div className="flex items-start justify-between">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: p.color }}>{p.name}</p>
                {p.popular && <Badge tone="success">popular</Badge>}
              </div>
              <p className="mt-3 font-display text-3xl font-black">{money(p.price)}</p>
              <p className="text-[11px] text-muted">{t('pricing.month')}</p>
              <ul className="mt-4 flex-1 space-y-2">
                {(p.features || []).slice(0, 4).map((f) => (
                  <li key={f} className="flex items-start gap-2 text-xs text-bone/80">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: p.color }} />
                    {f}
                  </li>
                ))}
              </ul>
              <Button
                className="mt-5 !py-2.5 !text-xs"
                variant={p.name === member.planName ? 'ghost' : 'primary'}
                disabled={p.name === member.planName}
                onClick={() => renew(p)}
              >
                {p.name === member.planName ? 'Current plan' : 'Switch & pay'}
              </Button>
            </div>
          ))}
        </div>
      )}

      {tab === 'profile' && (
        <div className="grid gap-4 md:grid-cols-2">
          {[
            { k: 'Full name', v: `${member.firstName} ${member.lastName}` },
            { k: 'Email', v: user?.email },
            { k: 'Phone', v: user?.phone || '—' },
            { k: 'Gender', v: member.gender },
            { k: 'Blood group', v: member.bloodGroup || '—' },
            { k: 'Joined', v: date(member.joinedAt) },
            { k: 'Emergency contact', v: `${member.emergencyContact?.name || '—'} (${member.emergencyContact?.relation || '—'}) ${member.emergencyContact?.phone || ''}` },
            { k: 'Company', v: member.company || '—' },
          ].map((x) => (
            <div key={x.k} className="rounded-2xl border border-white/10 bg-surface/60 p-4">
              <p className="text-[10px] uppercase tracking-widest text-muted">{x.k}</p>
              <p className="mt-1.5 text-sm font-medium">{x.v}</p>
            </div>
          ))}
          <div className="md:col-span-2 rounded-2xl border border-white/10 bg-surface/60 p-4">
            <p className="text-[10px] uppercase tracking-widest text-muted">Goals</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {(member.goals || []).map((g) => <span key={g} className="chip">{g}</span>)}
              {(member.tags || []).map((g) => <span key={g} className="chip">{g}</span>)}
            </div>
          </div>
          <div className="md:col-span-2">
            <Link to="/app/settings" className="btn-ghost">Edit account settings</Link>
          </div>
        </div>
      )}
    </div>
  );
}
