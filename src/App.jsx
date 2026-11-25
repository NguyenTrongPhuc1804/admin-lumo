import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { AdminShell } from './components/AdminShell.jsx';
import { AccountsPage } from './pages/AccountsPage.jsx';
import { LoginPage } from './pages/LoginPage.jsx';
import { ModelsPage } from './pages/ModelsPage.jsx';
import { QuotaPolicyPage } from './pages/QuotaPolicyPage.jsx';
import { useAdminStore } from './store/adminStore.mjs';

export function App() {
  const session = useAdminStore((state) => state.session);
  const checking = useAdminStore((state) => state.checking);
  const restoreSession = useAdminStore((state) => state.restoreSession);
  const logout = useAdminStore((state) => state.logout);
  const [hash, setHash] = useState(() => window.location.hash);

  useEffect(() => { restoreSession(); }, [restoreSession]);
  useEffect(() => {
    function syncHash() { setHash(window.location.hash); }
    window.addEventListener('hashchange', syncHash);
    return () => window.removeEventListener('hashchange', syncHash);
  }, []);
  if (checking) return <p className="p-6" role="status">Đang kiểm tra phiên đăng nhập…</p>;
  if (!session) return <LoginPage />;

  async function signOut() {
    try {
      await logout();
      toast.success('Đã đăng xuất.');
    } catch (error) {
      toast.error('Đã thoát trên trình duyệt, nhưng chưa xác nhận được đăng xuất trên máy chủ.', { description: error.message });
    }
  }

  if (session.mustChangePassword) return <LoginPage key="change-password" mustChangePassword onLogout={signOut} />;

  const canViewSettings = session.role === 'owner' || session.role === 'admin';
  const isOwner = session.role === 'owner';
  const requestedPage = hash.slice(1);
  const page = canViewSettings && ['models', 'quotas'].includes(requestedPage) ? requestedPage : 'accounts';

  return (
    <AdminShell username={session.username} onLogout={signOut} page={page} canViewSettings={canViewSettings}>
      {page === 'models' && <ModelsPage key={`${session.username}:${session.role}`} isOwner={isOwner} />}
      {page === 'quotas' && <QuotaPolicyPage key={`${session.username}:${session.role}`} isOwner={isOwner} />}
      {page === 'accounts' && <AccountsPage />}
    </AdminShell>
  );
}
