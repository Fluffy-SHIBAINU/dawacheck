import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../state/AppContext';
import { Layout } from '../components/Layout';
import { listChecks } from '../data/checks';
import type { CheckRow } from '../data/db';
import { timeAgo } from '../lib/time';

export function History() {
  const { t } = useApp();
  const [rows, setRows] = useState<CheckRow[]>([]);
  useEffect(() => {
    void listChecks(200).then(setRows);
  }, []);
  return (
    <Layout>
      <h1>{t('history_title')}</h1>
      {rows.length === 0 ? (
        <p className="muted">{t('history_empty')}</p>
      ) : (
        <div className="list">
          {rows.map((c) => (
            <Link key={c.id} to={`/result/${c.id}`}>
              <span className={`dot dot-${c.level}`} />
              <span className="stack" style={{ gap: 0, flex: 1 }}>
                <span>{c.productName ?? c.nrn ?? '—'}</span>
                <span className="small muted"><span className="code">{c.nrn ?? ''}</span> · {timeAgo(c.createdAt)}</span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </Layout>
  );
}
