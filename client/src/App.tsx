import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useSite } from '@/lib/site';
import { Spinner } from '@/components/ui';
import SiteLayout from '@/site/SiteLayout';
import Home from '@/site/Home';
import { RequirePerm } from '@/admin/AdminLayout';

const Join = lazy(() => import('@/site/Join'));
const Contact = lazy(() => import('@/site/Contact'));
const Login = lazy(() => import('@/admin/Login'));
const AdminLayout = lazy(() => import('@/admin/AdminLayout'));
const Dashboard = lazy(() => import('@/admin/Dashboard'));
const WebsiteEditor = lazy(() => import('@/admin/website/WebsiteEditor'));
const PublishHistory = lazy(() => import('@/admin/website/PublishHistory'));
const Offers = lazy(() => import('@/admin/Offers'));
const Plans = lazy(() => import('@/admin/Plans'));
const Members = lazy(() => import('@/admin/Members'));
const MemberDetail = lazy(() => import('@/admin/Members').then((m) => ({ default: m.MemberDetail })));
const Leads = lazy(() => import('@/admin/Leads'));
const Billing = lazy(() => import('@/admin/Billing'));
const InvoiceDetail = lazy(() => import('@/admin/Billing').then((m) => ({ default: m.InvoiceDetail })));
const Reports = lazy(() => import('@/admin/Reports'));
const Staff = lazy(() => import('@/admin/Staff'));
const Audit = lazy(() => import('@/admin/Staff').then((m) => ({ default: m.Audit })));
const Settings = lazy(() => import('@/admin/Settings'));
const SetupWizard = lazy(() => import('@/admin/SetupWizard'));
const Ops = {
  CheckIns: lazy(() => import('@/admin/Operations').then((m) => ({ default: m.CheckIns }))),
  Classes: lazy(() => import('@/admin/Operations').then((m) => ({ default: m.Classes }))),
  Equipment: lazy(() => import('@/admin/Operations').then((m) => ({ default: m.EquipmentPage }))),
  Expenses: lazy(() => import('@/admin/Operations').then((m) => ({ default: m.ExpensesPage }))),
  Retail: lazy(() => import('@/admin/Operations').then((m) => ({ default: m.Retail }))),
  Account: lazy(() => import('@/admin/Operations').then((m) => ({ default: m.Account }))),
};
const Portal = lazy(() => import('@/portal/Portal'));
const Platform = lazy(() => import('@/platform/Platform'));

function GymUnavailable({ status, message }: { status: number; message: string }) {
  return (
    <div className="grid min-h-screen place-items-center px-6 text-center" style={{ background: '#f6f7f9', color: '#111' }}>
      <div>
        <h1 className="text-2xl font-bold">{status === 404 ? 'No gym at this address' : 'This site is unavailable'}</h1>
        <p className="mt-2 text-sm opacity-70">{message}</p>
        {import.meta.env.DEV && <p className="mt-6 text-xs opacity-60">Dev tip: add <code>?gym=&lt;slug&gt;</code> to the URL, or set VITE_DEV_TENANT.</p>}
      </div>
    </div>
  );
}

const page = (el: React.ReactNode) => <Suspense fallback={<Spinner />}>{el}</Suspense>;
const guard = (perms: Parameters<typeof RequirePerm>[0]['perms'], el: React.ReactNode) => page(<RequirePerm perms={perms}>{el}</RequirePerm>);

export default function App() {
  const { site, error, loading } = useSite();
  const loc = useLocation();

  // The vendor console doesn't belong to any gym.
  if (loc.pathname.startsWith('/platform')) return page(<Platform />);
  if (loading) return <div className="grid min-h-screen place-items-center"><Spinner /></div>;
  if (error || !site) return <GymUnavailable status={error?.status ?? 500} message={error?.message ?? 'Please try again later.'} />;

  return (
    <Routes>
      <Route element={<SiteLayout />}>
        <Route index element={<Home />} />
        <Route path="join" element={page(<Join />)} />
        <Route path="contact" element={page(<Contact />)} />
      </Route>
      <Route path="login" element={page(<Login />)} />
      <Route path="signin" element={<Navigate to="/login" replace />} />
      <Route path="portal" element={page(<Portal />)} />
      <Route path="admin" element={page(<AdminLayout />)}>
        <Route index element={guard(['dashboard.view'], <Dashboard />)} />
        <Route path="setup" element={guard(['settings.manage'], <SetupWizard />)} />
        <Route path="website" element={guard(['website.manage'], <WebsiteEditor />)} />
        <Route path="website/publish" element={guard(['website.manage'], <PublishHistory />)} />
        <Route path="offers" element={guard(['offers.manage'], <Offers />)} />
        <Route path="plans" element={guard(['plans.manage'], <Plans />)} />
        <Route path="members" element={guard(['members.read'], <Members />)} />
        <Route path="members/:id" element={guard(['members.read'], <MemberDetail />)} />
        <Route path="leads" element={guard(['leads.read', 'leads.manage'], <Leads />)} />
        <Route path="billing" element={guard(['billing.read', 'payments.record'], <Billing />)} />
        <Route path="billing/:id" element={guard(['billing.read', 'payments.record'], <InvoiceDetail />)} />
        <Route path="expenses" element={guard(['expenses.manage'], <Ops.Expenses />)} />
        <Route path="reports" element={guard(['reports.read', 'billing.read'], <Reports />)} />
        <Route path="staff" element={guard(['staff.manage'], <Staff />)} />
        <Route path="settings" element={guard(['settings.manage'], <Settings />)} />
        <Route path="audit" element={guard(['audit.read'], <Audit />)} />
        <Route path="checkins" element={guard(['checkins.manage'], <Ops.CheckIns />)} />
        <Route path="classes" element={guard(['classes.read', 'classes.manage'], <Ops.Classes />)} />
        <Route path="equipment" element={guard(['equipment.manage'], <Ops.Equipment />)} />
        <Route path="retail" element={guard(['retail.manage'], <Ops.Retail />)} />
        <Route path="account" element={page(<Ops.Account />)} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
