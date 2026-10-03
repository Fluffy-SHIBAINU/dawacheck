import { useEffect, useState } from 'react';
import { useApp } from '../state/AppContext';
import { Layout } from '../components/Layout';
import { LANGS } from '../i18n';
import { NG_STATES } from '../core/states';
import { countPendingEvents, logEvent } from '../telemetry/events';
import type { Lang } from '../core/types';

export function Settings() {
  const { t, settings, updateSettings, packs, pendingReports } = useApp();
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
      </div>
      <h2>{t('about_title')}</h2>
      <p>{t('about_body')}</p>
    </Layout>
  );
}
