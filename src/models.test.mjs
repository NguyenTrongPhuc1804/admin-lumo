import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { createAdminStore } from './store/adminStore.mjs';

const apiUrl = 'https://admin.example.com';
const model = { id: 'model/1', code: 'gemini', name: 'Gemini', description: '', baseUrl: 'https://provider.example.com/v1', enabled: true, order: 0, apiKey: 'abc...1234' };
const { id, apiKey, ...fields } = model;
const json = (data, status = 200) => new Response(JSON.stringify(data), { status });

async function signIn(role, respond) {
  const calls = [];
  const entries = new Map();
  const storage = { setItem: (key, value) => entries.set(key, value), removeItem: (key) => entries.delete(key) };
  const store = createAdminStore(async (url, options) => {
    const path = url.slice(`${apiUrl}/api/admin-web`.length);
    if (path === '/auth/login') return json({ username: role, role, token: 'test-token' });
    if (path.startsWith('/users?')) return json({ items: [], total: 0, limit: 10, page: 1 });
    calls.push([options.method, path, options.body && JSON.parse(options.body), options.headers.Authorization]);
    return respond(path, options.method);
  }, 0, apiUrl, storage);
  await store.getState().login(role, 'password');
  return { store, calls, entries };
}

test('chính sách hạn mức: chỉ owner ghi, admin chỉ đọc, viewer không gọi API', async () => {
  const policy = { guestLimit: 3, freeLimit: 100 };
  for (const role of ['owner', 'admin', 'viewer']) {
    const { store, calls } = await signIn(role, () => json(policy));
    await store.getState().getQuotaPolicy();
    await store.getState().saveQuotaPolicy(policy);
    assert.deepEqual(calls.map(([method, path]) => `${method} ${path}`), role === 'viewer' ? [] : role === 'admin' ? ['GET /quota-policy'] : ['GET /quota-policy', 'PUT /quota-policy']);
  }
});

test('owner dùng các endpoint Models với Bearer, không gửi lại khóa đã che', async () => {
  const { store, calls } = await signIn('owner', (path, method) => {
    if (method === 'GET') return json([model]);
    if (method === 'DELETE' || path === '/models/verify') return json({ ok: true });
    return json({ ok: true, model });
  });
  const actions = store.getState();
  assert.deepEqual(await actions.listModels(), [model]);
  assert.deepEqual(await actions.saveModel(null, { ...fields, apiKey: 'new-key' }), model);
  await actions.saveModel(id, { ...fields, apiKey: '   ' });
  await actions.saveModel(id, { enabled: false });
  await actions.verifyModel(model);
  await actions.deleteModel(id);
  assert.deepEqual(calls, [
    ['GET', '/models', undefined, 'Bearer test-token'],
    ['POST', '/models', { ...fields, apiKey: 'new-key' }, 'Bearer test-token'],
    ['PUT', '/models/model%2F1', fields, 'Bearer test-token'],
    ['PUT', '/models/model%2F1', { enabled: false }, 'Bearer test-token'],
    ['POST', '/models/verify', { id, model: 'gemini', baseUrl: 'https://provider.example.com/v1' }, 'Bearer test-token'],
    ['DELETE', '/models/model%2F1', undefined, 'Bearer test-token'],
  ]);
});

test('admin chỉ đọc và không nhận khóa; viewer không gọi API model', async () => {
  for (const role of ['admin', 'viewer']) {
    const { store, calls } = await signIn(role, () => json([model]));
    const actions = store.getState();
    const list = await actions.listModels();
    if (role === 'admin') assert.deepEqual(list, [{ id, ...fields }]);
    else assert.equal(list, undefined);
    await actions.saveModel(null, fields);
    await actions.saveModel(id, fields);
    await actions.verifyModel(model);
    await actions.deleteModel(id);
    assert.deepEqual(calls.map(([method]) => method), role === 'admin' ? ['GET'] : []);
  }
});

test('401 từ Models xóa phiên và token đã lưu', async () => {
  const { store, entries } = await signIn('owner', () => json({ error: 'Phiên hết hạn' }, 401));
  await assert.rejects(store.getState().verifyModel(model), { status: 401 });
  assert.equal(store.getState().session, null);
  assert.equal(entries.size, 0);
});

