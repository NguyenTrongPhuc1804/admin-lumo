import { useEffect, useState } from 'react';
import { AdminShell } from './components/AdminShell.jsx';
import { AccountsPage } from './pages/AccountsPage.jsx';
import { LoginPage } from './pages/LoginPage.jsx';
import { ModelsPage } from './pages/ModelsPage.jsx';
import { useAdminStore } from './store/adminStore.mjs';

export function App() {
  const session = useAdminStore((state) => state.session);
  const checking = useAdminStore((state) => state.checking);
  const restoreSession = useAdminStore((state) => state.restoreSession);
  const logout = useAdminStore((state) => state.logout);
  const [logoutError, setLogoutError] = useState('');

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
    setLogoutError('');
    try { await logout(); } catch (error) { setLogoutError(error.message); }
  }

  if (session.mustChangePassword) return <LoginPage key="change-password" mustChangePassword onLogout={signOut} logoutError={logoutError} />;

  const canViewModels = session.role === 'owner' || session.role === 'admin';
  const page = canViewModels && hash === '#models' ? 'models' : 'accounts';

  return (
    <AdminShell username={session.username} onLogout={signOut} page={page} canViewModels={canViewModels}>
      {page === 'models' ? <ModelsPage key={`${session.username}:${session.role}`} isOwner={session.role === 'owner'} logoutError={logoutError} /> : <AccountsPage logoutError={logoutError} />}
    </AdminShell>
  );
}
