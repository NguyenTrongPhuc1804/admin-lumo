import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { createAdminStore } from './store/adminStore.mjs';

test('bảng hiển thị tài khoản web và Google; chỉ owner có thao tác web', async () => {
  const vite = await createServer({
    configFile: false,
    envFile: false,
    optimizeDeps: { noDiscovery: true, include: [] },
    esbuild: { jsx: 'automatic' },
    server: { middlewareMode: true, watch: null, ws: false },
  });
  try {
    const { AccountTable } = await vite.ssrLoadModule('/src/components/AccountTable.jsx');
    const render = (isOwner, canChangeUsers) => renderToStaticMarkup(createElement(AccountTable, {
      result: { rows: [
        { id: 'web-1', provider: 'web', email: 'web@example.com', name: '', role: 'user', webAdminRole: 'viewer', status: 'active', lastLoginAt: null },
        { id: 'google-1', provider: 'google', email: 'google@example.com', name: 'Google User', role: 'user', status: 'active', lastLoginAt: null, plan: 'Cơ bản', usageCount: 4, dailyLimit: 10 },
      ], total: 2, page: 1, pageCount: 1, start: 0 },
      selected: [], pageSize: 10, isOwner, canChangeUsers,
    }));
    const [webRow, googleRow] = render(true, true).match(/<tbody>(.*?)<\/tbody>/s)[1].match(/<tr\b.*?<\/tr>/gs);
    assert.match(webRow, /web@example\.com/);
    assert.match(webRow, /Chỉ dùng web/);
    assert.match(webRow, /Người dùng/);
    assert.match(webRow, /<td[^>]*>—<\/td>/);
    assert.match(webRow, /<option value="viewer" selected="">Người dùng<\/option>/);
    assert.match(webRow, /Đặt lại mật khẩu/);
    assert.match(webRow, /Thu hồi quyền/);
    assert.doesNotMatch(webRow, /NaN|Không giới hạn|Khóa|Cấp quyền web admin/);
    assert.match(googleRow, />Google<\/span>/);
    assert.match(googleRow, /4 \/ 10/);
    assert.match(googleRow, /Khóa/);
    assert.match(googleRow, /Cấp quyền web admin/);
    for (const canChangeUsers of [true, false]) {
      const [readOnlyWeb] = render(false, canChangeUsers).match(/<tbody>(.*?)<\/tbody>/s)[1].match(/<tr\b.*?<\/tr>/gs);
      assert.doesNotMatch(readOnlyWeb, /<select|<button|<input/);
    }
  } finally {
    await vite.close();
  }
});

test('owner dùng đúng hợp đồng API tài khoản web độc lập', async () => {
  const calls = [];
  const account = { id: 'web/1', email: 'viewer@example.com', role: 'viewer' };
  const storage = sessionStorageStub();
  const store = createAdminStore(async (url, options) => {
    const path = url.slice(`${apiUrl}/api/admin-web`.length);
    if (path === '/auth/login') return json({ username: 'owner', role: 'owner', token: 'owner-token' });
    calls.push([options.method, path, options.body && JSON.parse(options.body), options.headers.Authorization]);
    if (path.startsWith('/users?')) return page('user-1', Number(new URL(url).searchParams.get('page')));
    return path === '/auth/accounts' ? json(account, 201) : json({ ok: true });
  }, 0, apiUrl, storage);
  await store.getState().login('owner', 'password');
  const actions = store.getState();
  await assert.rejects(async () => actions.createWebAccount(account.email, 'test-temporary', 'owner'), /vai trò/i);
  await assert.rejects(async () => actions.changeWebAccountRole(account.id, 'owner'), /vai trò/i);
  await actions.update('role', 'admin');
  await actions.update('status', 'active');
  await actions.goToPage(2);
  calls.length = 0;

  await actions.createWebAccount(' viewer@example.com ', 'test-temporary', 'viewer');
  assert.equal(store.getState().result.page, 1);
  await actions.goToPage(2);
  await actions.changeWebAccountRole(account.id, 'admin');
  await actions.resetWebAccountPassword(account.id, 'new-temporary');
  await actions.revokeWebAccount(account.id);
  const pageOne = ['GET', '/users?q=&role=admin&status=active&page=1&limit=10', undefined, 'Bearer owner-token'];
  const pageTwo = ['GET', '/users?q=&role=admin&status=active&page=2&limit=10', undefined, 'Bearer owner-token'];
  assert.deepEqual(calls, [
    ['POST', '/auth/accounts', { email: 'viewer@example.com', password: 'test-temporary', role: 'viewer' }, 'Bearer owner-token'],
    pageOne,
    pageTwo,
    ['POST', '/auth/accounts/web%2F1/role', { role: 'admin' }, 'Bearer owner-token'],
    pageTwo,
    ['POST', '/auth/accounts/web%2F1/reset-password', { password: 'new-temporary' }, 'Bearer owner-token'],
    pageTwo,
    ['POST', '/auth/accounts/web%2F1/revoke', {}, 'Bearer owner-token'],
    pageTwo,
  ]);
  assert.equal(JSON.stringify(store.getState()).includes('temporary'), false);
  assert.deepEqual([...storage.entries.values()], ['owner-token']);
});

