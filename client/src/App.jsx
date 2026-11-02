import { Suspense, lazy, useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from './lib/auth';
import { Loading } from './components/ui';
import PublicLayout from './layouts/PublicLayout';

const Home = lazy(() => import('./pages/Home'));
const About = lazy(() => import('./pages/About'));
const Gallery = lazy(() => import('./pages/Gallery'));
const Contact = lazy(() => import('./pages/Contact'));
const SignIn = lazy(() => import('./pages/SignIn'));
const Register = lazy(() => import('./pages/Register'));

const DashboardLayout = lazy(() => import('./pages/app/DashboardLayout'));
const Overview = lazy(() => import('./pages/app/Overview'));
const Members = lazy(() => import('./pages/app/Members'));
const Staff = lazy(() => import('./pages/app/Staff'));
const Classes = lazy(() => import('./pages/app/Classes'));
const Equipment = lazy(() => import('./pages/app/Equipment'));
const Finance = lazy(() => import('./pages/app/Finance'));
const CheckIns = lazy(() => import('./pages/app/CheckIns'));
const Reports = lazy(() => import('./pages/app/Reports'));
const Inbox = lazy(() => import('./pages/app/Inbox'));
const MyMembership = lazy(() => import('./pages/app/MyMembership'));
const MyClasses = lazy(() => import('./pages/app/MyClasses'));
const Settings = lazy(() => import('./pages/app/Settings'));

function Page({ children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 26, rotateX: -8 }}
      animate={{ opacity: 1, y: 0, rotateX: 0 }}
      exit={{ opacity: 0, y: -14 }}
      transition={{ duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}
      style={{ transformPerspective: 1400 }}
    >
      {children}
    </motion.div>
  );
}

function RequireAuth({ children, roles }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="grid min-h-screen place-items-center bg-void"><Loading label="Restoring session…" /></div>;
  if (!user) return <Navigate to="/signin" state={{ from: location.pathname }} replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to={user.role === 'member' ? '/app/membership' : '/app'} replace />;
  return children;
}

export default function App() {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [location.pathname]);

  return (
    <Suspense fallback={<div className="grid min-h-screen place-items-center bg-void"><Loading label="Loading GymFlow…" /></div>}>
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route element={<PublicLayout />}>
            <Route path="/" element={<Page><Home /></Page>} />
            <Route path="/about" element={<Page><About /></Page>} />
            <Route path="/gallery" element={<Page><Gallery /></Page>} />
            <Route path="/contact" element={<Page><Contact /></Page>} />
          </Route>

          <Route path="/signin" element={<Page><SignIn /></Page>} />
          <Route path="/register" element={<Page><Register /></Page>} />
          <Route path="/login" element={<Navigate to="/signin" replace />} />

          <Route
            path="/app"
            element={
              <RequireAuth>
                <DashboardLayout />
              </RequireAuth>
            }
          >
            <Route index element={<Page><Overview /></Page>} />
            <Route path="members" element={<RequireAuth roles={['admin', 'trainer']}><Page><Members /></Page></RequireAuth>} />
            <Route path="staff" element={<RequireAuth roles={['admin']}><Page><Staff /></Page></RequireAuth>} />
            <Route path="classes" element={<Page><Classes /></Page>} />
            <Route path="equipment" element={<RequireAuth roles={['admin', 'trainer']}><Page><Equipment /></Page></RequireAuth>} />
            <Route path="finance" element={<RequireAuth roles={['admin']}><Page><Finance /></Page></RequireAuth>} />
            <Route path="checkins" element={<RequireAuth roles={['admin', 'trainer']}><Page><CheckIns /></Page></RequireAuth>} />
            <Route path="reports" element={<RequireAuth roles={['admin', 'trainer']}><Page><Reports /></Page></RequireAuth>} />
            <Route path="inbox" element={<RequireAuth roles={['admin']}><Page><Inbox /></Page></RequireAuth>} />
            <Route path="membership" element={<Page><MyMembership /></Page>} />
            <Route path="my-classes" element={<Page><MyClasses /></Page>} />
            <Route path="settings" element={<Page><Settings /></Page>} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AnimatePresence>
    </Suspense>
  );
}
