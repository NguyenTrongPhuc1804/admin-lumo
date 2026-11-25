import { useState } from 'react';
import { toast } from 'sonner';
import { AccountTable } from '../components/AccountTable.jsx';
import { Icon } from '../components/Icon.jsx';
import { WebAccountCreateButton } from '../components/WebAccountsSection.jsx';
import { useAdminStore } from '../store/adminStore.mjs';
import { roles, statuses } from '../utils/accounts.mjs';

export function AccountsPage() {
  const {
    session, filters, result, selected, update, toggleRows, reset, goToPage, loading, listError, load,
    changeStatus, changing, changeWebAdmin, changeWebAccountRole, resetWebAccountPassword, revokeWebAccount,
  } = useAdminStore();
  const [permission, setPermission] = useState(null);
  const [permissionError, setPermissionError] = useState('');
  const [savingPermission, setSavingPermission] = useState(false);
  const isOwner = session.role === 'owner';
  const isWebPermission = permission?.account.provider === 'web';

  function editPermission(account, action) {
    setPermissionError('');
    setPermission({ account, action });
  }

  async function changeWebRole(account, role) {
    if (!isOwner || savingPermission) return;
    setPermissionError('');
    setSavingPermission(true);
    try {
      if (await changeWebAccountRole(account.id, role)) toast.success('Đã cập nhật vai trò tài khoản.');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSavingPermission(false);
    }
  }

  async function submitPermission(event) {
    event.preventDefault();
    if (!isOwner || savingPermission) return;
    const form = event.currentTarget;
    const password = new FormData(form).get('password') ?? undefined;
    setSavingPermission(true);
    setPermissionError('');
    try {
      const { account, action } = permission;
      const result = !isWebPermission ? await changeWebAdmin(account.id, action, password)
        : action === 'revoke' ? await revokeWebAccount(account.id)
        : await resetWebAccountPassword(account.id, password);
      if (result) {
        toast.success({ grant: 'Đã cấp quyền web admin.', revoke: 'Đã thu hồi quyền truy cập web.', 'reset-password': 'Đã đặt lại mật khẩu.' }[action]);
        setPermission(null);
      }
    } catch (error) {
      setPermissionError(error.message);
    } finally {
      form.reset();
      setSavingPermission(false);
    }
  }

  async function confirmStatus(account) {
    const action = account.status === 'blocked' ? 'Mở khóa' : 'Khóa';
    const name = account.name || account.email || account.id;
    if (!window.confirm(`${action} tài khoản ${name}?`)) return;
    try {
      if (await changeStatus(account)) toast.success(`Đã ${action.toLowerCase()} tài khoản ${name}.`);
    } catch (error) {
      toast.error(error.message);
    }
  }

  return (
    <>
      <section className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight sm:text-[32px]">Quản lý Tài khoản</h1>
          <p className="mt-1 max-w-[70ch] text-muted">Quản trị phân quyền, trạng thái kích hoạt và theo dõi mức tiêu thụ tài nguyên theo người dùng.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="soft-button" disabled><Icon name="tune" />Bộ lọc nâng cao</button>
          <button className="soft-button" disabled><Icon name="file_download" />Xuất CSV/Excel</button>
          {isOwner && <WebAccountCreateButton disabled={changing || savingPermission || !!permission} />}
        </div>
      </section>
      {isOwner && permission && <form key={`${permission.account.id}:${permission.action}`} onSubmit={submitPermission} className="grid gap-2 rounded-xl bg-white p-4 shadow-sm">
        <h2 className="font-semibold break-all">{permission.action === 'grant' ? 'Cấp quyền web admin' : permission.action === 'revoke' ? (isWebPermission ? 'Thu hồi quyền truy cập web' : 'Thu hồi quyền web admin') : 'Đặt lại mật khẩu'}: {permission.account.webAdminLoginEmail || permission.account.email}</h2>
        {permission.action === 'revoke' ? <p>{isWebPermission ? 'Tài khoản này sẽ không thể đăng nhập web nữa và các phiên hiện tại sẽ hết hiệu lực.' : 'Phiên web admin hiện tại của tài khoản này sẽ hết hiệu lực.'}</p> : (
          <label className="grid max-w-sm gap-1">Mật khẩu tạm<input className="control" type="password" name="password" autoComplete="new-password" maxLength={512} required /></label>
        )}
        {permissionError && <p role="alert" className="text-danger">{permissionError}</p>}
        <div className="flex gap-2">
          <button className="soft-button" disabled={savingPermission}>Xác nhận</button>
          <button className="soft-button" type="button" disabled={savingPermission} onClick={() => { setPermission(null); setPermissionError(''); }}>Hủy</button>
        </div>
      </form>}
      <section aria-label="Lọc tài khoản" className="flex flex-wrap gap-2 rounded-xl bg-white p-3 shadow-sm">
        <label className="relative min-w-0 basis-full lg:flex-1">
          <span className="sr-only">Tìm tài khoản</span>
          <Icon name="search" className="pointer-events-none absolute top-3 left-3 text-muted" />
          <input type="search" className="control w-full pl-10" placeholder="Tìm theo email, họ tên hoặc User ID..." value={filters.query} onChange={(event) => update('query', event.target.value)} />
        </label>
        <select aria-label="Vai trò" className="control max-w-full" value={filters.role} onChange={(event) => update('role', event.target.value)}>
          <option value="">Tất cả vai trò</option>
          {['user', 'admin'].map((key) => <option key={key} value={key}>{roles[key][0]}</option>)}
        </select>
        <select aria-label="Trạng thái" className="control max-w-full" value={filters.status} onChange={(event) => update('status', event.target.value)}>
          <option value="">Tất cả trạng thái</option>
          {['active', 'blocked'].map((key) => <option key={key} value={key}>{statuses[key]}</option>)}
        </select>
        <button type="button" className="soft-button h-10" aria-label="Đặt lại bộ lọc" title="Đặt lại bộ lọc" onClick={reset}><Icon name="restart_alt" /></button>
      </section>
      {listError && <p role="alert" className="text-danger">{listError} <button className="soft-button" onClick={load}>Thử lại</button></p>}
      {loading ? <p role="status">Đang tải tài khoản…</p> : <AccountTable
        result={result} selected={selected} toggleRows={toggleRows} pageSize={filters.pageSize}
        onPageChange={goToPage} onPageSizeChange={(size) => update('pageSize', size)}
        onChangeStatus={confirmStatus} changing={changing || savingPermission || !!permission}
        canChangeUsers={isOwner || session.role === 'admin'}
        isOwner={isOwner} onEditPermission={editPermission} onChangeWebRole={changeWebRole}
      />}
    </>
  );
}
