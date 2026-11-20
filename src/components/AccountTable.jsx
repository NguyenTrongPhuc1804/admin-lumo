import { Icon } from './Icon.jsx';
import { roles, statuses } from '../utils/accounts.mjs';

const columns = ['Người dùng', 'Vai trò (Role)', 'Gói & Hạn mức dịch', 'Đăng nhập gần nhất', 'Trạng thái', 'Thao tác'];
const date = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' });
const number = new Intl.NumberFormat('en-US');

function AccountRow({ account, checked, onChange, onChangeStatus, changing, canChangeUsers, isOwner, onEditPermission, onChangeWebRole }) {
  const isWeb = account.provider === 'web';
  const [role, icon, tone] = roles[account.role] ?? roles.user;
  const blocked = account.status === 'blocked';
  const active = account.status === 'active';
  const name = account.name || account.email || account.id;
  const initials = name.trim().split(/\s+/).slice(0, 2).map((word) => word[0]).join('').toUpperCase();
  const percent = account.dailyLimit > 0 ? Math.round(account.usageCount / account.dailyLimit * 100) : 0;
  const canGrant = isOwner && active && account.provider === 'google' && account.email && !account.webAdminGranted;
  const providerLabel = isWeb ? 'Chỉ dùng web' : account.provider === 'google' ? 'Google' : '';
  return (
    <tr className={`border-b border-line/40 hover:bg-panel/70 ${blocked ? 'bg-blush/20' : ''}`}>
      {canChangeUsers && <td className="py-3 pl-5 pr-2">{!isWeb && <input type="checkbox" className="size-4 accent-primary" aria-label={`Chọn ${name}`} checked={checked} onChange={(event) => onChange(event.target.checked)} />}</td>}
      <td className="px-3 py-3">
        <div className="flex min-w-48 items-center gap-3">
          <span aria-hidden="true" className={`grid size-9 shrink-0 place-items-center rounded-full font-heading font-bold ${blocked ? 'bg-blush text-danger' : tone}`}>{initials}</span>
          <div>
            <span className={`block font-semibold ${blocked ? 'text-danger' : ''}`}>{name}</span>
            {name !== account.email && <span className="block text-xs text-muted">{account.email || '—'}</span>}
            {providerLabel && <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${isWeb ? 'bg-lavender text-violet-950' : 'bg-panel text-muted'}`}>{providerLabel}</span>}
          </div>
        </div>
      </td>
      <td className="px-3 py-3"><span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-1 text-[10px] font-bold tracking-wide uppercase ${tone}`}><Icon name={icon} className="text-[13px]" />{role}</span></td>
      <td className="min-w-48 px-3 py-3">
        {isWeb ? '—' : <>
          <div className="flex justify-between gap-2 font-mono text-[11px] font-semibold"><span>{account.role === 'admin' ? 'Không giới hạn' : `${number.format(account.usageCount)} / ${number.format(account.dailyLimit)}`}</span><span className={percent >= 100 ? 'text-danger' : 'text-primary'}>{account.plan || '—'}</span></div>
          {account.role !== 'admin' && <div aria-hidden="true" className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line"><div style={{ width: `${Math.min(100, percent)}%` }} className={`h-full rounded-full ${percent >= 100 ? 'bg-danger' : 'bg-primary'}`} /></div>}
        </>}
      </td>
      <td className="px-3 py-3 whitespace-nowrap">{account.lastLoginAt ? date.format(new Date(account.lastLoginAt)) : '—'}</td>
      <td className="px-3 py-3 text-center"><span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-1 text-[11px] font-semibold ${blocked ? 'bg-blush text-danger' : active ? 'bg-mint/40 text-primary' : 'bg-panel text-muted'}`}><span aria-hidden="true" className="size-1.5 rounded-full bg-current" />{statuses[account.status]}</span></td>
      {canChangeUsers && <td className="px-3 py-3">
        {isWeb ? isOwner && <div className="flex flex-wrap justify-end gap-1">
          <select className="control" aria-label={`Vai trò của ${name}`} value={account.webAdminRole} disabled={changing} onChange={(event) => onChangeWebRole(account, event.target.value)}>
            <option value="viewer">Người dùng</option>
            <option value="admin">Admin</option>
          </select>
          <button type="button" className="soft-button" disabled={changing} onClick={() => onEditPermission(account, 'reset-password')}>Đặt lại mật khẩu</button>
          <button type="button" className="soft-button text-danger" disabled={changing} onClick={() => onEditPermission(account, 'revoke')}>Thu hồi quyền</button>
        </div> : <>
          {account.webAdminGranted && <p className="mb-1 text-right text-xs font-semibold text-primary">Đã cấp quyền web admin</p>}
          <div className="flex flex-wrap justify-end gap-1">
            {(isOwner || (!account.webAdminGranted && account.role !== 'admin')) && <button type="button" className={`soft-button whitespace-nowrap ${blocked ? 'text-primary' : 'text-danger'}`} disabled={changing} onClick={() => onChangeStatus(account)}><Icon name={blocked ? 'lock_open' : 'lock'} />{blocked ? 'Mở khóa' : 'Khóa'}</button>}
            {canGrant && <button type="button" className="soft-button" disabled={changing} onClick={() => onEditPermission(account, 'grant')}>Cấp quyền web admin</button>}
            {isOwner && account.webAdminGranted && <>
              {active && <button type="button" className="soft-button" disabled={changing} onClick={() => onEditPermission(account, 'reset-password')}>Đặt lại mật khẩu</button>}
              <button type="button" className="soft-button text-danger" disabled={changing} onClick={() => onEditPermission(account, 'revoke')}>Thu hồi quyền</button>
            </>}
          </div>
        </>}
      </td>}
    </tr>
  );
}

export function AccountTable({ result, selected, toggleRows, pageSize, onPageChange, onPageSizeChange, onChangeStatus, changing, canChangeUsers, isOwner, onEditPermission, onChangeWebRole }) {
  const { rows, total, page, pageCount, start } = result;
  const pageIds = rows.filter(({ provider }) => provider !== 'web').map(({ id }) => id);
  const checkedCount = pageIds.filter((id) => selected.includes(id)).length;
  return (
    <section aria-label="Danh sách tài khoản" className="min-w-0 overflow-hidden rounded-xl bg-white shadow-sm">
      {canChangeUsers && selected.length > 0 && <div className="flex flex-wrap items-center justify-between gap-2 bg-line px-5 py-2.5">
        <span role="status" className="font-semibold text-primary">{selected.length} tài khoản được chọn</span>
        <div className="flex flex-wrap gap-2"><button className="soft-button" onClick={() => toggleRows(selected, false)}>Bỏ chọn tất cả</button><button className="soft-button" disabled>Cấp +500 lượt</button><button className="soft-button" disabled>Đổi vai trò</button><button className="soft-button disabled:bg-blush disabled:text-danger" disabled>Khóa hàng loạt</button></div>
      </div>}
      <div role="region" aria-label="Bảng tài khoản, có thể cuộn ngang" tabIndex={0} className="overflow-x-auto focus-visible:outline-offset-[-2px]">
        <table className="w-full text-left">
          <thead className="bg-panel text-[10px] font-bold tracking-wider text-muted uppercase"><tr>
            {canChangeUsers && <th scope="col" className="py-3 pl-5 pr-2"><input type="checkbox" className="size-4 accent-primary" aria-label="Chọn tất cả tài khoản có thể chọn trên trang" disabled={!pageIds.length} checked={pageIds.length > 0 && checkedCount === pageIds.length} ref={(input) => { if (input) input.indeterminate = checkedCount > 0 && checkedCount < pageIds.length; }} onChange={(event) => toggleRows(pageIds, event.target.checked)} /></th>}
            {(canChangeUsers ? columns : columns.slice(0, -1)).map((label, index) => <th scope="col" className={`px-3 py-3 whitespace-nowrap ${index === 4 ? 'text-center' : ''} ${index === 5 ? 'text-right' : ''}`} key={label}>{label}</th>)}
          </tr></thead>
          <tbody>
            {rows.map((account) => <AccountRow key={`${account.provider}:${account.id}`} account={account} checked={selected.includes(account.id)} onChange={(checked) => toggleRows([account.id], checked)} onChangeStatus={onChangeStatus} changing={changing} canChangeUsers={canChangeUsers} isOwner={isOwner} onEditPermission={onEditPermission} onChangeWebRole={onChangeWebRole} />)}
            {!rows.length && <tr><td colSpan={canChangeUsers ? columns.length + 1 : columns.length - 1} className="p-8 text-center text-muted">Không tìm thấy tài khoản phù hợp.</td></tr>}
          </tbody>
        </table>
      </div>
      <footer className="flex flex-wrap items-center justify-between gap-3 bg-panel px-5 py-3 text-xs text-muted">
        <div className="flex flex-wrap items-center gap-3">
          <span>Hiển thị <strong className="text-ink">{total ? `${start + 1}–${start + rows.length}` : '0'}</strong> / {total} tài khoản</span>
          <label className="flex items-center gap-1.5">Dòng/trang: <select className="rounded bg-white p-1 font-mono" value={pageSize} onChange={(event) => onPageSizeChange(Number(event.target.value))}>{[5, 10, 25].map((size) => <option key={size}>{size}</option>)}</select></label>
        </div>
        <nav aria-label="Phân trang tài khoản" className="flex items-center gap-1">
          <button className="soft-button min-h-8 px-1.5" aria-label="Trang trước" disabled={page === 1} onClick={() => onPageChange(page - 1)}><Icon name="chevron_left" /></button>
          {Array.from({ length: Math.min(5, pageCount) }, (_, index) => Math.max(1, Math.min(page - 2, pageCount - 4)) + index).map((number) => (
            <button key={number} type="button" aria-label={`Trang ${number}`} aria-current={page === number ? 'page' : undefined} onClick={() => onPageChange(number)} className={`size-8 rounded-lg font-mono font-semibold ${page === number ? 'bg-primary text-white' : 'bg-white hover:bg-line'}`}>{number}</button>
          ))}
          <button className="soft-button min-h-8 px-1.5" aria-label="Trang sau" disabled={page === pageCount} onClick={() => onPageChange(page + 1)}><Icon name="chevron_right" /></button>
        </nav>
      </footer>
    </section>
  );
}
