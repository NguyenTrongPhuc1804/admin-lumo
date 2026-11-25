import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Icon } from '../components/Icon.jsx';
import { ModelCard } from '../components/ModelCard.jsx';
import { ModelDialog } from '../components/ModelDialog.jsx';
import { useAdminStore } from '../store/adminStore.mjs';

export function ModelsPage({ isOwner }) {
  const listModels = useAdminStore((state) => state.listModels);
  const saveModel = useAdminStore((state) => state.saveModel);
  const deleteModel = useAdminStore((state) => state.deleteModel);
  const verifyModel = useAdminStore((state) => state.verifyModel);
  const dialog = useRef(null);
  const [models, setModels] = useState([]);
  const [query, setQuery] = useState('');
  const [editor, setEditor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [listError, setListError] = useState('');
  const [dialogError, setDialogError] = useState('');
  const [busy, setBusy] = useState('');
  const [connections, setConnections] = useState({});

  useEffect(() => {
    let active = true;
    listModels().then((data) => {
      if (active && data) setModels(data);
    }).catch((error) => {
      if (active) setListError(error.message);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [attempt, listModels]);

  function retry() {
    setListError('');
    setLoading(true);
    setAttempt(attempt + 1);
  }

  function openEditor(model) {
    setEditor({ model });
    setDialogError('');
  }

  async function checkConnection(model) {
    if (!isOwner || busy || connections[model.id]?.status === 'checking') return;
    setConnections((current) => ({ ...current, [model.id]: { status: 'checking' } }));
    let result;
    try {
      if (await verifyModel(model)) {
        result = { status: 'success' };
        toast.success(`Kết nối thành công: ${model.name}.`);
      }
    } catch (error) {
      result = { status: 'error', message: error.message };
      toast.error(`Kết nối thất bại: ${model.name}.`, { description: error.message });
    } finally {
      setConnections((current) => ({ ...current, [model.id]: result }));
    }
  }

  async function run(action, model, fields) {
    if (!isOwner || busy) return;
    const inDialog = action === 'save' || action === 'delete';
    setBusy(action);
    setDialogError('');
    try {
      if (action === 'delete') {
        if (!await deleteModel(model.id)) return;
        setModels((current) => current.filter((entry) => entry.id !== model.id));
        toast.success(`Đã xóa ${model.name}.`);
      } else {
        const updated = await saveModel(model?.id, action === 'toggle' ? { enabled: !model.enabled } : fields);
        if (!updated) return;
        setModels((current) => model ? current.map((entry) => entry.id === model.id ? updated : entry) : [...current, updated]);
        toast.success(action === 'toggle' ? `Đã ${updated.enabled ? 'bật' : 'tắt'} ${updated.name}.` : `Đã lưu ${updated.name}.`);
      }
      if (inDialog) {
        if (model) setConnections((current) => ({ ...current, [model.id]: undefined }));
        dialog.current?.close();
      }
    } catch (error) {
      if (inDialog) setDialogError(error.message);
      else toast.error(`${model.name}: ${error.message}`);
    } finally {
      setBusy('');
    }
  }

  const search = query.trim().toLowerCase();
  const visibleModels = models.filter((model) => [model.name, model.code, model.description].some((value) => value?.toLowerCase().includes(search))).sort((a, b) => a.order - b.order);

  return (
    <>
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-panel p-4 sm:p-5">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight sm:text-[32px]">Quản lý Model AI</h1>
          <p className="mt-1 text-muted">{isOwner ? 'Quản lý cấu hình, trạng thái và kết nối của từng model AI.' : 'Xem cấu hình và trạng thái model AI. Bạn chỉ có quyền xem.'}</p>
        </div>
        {isOwner && <button type="button" className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 font-semibold text-white shadow-sm hover:bg-accent disabled:opacity-50" aria-haspopup="dialog" disabled={loading || !!listError || !!busy} onClick={() => openEditor(null)}><Icon name="add_circle" />Thêm Model AI</button>}
      </section>
      <section aria-labelledby="model-list-title" className="grid min-w-0 gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Icon name="neurology" className="text-primary" />
            <h2 id="model-list-title" className="font-heading text-lg font-bold">Danh sách Model AI</h2>
            {!loading && !listError && <span className="rounded-full bg-line px-2 py-0.5 font-mono text-xs font-semibold text-muted">{search ? `${visibleModels.length}/${models.length}` : models.length} model</span>}
          </div>
          <label className="relative w-full sm:w-56">
            <span className="sr-only">Lọc model</span>
            <Icon name="filter_list" className="pointer-events-none absolute top-3 left-3 text-muted" />
            <input type="search" className="control w-full pl-10" placeholder="Lọc model…" value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
        </div>
        {loading ? <p role="status">Đang tải model…</p> : listError ? (
          <div className="rounded-xl bg-white p-4 shadow-sm"><p role="alert" className="mb-2 text-danger">{listError}</p><button type="button" className="soft-button" onClick={retry}>Thử lại</button></div>
        ) : visibleModels.length === 0 ? (
          <p role="status" className="rounded-xl bg-white p-5 text-muted shadow-sm">{search ? 'Không tìm thấy model phù hợp.' : 'Chưa có model nào được cấu hình.'}</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {visibleModels.map((model) => <ModelCard key={model.id} model={model} isOwner={isOwner} busy={!!busy} connection={connections[model.id]} onEdit={openEditor} onToggle={() => run('toggle', model)} onVerify={checkConnection} />)}
          </div>
        )}
      </section>
      {isOwner && editor && <ModelDialog dialog={dialog} model={editor.model} busy={!!busy} error={dialogError} onClose={() => setEditor(null)} onSave={(fields) => run('save', editor.model, fields)} onDelete={() => {
        if (window.confirm(`Xóa model ${editor.model.name}? Thao tác này không thể hoàn tác.`)) run('delete', editor.model);
      }} />}
    </>
  );
}
