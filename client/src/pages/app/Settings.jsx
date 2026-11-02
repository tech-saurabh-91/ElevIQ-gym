import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Field, Input, Select, Tabs, useToast } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { useLocale, CURRENCIES, LANGUAGES } from '../../lib/i18n';
import api from '../../lib/api';

export default function Settings() {
  const { user, setUser, logout, refresh } = useAuth();
  const { currency, setLocale, money, lang, t } = useLocale();
  const { push } = useToast();
  const navigate = useNavigate();
  const [tab, setTab] = useState('profile');
  const [profile, setProfile] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    country: user?.country || 'US',
    currency: user?.currency || currency,
    locale: user?.locale || lang,
  });
  const [pwd, setPwd] = useState({ currentPassword: '', newPassword: '' });
  const [busy, setBusy] = useState(false);
  const [pwdBusy, setPwdBusy] = useState(false);

  const saveProfile = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api.put('/auth/me', profile);
      setUser(res.user);
      setLocale({ currency: profile.currency, country: profile.country, lang: profile.locale });
      push('Profile updated.');
      refresh();
    } catch (err) {
      push(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const savePassword = async (e) => {
    e.preventDefault();
    if (pwd.newPassword.length < 6) return push('New password must be at least 6 characters.', 'error');
    setPwdBusy(true);
    try {
      await api.put('/auth/password', pwd);
      push('Password changed.');
      setPwd({ currentPassword: '', newPassword: '' });
    } catch (err) {
      push(err.message, 'error');
    } finally {
      setPwdBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[11px] uppercase tracking-[0.24em] text-mint">Settings</p>
        <h2 className="mt-1 font-display text-3xl font-black tracking-tight">Account & preferences</h2>
        <p className="mt-1 text-sm text-muted">Signed in as {user?.email} · role {user?.role}</p>
      </div>

      <Tabs
        tabs={[
          { value: 'profile', label: 'Profile' },
          { value: 'locale', label: 'Region & language' },
          { value: 'security', label: 'Security' },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'profile' && (
        <form onSubmit={saveProfile} className="grid max-w-3xl gap-4 rounded-3xl border border-white/10 bg-surface/60 p-6 sm:grid-cols-2">
          <div className="sm:col-span-2 flex items-center gap-4">
            <span className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-mint to-violet font-display text-xl font-black text-void">
              {(user?.name || '?').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
            </span>
            <div>
              <p className="font-display text-lg font-bold">{user?.name}</p>
              <p className="text-xs text-muted">{user?.email}</p>
            </div>
          </div>
          <Field label="Full name"><Input value={profile.name} onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))} /></Field>
          <Field label="Phone"><Input value={profile.phone} onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))} /></Field>
          <Field label="Country">
            <Select value={profile.country} onChange={(e) => setProfile((p) => ({ ...p, country: e.target.value }))}>
              {['US', 'IN', 'GB', 'DE', 'FR', 'ES', 'JP', 'BR', 'AE', 'AU', 'CA', 'SG', 'ZA', 'MX'].map((c) => (
                <option key={c} value={c}>{new Intl.DisplayNames(['en'], { type: 'region' }).of(c)}</option>
              ))}
            </Select>
          </Field>
          <Field label="Currency">
            <Select value={profile.currency} onChange={(e) => setProfile((p) => ({ ...p, currency: e.target.value }))}>
              {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.country}</option>)}
            </Select>
          </Field>
          <div className="sm:col-span-2">
            <Button type="submit" loading={busy}>Save changes</Button>
          </div>
        </form>
      )}

      {tab === 'locale' && (
        <div className="grid max-w-3xl gap-5 rounded-3xl border border-white/10 bg-surface/60 p-6">
          <div>
            <span className="label">{t('common.language')}</span>
            <div className="flex flex-wrap gap-2">
              {LANGUAGES.map((l) => (
                <button
                  key={l.code}
                  onClick={() => setLocale({ lang: l.code })}
                  dir={l.dir}
                  className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
                    lang === l.code ? 'border-mint bg-mint text-void' : 'border-white/12 bg-white/5 text-muted hover:text-bone'
                  }`}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="label">{t('common.country')}</span>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {CURRENCIES.map((c) => (
                <button
                  key={c.code}
                  onClick={() => setLocale({ currency: c.code })}
                  className={`rounded-xl border px-3 py-2.5 text-start text-xs transition ${
                    currency === c.code ? 'border-violet bg-violet/15 text-bone' : 'border-white/10 bg-white/5 text-muted hover:text-bone'
                  }`}
                >
                  <span className="block font-semibold">{c.code}</span>
                  <span className="block text-[10px] text-muted">{c.country}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-xs text-muted">
            Displayed prices convert from a USD base rate: $69 Pro plan shows as{' '}
            <span className="font-semibold text-bone">{money(69)}</span>. Reporting always stores the base currency.
          </div>
        </div>
      )}

      {tab === 'security' && (
        <div className="grid max-w-3xl gap-5">
          <form onSubmit={savePassword} className="grid gap-4 rounded-3xl border border-white/10 bg-surface/60 p-6">
            <h3 className="font-display text-lg font-bold">Change password</h3>
            <Field label="Current password">
              <Input type="password" value={pwd.currentPassword} onChange={(e) => setPwd((p) => ({ ...p, currentPassword: e.target.value }))} required />
            </Field>
            <Field label="New password" hint="Minimum 6 characters.">
              <Input type="password" value={pwd.newPassword} onChange={(e) => setPwd((p) => ({ ...p, newPassword: e.target.value }))} required />
            </Field>
            <div>
              <Button type="submit" loading={pwdBusy}>Update password</Button>
            </div>
          </form>

          <div className="rounded-3xl border border-coral/30 bg-coral/[0.06] p-6">
            <h3 className="font-display text-lg font-bold text-coral">Session</h3>
            <p className="mt-2 text-sm text-muted">Signing out clears the local token and returns you to the public site.</p>
            <div className="mt-4 flex gap-3">
              <Button
                variant="coral"
                onClick={() => {
                  logout();
                  navigate('/');
                }}
              >
                Log out everywhere
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
