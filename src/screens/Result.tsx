import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../state/AppContext';
import { Layout } from '../components/Layout';
import { VerdictView } from '../components/VerdictView';
import { getCheck } from '../data/checks';
import type { CheckRow } from '../data/db';
import { logEvent } from '../telemetry/events';
import { ListenButton } from '../components/ListenButton';
import { clipForVerdict } from '../voice/forVerdict';

export function Result() {
  const { id = '' } = useParams();
  const { t, check } = useApp();
  const navigate = useNavigate();
  const [row, setRow] = useState<CheckRow | null>(null);

  useEffect(() => {
    void getCheck(id).then((r) => setRow(r ?? null));
  }, [id]);

  async function pick(nrn: string) {
    if (!row) return;
    void logEvent('suggestion_chosen', { nrn });
    if (row.verdict.nrn) void logEvent('nrn_corrected', { read: row.verdict.nrn, corrected: nrn });
    const next = await check({ ...row.input, nrnCandidates: [nrn] });
    navigate(`/result/${next.id}`, { replace: true });
  }

  if (!row) return <Layout><p className="muted">…</p></Layout>;
  return (
    <Layout>
      <VerdictView
        verdict={row.verdict}
        t={t}
        onPickSuggestion={pick}
        actions={
          <div className="stack">
            <ListenButton clip={clipForVerdict(row.verdict)} autoPlay />
            {row.verdict.level !== 'green' && (
              <Link to={`/report/${row.id}`} className="btn btn-outline" data-testid="report-link">{t('report')}</Link>
            )}
            {row.input.source === 'ocr' && (
              <Link to="/type" state={{ read: row.verdict.nrn, text: row.input.text }} className="btn btn-plain">{t('scan_type')}</Link>
            )}
            <Link to="/" className="btn btn-plain">{t('done')}</Link>
          </div>
        }
      />
    </Layout>
  );
}
