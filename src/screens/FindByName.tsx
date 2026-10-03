import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useApp } from '../state/AppContext';
import { Layout } from '../components/Layout';
import { searchRegister } from '../core/search';

export function FindByName() {
  const { t, ctx } = useApp();
  const [params] = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  const results = useMemo(() => (ctx ? searchRegister(ctx.register, q) : []), [ctx, q]);
  const enough = q.replace(/[^A-Za-z0-9]/g, '').length >= 3;

  return (
    <Layout>
      <h1>{t('find_title')}</h1>
      <label className="field">
        <span className="muted">{t('find_placeholder')}</span>
        <input
          type="search"
          autoComplete="off"
          autoFocus
          value={q}
          placeholder={t('find_placeholder')}
          onChange={(e) => setQ(e.target.value)}
          data-testid="find-input"
        />
      </label>
      {!enough ? (
        <p className="muted small">{t('find_hint')}</p>
      ) : results.length === 0 ? (
        <p className="muted">{t('find_none')}</p>
      ) : (
        <>
          <span className="label">{t('find_count', { n: results.length })}</span>
          <div className="list" data-testid="find-results">
            {results.map((p, i) => (
              <Link key={`${p.nrn}-${i}`} to={`/product/${encodeURIComponent(p.nrn)}`}>
                <span className={`dot dot-${p.status === 'Active' ? 'green' : 'amber'}`} />
                <span className="stack" style={{ gap: 0 }}>
                  <span>{p.name}</span>
                  <span className="small muted">{[p.strength, p.form].filter(Boolean).join(' · ')}</span>
                  <span className="small">
                    <span className="code">{p.nrn}</span> · {p.status === 'Active' ? t('status_active') : t('status_inactive')}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </>
      )}
    </Layout>
  );
}
