import type { ReactNode } from 'react';
import type { Reason, Verdict } from '../core/types';
import type { AppApi } from '../state/AppContext';
import { formatDate, formatExpiry } from '../lib/time';

const ICONS = {
  green: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  amber: (
    <>
      <path d="M12 3l9.5 17h-19z" />
      <path d="M12 10v4M12 17.5h.01" />
    </>
  ),
  red: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9 9l6 6M15 9l-6 6" />
    </>
  ),
  unknown: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5V14M12 17.5h.01" />
    </>
  ),
};

const INFO_ONLY: Reason[] = ['registered'];

export function VerdictView({
  verdict: v,
  t,
  onPickSuggestion,
  actions,
}: {
  verdict: Verdict;
  t: AppApi['t'];
  onPickSuggestion?: (nrn: string) => void;
  actions?: ReactNode;
}) {
  const title = { green: t('v_green_title'), amber: t('v_amber_title'), red: t('v_red_title'), unknown: t('v_unknown_title') }[v.level];
  const next = { green: t('next_green'), amber: t('next_amber'), red: t('next_red'), unknown: t('next_unknown') }[v.level];
  const p = v.product;
  const vars = {
    name: p?.name ?? '',
    read: v.correctedFrom ?? '',
    nrn: v.nrn ?? '',
    n: v.flag?.reports ?? 0,
    date: formatExpiry(v.expiry),
  };
  const shown = v.reasons.filter((r) => !(INFO_ONLY.includes(r) && v.level !== 'green'));
  const mismatch = v.reasons.includes('name_mismatch') || v.reasons.includes('strength_mismatch');
  const boxStrength = v.boxStrengths.filter((s) => s.unit === 'MG').map((s) => s.value).join(' / ');
  return (
    <section className="stack" data-testid="verdict" data-level={v.level}>
      <div className={`band band-${v.level}`} role="status">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {ICONS[v.level]}
        </svg>
        <span>{title}</span>
      </div>
      <p><strong>{next}</strong></p>

      {p && (
        <div className="card">
          <h2>{p.name}</h2>
          <span>{p.ingredient}{p.strength ? ` · ${p.strength}` : ''}</span>
          <span className="muted small">{[p.form, p.route].filter(Boolean).join(' · ')}</span>
          <span className="code">{p.nrn}</span>
          {p.regExpiry && <span className="small">{t('reg_valid_to', { date: formatDate(p.regExpiry) })}</span>}
        </div>
      )}

      {mismatch && p && (
        <div className="cmp">
          <div className="cmp-box">
            <span className="label">{t('box_says')}</span>
            <strong>{v.boxName ?? '—'}</strong>
            {boxStrength && <span className="code">{boxStrength} mg</span>}
          </div>
          <div>
            <span className="label">{t('nrn_is', { nrn: p.nrn })}</span>
            <strong>{p.name}</strong>
            <span className="code">{p.strength}</span>
          </div>
        </div>
      )}

      {p && v.level !== 'red' && (p.description || p.packSize) && (
        <div className="look">
          <span className="label">{t('looks_like')}</span>
          {p.description && <span>{p.description}</span>}
          {p.packSize && <span>{t('pack_label', { pack: p.packSize })}</span>}
        </div>
      )}

      {v.alert && (
        <div className="alertcard">
          <strong>{t('alert_label', { id: v.alert.id })}</strong>
          <span>{v.alert.summary || v.alert.title}</span>
          {v.alert.products.some((ap) => ap.batches.length) && (
            <span className="code small">{t('alert_batches', { batches: v.alert.products.flatMap((ap) => ap.batches).join(', ') })}</span>
          )}
        </div>
      )}

      <ul className="reasons">
        {shown.map((r) => (
          <li key={r}>{t(`r_${r}` as Parameters<AppApi['t']>[0], vars)}</li>
        ))}
      </ul>

      {v.ingredientAlertNote && <p className="notice small">{t('ingredient_note', { ingredient: v.ingredientAlertNote })}</p>}

      {v.suggestions.length > 0 && onPickSuggestion && (
        <div className="stack">
          <span className="label">{t('did_you_mean')}</span>
          {v.suggestions.map((s) => (
            <button key={`${s.nrn}-${s.name}`} type="button" className="btn btn-plain" onClick={() => onPickSuggestion(s.nrn)}>
              <span className="code">{s.nrn}</span> {s.name}
            </button>
          ))}
        </div>
      )}

      {actions}
    </section>
  );
}
