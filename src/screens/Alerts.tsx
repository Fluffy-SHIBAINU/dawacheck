import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../state/AppContext';
import { Layout } from '../components/Layout';
import { filterAlerts } from '../core/alertSearch';
import { formatDate } from '../lib/time';
import type { AlertKind } from '../core/types';
import type { MessageKey } from '../i18n';

export const alertKindKey = (k: AlertKind) => `alert_kind_${k}` as MessageKey;

export function Alerts() {
  const { t, packs } = useApp();
  const [q, setQ] = useState('');
  const list = useMemo(() => filterAlerts(packs?.alerts.alerts ?? [], q), [packs, q]);

  return (
    <Layout>
      <h1>{t('alerts_title')}</h1>
      <label className="field">
        <span className="muted">{t('alerts_search')}</span>
        <input type="search" autoComplete="off" value={q} placeholder={t('alerts_search')} onChange={(e) => setQ(e.target.value)} data-testid="alerts-input" />
      </label>
      {list.length === 0 ? (
        <p className="muted">{t('alerts_none')}</p>
      ) : (
        <div className="list" data-testid="alerts-list">
          {list.map((a) => {
            const brands = a.products.map((p) => p.brand).filter((b): b is string => Boolean(b));
            const batches = a.products.flatMap((p) => p.batches);
            return (
              <Link key={a.id} to={`/alerts/${encodeURIComponent(a.id)}`}>
                <span className={`dot dot-${a.kind === 'counterfeit' || a.kind === 'unregistered' ? 'red' : 'amber'}`} />
                <span className="stack" style={{ gap: 0 }}>
                  <span>{brands.length ? brands.join(', ') : a.title}</span>
                  <span className="small muted">
                    {t(alertKindKey(a.kind))} · <span className="code">{formatDate(a.date)}</span>
                  </span>
                  {batches.length > 0 && <span className="small code">{batches.slice(0, 4).join(', ')}</span>}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </Layout>
  );
}
