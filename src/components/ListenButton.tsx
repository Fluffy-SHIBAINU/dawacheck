import { useEffect, useState } from 'react';
import { useApp } from '../state/AppContext';
import { playClip } from '../voice/player';
import { CLIPS, voiceLangFor, type ClipKey } from '../voice/clips';
import { speak } from '../voice/speech';
import { logEvent } from '../telemetry/events';

export function ListenButton({ clip, label, autoPlay = false }: { clip: ClipKey; label?: string; autoPlay?: boolean }) {
  const { t, settings } = useApp();
  const [unavailable, setUnavailable] = useState(false);
  const play = async () => {
    setUnavailable(false);
    const ok = await playClip(clip, settings.lang);
    // No recorded clip: use the phone's own offline voice (English and Pidgin only).
    const spoke = ok ? false : await speak(CLIPS[clip][voiceLangFor(settings.lang)], settings.lang);
    if (!ok && !spoke) setUnavailable(true);
    void logEvent('voice_played', { key: clip, lang: settings.lang, ok, fallback: spoke });
  };
  useEffect(() => {
    if (autoPlay) void playClip(clip, settings.lang);
  }, [autoPlay, clip, settings.lang]);
  return (
    <>
      <button type="button" className="btn btn-outline" onClick={play} data-testid="listen">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 10v4h4l5 4V6L8 10z" />
          <path d="M16 9a4 4 0 0 1 0 6" />
        </svg>
        {label ?? t('listen')}
      </button>
      {unavailable && (
        <span className="small muted" role="status" data-testid="voice-unavailable">
          {t('voice_unavailable')}
        </span>
      )}
    </>
  );
}
