import { Icon } from './Icon.jsx';

export function ModelCard({ model, isOwner, busy, connection, onToggle, onVerify, onEdit }) {
  const checking = connection?.status === 'checking';
  const disabled = busy || checking;
  return (
    <article className="flex min-w-0 flex-col gap-4 rounded-xl bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-mint/30 text-primary"><Icon name="neurology" /></span>
        <div className="min-w-0 flex-1">
          <h3 className="font-heading text-base font-bold break-words">{model.name}</h3>
          <p className="font-mono text-xs break-all text-muted">{model.code}</p>
        </div>
        <div className="grid shrink-0 justify-items-end gap-1">
          {isOwner && <button type="button" role="switch" aria-checked={model.enabled} aria-label={`Kích hoạt ${model.name}`} disabled={disabled} onClick={() => onToggle(model)} className={`flex h-6 w-11 items-center rounded-full p-1 disabled:opacity-50 ${model.enabled ? 'justify-end bg-primary' : 'justify-start bg-muted'}`}>
            <span className="size-4 rounded-full bg-white" />
          </button>}
          <span className={`text-[11px] font-semibold ${model.enabled ? 'text-primary' : 'text-muted'}`}>{model.enabled ? 'Đang bật' : 'Đã tắt'}</span>
        </div>
      </div>
      <p className="text-sm text-muted">{model.coinPrice > 0 ? `${model.coinPrice} xu / lần gọi AI` : 'Dùng hạn mức cơ bản'}</p>
      {model.description && <p className="whitespace-pre-line break-words text-muted">{model.description}</p>}
      <dl className="mt-auto grid gap-2">
        <div className="flex min-w-0 items-start gap-2 rounded-lg bg-panel px-3 py-2">
          <dt className="flex shrink-0 items-center gap-1 text-xs font-semibold text-muted"><Icon name="link" /> Base URL</dt>
          <dd className="min-w-0 font-mono text-xs break-all">{model.baseUrl || 'Chưa cấu hình'}</dd>
        </div>
        {isOwner && <div className="flex min-w-0 items-start gap-2 rounded-lg bg-panel px-3 py-2">
          <dt className="flex shrink-0 items-center gap-1 text-xs font-semibold text-muted"><Icon name="key" /> API key</dt>
          <dd className="min-w-0 font-mono text-xs break-all">{model.apiKey || 'Chưa cấu hình'}</dd>
        </div>}
      </dl>
      {isOwner && connection?.status === 'success' && <p role="status" className="self-start rounded-full bg-mint/40 px-2.5 py-1 text-xs font-semibold text-primary">Kết nối thành công</p>}
      {isOwner && connection?.status === 'error' && <p role="alert" className="rounded-lg bg-blush/50 px-2.5 py-1.5 text-xs break-words text-danger">Kết nối thất bại: {connection.message}</p>}
      {isOwner && <div className="flex flex-wrap justify-between gap-2 border-t border-line pt-3">
        <button type="button" className="soft-button" disabled={disabled} onClick={() => onVerify(model)}><Icon name={checking ? 'progress_activity' : 'sensors'} className={checking ? 'text-primary motion-safe:animate-spin' : 'text-primary'} />{checking ? 'Đang kiểm tra…' : 'Kiểm tra kết nối'}</button>
        <button type="button" className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-ink px-3 font-semibold text-white hover:bg-muted disabled:opacity-50" aria-haspopup="dialog" disabled={disabled} onClick={() => onEdit(model)}><Icon name="edit" />Chỉnh sửa</button>
      </div>}
    </article>
  );
}