test('viewer chỉ tải, lọc và phân trang; không gửi yêu cầu thay đổi', async () => {
  const calls = [];
  const store = createAdminStore(async (url) => {
    calls.push(url);
    if (url.endsWith('/login')) return json({ username: 'viewer@example.com', role: 'viewer', token: 'viewer-token' });
    return page('user-1', Number(new URL(url).searchParams.get('page')));
  }, 0, apiUrl, sessionStorageStub());
  await store.getState().login('viewer@example.com', 'password');
  const actions = store.getState();
  await actions.update('status', 'active');
  await actions.goToPage(2);
  assert.equal(store.getState().result.page, 2);
  assert.match(calls.at(-1), /status=active&page=2/);
  const count = calls.length;
  await actions.changeStatus({ id: 'user-1', status: 'active' });
  actions.toggleRows(['user-1'], true);
  assert.deepEqual(store.getState().selected, []);
  assert.equal(calls.length, count);
  await actions.createWebAccount('viewer@example.com', 'test-temporary', 'viewer');
  await actions.changeWebAccountRole('web-1', 'admin');
  await actions.resetWebAccountPassword('web-1', 'test-temporary');
  await actions.revokeWebAccount('web-1');
  await actions.changeWebAdmin('user-1', 'grant', 'test-temporary');
  assert.equal(calls.length, count);
});

test('admin vẫn khóa người dùng thường nhưng không quản lý tài khoản web độc lập', async () => {
  const calls = [];
  const store = createAdminStore(async (url) => {
    calls.push(url);
    if (url.endsWith('/login')) return json({ username: 'admin@example.com', role: 'admin', token: 'admin-token' });
    if (url.endsWith('/block')) return json({ ok: true });
    return page('user-1');
  }, 0, apiUrl, sessionStorageStub());
  await store.getState().login('admin@example.com', 'password');
  const actions = store.getState();
  assert.equal(await actions.changeStatus({ id: 'user-1', status: 'active' }), true);
  assert.match(calls.at(-2), /\/users\/user-1\/block$/);
  const count = calls.length;
  await actions.changeWebAccountRole('web-1', 'viewer');
  await actions.resetWebAccountPassword('web-1', 'test-temporary');
  await actions.revokeWebAccount('web-1');
  assert.equal(calls.length, count);
});

test('lỗi khóa tài khoản được trả về mà không làm mất bảng tài khoản', async () => {
  const store = createAdminStore(async (url) => {
    if (url.endsWith('/login')) return json({ username: 'admin', role: 'admin', token: 'admin-token' });
    if (url.endsWith('/block')) return json({ error: 'Không thể khóa tài khoản' }, 403);
    return page('user-1');
  }, 0, apiUrl, sessionStorageStub());
  await store.getState().login('admin', 'password');
  await assert.rejects(store.getState().changeStatus({ id: 'user-1', status: 'active' }), { status: 403 });
  assert.equal(store.getState().listError, '');
  assert.equal(store.getState().changing, false);
  assert.equal(store.getState().result.rows[0].id, 'user-1');
});

test('401 của API tài khoản web độc lập xóa phiên và token', async () => {
  const storage = sessionStorageStub();
  const store = createAdminStore(async (url) => {
    if (url.endsWith('/login')) return json({ username: 'owner', role: 'owner', token: 'owner-token' });
    if (url.endsWith('/auth/accounts')) return json({ error: 'Phiên hết hạn' }, 401);
    return page('user-1');
  }, 0, apiUrl, storage);
  await store.getState().login('owner', 'password');
  await assert.rejects(store.getState().createWebAccount('viewer@example.com', 'test-temporary', 'viewer'), { status: 401 });
  assert.equal(store.getState().session, null);
  assert.equal(storage.entries.size, 0);
});

test('không gửi yêu cầu khóa tài khoản chỉ dùng web', async () => {
  const store = createAdminStore(async (url, options) => {
    if (url.endsWith('/login')) return json({ username: 'owner', role: 'owner', token: 'owner-token' });
    if (options.method === 'GET') return page('web-1');
    return json({ error: 'Không thể khóa tài khoản chỉ dùng web' }, 400);
  }, 0, apiUrl, sessionStorageStub());
  await store.getState().login('owner', 'password');
  await store.getState().changeStatus({ id: 'web-1', provider: 'web', status: 'active' });
  assert.equal(store.getState().listError, '');
});

