import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Lock } from 'lucide-react';
import { useAuth, homeFor } from '@/lib/auth';
import { useSite } from '@/lib/site';
import { Button, ErrorNote, Field, Input } from '@/components/ui';

/**
 * One fully branded sign-in page for owners, staff and members: the gym's banner photo as a
 * full background under a brand-coloured overlay, with the logo above the form.
 */
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
  const brand = site?.site.brand;
  const banner = site?.site.banners.find((b) => b.active && b.imageUrl)?.imageUrl || site?.site.about.imageUrl;
  // The overlay is dark, so prefer the light-on-dark logo when the gym provided one.
  const logo = brand?.logoDarkUrl || brand?.logoUrl;

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
    <div className="relative isolate flex min-h-[100svh] items-center justify-center overflow-hidden px-4 py-12">
      {banner && <img src={banner} alt="" className="absolute inset-0 -z-20 h-full w-full object-cover" fetchPriority="high" />}
      {/* Brand-coloured overlay: primary -> secondary, dark enough for white text on any photo. */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/90 via-primary/75 to-secondary/90" />
      <div className="absolute inset-0 -z-10 bg-black/35" />

      <Link to="/" className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-black/25 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur hover:bg-black/40 sm:left-6 sm:top-6">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to website
      </Link>

      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center text-white">
          {logo ? (
            <img src={logo} alt={brand?.name} className="h-16 w-auto max-w-[220px] object-contain drop-shadow-lg" />
          ) : (
            <span className="font-display text-3xl font-extrabold tracking-tight drop-shadow">{brand?.name}</span>
          )}
          {brand?.tagline && <p className="mt-3 text-sm text-white/85">{brand.tagline}</p>}
        </div>

        <div className="rounded-brand border border-white/20 bg-surface/95 p-7 shadow-2xl backdrop-blur-md">
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Welcome back</h1>
          <p className="mt-1 text-sm text-muted">Sign in to {brand?.name ?? 'your gym'}. Staff and members use the same page.</p>
          <form onSubmit={submit} className="mt-6 space-y-4">
            <Field label="Email"><Input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
            <Field label="Password"><Input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
            <ErrorNote error={error} />
            <Button type="submit" size="lg" className="w-full" loading={busy} icon={<Lock className="h-4 w-4" />}>Sign in</Button>
          </form>
          <p className="mt-5 text-center text-xs text-muted">Forgot your password? Ask the gym owner or front desk to reset it.</p>
        </div>
      </div>
    </div>
  );
}
