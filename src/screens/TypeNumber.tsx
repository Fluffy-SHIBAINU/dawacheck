import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../state/AppContext';
import { Layout } from '../components/Layout';
import { manualInput } from '../core/parse';
import { logEvent } from '../telemetry/events';

export function TypeNumber() {
  const { t, check } = useApp();
  const navigate = useNavigate();
  const [value, setValue] = useState('');
  const [error, setError] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const input = manualInput(value);
    if (!input) {
      setError(true);
      return;
    }
    void logEvent('manual_entry', {});
    const row = await check(input);
    navigate(`/result/${row.id}`);
  }

  return (
    <Layout>
      <h1>{t('type_title')}</h1>
      <form className="stack" onSubmit={submit}>
        <label className="field">
          <span className="muted">{t('type_hint')}</span>
          <input
            type="text"
            className="code"
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            placeholder="A4-1234"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError(false);
            }}
            data-testid="nrn-input"
          />
        </label>
        {error && <p className="error" role="alert">{t('type_invalid')}</p>}
        <button type="submit" className="btn btn-primary">{t('type_check')}</button>
      </form>
    </Layout>
  );
}
