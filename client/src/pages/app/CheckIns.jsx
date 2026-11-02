import { useCallback, useEffect, useState } from 'react';
import { Badge, Button, Field, Input, Loading, useToast } from '../../components/ui';
import { useLocale } from '../../lib/i18n';
import api from '../../lib/api';

export default function CheckIns() {
  const { date } = useLocale();
  const { push } = useToast();
  const [live, setLive] = useState(null);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [recent, setRecent] = useState([]);

  const load = useCallback(async () => {
    try {
      const r = await api.get('/checkins/live');
      setLive(r.data);
      setRecent(r.data.recent);
    } catch (e) {
      push(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [push]);

  useEffect(() => {
    load();
    const id = setInterval(load, 20000);
    return () => clearInterval(id);
  }, [load]);

  const scan = async (e) => {
    e.preventDefault();
    if (!code.trim()) return;
    setBusy(true);
    try {
      const r = await api.post('/checkins/scan', { code: code.trim(), method: 'manual' });
      const m = r.data.member;
      push(`${r.data.action === 'checkin' ? 'Checked in' : 'Checked out'} · ${m.firstName} ${m.lastName} (${m.memberId})`);
      setCode('');
      load();
    } catch (err) {
      push(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  if (loading && !live) return <Loading label="Connecting to turnstile…" />;

  const inside = live?.inside ?? 0;
  const occupancy = Math.min(100, Math.round((inside / 250) * 100));

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-2xl font-black tracking-tight">Check-in & access</h2>
        <p className="mt-1 text-sm text-muted">Scan a QR pass or RFID code. Members already inside are checked out automatically.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.3fr]">
        {/* Scanner */}
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-surface/60 p-6">
          <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-mint/20 blur-3xl" />
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-mint">Front desk scanner</p>

          <div className="relative mt-5 grid place-items-center">
            <div className="relative grid h-52 w-52 place-items-center rounded-3xl border-2 border-dashed border-mint/40 bg-void/60">
              <span className="absolute h-52 w-52 animate-pulseRing rounded-3xl border border-mint/40" />
              <svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="#00E5A0" strokeWidth="1.3" className="opacity-80">
                <path d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2" />
                <path d="M3 12h18" />
              </svg>
            </div>
          </div>

          <form onSubmit={scan} className="relative mt-6">
            <Field label="Member ID, QR token or RFID">
              <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="GF-01001" className="font-mono" autoFocus />
            </Field>
            <Button type="submit" loading={busy} className="mt-3 w-full !py-3.5">
              Verify & toggle access
            </Button>
          </form>

          <p className="relative mt-3 text-center text-[11px] text-muted">Try a member ID such as GF-01001 or scan from the member portal.</p>
        </div>

        {/* Live metrics */}
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { k: 'Inside now', v: inside, tone: 'text-mint' },
              { k: "Today's check-ins", v: live?.todayCount ?? 0, tone: 'text-sky' },
              { k: 'Occupancy', v: `${occupancy}%`, tone: 'text-violet' },
            ].map((s) => (
              <div key={s.k} className="rounded-2xl border border-white/10 bg-surface/60 p-4">
                <p className={`font-display text-3xl font-black ${s.tone}`}>{s.v}</p>
                <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-muted">{s.k}</p>
              </div>
            ))}
          </div>

          <div className="rounded-3xl border border-white/10 bg-surface/60 p-5">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted">Live floor feed</p>
              <span className="flex items-center gap-1.5 text-[11px] text-mint">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-mint" /> updating
              </span>
            </div>

            <div className="h-3 overflow-hidden rounded-full bg-white/8">
              <div
                className="h-full rounded-full bg-gradient-to-r from-mint via-sky to-violet transition-all duration-700"
                style={{ width: `${occupancy}%` }}
              />
            </div>

            <div className="mt-4 max-h-[340px] space-y-2 overflow-y-auto scrollbar-thin">
              {recent.length === 0 && <p className="py-6 text-center text-xs text-muted">No activity yet today.</p>}
              {recent.map((c) => (
                <div key={c._id} className="flex items-center justify-between gap-3 rounded-xl border border-white/8 bg-white/[0.03] px-3.5 py-2.5">
                  <div className="flex items-center gap-3">
                    <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-mint/70 to-violet/70 font-display text-[10px] font-black text-void">
                      {(c.member?.firstName?.[0] || '?') + (c.member?.lastName?.[0] || '')}
                    </span>
                    <div>
                      <p className="text-xs font-semibold">{c.member?.firstName} {c.member?.lastName}</p>
                      <p className="font-mono text-[10px] text-muted">{c.member?.memberId} · {c.method}</p>
                    </div>
                  </div>
                  <div className="text-end">
                    <p className="font-mono text-[11px] text-bone/80">
                      {new Date(c.inAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    <p className="text-[10px] uppercase tracking-widest text-muted">{c.outAt ? 'closed' : 'inside'}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
