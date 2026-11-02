import { useEffect, useState } from 'react';
import { Field, Input, Select, Textarea, Button, Badge, Reveal, SectionHeading, useToast, Tilt } from '../components/ui';
import { useLocale } from '../lib/i18n';
import api from '../lib/api';

const FAQS = [
  { q: 'How long does onboarding take?', a: 'Most clubs are live in 7–10 days. We migrate members, plans, open invoices and historical visits from your current system at no extra cost.' },
  { q: 'Can I run multiple countries on one account?', a: 'Yes. Each location carries its own currency, timezone, tax rate and language default, while reporting rolls up into a single group view.' },
  { q: 'Does it work offline at the front desk?', a: 'Check-ins queue locally and sync the moment connectivity returns. The member portal is a PWA and works on flaky connections.' },
  { q: 'What about GDPR and data export?', a: 'Members can request a full data export or erasure from the portal. Admins get an audit trail of every access event.' },
  { q: 'Is there a POS for supplements and merch?', a: 'Built in — barcode-ready catalog, stock alerts, supplier tracking, promotions and loyalty, with sales flowing straight into revenue reports.' },
  { q: 'Do you support RFID and QR check-in?', a: 'Both. RFID cards, printed QR passes and phone-based passes are supported, with a manual fallback for the front desk.' },
];

