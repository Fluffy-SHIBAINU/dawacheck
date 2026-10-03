import { useEffect, useState, type ChangeEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../state/AppContext';
import { Layout } from '../components/Layout';
import { StatusPill } from '../components/StatusPill';
import { listChecks } from '../data/checks';
import type { CheckRow } from '../data/db';
import { pendingScan } from '../lib/pendingScan';
import { logEvent } from '../telemetry/events';
import { ListenButton } from '../components/ListenButton';

export function Home() {
  const { t } = useApp();
  const navigate = useNavigate();
  const [recent, setRecent] = useState<CheckRow[]>([]);

  useEffect(() => {
    void listChecks(5).then(setRecent);
  }, []);

  function onFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    pendingScan.set(f);
    void logEvent('scan_started', { via: 'camera' });
    navigate('/scan');
  }

  return (
    <Layout>
      <StatusPill />
      <label className="btn btn-primary btn-hero" data-testid="check-button">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
          <circle cx="12" cy="13" r="3.5" />
        </svg>
        <strong>{t('home_check')}</strong>
        <span>{t('home_check_sub')}</span>
        <input className="visually-hidden" type="file" accept="image/*" capture="environment" onChange={onFile} data-testid="photo-input" />
      </label>
      <Link to="/type" className="btn btn-outline">{t('home_type')}</Link>
      <ListenButton clip="howto" label={t('home_listen')} />
      <span className="label">{t('home_recent')}</span>
      {recent.length === 0 ? (
        <p className="muted">{t('home_no_recent')}</p>
      ) : (
        <div className="list">
          {recent.map((c) => (
            <Link key={c.id} to={`/result/${c.id}`}>
              <span className={`dot dot-${c.level}`} />
              <span className="stack" style={{ gap: 0 }}>
                <span>{c.productName ?? c.nrn ?? '—'}</span>
                <span className="small muted code">{c.nrn ?? ''}</span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </Layout>
  );
}
