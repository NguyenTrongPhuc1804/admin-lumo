import { useRef, useState } from 'react';
import { useAdminStore } from '../store/adminStore.mjs';

export function WebAccountCreateButton({ disabled, onCreated }) {
  const createWebAccount = useAdminStore((state) => state.createWebAccount);
  const dialog = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function createAccount(event) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    form.elements.password.value = '';
    setError('');
    setBusy(true);
    try {
      const account = await createWebAccount(data.get('email'), data.get('password'), data.get('role'));
      if (account) {
        dialog.current?.close();
        onCreated(account.email || data.get('email').trim());
      }
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" className="h-10 rounded-lg bg-primary px-4 font-semibold text-white hover:bg-accent disabled:opacity-50" aria-haspopup="dialog" disabled={disabled || busy} onClick={() => dialog.current.showModal()}>
        Thêm tài khoản
      </button>
      <dialog ref={dialog} aria-labelledby="create-web-account-title" className="m-auto max-h-[calc(100%-2rem)] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-xl bg-white p-5 text-ink shadow-xl backdrop:bg-ink/40" onCancel={(event) => { if (busy) event.preventDefault(); }} onClose={(event) => {
        event.currentTarget.querySelector('form').reset();
        setError('');
      }}>
        <form onSubmit={createAccount} className="grid gap-4">
          <h2 id="create-web-account-title" className="font-heading text-lg font-bold">Thêm tài khoản web</h2>
          <p className="text-sm text-muted">Đăng nhập bằng email, không cần Google. Tài khoản phải đổi mật khẩu tạm ở lần đăng nhập đầu tiên.</p>
          <fieldset disabled={busy} className="grid min-w-0 gap-3">
            <label className="grid gap-1">Email<input className="control min-w-0" type="email" name="email" autoComplete="off" maxLength={254} required /></label>
            <label className="grid gap-1">Mật khẩu tạm<input className="control min-w-0" type="password" name="password" autoComplete="new-password" maxLength={512} required /></label>
            <label className="grid gap-1">Vai trò<select className="control" name="role" defaultValue="viewer" aria-describedby="create-web-role-help"><option value="viewer">Người dùng</option><option value="admin">Admin</option></select></label>
            <p id="create-web-role-help" className="text-sm text-muted">Vai trò Người dùng trên web chỉ có quyền xem.</p>
          </fieldset>
          {error && <p role="alert" className="text-danger">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" className="soft-button" disabled={busy} onClick={() => dialog.current.close()}>Hủy</button>
            <button type="submit" className="h-10 rounded-lg bg-primary px-4 font-semibold text-white hover:bg-accent disabled:opacity-50" disabled={busy}>{busy ? 'Đang thêm…' : 'Thêm tài khoản'}</button>
          </div>
        </form>
      </dialog>
    </>
  );
}
