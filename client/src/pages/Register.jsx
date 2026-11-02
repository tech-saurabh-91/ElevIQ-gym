import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import AuthShell from '../components/AuthShell';
import { Badge, Button, Field, Input, useToast } from '../components/ui';
import { useAuth } from '../lib/auth';
import { useLocale, CURRENCIES } from '../lib/i18n';
import api from '../lib/api';

const GOALS = ['Fat loss', 'Muscle gain', 'Endurance', 'Mobility', 'Sport performance', 'Rehab'];

const COUNTRY_CURRENCY = {
  US: 'USD', IN: 'INR', GB: 'GBP', DE: 'EUR', FR: 'EUR', ES: 'EUR', JP: 'JPY',
  BR: 'BRL', AE: 'AED', AU: 'AUD', CA: 'CAD', SG: 'SGD', ZA: 'ZAR', MX: 'MXN',
};

export default function Register() {
  const { t, money, setLocale, currency } = useLocale();
  const { register, user, loading } = useAuth();
  const navigate = useNavigate();
  const { push } = useToast();
  const [plans, setPlans] = useState([]);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    country: 'US',
    currency: 'USD',
    planCode: 'PRO',
    goals: [],
  });

  useEffect(() => {
    api.get('/plans').then((r) => setPlans(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    setForm((f) => ({ ...f, currency }));
  }, [currency]);

  if (!loading && user) return <Navigate to={user.role === 'member' ? '/app/membership' : '/app'} replace />;

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const onCountry = (e) => {
    const code = e.target.value;
    const cur = COUNTRY_CURRENCY[code] || 'USD';
    setForm((f) => ({ ...f, country: code, currency: cur }));
    setLocale({ currency: cur, country: code });
  };

  const toggleGoal = (g) =>
    setForm((f) => ({ ...f, goals: f.goals.includes(g) ? f.goals.filter((x) => x !== g) : [...f.goals, g] }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return push('Please enter your full name.', 'error');
    if (!form.email.includes('@')) return push('Enter a valid email address.', 'error');
    if (form.password.length < 6) return push('Password must be at least 6 characters.', 'error');
    const plan = plans.find((p) => p.code === form.planCode);
    setBusy(true);
    try {
      const u = await register({
        name: form.name,
        email: form.email,
        password: form.password,
        phone: form.phone,
        country: form.country,
        currency: form.currency,
        locale: t === undefined ? 'en' : undefined,
        planId: plan?._id,
        goals: form.goals,
      });
      push(`Welcome to GymFlow, ${u.name.split(' ')[0]}.`);
      navigate('/app/membership', { replace: true });
    } catch (err) {
      push(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title={t('auth.register')}
      subtitle="Create your membership in under a minute — no card required for the demo."
      footer={
        <p className="mt-6 text-center text-sm text-muted">
          {t('auth.have')}{' '}
          <Link to="/signin" className="font-semibold text-mint hover:underline">
            {t('auth.signin')}
          </Link>
        </p>
      }
    >
      <form onSubmit={submit} className="grid gap-4">
        <Field label={t('auth.name')}>
          <Input value={form.name} onChange={set('name')} placeholder="Aarav Sharma" autoComplete="name" />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('auth.email')}>
            <Input type="email" value={form.email} onChange={set('email')} placeholder="you@mail.com" autoComplete="email" />
          </Field>
          <Field label={t('auth.password')}>
            <Input type="password" value={form.password} onChange={set('password')} placeholder="min. 6 characters" autoComplete="new-password" />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('contact.phone')}>
            <Input value={form.phone} onChange={set('phone')} placeholder="+1 512 000 0000" />
          </Field>
          <Field label={t('common.country')}>
            <select value={form.country} onChange={onCountry} className="field">
              {Object.keys(COUNTRY_CURRENCY).map((c) => (
                <option key={c} value={c}>
                  {new Intl.DisplayNames(['en'], { type: 'region' }).of(c)}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div>
          <span className="label">Choose your plan</span>
          <div className="grid gap-2.5">
            {(plans.length ? plans : [{ code: 'PRO', name: 'Pro', price: 69, features: [] }]).slice(0, 4).map((p) => (
              <button
                key={p.code}
                type="button"
                onClick={() => setForm((f) => ({ ...f, planCode: p.code }))}
                className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3.5 text-start transition ${
                  form.planCode === p.code
                    ? 'border-mint/60 bg-mint/10 shadow-glow'
                    : 'border-white/10 bg-white/[0.03] hover:border-white/25'
                }`}
              >
                <div>
                  <p className="text-sm font-semibold">{p.name}</p>
                  <p className="mt-0.5 text-[11px] text-muted">{(p.features || []).slice(0, 2).join(' · ') || p.tagline}</p>
                </div>
                <div className="text-end">
                  <p className="font-display text-lg font-black">{money(p.price)}</p>
                  <p className="text-[10px] uppercase tracking-widest text-muted">{p.billing}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="label">Training goals</span>
          <div className="flex flex-wrap gap-2">
            {GOALS.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => toggleGoal(g)}
                className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${
                  form.goals.includes(g) ? 'border-violet/60 bg-violet/20 text-bone' : 'border-white/12 bg-white/5 text-muted hover:text-bone'
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        <label className="flex items-start gap-2.5 text-xs text-muted">
          <input type="checkbox" required className="mt-0.5 h-4 w-4 accent-[#00E5A0]" />
          I agree to the Terms of Service, Privacy Policy and GDPR/CCPA data processing terms.
        </label>

        <Button type="submit" loading={busy} className="mt-1 w-full !py-3.5">
          {t('auth.submitRegister')}
        </Button>

        <div className="flex items-center justify-center gap-3 pt-1">
          <Badge tone="success">Free 1-day pass</Badge>
          <span className="text-[11px] text-muted">Cancel anytime · migration included</span>
        </div>
      </form>
    </AuthShell>
  );
}
