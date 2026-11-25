import { useState } from 'react';
import { toast } from 'sonner';
import { Icon } from '../components/Icon.jsx';
import { useAdminStore } from '../store/adminStore.mjs';

export function LoginPage({ mustChangePassword = false, onLogout }) {
  const login = useAdminStore((state) => state.login);
  const changePassword = useAdminStore((state) => state.changePassword);
  const [method, setMethod] = useState('owner');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const byEmail = method === 'email';

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    setError('');
    setBusy(true);
    try {
      if (mustChangePassword) await changePassword(data.get('password'));
      else await login(data.get('username'), data.get('password'));
      const { session } = useAdminStore.getState();
      if (session && !session.mustChangePassword) {
        toast.success(mustChangePassword ? 'Đã đổi mật khẩu.' : 'Đăng nhập thành công.');
      }
    } catch (failure) {
      setError(failure.message);
    } finally {
      form.elements.password.value = '';
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center px-4 py-8">
      <form onSubmit={submit} className="grid w-full max-w-sm gap-4 rounded-xl bg-white p-6 shadow-sm">
        <span className="grid size-10 place-items-center rounded-lg bg-primary text-white"><Icon name="center_focus_strong" /></span>
        <div><h1 className="font-heading text-2xl font-bold">{mustChangePassword ? 'Đổi mật khẩu tạm' : 'Đăng nhập quản trị'}</h1><p className="mt-1 text-muted">{mustChangePassword ? 'Đặt mật khẩu mới khác mật khẩu tạm trước khi vào trang quản trị.' : 'Dùng tên đăng nhập của chủ quản trị hoặc email tài khoản web.'}</p></div>
        {!mustChangePassword && <>
          <div className="flex gap-2" role="group" aria-label="Phương thức đăng nhập">
            {[['owner', 'Tài khoản chủ'], ['email', 'Email tài khoản web']].map(([key, label]) => (
              <button key={key} type="button" className="soft-button flex-1 aria-pressed:bg-primary aria-pressed:text-white" aria-pressed={method === key} disabled={busy} onClick={() => { setMethod(key); setError(''); }}>{label}</button>
            ))}
          </div>
          <label key={method} className="grid gap-1 font-semibold">{byEmail ? 'Email' : 'Tên đăng nhập'}<input className="control" type={byEmail ? 'email' : 'text'} name="username" autoComplete="username" required maxLength={254} /></label>
        </>}
        <label key={`password-${method}`} className="grid gap-1 font-semibold">{mustChangePassword ? 'Mật khẩu mới' : 'Mật khẩu'}<input className="control" type="password" name="password" autoComplete={mustChangePassword ? 'new-password' : 'current-password'} required maxLength={512} /></label>
        {error && <p role="alert" className="text-danger">{error}</p>}
        <button disabled={busy} className="min-h-10 rounded-lg bg-primary px-4 font-semibold text-white disabled:opacity-60">{busy ? 'Đang xử lý…' : mustChangePassword ? 'Đổi mật khẩu' : 'Đăng nhập'}</button>
        {mustChangePassword && <button type="button" className="soft-button" onClick={onLogout} disabled={busy}>Đăng xuất</button>}
      </form>
    </main>
  );
}
