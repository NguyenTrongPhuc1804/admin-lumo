import { useEffect } from 'react';

export function ModelDialog({ dialog, model, busy, error, onClose, onSave, onDelete }) {
  useEffect(() => {
    if (!dialog.current.open) dialog.current.showModal();
  }, [dialog]);

  function submit(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const code = data.get('code').trim();
    const name = data.get('name').trim();
    if (!code || !name) {
      const input = event.currentTarget.elements.namedItem(code ? 'name' : 'code');
      input.value = '';
      input.reportValidity();
      return;
    }
    onSave({
      code,
      name,
      description: data.get('description').trim(),
      baseUrl: data.get('baseUrl').trim(),
      apiKey: data.get('apiKey'),
      order: Number(data.get('order')),
      enabled: data.has('enabled'),
    });
  }

  return (
    <dialog ref={dialog} aria-labelledby="model-dialog-title" className="m-auto max-h-[calc(100%-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-xl bg-white p-5 text-ink shadow-xl backdrop:bg-ink/40" onClose={onClose} onCancel={(event) => { if (busy) event.preventDefault(); }}>
      <form className="grid gap-4" onSubmit={submit}>
        <h2 id="model-dialog-title" className="font-heading text-lg font-bold">{model ? 'Chỉnh sửa Model AI' : 'Thêm Model AI'}</h2>
        <fieldset className="grid min-w-0 gap-3" disabled={busy}>
          <label className="grid gap-1">Tên model<input className="control" name="name" defaultValue={model?.name} required /></label>
          <label className="grid gap-1">Mã model<input className="control font-mono" name="code" defaultValue={model?.code} required /></label>
          <label className="grid gap-1">Mô tả<textarea className="control h-auto py-2" name="description" rows={2} maxLength={500} defaultValue={model?.description} /></label>
          <label className="grid gap-1">Base URL<input type="url" className="control" name="baseUrl" defaultValue={model?.baseUrl} placeholder="https://api.example.com/v1" /></label>
          <label className="grid gap-1">API key<input type="password" className="control" name="apiKey" autoComplete="new-password" placeholder={model ? 'Để trống để giữ khóa hiện tại' : 'Nhập API key'} aria-describedby={model ? 'model-key-help' : undefined} /></label>
          {model && <p id="model-key-help" className="text-xs text-muted">Khi đổi Base URL, có thể cần nhập khóa mới của nhà cung cấp.</p>}
          <div className="flex flex-wrap items-end gap-4">
            <label className="grid gap-1">Thứ tự<input type="number" className="control w-24" name="order" defaultValue={model?.order ?? 0} required /></label>
            <label className="flex h-10 items-center gap-2"><input type="checkbox" className="accent-primary" name="enabled" defaultChecked={model?.enabled ?? true} /> Kích hoạt</label>
          </div>
        </fieldset>
        {error && <p role="alert" className="break-words text-danger">{error}</p>}
        <div className="flex flex-wrap justify-end gap-2">
          {model && <button type="button" className="soft-button mr-auto text-danger" disabled={busy} onClick={onDelete}>Xóa model</button>}
          <button type="button" className="soft-button" disabled={busy} onClick={() => dialog.current.close()}>Hủy</button>
          <button type="submit" className="h-10 rounded-lg bg-primary px-4 font-semibold text-white hover:bg-accent disabled:opacity-50" disabled={busy}>{busy ? 'Đang xử lý…' : model ? 'Lưu thay đổi' : 'Thêm model'}</button>
        </div>
      </form>
    </dialog>
  );
}
