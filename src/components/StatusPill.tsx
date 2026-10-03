import { useApp } from '../state/AppContext';
import { formatDate } from '../lib/time';

export function StatusPill() {
  const { t, online, packs, pendingReports } = useApp();
  const count = packs?.register.products.length ?? 0;
  return (
    <div className="stack" style={{ gap: 6 }}>
      <span className="pill" data-testid="status-pill">
        <span className={`dot ${online ? 'dot-online' : 'dot-offline'}`} />
        {online ? t('status_online') : t('status_offline')} · {t('status_register', { date: formatDate(packs?.register.version ?? null), count: count.toLocaleString('en') })}
      </span>
      {pendingReports > 0 && <span className="pill">{t('status_pending', { n: pendingReports })}</span>}
    </div>
  );
}
