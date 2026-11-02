import { Link } from 'react-router-dom';
import HeroScene from '../components/three/HeroScene';
import { Logo, LocaleMenu } from '../components/Navbar';
import { useLocale } from '../lib/i18n';

export default function AuthShell({ title, subtitle, children, footer }) {
  const { t } = useLocale();

  return (
    <div className="relative min-h-screen bg-void">
      <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
        {/* Visual side */}
        <div className="relative hidden overflow-hidden lg:block">
          <div className="absolute inset-0">
            <HeroScene className="h-full w-full" />
          </div>
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_30%_30%,transparent_10%,rgba(5,5,10,0.9)_75%)]" />
          <div className="absolute inset-x-0 bottom-0 z-10 p-12">
            <span className="eyebrow">GymFlow Console</span>
            <h2 className="mt-5 max-w-md font-display text-4xl font-black leading-[0.98]">
              Every rep, <span className="text-gradient">every rupee, every rep counted.</span>
            </h2>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted">
              Memberships, classes, coaches, equipment and revenue — one console, six languages, twelve currencies.
            </p>
            <div className="mt-7 flex flex-wrap gap-6">
              {[
                { k: '500+', v: 'members / club' },
                { k: '99.9%', v: 'uptime' },
                { k: '<500ms', v: 'API p95' },
              ].map((s) => (
                <div key={s.k}>
                  <p className="font-display text-2xl font-black text-mint">{s.k}</p>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-muted">{s.v}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Form side */}
        <div className="relative flex flex-col">
          <div className="flex items-center justify-between px-6 py-6 sm:px-10">
            <Logo />
            <div className="flex items-center gap-3">
              <LocaleMenu />
              <Link to="/" className="text-sm text-muted transition hover:text-bone">
                {t('nav.home')}
              </Link>
            </div>
          </div>

          <div className="flex flex-1 items-center justify-center px-6 pb-16 sm:px-10">
            <div className="w-full max-w-md">
              <div className="mb-8">
                <h1 className="font-display text-3xl font-black tracking-tight">{title}</h1>
                <p className="mt-2 text-sm text-muted">{subtitle}</p>
              </div>
              {children}
              {footer}
            </div>
          </div>

          <div className="border-t border-white/10 px-6 py-5 text-center text-[11px] text-muted sm:px-10">
            © {new Date().getFullYear()} GymFlow · Encrypted in transit & at rest · RBAC · GDPR ready
          </div>
        </div>
      </div>
    </div>
  );
}
