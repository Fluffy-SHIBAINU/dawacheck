import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useApp } from '../state/AppContext';
import { Layout } from '../components/Layout';
import { getCheck } from '../data/checks';
import { saveReport, countPendingReports } from '../data/reports';
import type { CheckRow } from '../data/db';
import { NG_STATES } from '../core/states';
import { NAFDAC_HOTLINE, reportReasonFor, smsBody, smsHref } from '../core/sms';
import { REPORT_REASONS, type ReportReason } from '../core/types';
import { blobToDataUrl } from '../lib/blob';
import { logEvent } from '../telemetry/events';
import type { MessageKey } from '../i18n';

export function Report() {
  const { id = '' } = useParams();
  const { t, settings, packs, refreshCounts } = useApp();
  const [row, setRow] = useState<CheckRow | null>(null);
  const [reason, setReason] = useState<ReportReason>('other');
  const [state, setState] = useState<string>(settings.state ?? '');
  const [photo, setPhoto] = useState(false);
  const [note, setNote] = useState('');
  const [saved, setSaved] = useState<number | null>(null);

  useEffect(() => {
    void getCheck(id).then((r) => {
      if (!r) return;
      setRow(r);
      setReason(reportReasonFor(r.verdict));
    });
  }, [id]);

  async function save() {
    if (!row) return;
    await saveReport({
      checkId: row.id,
      nrn: row.verdict.nrn,
      productName: row.verdict.product?.name ?? null,
      reason,
      verdict: row.verdict.level,
      state: state || null,
      note: note.trim() || null,
      photoThumb: photo && row.thumb ? await blobToDataUrl(row.thumb) : null,
      ocrExcerpt: row.input.text ? row.input.text.slice(0, 500) : null,
      lang: settings.lang,
      packVersion: packs?.register.version ?? '',
    });
    void logEvent('report_saved', { reason });
    await refreshCounts();
    setSaved(await countPendingReports());
  }

  if (!row) return <Layout><p className="muted">…</p></Layout>;

  if (saved !== null) {
    const body = smsBody({ nrn: row.verdict.nrn, reason, state: state || null });
    return (
      <Layout>
        <h1 data-testid="report-saved">{t('report_saved')}</h1>
        <div className="queue"><strong>{t('report_waiting', { n: saved })}</strong></div>
        <a className="btn btn-plain" href={smsHref(body)} onClick={() => void logEvent('report_sms_opened', {})}>{t('report_sms')}</a>
        <p className="small muted">{t('report_sms_note')}</p>
        <p>{t('report_hotline')}: <span className="code">{NAFDAC_HOTLINE}</span></p>
        <p className="small muted">{t('report_privacy')}</p>
        <Link to="/" className="btn btn-primary">{t('done')}</Link>
      </Layout>
    );
  }

  return (
    <Layout>
      <h1>{t('report_title')}</h1>
      <p className="code">{row.verdict.nrn ?? '—'} {row.verdict.product?.name ?? ''}</p>
      <label className="field">
        <span className="label">{t('report_reason')}</span>
        <select value={reason} onChange={(e) => setReason(e.target.value as ReportReason)}>
          {REPORT_REASONS.map((r) => (
            <option key={r} value={r}>{t(`reason_${r}` as MessageKey)}</option>
          ))}
        </select>
      </label>
      <label className="field">
        <span className="label">{t('report_state')}</span>
        <select value={state} onChange={(e) => setState(e.target.value)}>
          <option value="">{t('state_none')}</option>
          {NG_STATES.map((s) => (
            <option key={s.code} value={s.code}>{s.name}</option>
          ))}
        </select>
      </label>
      {row.thumb && (
        <label className="check">
          <input type="checkbox" checked={photo} onChange={(e) => setPhoto(e.target.checked)} />
          {t('report_photo')}
        </label>
      )}
      <label className="field">
        <span className="label">{t('report_note')}</span>
        <textarea maxLength={200} rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      <p className="small muted">{t('report_privacy')}</p>
      <button type="button" className="btn btn-primary" onClick={save}>{t('report_save')}</button>
    </Layout>
  );
}
