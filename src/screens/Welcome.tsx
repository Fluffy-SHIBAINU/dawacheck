import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../state/AppContext';
import { LANGS } from '../i18n';
import { NG_STATES } from '../core/states';
import { logEvent } from '../telemetry/events';
import type { Lang } from '../core/types';

export function Welcome() {
  const { t, settings, updateSettings } = useApp();
  const navigate = useNavigate();
  const [step, setStep] = useState<'lang' | 'consent'>('lang');
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState<string>('');

  async function pick(lang: Lang) {
    await updateSettings({ lang });
    void logEvent('lang_selected', { lang });
    setStep('consent');
  }

  async function finish() {
    await updateSettings({ consent, state: state || null, onboarded: true });
    void logEvent('consent_changed', { value: consent });
    navigate('/', { replace: true });
  }

  return (
    <div className="app">
      <main className="main">
        <span className="brand">{t('app_name')}</span>
        {step === 'lang' ? (
          <>
            <h1>{t('welcome_title')}</h1>
            <div className="stack">
              {LANGS.map((l) => (
                <button key={l.code} type="button" className={`btn ${settings.lang === l.code ? 'btn-primary' : 'btn-outline'}`} onClick={() => pick(l.code)}>
                  {l.native}
                  {l.draft && <span className="small"> · {t('draft_badge')}</span>}
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <h1>{t('consent_title')}</h1>
            <p>{t('consent_body')}</p>
            <label className="check">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              {t('consent_yes')}
            </label>
            <label className="field">
              <span className="label">{t('state_label')}</span>
              <select value={state} onChange={(e) => setState(e.target.value)}>
                <option value="">{t('state_none')}</option>
                {NG_STATES.map((s) => (
                  <option key={s.code} value={s.code}>{s.name}</option>
                ))}
              </select>
            </label>
            <button type="button" className="btn btn-primary" onClick={finish}>{t('continue')}</button>
          </>
        )}
      </main>
    </div>
  );
}
