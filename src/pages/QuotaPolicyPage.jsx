import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Icon } from '../components/Icon.jsx';
import { useAdminStore } from '../store/adminStore.mjs';

const tiers = [
  { key: 'guestLimit', icon: 'no_accounts', title: 'Khách vãng lai', subtitle: 'Không cần tài khoản', unit: 'lượt / bản cài', label: 'Tổng lượt thử', min: 0, max: 100, cycle: 'Không tự làm mới. Nhập 0 để tắt dùng thử.', features: ['Dịch thủ công bằng Lens', 'Google Dịch và model AI được cấu hình bên dưới'] },
  { key: 'freeLimit', icon: 'person', title: 'Free Registered', subtitle: 'Tài khoản miễn phí', unit: 'lượt / ngày', label: 'Lượt mỗi ngày', min: 1, max: 10000, cycle: 'Làm mới lúc 00:00 giờ Việt Nam.', features: ['Dịch thủ công bằng Lens', 'Google Dịch và model AI được cấu hình bên dưới'] },
  { icon: 'verified', title: 'Pro Gamer', subtitle: 'Gói thành viên', features: ['Hạn mức riêng', 'Quyền dùng model theo gói'] },
  { icon: 'diamond', title: 'VIP & Studio', subtitle: 'Gói cho studio và nhóm', features: ['Hạn mức riêng', 'Quyền dùng model theo gói'] },
];

const bonusRules = [
  ['referral', 'share', 'Mã giới thiệu bạn bè', ['installation', 'month']],
  ['rewardedVideo', 'smart_display', 'Video tài trợ', ['view', 'day']],
];
const periods = { day: 'Ngày', week: 'Tuần', month: 'Tháng', installation: 'Lần cài', view: 'Lần xem' };
const groupLabels = { guest: 'Khách vãng lai', free: 'Free Registered' };
const fields = { 'bonusRules.checkIn': 'Điểm danh hằng ngày (đã ngừng)', guestLimit: 'Hạn mức Guest', freeLimit: 'Hạn mức Free', sharedAiModelId: 'Model AI cho Free và Guest', ...Object.fromEntries(bonusRules.map(([key, , title]) => [`bonusRules.${key}`, title])) };
const formatTime = (value) => new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
const formatValue = (value, unit = 'xu') => value == null ? 'Chưa cấu hình' : typeof value === 'object'
  ? `${value.reward} ${unit}, tối đa ${value.maxClaims} lần / ${periods[value.period].toLowerCase()} · ${value.enabled ? 'Bật' : 'Tắt'}` : String(value);

