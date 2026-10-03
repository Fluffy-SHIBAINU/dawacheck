import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { loadPacks, type LoadedPacks } from '../data/packs';
import { getSettings, saveSettings, DEFAULT_SETTINGS, getDeviceId, getMeta, type Settings } from '../data/meta';
import { syncNow, type SyncSummary } from '../sync/sync';
import { syncConfig } from '../sync/config';
import { saveCheck } from '../data/checks';
import { countPendingReports } from '../data/reports';
import type { CheckRow } from '../data/db';
import { logEvent, setEventContext } from '../telemetry/events';
import { buildRegisterIndex } from '../core/registerIndex';
import { buildConfusion } from '../core/confusion';
import { decide, type DecideContext } from '../core/verdict';
import { DEFAULT_THRESHOLDS, type ScanInput } from '../core/types';
import { translate, type MessageKey } from '../i18n';
import { requestPersistence } from '../lib/install';

export interface AppApi {
  status: 'loading' | 'ready' | 'error';
  error: string | null;
  settings: Settings;
  packs: LoadedPacks | null;
  ctx: DecideContext | null;
  online: boolean;
  pendingReports: number;
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
  reloadPacks: () => Promise<void>;
  refreshCounts: () => Promise<void>;
  check: (input: ScanInput, thumb?: Blob | null) => Promise<CheckRow>;
  syncing: boolean;
  lastSync: SyncSummary | null;
  syncEnabled: boolean;
  runSync: () => Promise<void>;
  /** Whether the browser agreed to keep the offline data (null until asked). */
  storagePersisted: 'granted' | 'denied' | 'unsupported' | null;
}

const AppCtx = createContext<AppApi | null>(null);

export function buildDecideContext(p: LoadedPacks, today: Date): DecideContext {
  return {
    register: buildRegisterIndex(p.register),
    alerts: p.alerts.alerts,
    flags: new Map(p.flags.map((f) => [f.nrn, f])),
    confusion: buildConfusion(p.corrections),
    today,
    thresholds: p.manifest?.thresholds ?? DEFAULT_THRESHOLDS,
  };
}

export function AppProvider({ children, loader = loadPacks, now = () => new Date() }: { children: ReactNode; loader?: () => Promise<LoadedPacks>; now?: () => Date }) {
  const [status, setStatus] = useState<AppApi['status']>('loading');
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [packs, setPacks] = useState<LoadedPacks | null>(null);
  const [online, setOnline] = useState<boolean>(typeof navigator === 'undefined' ? true : navigator.onLine);
  const [pendingReports, setPending] = useState(0);
  const [storagePersisted, setStoragePersisted] = useState<AppApi['storagePersisted']>(null);

  const refreshCounts = useCallback(async () => {
    setPending(await countPendingReports());
  }, []);

  const reloadPacks = useCallback(async () => {
    const p = await loader();
    setPacks(p);
    setEventContext({ packVersion: p.register.version });
  }, [loader]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await getSettings();
        if (cancelled) return;
        setSettings(s);
        setEventContext({ lang: s.lang });
        await reloadPacks();
        await refreshCounts();
        if (!cancelled) setStatus('ready');
        // Ask the browser not to evict the 16 MB of offline data under storage pressure.
        void requestPersistence().then((r) => {
          if (!cancelled) setStoragePersisted(r);
        });
        void logEvent('app_open', { online: navigator.onLine });
      } catch (e) {
        if (!cancelled) {
          setError((e as Error).message);
          setStatus('error');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadPacks, refreshCounts]);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  // Keep `now` out of the deps: the default arrow is new every render and would rebuild the 8.9k-product index.
  const nowRef = useRef(now);
  const ctx = useMemo(() => (packs ? buildDecideContext(packs, nowRef.current()) : null), [packs]);

  const t = useCallback<AppApi['t']>((key, vars) => translate(settings.lang, key, vars), [settings.lang]);

  const updateSettings = useCallback(async (patch: Partial<Settings>) => {
    const next = await saveSettings(patch);
    setSettings(next);
    setEventContext({ lang: next.lang });
  }, []);

  const check = useCallback<AppApi['check']>(
    async (input, thumb = null) => {
      if (!ctx) throw new Error('packs not loaded');
      const verdict = decide(input, ctx);
      const row = await saveCheck(input, verdict, thumb);
      void logEvent('verdict_shown', { level: verdict.level, reasons: verdict.reasons, source: input.source });
      return row;
    },
    [ctx],
  );

  const cfg = useMemo(() => syncConfig(), []);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<SyncSummary | null>(null);
  const latest = useRef({ packs, settings });
  latest.current = { packs, settings };

  const runSync = useCallback(async () => {
    const { packs: p, settings: s } = latest.current;
    if (!cfg.enabled || !p || !navigator.onLine) return;
    setSyncing(true);
    try {
      const summary = await syncNow({
        consent: s.consent,
        deviceId: await getDeviceId(),
        localVersions: { register: p.register.version, alerts: p.alerts.version, registerCount: p.register.products.length },
      });
      setLastSync(summary);
      void logEvent(
        summary.ok ? 'sync_ok' : 'sync_failed',
        summary.ok
          ? { reports: summary.sentReports, events: summary.sentEvents, packs: summary.registerTo !== null || summary.alertsUpdated }
          : { stage: summary.errors[0]?.split(':')[0] ?? 'unknown', error: (summary.errors[0] ?? '').slice(0, 60) },
      );
      await reloadPacks();
      await refreshCounts();
    } finally {
      setSyncing(false);
    }
  }, [cfg.enabled, reloadPacks, refreshCounts]);

  useEffect(() => {
    void getMeta<SyncSummary>('lastSync').then((s) => {
      if (s) setLastSync(s);
    });
  }, []);

  useEffect(() => {
    if (status !== 'ready') return;
    void runSync();
    const onOnline = () => void runSync();
    const onVisible = () => {
      if (document.visibilityState === 'visible') void runSync();
    };
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisible);
    const timer = window.setInterval(() => void runSync(), 5 * 60_000);
    return () => {
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(timer);
    };
  }, [status, runSync]);

  const api: AppApi = {
    status, error, settings, packs, ctx, online, pendingReports, t, updateSettings, reloadPacks, refreshCounts, check,
    syncing, lastSync, syncEnabled: cfg.enabled, runSync, storagePersisted,
  };
  return <AppCtx.Provider value={api}>{children}</AppCtx.Provider>;
}

export function useApp(): AppApi {
  const v = useContext(AppCtx);
  if (!v) throw new Error('useApp outside AppProvider');
  return v;
}
