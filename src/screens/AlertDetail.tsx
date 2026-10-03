import { Link, useParams } from 'react-router-dom';
import { useApp } from '../state/AppContext';
import { Layout } from '../components/Layout';
import { formatDate } from '../lib/time';
import { alertKindKey } from './Alerts';

export function AlertDetail() {
  const { t, packs, status } = useApp();
  const { id = '' } = useParams();
  const alert = packs?.alerts.alerts.find((a) => a.id === decodeURIComponent(id));

  if (!alert) {
    return (
      <Layout>
        {status === 'ready' && <p className="muted">{t('alerts_none')}</p>}
        <Link to="/alerts" className="btn btn-outline">{t('alerts_title')}</Link>
      </Layout>
    );
  }
  return (
    <Layout>
      <span className="label">
        {t(alertKindKey(alert.kind))} · <span className="code">{formatDate(alert.date)}</span>
      </span>
      <h2>{alert.title}</h2>
      {alert.summary && <p>{alert.summary}</p>}
      {alert.products.map((p, i) => (
        <div className="card small" key={i} data-testid="alert-product">
          <strong>{p.brand ?? p.ingredient ?? '—'}</strong>
          {p.strength && <span>{p.strength}</span>}
          {p.manufacturer && <span className="muted">{p.manufacturer}</span>}
          {p.batches.length > 0 && <span className="code small">{t('alert_batches', { batches: p.batches.join(', ') })}</span>}
        </div>
      ))}
      <a href={alert.url} target="_blank" rel="noopener noreferrer" className="btn btn-plain">{t('alert_open')}</a>
      <Link to="/alerts" className="btn btn-outline">{t('alerts_title')}</Link>
    </Layout>
  );
}