export function QuotaPolicyPage({ isOwner }) {
  const read = useAdminStore((s) => s.getQuotaPolicy);
  const save = useAdminStore((s) => s.saveQuotaPolicy);
  const [policy, setPolicy] = useState(null);
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [bonusDrafts, setBonusDrafts] = useState({});
  const [attempt, setAttempt] = useState(0);
  const [saving, setSaving] = useState('');
  const readBonus = useAdminStore((s) => s.getBonusRules);
  const saveBonus = useAdminStore((s) => s.saveBonusRule);
  const readAudit = useAdminStore((s) => s.getQuotaAudit);
  const readUsage = useAdminStore((s) => s.getQuotaUsage);
  const listModels = useAdminStore((s) => s.listModels);
  const [overview, setOverview] = useState({});
  const [conflict, setConflict] = useState(false);
  const [auditVersion, setAuditVersion] = useState(0);

  useEffect(() => {
    let active = true;
    for (const [key, load] of [['bonus', readBonus], ['usage', readUsage], ['models', async () => ({ items: await listModels() })]]) {
      load().then((data) => { if (active) setOverview((current) => ({ ...current, [key]: data })); })
        .catch((err) => { if (active) setOverview((current) => ({ ...current, [key]: { error: err.message } })); });
    }
    return () => { active = false; };
  }, [readBonus, readUsage, listModels, attempt]);

  useEffect(() => {
    let active = true;
    readAudit().then((data) => { if (active) setOverview((current) => ({ ...current, audit: data })); })
      .catch((err) => { if (active) setOverview((current) => ({ ...current, audit: { error: err.message } })); });
    return () => { active = false; };
  }, [readAudit, attempt, auditVersion]);

  function reload() {
    setConflict(false);
    setError('');
    setFeedback(null);
    setPolicy(null);
    setOverview({});
    setBonusDrafts({});
    setAttempt((value) => value + 1);
  }

  async function submitBonus(event, rule) {
    event.preventDefault();
    if (!isOwner || saving || conflict) return;
    const fields = new FormData(event.currentTarget);
    const revision = overview.bonus.revision;
    setSaving(rule);
    setError('');
    setFeedback(null);
    try {
      const next = await saveBonus(rule, { reward: Number(fields.get('reward')), maxClaims: Number(fields.get('maxClaims')), period: fields.get('period'), enabled: fields.has('enabled'), revision });
      if (next) {
        setOverview((current) => ({ ...current, bonus: next }));
        setPolicy((current) => current?.revision === revision ? { ...current, revision: next.revision } : current);
        setAuditVersion((value) => value + 1);
        setBonusDrafts((current) => ({ ...current, [rule]: undefined }));
        toast.success('Đã lưu cấu hình · Chưa cấp xu tự động');
      }
    } catch (err) {
      setConflict(err.status === 409);
      setFeedback({ key: rule, message: err.message });
    }
    finally { setSaving(''); }
  }

  useEffect(() => {
    let active = true;
    read().then((data) => {
      if (active && data) { setPolicy(data); setDraft(data); }
    }).catch((err) => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [read, attempt]);

  async function submit(event) {
    event.preventDefault();
    if (!isOwner || saving || conflict || !window.confirm('Áp dụng hạn mức mới cho tất cả người dùng? Số lượt đã dùng không thay đổi.')) return;
    setSaving('limits');
    setError('');
    setFeedback(null);
    try {
      const next = await save({
        guestLimit: Number(draft.guestLimit), freeLimit: Number(draft.freeLimit), revision: policy.revision,
        ...(draft.sharedAiModelId !== policy.sharedAiModelId && { sharedAiModelId: draft.sharedAiModelId || null }),
      });
      if (next) {
        setOverview((current) => current.bonus?.revision === policy.revision
          ? { ...current, bonus: { ...current.bonus, revision: next.revision } } : current);
        setPolicy(next);
        setDraft(next);
        setAuditVersion((value) => value + 1);
        toast.success('Đã áp dụng hạn mức mới.');
      }
    } catch (err) {
      setConflict(err.status === 409);
      setFeedback({ key: 'limits', message: err.message });
    }
    finally { setSaving(''); }
  }

  return <>
    <section className="rounded-xl bg-panel p-5">
      <h1 className="font-heading text-3xl font-bold">Quản lý Gói &amp; Hạn mức</h1>
      <p className="mt-1 text-muted">{isOwner ? 'Cấu hình lượt dịch cho khách và tài khoản Free.' : 'Chính sách lượt dịch hiện tại. Bạn chỉ có quyền xem.'}</p>
    </section>
    {error && <p role="alert" className="text-danger">{error}</p>}
    {((!policy && error) || Object.values(overview).some((section) => section?.error)) &&
      <button type="button" className="soft-button justify-self-start" disabled={!!saving} onClick={reload}>Tải lại dữ liệu</button>}
    {!policy && !error && <p role="status">Đang tải hạn mức…</p>}
    {policy && <QuotaPolicyForm {...{ policy, draft, isOwner, saving, feedback }} models={overview.models} blocked={conflict} onReload={reload} onSubmit={submit} onChange={(key, value) => {
      setDraft({ ...draft, [key]: value });
      if (feedback?.key === 'limits') setFeedback(null);
    }} />}
    <QuotaOverview {...overview} {...{ isOwner, saving, feedback, bonusDrafts }} blocked={conflict} onReload={reload} onSave={submitBonus} onChange={(key, values) => {
      setBonusDrafts((current) => ({ ...current, [key]: values }));
      if (feedback?.key === key) setFeedback(null);
    }} />
    <QuotaAudit {...overview.audit} loading={!overview.audit} />
  </>;
}

function SaveFeedback({ feedback, blocked, onReload }) {
  return <>
    {feedback?.message && <p role="alert" className="text-sm text-danger">{feedback.message}</p>}
    {blocked && <button type="button" className="soft-button" onClick={onReload}>Tải lại dữ liệu</button>}
  </>;
}

export function QuotaPolicyForm({ policy, draft, isOwner, saving, blocked, feedback, models, onReload, onSubmit, onChange }) {
  const eligibleModels = (models?.items ?? []).filter((model) => model.enabled && (model.coinPrice ?? 0) === 0);
  const selectedId = draft.sharedAiModelId || '';
  const selectedModel = eligibleModels.find((model) => model.id === selectedId);
  const modelChanged = (policy.sharedAiModelId || '') !== selectedId;
  return <form onSubmit={onSubmit} className="grid gap-4" aria-labelledby="quota-tier-title">
      <div>
        <h2 id="quota-tier-title" className="font-heading text-xl font-bold">Ma trận gói tài khoản</h2>
        <p className="text-muted">So sánh hạn mức, quyền dùng model và tính năng theo từng gói.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
        {tiers.map(({ key, icon, title, subtitle, unit, cycle, label, min, max, features }) => <section key={title} className={`flex min-w-0 flex-col gap-4 rounded-xl border bg-white p-4 shadow-sm ${key === 'freeLimit' ? 'border-primary/40' : 'border-line'}`}>
          <header className="flex items-start gap-3">
            <span className={`grid size-10 shrink-0 place-items-center rounded-lg ${key ? 'bg-mint/30 text-primary' : 'bg-panel text-muted'}`}><Icon name={icon} /></span>
            <div><h3 className="font-heading text-lg leading-tight font-bold">{title}</h3><p className="mt-1 text-xs text-muted">{subtitle}</p></div>
          </header>
          <div className="min-h-28 rounded-lg bg-panel p-3">
            <p className="text-xs font-semibold text-muted">Hạn mức dịch</p>
            {key ? <><p className="mt-1 text-sm text-muted"><strong className="mr-1 text-2xl text-ink tabular-nums">{policy[key].toLocaleString('vi-VN')}</strong> {unit}</p><p className="mt-1 text-xs text-muted">{cycle}</p></> : <p className="mt-2 font-semibold text-muted">Chưa kích hoạt</p>}
          </div>
          <div className="mb-auto">
            <p className="text-xs font-bold">{key ? 'Tính năng & model' : 'Cấu hình dự kiến'}</p>
            <ul className="mt-2 grid gap-1.5 text-xs text-muted">{features.map((feature) => <li key={feature} className="flex items-start gap-2"><Icon name={key ? 'check_circle' : 'remove'} className={key ? 'text-primary' : ''} />{feature}</li>)}</ul>
          </div>
          {key && isOwner && <label className="grid gap-1 border-t border-line pt-3 text-sm font-semibold">{label}
            <input className="control w-full" type="number" required min={min} max={max} step="1" disabled={!!saving || blocked} value={draft[key]} onChange={(event) => onChange(key, event.target.value)} />
          </label>}
        </section>)}
      </div>
      <section className="grid gap-2 rounded-xl border border-line bg-white p-4">
        <label htmlFor={isOwner ? 'shared-ai-model' : undefined} className="font-semibold">Model AI cho Free và Guest</label>
        <p className="text-sm text-muted">Chỉ dịch thủ công khi có mạng. Dùng chung lượt với Google Dịch và không trừ xu.</p>
        {models?.error && <p role="alert" className="text-sm text-danger">{models.error}</p>}
        {!models && <p role="status" className="text-sm text-muted">Đang tải danh sách model…</p>}
        {isOwner ? <select id="shared-ai-model" className="control" value={selectedId} disabled={!!saving || blocked || !models?.items} onChange={(event) => onChange('sharedAiModelId', event.target.value || null)}>
          <option value="">Không dùng AI</option>
          {selectedId && !selectedModel && <option value={selectedId} disabled>Model đã lưu hiện không khả dụng</option>}
          {eligibleModels.map((model) => <option key={model.id} value={model.id}>{model.name}</option>)}
        </select> : models?.items && <p className="text-sm">{selectedModel?.name ?? (selectedId ? 'Model đã lưu hiện không khả dụng' : 'Không dùng AI')}</p>}
      </section>
      {policy.updatedAt && <p className="text-sm text-muted">Cập nhật lần cuối: {new Date(policy.updatedAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })} · {policy.updatedBy}</p>}
      {isOwner && <div className="flex flex-wrap items-center justify-end gap-2">
        <SaveFeedback feedback={feedback?.key === 'limits' ? feedback : null} blocked={blocked && feedback?.key === 'limits'} onReload={onReload} />
        <button type="submit" disabled={!!saving || blocked || (!modelChanged && tiers.every(({ key }) => !key || String(policy[key]) === String(draft[key])))} className="rounded-lg bg-primary px-4 py-2 font-semibold text-white hover:bg-accent disabled:opacity-50">
          {saving === 'limits' ? 'Đang lưu…' : 'Áp dụng hạn mức'}
        </button>
      </div>}
    </form>;
}

export function QuotaOverview({ bonus, usage, isOwner, saving, blocked, onSave, onChange, onReload, feedback, bonusDrafts = {} }) {
  return <div className="grid items-start gap-4 xl:grid-cols-[3fr_2fr]">
    <section className="rounded-xl border border-line bg-white p-5" aria-labelledby="bonus-rules-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="bonus-rules-title" className="flex items-center gap-2 font-heading text-lg font-bold"><Icon name="card_giftcard" className="text-primary" />Quy tắc cấp xu bổ sung</h2>
        <span className="rounded-full bg-panel px-2.5 py-1 text-xs font-semibold text-muted">Chỉ lưu cấu hình</span>
      </div>
      <p className="mt-1 text-sm text-muted">Các hình thức cấp xu tự động dự kiến chưa áp dụng cho người dùng.</p>
      {bonus?.error && <p className="mt-2 text-sm text-danger" role="alert">{bonus.error}</p>}
      {!bonus && <p className="mt-2 text-sm text-muted" role="status">Đang tải quy tắc…</p>}
      <ul className="mt-4 divide-y divide-line border-y border-line">
        {bonusRules.map(([key, icon, title, allowedPeriods]) => {
          const rule = bonus?.rules?.[key];
          const enabled = rule?.enabled === true;
          const draft = bonusDrafts[key] ?? { reward: rule?.reward ?? '', maxClaims: rule?.maxClaims ?? '', period: rule?.period ?? '', enabled };
          const canSave = draft.reward && draft.maxClaims && draft.period && (Number(draft.reward) !== rule?.reward || Number(draft.maxClaims) !== rule?.maxClaims || draft.period !== rule?.period || Boolean(draft.enabled) !== enabled);
          const updateDraft = ({ target }) => onChange(key, { ...draft, [target.name]: target.type === 'checkbox' ? target.checked : target.value });
          return <li key={key} className="flex items-start gap-3 py-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-panel text-muted"><Icon name={icon} /></span>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold">{title}</h3>
              {bonus?.rules && <p className="mt-0.5 text-xs text-muted">{formatValue(rule)}</p>}
              {isOwner && bonus?.rules && <form aria-label={`Cấu hình ${title}`} onSubmit={(event) => {
                event.preventDefault();
                if (canSave) onSave(event, key);
              }} className="mt-2">
                <fieldset disabled={!!saving || blocked} className="flex min-w-0 flex-wrap items-end gap-2">
                  <label className="grid min-w-0 flex-1 gap-1 text-xs">Xu thưởng<input className="control w-full" name="reward" type="number" required min="1" max="10000" value={draft.reward} onChange={updateDraft} /></label>
                  <label className="grid min-w-0 flex-1 gap-1 text-xs">Số lần tối đa<input className="control w-full" name="maxClaims" type="number" required min="1" max="100" value={draft.maxClaims} onChange={updateDraft} /></label>
                  <label className="grid gap-1 text-xs">Chu kỳ<select className="control" name="period" required value={draft.period} onChange={updateDraft}><option value="" disabled>Chọn</option>{allowedPeriods.map((period) => <option key={period} value={period}>{periods[period]}</option>)}</select></label>
                  <label className="flex items-center gap-2 text-sm"><input name="enabled" type="checkbox" role="switch" checked={Boolean(draft.enabled)} onChange={updateDraft} />Bật quy tắc</label>
                  <button type="submit" className="soft-button" disabled={!canSave || !!saving || blocked} aria-label={`Lưu cấu hình ${title}`}>{saving === key ? 'Đang lưu…' : 'Lưu'}</button>
                </fieldset>
                <SaveFeedback feedback={feedback?.key === key ? feedback : null} blocked={blocked && feedback?.key === key} onReload={onReload} />
              </form>}
            </div>
          </li>;
        })}
      </ul>
    </section>
    <section className="rounded-xl border border-line bg-white p-5" aria-labelledby="resource-share-title">
      <h2 id="resource-share-title" className="flex items-center gap-2 font-heading text-lg font-bold"><Icon name="pie_chart" className="text-primary" />Tỷ trọng lượt gọi AI</h2>
      <p className="mt-1 text-sm text-muted">24 khung giờ gần nhất, kể cả giờ hiện tại. Không phản ánh chi phí hoặc tải OCR.</p>
      {!usage && <p className="mt-4 text-sm text-muted" role="status">Đang tải thống kê…</p>}
      {usage?.error && <p className="mt-4 text-sm text-danger" role="alert">{usage.error}</p>}
      {usage?.total === 0 && <p className="mt-4 rounded-lg bg-panel p-4 text-sm text-muted">Chưa có dữ liệu lượt gọi AI trong khoảng này.</p>}
      {usage?.total > 0 && <ul className="mt-4 grid gap-3">
        {usage.groups.map(({ key, calls, share }) => <li key={key} className="grid gap-1.5">
          <div className="flex flex-wrap justify-between gap-2 text-sm"><span>{groupLabels[key]}</span><span className="font-semibold tabular-nums">{calls.toLocaleString('vi-VN')} lượt · {share.toLocaleString('vi-VN')}%</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-panel" aria-hidden="true"><div style={{ width: `${share}%` }} className={`h-full ${key === 'free' ? 'bg-primary' : 'bg-accent'}`} /></div>
        </li>)}
      </ul>}
      <p className="mt-4 border-t border-line pt-3 text-xs text-muted">Pro Gamer và VIP &amp; Studio chưa kích hoạt.</p>
    </section>
  </div>;
}

export function QuotaAudit({ items = [], error, loading }) {
  return <section className="rounded-xl border border-line bg-white p-5" aria-labelledby="policy-audit-title">
    <h2 id="policy-audit-title" className="flex items-center gap-2 font-heading text-lg font-bold"><Icon name="history" className="text-primary" />Nhật ký điều chỉnh gần nhất</h2>
    <p className="mt-1 text-sm text-muted">Tối đa 50 lần thay đổi gần nhất · Giờ Việt Nam.</p>
    {loading ? <p className="mt-3 text-sm text-muted" role="status">Đang tải nhật ký…</p>
      : error ? <p className="mt-3 text-sm text-danger" role="alert">{error}</p>
      : items.length === 0 ? <p className="mt-3 text-sm text-muted">Chưa có điều chỉnh nào được ghi nhận.</p>
      : <ol className="mt-3 divide-y divide-line border-t border-line">{items.map(({ updatedBy, updatedAt, changes }, index) => <li key={`${updatedAt}:${index}`} className="py-3">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm"><strong className="break-all">{updatedBy}</strong><time dateTime={updatedAt} className="text-muted">{formatTime(updatedAt)}</time></div>
        <ul className="mt-1 grid gap-1 text-sm text-muted">{changes.map(({ field, before, after }) => <li key={field}><span className="font-semibold text-ink">{fields[field]}:</span> {formatValue(before, field === 'bonusRules.checkIn' ? 'lượt' : 'xu')} → {formatValue(after, field === 'bonusRules.checkIn' ? 'lượt' : 'xu')}</li>)}</ul>
      </li>)}</ol>}
  </section>;
}
