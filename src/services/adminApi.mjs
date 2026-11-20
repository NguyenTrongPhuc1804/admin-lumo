export function createAdminApi(request = fetch, apiUrl = import.meta.env?.VITE_BASE_URL_API) {
  async function api(path, { body, token, method = body === undefined ? 'GET' : 'POST' } = {}) {
    const base = apiUrl?.trim().replace(/\/+$/, '');
    if (!base || !/^https?:\/\//i.test(base)) throw new Error('Cần cấu hình VITE_BASE_URL_API với địa chỉ API HTTP hoặc HTTPS');
    const headers = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await request(`${base}/api/admin-web${path}`, {
      method, credentials: 'omit', headers, body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(data.error || 'Không gọi được API quản trị'), { status: response.status });
    return data;
  }

  return {
    getSession: (token) => api('/auth/session', { token }),
    login: (username, password) => api('/auth/login', { body: { username, password } }),
    changePassword: (password, token) => api('/auth/change-password', { token, body: { password } }),
    changeWebAdmin: (id, action, password, token) => api(`/auth/users/${encodeURIComponent(id)}/${action}`, { token, body: { password } }),
    createWebAccount: (email, password, role, token) => api('/auth/accounts', { token, body: { email, password, role } }),
    changeWebAccount: (id, action, body, token) => api(`/auth/accounts/${encodeURIComponent(id)}/${action}`, { token, body }),
    logout: (token) => api('/auth/logout', { token, body: {} }),
    listModels: (token) => api('/models', { token }),
    saveModel: (id, body, token) => id == null
      ? api('/models', { token, body, method: 'POST' })
      : api(`/models/${encodeURIComponent(id)}`, { token, body, method: 'PUT' }),
    deleteModel: (id, token) => api(`/models/${encodeURIComponent(id)}`, { token, method: 'DELETE' }),
    verifyModel: (body, token) => api('/models/verify', { token, body, method: 'POST' }),
    listUsers({ query, role, status, page, pageSize }, token) {
      const params = new URLSearchParams({ q: query.trim(), role, status, page, limit: pageSize });
      return api(`/users?${params}`, { token });
    },
    changeUserStatus: (id, action, token) => api(`/users/${encodeURIComponent(id)}/${action}`, { token, body: {} }),
  };
}
