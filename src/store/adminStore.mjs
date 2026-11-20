import { create } from 'zustand';
import { createAdminApi } from '../services/adminApi.mjs';

const defaults = { query: '', role: '', status: '', page: 1, pageSize: 10 };
const empty = { rows: [], total: 0, page: 1, pageCount: 1, start: 0 };

export function createAdminStore(request = fetch, wait = 300, apiUrl = import.meta.env?.VITE_BASE_URL_API, storage) {
  const adminApi = createAdminApi(request, apiUrl);
  const storageKey = `lumo-admin-token:${apiUrl?.trim().replace(/\/+$/, '') ?? ''}`;
  let version = 0;
  let timer;

  function storedToken(token) {
    try {
      const target = storage ?? globalThis.sessionStorage;
      if (token === undefined) return target?.getItem(storageKey);
      if (token === null) target?.removeItem(storageKey);
      else target?.setItem(storageKey, token);
    } catch {
      // Nếu trình duyệt chặn storage, phiên vẫn dùng được đến khi tải lại.
    }
  }

  return create((set, get) => {
    function setSession(session) {
      if (!session?.token) throw new Error('API quản trị chưa trả token đăng nhập');
      storedToken(session.token);
      set({ session });
    }

    function clearSession() {
      storedToken(null);
      clearTimeout(timer);
      version++;
      set({ session: null, result: empty, filters: defaults, selected: [], loading: false, listError: '', changing: false });
    }

    async function load() {
      clearTimeout(timer);
      const { session, filters } = get();
      if (!session || session.mustChangePassword) return;
      const current = ++version;
      set({ loading: true, listError: '' });
      try {
        const data = await adminApi.listUsers(filters, session.token);
        if (current !== version) return;
        const pageCount = Math.max(1, Math.ceil(data.total / data.limit));
        if (filters.page > pageCount) return get().goToPage(pageCount);
        set({ result: { rows: data.items, total: data.total, page: data.page, pageCount, start: (data.page - 1) * data.limit }, loading: false });
      } catch (error) {
        if (current !== version) return;
        if (error.status === 401) clearSession();
        else set({ listError: error.message, loading: false });
      }
    }

    function canChangeUsers() {
      const { session } = get();
      return !session?.mustChangePassword && (session?.role === 'owner' || session?.role === 'admin');
    }

    async function ownerMutation(send, firstPage = false) {
      const { session } = get();
      if (session?.role !== 'owner' || session.mustChangePassword) return;
      try {
        const data = await send(session.token);
        if (get().session !== session) return;
        if (firstPage) await get().goToPage(1);
        else await load();
        if (get().session === session) return data;
      } catch (error) {
        if (get().session !== session) return;
        if (error.status === 401) clearSession();
        throw error;
      }
    }

    async function modelRequest(send, ownerOnly = true) {
      const { session } = get();
      if (!session || session.mustChangePassword || (session.role !== 'owner' && (ownerOnly || session.role !== 'admin'))) return;
      try {
        const data = await send(session.token, session.role);
        if (get().session === session) return data;
      } catch (error) {
        if (get().session !== session) return;
        if (error.status === 401) clearSession();
        throw error;
      }
    }

    return {
      session: null, checking: true, filters: defaults, result: empty, selected: [], loading: false, listError: '', changing: false,
      async restoreSession() {
        const token = storedToken();
        try {
          if (token) {
            const session = await adminApi.getSession(token);
            if (typeof session.username !== 'string') throw new Error('Phiên đăng nhập không hợp lệ');
            setSession({ ...session, token });
            return load();
          }
        } catch (error) {
          if (error.status === 401) clearSession();
        } finally {
          set({ checking: false });
        }
      },
      async login(username, password) {
        setSession(await adminApi.login(username, password));
        return load();
      },
      async logout() {
        const { session } = get();
        clearSession();
        if (!session) return;
        try { await adminApi.logout(session.token); } catch (error) { if (error.status !== 401) throw error; }
      },
      load,
      update(key, value) {
        version++;
        clearTimeout(timer);
        set({ filters: { ...get().filters, page: 1, [key]: value }, selected: [], loading: true, listError: '' });
        if (key === 'query') timer = setTimeout(load, wait);
        else return load();
      },
      reset() { set({ filters: defaults, selected: [] }); return load(); },
      goToPage(page) { set({ filters: { ...get().filters, page } }); return load(); },
      toggleRows(ids, checked) {
        if (!canChangeUsers()) return;
        set(({ selected }) => ({ selected: checked ? [...new Set([...selected, ...ids])] : selected.filter((id) => !ids.includes(id)) }));
      },
      async changePassword(password) {
        const { session } = get();
        if (!session?.mustChangePassword) return;
        try {
          const nextSession = await adminApi.changePassword(password, session.token);
          if (get().session !== session) return;
          setSession(nextSession);
          return load();
        } catch (error) {
          if (error.status === 401 && get().session === session) clearSession();
          throw error;
        }
      },
      listModels() {
        return modelRequest(async (token, role) => {
          const models = await adminApi.listModels(token);
          if (!Array.isArray(models)) throw new Error('Danh sách model không hợp lệ');
          return role === 'owner' ? models : models.map(({ apiKey: _key, ...model }) => model);
        }, false);
      },
      saveModel(id, { apiKey, ...fields }) {
        return modelRequest(async (token) => {
          const key = apiKey?.trim();
          const data = await adminApi.saveModel(id, key ? { ...fields, apiKey: key } : fields, token);
          if (!data.ok || !data.model) throw new Error('Không lưu được model');
          return data.model;
        });
      },
      deleteModel(id) {
        return modelRequest(async (token) => {
          const data = await adminApi.deleteModel(id, token);
          if (!data.ok) throw new Error('Không xóa được model');
          return data;
        });
      },
      verifyModel({ id, code, baseUrl }) {
        return modelRequest(async (token) => {
          const data = await adminApi.verifyModel({ id, model: code, baseUrl }, token);
          if (!data.ok) throw new Error('Không kết nối được model');
          return data;
        });
      },
      changeWebAdmin(id, action, password) {
        return ownerMutation((token) => adminApi.changeWebAdmin(id, action, password, token));
      },
      createWebAccount(email, password, role) {
        return ownerMutation((token) => {
          if (role !== 'admin' && role !== 'viewer') throw new Error('Vai trò không hợp lệ');
          return adminApi.createWebAccount(email.trim(), password, role, token);
        }, true);
      },
      changeWebAccountRole(id, role) {
        return ownerMutation((token) => {
          if (role !== 'admin' && role !== 'viewer') throw new Error('Vai trò không hợp lệ');
          return adminApi.changeWebAccount(id, 'role', { role }, token);
        });
      },
      resetWebAccountPassword(id, password) {
        return ownerMutation((token) => adminApi.changeWebAccount(id, 'reset-password', { password }, token));
      },
      revokeWebAccount(id) {
        return ownerMutation((token) => adminApi.changeWebAccount(id, 'revoke', {}, token));
      },
      async changeStatus(account) {
        const { session, changing } = get();
        if (changing || account.provider === 'web' || !canChangeUsers()) return;
        set({ changing: true, listError: '' });
        try {
          const action = account.status === 'blocked' ? 'unblock' : 'block';
          await adminApi.changeUserStatus(account.id, action, session.token);
          if (get().session === session) return await load();
        } catch (error) {
          if (get().session !== session) return;
          if (error.status === 401) clearSession();
          else set({ listError: error.message });
        } finally {
          if (get().session === session) set({ changing: false });
        }
      },
    };
  });
}

export const useAdminStore = createAdminStore();
