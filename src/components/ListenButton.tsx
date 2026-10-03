import { useEffect } from 'react';
import { useApp } from '../state/AppContext';
import { playClip } from '../voice/player';
import type { ClipKey } from '../voice/clips';
import { logEvent } from '../telemetry/events';

export function ListenButton({ clip, label, autoPlay = false }: { clip: ClipKey; label?: string; autoPlay?: boolean }) {
  const { t, settings } = useApp();
  const play = async () => {
    const ok = await playClip(clip, settings.lang);
    void logEvent('voice_played', { key: clip, lang: settings.lang, ok });
  };
  useEffect(() => {
    if (autoPlay) void playClip(clip, settings.lang);
  }, [autoPlay, clip, settings.lang]);
  return (
    <button type="button" className="btn btn-outline" onClick={play} data-testid="listen">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 10v4h4l5 4V6L8 10z" />
        <path d="M16 9a4 4 0 0 1 0 6" />
      </svg>
      {label ?? t('listen')}
    </button>
  );
}