test('điều hướng, thẻ model và hộp thoại hiển thị theo quyền', async () => {
  const vite = await createServer({
    configFile: false,
    envFile: false,
    optimizeDeps: { noDiscovery: true, include: [] },
    esbuild: { jsx: 'automatic' },
    server: { middlewareMode: true, watch: null, ws: false },
  });
  try {
    const { AdminShell } = await vite.ssrLoadModule('/src/components/AdminShell.jsx');
    const render = (page, canViewSettings) => renderToStaticMarkup(createElement(AdminShell, { page, canViewSettings }));
    assert.match(render('quotas', true), /href="#quotas" aria-current="page"/);
    assert.doesNotMatch(render('accounts', false), /href="#quotas"/);
    const { QuotaAudit } = await vite.ssrLoadModule('/src/pages/QuotaPolicyPage.jsx');
    const audit = renderToStaticMarkup(createElement(QuotaAudit, { items: [{ updatedBy: 'owner-test', updatedAt: '2026-11-21T13:00:00Z', changes: [{ field: 'guestLimit', before: 3, after: 5 }] }] }));
    assert.match(audit, /owner-test/);
    assert.match(audit, /3 → 5/);
    assert.match(render('models', true), /href="#models" aria-current="page"/);
    assert.match(render('accounts', true), /href="#accounts" aria-current="page"/);
    assert.doesNotMatch(render('accounts', false), /Quản lý Model AI|href="#models"/);
    const { QuotaPolicyForm, QuotaOverview } = await vite.ssrLoadModule('/src/pages/QuotaPolicyPage.jsx');
    const policy = { guestLimit: 3, freeLimit: 300 };
    const referral = { reward: 3, maxClaims: 1, period: 'month' };
    const renderBonus = (bonusDrafts, feedback) => renderToStaticMarkup(createElement(QuotaOverview, {
      isOwner: true, bonus: { rules: { referral } }, bonusDrafts, feedback,
    }));
    const savedBonus = renderBonus({}, { key: 'referral', text: 'Đã lưu cấu hình · Chưa cấp lượt tự động' });
    assert.match(savedBonus, /disabled="" aria-label="Lưu cấu hình Mã giới thiệu bạn bè"/);
    assert.doesNotMatch(savedBonus, /Đã lưu cấu hình · Chưa cấp lượt tự động/);
    const failedBonus = renderBonus({ referral: { ...referral, reward: '4' } }, { key: 'referral', message: 'Không lưu được cấu hình bonus' });
    assert.doesNotMatch(failedBonus, /disabled="" aria-label="Lưu cấu hình Mã giới thiệu bạn bè"/);
    assert.match(failedBonus, /role="alert"[^>]*>Không lưu được cấu hình bonus/);
    for (const isOwner of [true, false]) {
      const models = { items: [{ id: 'free-model', name: 'Model được chọn', enabled: true }, { id: 'paid-model', name: 'Model tính xu', enabled: true, coinPrice: 5 }, { id: 'off-model', name: 'Model đang tắt', enabled: false }] };
      const quotas = renderToStaticMarkup(createElement('div', null, createElement(QuotaPolicyForm, { isOwner, policy, draft: { ...policy, sharedAiModelId: 'free-model' }, models }), createElement(QuotaOverview, { isOwner, bonus: { rules: {} }, usage: { total: 0 } })));
      assert.match(quotas, /Model AI cho Free và Guest/);
      assert.equal(quotas.includes('id="shared-ai-model"'), isOwner);
      assert.match(quotas, /Model được chọn/);
      assert.doesNotMatch(quotas, /Model tính xu|Model đang tắt/);
      assert.match(quotas, /Khách vãng lai/);
      assert.match(quotas, /Free Registered/);
      assert.match(quotas, /Pro Gamer/);
      assert.match(quotas, /VIP &amp; Studio/);
      assert.doesNotMatch(quotas, /Điểm danh hằng ngày/);
      assert.match(quotas, /Mã giới thiệu bạn bè/);
      assert.match(quotas, /Video tài trợ/);
      assert.match(quotas, /Chưa có dữ liệu lượt gọi AI/);
      assert.doesNotMatch(quotas, /14\.8M|38\.0%|Lưu thay đổi Quy tắc/);
      assert.equal((quotas.match(/<input/g) || []).length, isOwner ? 8 : 0);
      assert.equal((quotas.match(/role="switch"/g) || []).length, isOwner ? 2 : 0);
      assert.equal((quotas.match(/aria-label="Lưu cấu hình/g) || []).length, isOwner ? 2 : 0);
    }
    const { ModelCard } = await vite.ssrLoadModule('/src/components/ModelCard.jsx');
    const ownerCard = renderToStaticMarkup(createElement(ModelCard, { model, isOwner: true }));
    const adminCard = renderToStaticMarkup(createElement(ModelCard, { model, isOwner: false }));
    assert.match(ownerCard, /role="switch" aria-checked="true"/);
    assert.match(ownerCard, /abc\.\.\.1234/);
    assert.match(ownerCard, /Kiểm tra kết nối/);
    assert.match(adminCard, /Đang bật/);
    assert.match(adminCard, /https:\/\/provider\.example\.com\/v1/);
    assert.doesNotMatch(adminCard, /abc\.\.\.1234|API key|<button/);

    const renderConnection = (connection) => renderToStaticMarkup(createElement(ModelCard, { model, isOwner: true, connection }));
    const checkingCard = renderConnection({ status: 'checking' });
    assert.match(checkingCard, /<button[^>]* disabled=""[^>]*>.*Đang kiểm tra…/);
    assert.doesNotMatch(ownerCard, /disabled=""|Đang kiểm tra…|Kết nối thành công/);
    assert.match(renderConnection({ status: 'success' }), /role="status"[^>]*>Kết nối thành công/);
    assert.match(renderConnection({ status: 'error', message: 'Hết thời gian chờ' }), /role="alert"[^>]*>Kết nối thất bại: Hết thời gian chờ/);

    const { ModelDialog } = await vite.ssrLoadModule('/src/components/ModelDialog.jsx');
    const edit = renderToStaticMarkup(createElement(ModelDialog, { model }));
    assert.match(edit, /name="apiKey"/);
    assert.match(edit, /Để trống để giữ khóa hiện tại/);
    assert.doesNotMatch(edit, /abc\.\.\.1234/);
  } finally {
    await vite.close();
  }
});
