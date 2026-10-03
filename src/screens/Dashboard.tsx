import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getView } from '../sync/api';
import { syncConfig } from '../sync/config';
import { stateName } from '../core/states';

interface Activity { checks: number; red: number; devices: number; reports: number }
interface ByState { state: string; reports: number }
interface ByReason { reason: string; reports: number }
interface Unknown { nrn: string; reports: number; devices: number }
interface Flag { nrn: string; reports: number; devices: number; level: string; states: string[] }

const REASONS: Record<string, string> = {
  not_in_register: 'Not in register', name_mismatch: 'Box does not match number', strength_mismatch: 'Strength does not match',
  pack_expired: 'Pack expired', reg_lapsed: 'Registration not active', on_alert: 'On NAFDAC alert', batch_on_alert: 'Batch on NAFDAC alert',
  alert_product: 'Product has NAFDAC warnings', community_flag: 'Community flag', looks_different: 'Looks different', other: 'Other',
};

export function barWidths(rows: { reports: number }[]): number[] {
  const max = Math.max(0, ...rows.map((r) => r.reports));
  return rows.map((r) => (max ? Math.round((r.reports / max) * 100) : 0));
}

export function Dashboard() {
  const cfg = syncConfig();
  const [data, setData] = useState<{ a: Activity | null; s: ByState[]; r: ByReason[]; u: Unknown[]; f: Flag[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const [a, s, r, u, f] = await Promise.all([
          getView<Activity>('dash_activity'), getView<ByState>('dash_by_state'), getView<ByReason>('dash_by_reason'),
          getView<Unknown>('dash_unknown_nrns'), getView<Flag>('community_flags'),
        ]);
        if (alive) {
          setData({ a: a[0] ?? null, s, r, u, f });
          setError(null);
        }
      } catch (e) {
        if (alive) setError(navigator.onLine ? (e as Error).message : 'Needs internet');
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), 15_000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, []);

  const widths = barWidths(data?.s ?? []);
  return (
    <div className="app wide">
      <header className="topbar">
        <Link to="/" className="brand">DawaCheck · NAFDAC view</Link>
        <span className="pill">Last 7 days{cfg.mode === 'mock' ? ' · Example data' : ''}</span>
      </header>
      <main className="main">
        {error && <p className="error" role="alert">{error}</p>}
        <div className="dash-grid" data-testid="dashboard">
          <section className="card">
            <span className="label">Activity</span>
            <div className="kpis">
              <div><b>{data?.a?.checks ?? 0}</b><span className="small muted">checks</span></div>
              <div><b>{data?.a?.reports ?? 0}</b><span className="small muted">reports</span></div>
              <div><b>{data?.a && data.a.checks ? `${((data.a.red / data.a.checks) * 100).toFixed(1)}%` : '0%'}</b><span className="small muted">red verdicts</span></div>
              <div><b>{data?.a?.devices ?? 0}</b><span className="small muted">phones</span></div>
            </div>
          </section>
          <section className="card">
            <span className="label">Reports by state</span>
            {(data?.s ?? []).map((row, i) => (
              <div key={row.state} className="bar"><span>{stateName(row.state) ?? row.state}</span><i style={{ width: `${widths[i]}%` }} /><span>{row.reports}</span></div>
            ))}
            {!data?.s.length && <span className="muted small">Nothing yet</span>}
          </section>
          <section className="card">
            <span className="label">Reasons</span>
            {(data?.r ?? []).map((row) => (
              <div key={row.reason} className="row" style={{ justifyContent: 'space-between' }}><span>{REASONS[row.reason] ?? row.reason}</span><b>{row.reports}</b></div>
            ))}
          </section>
          <section className="card">
            <span className="label">Numbers not in the register (2+ reports)</span>
            {(data?.u ?? []).map((row) => (
              <div key={row.nrn} className="row" style={{ justifyContent: 'space-between' }}><span className="code">{row.nrn}</span><span>{row.reports} reports · {row.devices} phones</span></div>
            ))}
          </section>
          <section className="card">
            <span className="label">Community flags</span>
            {(data?.f ?? []).map((row) => (
              <div key={row.nrn} className="row" style={{ justifyContent: 'space-between' }}><span className="code">{row.nrn}</span><span>{row.level} · {row.reports} reports · {row.states.join(', ')}</span></div>
            ))}
          </section>
        </div>
      </main>
    </div>
  );
}
