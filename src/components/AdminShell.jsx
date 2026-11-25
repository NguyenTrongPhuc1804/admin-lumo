import { useState } from 'react';
import { Icon } from './Icon.jsx';

const navigation = [
  ['grid_view', 'Dashboard Tổng quan'], ['manage_accounts', 'Quản lý Tài khoản', 'accounts'],
  ['neurology', 'Quản lý Model AI', 'models'], ['loyalty', 'Gói & Lượt miễn phí', 'quotas'],
  ['terminal', 'Nhật ký Hệ thống'], ['tune', 'Cấu hình Hệ thống'],
];

export function AdminShell({ children, username, onLogout, page, canViewSettings }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="min-h-screen lg:pl-72">
      <aside id="admin-menu" className={`${menuOpen ? 'flex' : 'hidden'} fixed inset-y-0 left-0 z-50 w-72 flex-col overflow-y-auto bg-white shadow-md lg:flex`}>
        <div className="flex h-16 shrink-0 items-center gap-2.5 border-b border-line/60 px-5">
          <span className="grid size-8 place-items-center rounded-lg bg-primary text-white"><Icon name="center_focus_strong" /></span>
          <div className="flex-1"><p className="font-heading text-base leading-tight font-bold">Lumo Lens</p><p className="text-[10px] font-bold tracking-wider text-primary uppercase">Admin Engine</p></div>
          <span className="rounded bg-panel px-2 py-1 font-mono text-[10px] text-muted">v2.4.1</span>
          <button type="button" className="soft-button p-2 lg:hidden" aria-label="Đóng menu" onClick={() => setMenuOpen(false)}><Icon name="close" /></button>
        </div>
        <p className="mt-2 mb-1 px-5 text-[10px] font-bold tracking-wider text-muted uppercase">Hạ tầng &amp; Vận hành</p>
        <nav aria-label="Quản trị" className="grid gap-1 px-3">
          {navigation.map(([icon, label, route]) => {
            if ((route === 'models' || route === 'quotas') && !canViewSettings) return null;
            if (!route) return <span key={icon} aria-disabled="true" title="Chưa khả dụng trong bản demo" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted"><Icon name={icon} />{label}</span>;
            const active = route === page;
            return (
              <a key={icon} href={`#${route}`} aria-current={active ? 'page' : undefined} onClick={() => setMenuOpen(false)} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold ${active ? 'bg-accent text-white shadow-sm' : 'text-muted hover:bg-panel hover:text-ink'}`}><Icon name={icon} />{label}</a>
            );
          })}
        </nav>
      </aside>
      {menuOpen && <button type="button" aria-label="Đóng điều hướng" onClick={() => setMenuOpen(false)} className="fixed inset-0 z-40 bg-ink/30 lg:hidden" />}
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-line/60 bg-surface/95 px-4 sm:px-6">
        <button type="button" className="soft-button p-2 lg:hidden" aria-label="Mở menu" aria-controls="admin-menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}><Icon name="menu" /></button>
        <div className="relative hidden min-w-0 max-w-md flex-1 sm:block">
          <Icon name="search" className="absolute top-3 left-3 text-muted" />
          <input className="control w-full pl-10" aria-label="Tìm kiếm toàn hệ thống (chưa khả dụng)" placeholder="Tìm kiếm OCR token, người dùng, model ID..." disabled />
        </div>
        <div className="ml-auto flex items-center gap-3">
          <button type="button" className="soft-button" onClick={onLogout}>Đăng xuất</button>
          <div className="flex items-center gap-2 border-l border-line pl-3">
            <div className="text-right"><p className="max-w-32 truncate text-xs font-bold" title={username}>{username}</p><p className="text-[9px] font-semibold uppercase tracking-wide text-muted">Quản trị nội bộ</p></div>
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-white"><Icon name="person" /></span>
          </div>
        </div>
      </header>
      <main id={page} className="grid min-w-0 scroll-mt-16 gap-5 px-4 py-5 sm:px-6">
        {children}
      </main>
    </div>
  );
}
