import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../state/AppContext';
import { Layout } from '../components/Layout';
import { CropBox } from '../components/CropBox';
import { pendingScan } from '../lib/pendingScan';
import { runScan, type ScanResult } from '../ocr/scan';
import type { Crop } from '../ocr/preprocess';
import { logEvent } from '../telemetry/events';

export function Scan() {
  const { t, check } = useApp();
  const navigate = useNavigate();
  const fileRef = useRef<File | null>(pendingScan.take());
  const url = useMemo(() => (fileRef.current ? URL.createObjectURL(fileRef.current) : ''), []);
  const [progress, setProgress] = useState(0);
  const [rotating, setRotating] = useState(false);
  const [phase, setPhase] = useState<'reading' | 'none' | 'crop' | 'failed'>('reading');
  const [result, setResult] = useState<ScanResult | null>(null);
  const [crop, setCrop] = useState<Crop | null>(null);

  async function finish(r: ScanResult) {
    const row = await check(r.input, r.thumb);
    navigate(`/result/${row.id}`, { replace: true });
  }

  useEffect(() => {
    const file = fileRef.current;
    if (!file) {
      navigate('/', { replace: true });
      return;
    }
    let cancelled = false;
    runScan(file, { onProgress: setProgress, onStage: () => setRotating(true) })
      .then(async (r) => {
        if (cancelled) return;
        setResult(r);
        void logEvent('ocr_done', { ms: r.ms, pass: r.pass, rotation: r.rotation, foundNrn: r.input.nrnCandidates.length > 0, conf: Math.round(r.confidence) });
        if (r.input.nrnCandidates.length) await finish(r);
        else setPhase('none');
      })
      .catch((e: Error) => {
        if (cancelled) return;
        void logEvent('ocr_failed', { error: e.message.slice(0, 60) });
        setPhase('failed');
      });
    return () => {
      cancelled = true;
      URL.revokeObjectURL(url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function readCrop() {
    if (!crop || !fileRef.current) return;
    setPhase('reading');
    void logEvent('crop_used', {});
    try {
      const r = await runScan(fileRef.current, { crop, previousText: result?.text ?? '', onProgress: setProgress });
      setResult(r);
      if (r.input.nrnCandidates.length) await finish(r);
      else setPhase('none');
    } catch {
      setPhase('failed');
    }
  }

  return (
    <Layout>
      {phase === 'crop' ? (
        <>
          <p>{t('scan_crop_help')}</p>
          <CropBox src={url} onChange={setCrop} />
          <button type="button" className="btn btn-primary" disabled={!crop} onClick={readCrop}>{t('scan_crop_done')}</button>
        </>
      ) : (
        <div className="photo"><img src={url} alt="" /></div>
      )}
      {phase === 'reading' && (
        <>
          <span className="label" data-testid="ocr-stage">{rotating ? t('scan_rotate') : t('scan_reading')}</span>
          <div className="progress" data-testid="ocr-progress"><i style={{ width: `${Math.round(progress * 100)}%` }} /></div>
          <p className="small muted">{t('scan_private')}</p>
        </>
      )}
      {(phase === 'none' || phase === 'failed') && (
        <>
          <p className="error" role="alert">{phase === 'none' ? t('scan_none') : t('scan_failed')}</p>
          {phase === 'none' && <button type="button" className="btn btn-outline" onClick={() => setPhase('crop')}>{t('scan_crop')}</button>}
          <button type="button" className="btn btn-plain" onClick={() => navigate('/type', { state: { read: result?.input.nrnCandidates[0] ?? null, text: result?.text ?? '' } })}>
            {t('scan_type')}
          </button>
        </>
      )}
    </Layout>
  );
}
