import { useEffect, useState } from 'react';
import { useApp } from '../state/AppContext';
import { Layout } from '../components/Layout';
import { LANGS } from '../i18n';
import { NG_STATES } from '../core/states';
import { countPendingEvents, logEvent } from '../telemetry/events';
import type { Lang } from '../core/types';
import { timeAgo } from '../lib/time';

export function Settings() {
  const { t, settings, updateSettings, packs, pendingReports, online, syncing, lastSync, syncEnabled, runSync } = useApp();
  const [pendingEvents, setPendingEvents] = useState(0);
  const lang = LANGS.find((l) => l.code === settings.lang);

  useEffect(() => {
    void countPendingEvents().then(setPendingEvents);
  }, []);

  return (
    <Layout>
      <h1>{t('settings_title')}</h1>
      <label className="field">
        <span className="label">{t('settings_language')}</span>
        <select
          value={settings.lang}
          onChange={(e) => {
            const l = e.target.value as Lang;
            void updateSettings({ lang: l });
            void logEvent('lang_selected', { lang: l });
          }}
        >
          {LANGS.map((l) => (
            <option key={l.code} value={l.code}>{l.native}</option>
          ))}
        </select>
      </label>
      {lang?.draft && <p className="notice small">{t('settings_draft')}</p>}
      <label className="field">
        <span className="label">{t('report_state')}</span>
        <select value={settings.state ?? ''} onChange={(e) => void updateSettings({ state: e.target.value || null })}>
          <option value="">{t('state_none')}</option>
          {NG_STATES.map((s) => (
            <option key={s.code} value={s.code}>{s.name}</option>
          ))}
        </select>
      </label>
      <label className="check">
        <input
          type="checkbox"
          checked={settings.consent}
          onChange={(e) => {
            void updateSettings({ consent: e.target.checked });
            void logEvent('consent_changed', { value: e.target.checked });
          }}
          data-testid="consent-toggle"
        />
        {t('settings_share')}
      </label>
      <h2>{t('settings_data')}</h2>
      <div className="card small" data-testid="data-card">
        <span>{t('settings_register', { count: (packs?.register.products.length ?? 0).toLocaleString('en'), version: packs?.register.version ?? '' })}</span>
        <span>{t('settings_alerts', { count: packs?.alerts.alerts.length ?? 0, version: packs?.alerts.version ?? '' })}</span>
        <span>{t('settings_flags', { count: packs?.flags.length ?? 0 })}</span>
        <span>{t('settings_pending', { reports: pendingReports, events: pendingEvents })}</span>
        <span className="small muted">Register version: <span className="code" data-testid="register-version">{packs?.register.version}</span></span>
      </div>
      {syncEnabled ? (
        <>
          <button type="button" className="btn btn-primary" disabled={syncing || !online} onClick={() => void runSync()} data-testid="sync-now">
            {syncing ? t('sync_running') : t('settings_sync')}
          </button>
          <span className="small muted" data-testid="last-sync">{t('settings_last_sync', { when: lastSync ? timeAgo(lastSync.at) : t('settings_never') })}</span>
          {lastSync && !lastSync.ok && <span className="small error">{t('sync_failed')}</span>}
        </>
      ) : (
        <p className="small muted">{t('settings_sync_off')}</p>
      )}
      <h2>{t('about_title')}</h2>
      <p>{t('about_body')}</p>
    </Layout>
  );
}
