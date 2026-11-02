import { Outlet, useLocation } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

export default function PublicLayout() {
  const { pathname } = useLocation();
  return (
    <div className="relative min-h-screen bg-void">
      <div className="pointer-events-none fixed inset-0 bg-radial-fade opacity-70" />
      <div className="pointer-events-none fixed inset-0 grid-bg opacity-[0.55]" />
      <Navbar key={pathname} />
      <main className="relative">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
