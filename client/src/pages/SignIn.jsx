import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import AuthShell from '../components/AuthShell';
import { Button, Field, Input, useToast } from '../components/ui';
import { useAuth } from '../lib/auth';
import { useLocale } from '../lib/i18n';

const DEMOS = [
  { label: 'Admin', email: 'admin@gymflow.io', password: 'admin123' },
  { label: 'Trainer', email: 'marcus.reed@gymflow.io', password: 'trainer123' },
  { label: 'Member', email: 'aarav.sharma0@mail.com', password: 'member123' },
];

export default function SignIn() {
  const { t } = useLocale();
  const { login, user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { push } = useToast();
  const [form, setForm] = useState({ email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);

  if (!loading && user) return <Navigate to={user.role === 'member' ? '/app/membership' : '/app'} replace />;

  const submit = async (e) => {
    e.preventDefault();
    if (!form.email.includes('@') || form.password.length < 4) {
      push('Enter a valid email and password.', 'error');
      return;
    }
    setBusy(true);
    try {
      const u = await login(form.email, form.password);
      push(`Welcome back, ${u.name.split(' ')[0]}.`);
      const to = location.state?.from || (u.role === 'member' ? '/app/membership' : '/app');
      navigate(to, { replace: true });
    } catch (err) {
      push(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const fill = (d) => setForm({ email: d.email, password: d.password });

  return (
    <AuthShell
      title={t('auth.signin')}
      subtitle="Access your operations console, classes and membership."
      footer={
        <p className="mt-6 text-center text-sm text-muted">
          {t('auth.no')}{' '}
          <Link to="/register" className="font-semibold text-mint hover:underline">
            {t('auth.register')}
          </Link>
        </p>
      }
    >
      <form onSubmit={submit} className="grid gap-4">
        <Field label={t('auth.email')}>
          <Input
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            placeholder="you@club.com"
          />
        </Field>
        <Field label={t('auth.password')}>
          <div className="relative">
            <Input
              type={show ? 'text' : 'password'}
              autoComplete="current-password"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              placeholder="••••••••"
              className="pe-12"
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              className="absolute end-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted hover:text-mint"
            >
              {show ? 'Hide' : 'Show'}
            </button>
          </div>
        </Field>

        <div className="flex items-center justify-between text-xs">
          <label className="flex cursor-pointer items-center gap-2 text-muted">
            <input type="checkbox" className="h-4 w-4 accent-[#00E5A0]" defaultChecked />
            Keep me signed in
          </label>
          <button type="button" onClick={() => push('Password reset link sent (demo).', 'info')} className="text-muted hover:text-mint">
            Forgot password?
          </button>
        </div>

        <Button type="submit" loading={busy} className="mt-1 w-full !py-3.5">
          {t('auth.submitSignin')}
        </Button>
      </form>

      <div className="mt-7 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-mint">{t('auth.demo')}</p>
        <div className="mt-3 grid gap-2">
          {DEMOS.map((d) => (
            <button
              key={d.label}
              type="button"
              onClick={() => fill(d)}
              className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-start transition hover:border-mint/50"
            >
              <span className="text-xs font-semibold">{d.label}</span>
              <span className="font-mono text-[11px] text-muted">{d.email}</span>
            </button>
          ))}
        </div>
        <p className="mt-3 text-[10px] leading-relaxed text-muted">{t('auth.demoHint')}</p>
      </div>
    </AuthShell>
  );
}
