import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { useAuth, homeFor } from '@/lib/auth';
import { useSite } from '@/lib/site';
import { Button, ErrorNote, Field, Input } from '@/components/ui';
import { Logo } from '@/site/SiteLayout';

/** One branded sign-in page for owners, staff and members. */
export default function Login() {
  const { session, login } = useAuth();
  const { site } = useSite();
  const nav = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  if (session) return <Navigate to={from ?? homeFor(session)} replace />;
  const banner = site?.site.banners.find((b) => b.active && b.imageUrl);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const s = await login(email, password);
      nav(from && s.user.role !== 'member' ? from : homeFor(s), { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen bg-bg lg:grid-cols-2">
      <div className="flex flex-col justify-center px-6 py-12 sm:px-12">
        <div className="mx-auto w-full max-w-sm">
          <Link to="/" aria-label="Back to website"><Logo className="h-12" /></Link>
          <h1 className="mt-10 font-display text-3xl font-bold tracking-tight text-ink">Welcome back</h1>
          <p className="mt-2 text-sm text-muted">Sign in to your {site?.site.brand.name ?? ''} account. Staff and members use the same page.</p>
          <form onSubmit={submit} className="mt-8 space-y-4">
            <Field label="Email"><Input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
            <Field label="Password"><Input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
            <ErrorNote error={error} />
            <Button type="submit" size="lg" className="w-full" loading={busy} icon={<Lock className="h-4 w-4" />}>Sign in</Button>
          </form>
          <p className="mt-6 text-xs text-muted">Forgot your password? Ask the gym owner or front desk to reset it.</p>
        </div>
      </div>
      <div className="relative hidden overflow-hidden bg-primary lg:block">
        {banner && <img src={banner.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-40 mix-blend-luminosity" />}
        <div className="relative flex h-full flex-col justify-end p-12 text-on-primary">
          <p className="font-display text-4xl font-bold leading-tight">{site?.site.brand.tagline || site?.site.brand.name}</p>
        </div>
      </div>
    </div>
  );
}
