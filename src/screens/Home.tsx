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
import { INSTALL_HINT_KEY, isIos, isStandalone } from '../lib/install';

function hintDismissed(): boolean {
  try {
    return localStorage.getItem(INSTALL_HINT_KEY) === '1';
  } catch {
    return false;
  }
}

export function Home() {
  const { t, lastSync, packs } = useApp();
  const navigate = useNavigate();
  const [recent, setRecent] = useState<CheckRow[]>([]);
  const [showInstall, setShowInstall] = useState(
    () => isIos(navigator.userAgent, navigator.maxTouchPoints ?? 0) && !isStandalone() && !hintDismissed(),
  );

  function dismissInstall() {
    try {
      localStorage.setItem(INSTALL_HINT_KEY, '1');
    } catch {
      /* private mode: hide for this visit only */
    }
    setShowInstall(false);
  }

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
      {showInstall && (
        <div className="card small" data-testid="install-hint">
          <span>{t('install_ios')}</span>
          <button type="button" className="btn btn-outline" onClick={dismissInstall}>{t('dismiss')}</button>
        </div>
      )}
      {lastSync && lastSync.ok && Date.now() - new Date(lastSync.at).getTime() < 120_000 && (
        <div className="card small" data-testid="sync-summary">
          <strong>{t('sync_sent', { reports: lastSync.sentReports, events: lastSync.sentEvents })}</strong>
          {lastSync.registerTo !== null && (
            <span>{t('sync_register', { from: (lastSync.registerFrom ?? 0).toLocaleString('en'), to: lastSync.registerTo.toLocaleString('en') })}</span>
          )}
          {lastSync.alertsUpdated && <span>{t('sync_alerts', { n: packs?.alerts.alerts.length ?? 0 })}</span>}
          <span>{t('sync_flags', { n: lastSync.flags })}</span>
        </div>
      )}
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
      <Link to="/find" className="btn btn-outline">{t('home_find')}</Link>
      <Link to="/alerts" className="btn btn-outline">{t('home_alerts', { n: packs?.alerts.alerts.length ?? 0 })}</Link>
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
