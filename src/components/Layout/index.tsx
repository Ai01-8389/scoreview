import { Outlet } from 'react-router-dom';
import { Sidebar } from '@/components/Layout/Sidebar';

export default function Layout() {
  return (
    <div className="flex h-screen overflow-hidden bg-[#0F172A]">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