export default function Contact() {
  const { t, money } = useLocale();
  const { push } = useToast();
  const [locations, setLocations] = useState([]);
  const [openFaq, setOpenFaq] = useState(0);
  const [sending, setSending] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', subject: '', message: '', topic: 'membership' });

  useEffect(() => {
    api.get('/locations').then((r) => setLocations(r.data)).catch(() => {});
  }, []);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.includes('@') || form.message.trim().length < 5) {
      push('Please complete name, a valid email and a message.', 'error');
      return;
    }
    setSending(true);
    try {
      const res = await api.post('/contact', form);
      push(res.message || t('contact.sent'));
      setForm({ name: '', email: '', phone: '', subject: '', message: '', topic: 'membership' });
    } catch (err) {
      push(err.message, 'error');
    } finally {
      setSending(false);
    }
  };

  const tzFor = (city) => (city === 'Bengaluru' ? 'Asia/Kolkata' : city === 'Austin' ? 'America/Chicago' : 'Europe/Berlin');

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden pb-16 pt-36">
        <div className="pointer-events-none absolute -left-24 top-16 h-[360px] w-[560px] rounded-full bg-coral/15 blur-[130px]" />
        <div className="container-x relative">
          <Reveal>
            <span className="eyebrow">{t('nav.contact')}</span>
            <h1 className="mt-6 max-w-3xl font-display text-[clamp(2.3rem,6vw,4.6rem)] font-black leading-[0.96] tracking-tight">
              {t('contact.title')}
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted">{t('contact.sub')}</p>
          </Reveal>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {[
              { k: t('contact.info'), v: 'GymFlow Systems, Level 4, Indiranagar, Bengaluru 560038', icon: '📍' },
              { k: 'Direct line', v: '+91 80 4567 8901 · +1 512 555 0142', icon: '📞' },
              { k: t('contact.hours'), v: t('contact.hoursValue'), icon: '🕘' },
            ].map((c, i) => (
              <Reveal key={c.k} delay={i * 0.07}>
                <div className="glass h-full rounded-2xl p-5">
                  <span className="text-xl">{c.icon}</span>
                  <p className="mt-3 text-[11px] font-bold uppercase tracking-[0.18em] text-mint">{c.k}</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{c.v}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Form + FAQ */}
      <section className="relative py-16">
        <div className="container-x grid gap-10 lg:grid-cols-[1.05fr_1fr]">
          <Reveal>
            <div className="glass rounded-[30px] p-7 sm:p-9">
              <h2 className="font-display text-2xl font-bold">Send us a message</h2>
              <p className="mt-2 text-sm text-muted">Tell us about your facility — size, locations and what you run today.</p>

              <form onSubmit={submit} className="mt-7 grid gap-4 sm:grid-cols-2">
                <Field label={t('contact.name')}>
                  <Input value={form.name} onChange={set('name')} placeholder="Aria Kapoor" autoComplete="name" />
                </Field>
                <Field label={t('contact.email')}>
                  <Input type="email" value={form.email} onChange={set('email')} placeholder="you@club.com" autoComplete="email" />
                </Field>
                <Field label={t('contact.phone')}>
                  <Input value={form.phone} onChange={set('phone')} placeholder="+1 512 000 0000" />
                </Field>
                <Field label="Topic">
                  <Select value={form.topic} onChange={set('topic')}>
                    <option value="membership">Membership & pricing</option>
                    <option value="personal-training">Personal training</option>
                    <option value="corporate">Corporate & multi-site</option>
                    <option value="feedback">Feedback</option>
                    <option value="support">Support</option>
                    <option value="other">Other</option>
                  </Select>
                </Field>
                <div className="sm:col-span-2">
                  <Field label={t('contact.subject')}>
                    <Input value={form.subject} onChange={set('subject')} placeholder="Multi-site rollout for 4 clubs" />
                  </Field>
                </div>
                <div className="sm:col-span-2">
                  <Field label={t('contact.message')} hint="We reply within 24 hours, Mon–Sun.">
                    <Textarea value={form.message} onChange={set('message')} placeholder="We run 3 clubs with 1,400 members and need…" />
                  </Field>
                </div>
                <div className="sm:col-span-2 flex flex-wrap items-center gap-4">
                  <Button type="submit" loading={sending} className="!px-7 !py-3.5">
                    {sending ? 'Sending…' : t('contact.send')}
                  </Button>
                  <span className="text-xs text-muted">No spam. Ever.</span>
                </div>
              </form>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <div>
              <h2 className="font-display text-2xl font-bold">Frequently asked</h2>
              <div className="mt-5 space-y-3">
                {FAQS.map((f, i) => (
                  <div
                    key={f.q}
                    className={`overflow-hidden rounded-2xl border transition ${openFaq === i ? 'border-mint/40 bg-mint/[0.06]' : 'border-white/10 bg-white/[0.03]'}`}
                  >
                    <button
                      onClick={() => setOpenFaq(openFaq === i ? -1 : i)}
                      className="flex w-full items-center justify-between gap-4 px-5 py-4 text-start"
                    >
                      <span className="text-sm font-semibold">{f.q}</span>
                      <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border transition ${openFaq === i ? 'rotate-45 border-mint text-mint' : 'border-white/15 text-muted'}`}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6">
                          <path d="M12 5v14M5 12h14" />
                        </svg>
                      </span>
                    </button>
                    <div className={`grid transition-all duration-300 ${openFaq === i ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                      <div className="overflow-hidden">
                        <p className="px-5 pb-5 text-sm leading-relaxed text-muted">{f.a}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Locations */}
      <section className="relative py-20">
        <div className="container-x">
          <SectionHeading eyebrow="Clubs" title="Find us on three continents" sub="Same platform, local currency, local language, local timezone." />
          <div className="grid gap-5 md:grid-cols-3">
            {locations.map((l, i) => (
              <Reveal key={l._id} delay={i * 0.08}>
                <Tilt max={8} className="h-full">
                  <div className="relative h-full overflow-hidden rounded-3xl border border-white/10 bg-surface/70 p-6">
                    <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-violet/25 blur-2xl" />
                    <div className="relative flex items-start justify-between">
                      <div>
                        <p className="font-mono text-[11px] text-mint">{l.code}</p>
                        <h3 className="mt-1 font-display text-xl font-bold">{l.name}</h3>
                        <p className="mt-1 text-sm text-muted">{l.address}</p>
                      </div>
                      <Badge tone="success">{l.status}</Badge>
                    </div>
                    <div className="relative mt-5 grid grid-cols-2 gap-2">
                      <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3">
                        <p className="text-[10px] uppercase tracking-widest text-muted">Local time</p>
                        <p className="mt-1 font-mono text-sm text-bone">
                          {new Date().toLocaleTimeString('en-GB', { timeZone: l.timezone, hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3">
                        <p className="text-[10px] uppercase tracking-widest text-muted">Capacity</p>
                        <p className="mt-1 font-mono text-sm text-bone">{l.capacity}</p>
                      </div>
                    </div>
                    <div className="relative mt-4 space-y-1.5 text-sm text-muted">
                      <p>☎ {l.phone}</p>
                      <p>✉ {l.email}</p>
                      <p>🕘 {l.openHours}</p>
                    </div>
                    <div className="relative mt-4 flex flex-wrap gap-1.5">
                      {(l.facilities || []).slice(0, 3).map((f) => (
                        <span key={f} className="chip">{f}</span>
                      ))}
                    </div>
                    <div className="relative mt-5 h-24 overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(135deg,rgba(0,229,160,0.12),rgba(123,97,255,0.1))]">
                      <div className="grid h-full grid-cols-6 gap-1 p-2 opacity-40">
                        {Array.from({ length: 24 }).map((_, idx) => (
                          <span key={idx} className="rounded-sm bg-white/30" />
                        ))}
                      </div>
                      <span className="absolute left-1/2 top-1/2 grid h-8 w-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-mint/60 bg-void text-mint">
                        <span className="absolute h-8 w-8 animate-pulseRing rounded-full border border-mint/60" />
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 21s7-6.2 7-11a7 7 0 10-14 0c0 4.8 7 11 7 11z" />
                          <circle cx="12" cy="10" r="2.5" />
                        </svg>
                      </span>
                    </div>
                  </div>
                </Tilt>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Enterprise band */}
      <section className="relative pb-28">
        <div className="container-x">
          <Reveal>
            <div className="glass flex flex-col items-center justify-between gap-6 rounded-[32px] p-8 text-center sm:flex-row sm:text-start">
              <div>
                <h3 className="font-display text-xl font-bold">Evaluating GymFlow for a group of clubs?</h3>
                <p className="mt-2 text-sm text-muted">Volume pricing, SSO and a dedicated migration squad for 3+ locations.</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <a href="mailto:enterprise@gymflow.io" className="btn-primary">enterprise@gymflow.io</a>
                <span className="chip">{money(29)} / seat / month</span>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