const apiUrl = 'https://api.example/lumo';
const json = (body, status = 200) => Response.json(body, { status });
const page = (id, current = 1) => json({ items: [{ id }], total: 15, page: current, limit: 10 });

function sessionStorageStub() {
  const entries = new Map();
  return {
    entries,
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, value),
    removeItem: (key) => entries.delete(key),
  };
}

test('reload xác minh token trước khi tải bảng; logout và 401 xóa token', async () => {
  const storage = sessionStorageStub();
  const calls = [];
  let sessionStatus = 200;
  const request = async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith('/login')) return json({ username: 'owner', role: 'owner', token: 'owner-token' });
    if (url.endsWith('/session')) return json({ username: 'owner', role: 'owner', mustChangePassword: false }, sessionStatus);
    if (url.endsWith('/logout')) return json({ ok: true });
    return page('user-1');
  };
  const open = () => createAdminStore(request, 0, apiUrl, storage);
  await open().getState().login('owner', 'test-password');
  assert.deepEqual([...storage.entries.values()], ['owner-token']);
  const reloaded = open();
  assert.equal(reloaded.getState().session, null);
  await reloaded.getState().restoreSession();
  assert.equal(calls[2].url, `${apiUrl}/api/admin-web/auth/session`);
  assert.equal(calls[2].options.headers.Authorization, 'Bearer owner-token');
  assert.equal(reloaded.getState().result.rows[0].id, 'user-1');
  await reloaded.getState().logout();
  assert.equal(storage.entries.size, 0);
  await open().getState().login('owner', 'test-password');
  sessionStatus = 401;
  const expired = open();
  await expired.getState().restoreSession();
  assert.equal(expired.getState().session, null);
  assert.equal(storage.entries.size, 0);
});

test('lọc, phân trang và cấp quyền dùng đúng API; phản hồi cũ không ghi đè bảng', async () => {
  const calls = [];
  let resolveOld;
  const store = createAdminStore(async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith('/login')) return json({ username: 'owner', role: 'owner', token: 'owner-token' });
    if (url.endsWith('/grant')) return json({ ok: true });
    const params = new URL(url).searchParams;
    if (params.get('role') === 'admin') return new Promise((resolve) => { resolveOld = resolve; });
    return page('user-1', Number(params.get('page')));
  }, 0, apiUrl, sessionStorageStub());
  await store.getState().login('owner', 'test-password');
  const old = store.getState().update('role', 'admin');
  await store.getState().update('role', 'user');
  resolveOld(page('old'));
  await old;
  assert.equal(store.getState().result.rows[0].id, 'user-1');
  await store.getState().update('status', 'blocked');
  await store.getState().goToPage(2);
  assert.match(calls.at(-1).url, /role=user&status=blocked&page=2&limit=10$/);
  await store.getState().changeWebAdmin('user-1', 'grant', 'temporary-password');
  assert.match(calls.at(-2).url, /\/auth\/users\/user-1\/grant$/);
  assert.equal(calls.at(-2).options.headers.Authorization, 'Bearer owner-token');
  assert.match(calls.at(-1).url, /\/users\?/);
  assert.equal(JSON.stringify(store.getState()).includes('temporary-password'), false);
});

test('reload phiên tạm không tải bảng và đổi mật khẩu cập nhật token', async () => {
  const storage = sessionStorageStub();
  const calls = [];
  const request = async (url, options) => {
    calls.push({ url, options });
    const pending = { username: 'admin@example.com', role: 'admin', mustChangePassword: true };
    if (url.endsWith('/login')) return json({ ...pending, token: 'temporary' });
    if (url.endsWith('/session')) return json(pending);
    if (url.endsWith('/change-password')) return json({ ...pending, mustChangePassword: false, token: 'new-token' });
    return page('user-1');
  };
  await createAdminStore(request, 0, apiUrl, storage).getState().login('admin@example.com', '2');
  const store = createAdminStore(request, 0, apiUrl, storage);
  await store.getState().restoreSession();
  assert.equal(calls.length, 2);
  assert.equal(store.getState().session.mustChangePassword, true);
  await store.getState().changePassword('1');
  assert.equal(calls[2].options.headers.Authorization, 'Bearer temporary');
  assert.equal(calls[3].options.headers.Authorization, 'Bearer new-token');
  assert.deepEqual([...storage.entries.values()], ['new-token']);
});
