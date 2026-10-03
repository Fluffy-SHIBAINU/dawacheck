import type { Lang } from '../core/types';
import { voiceLangFor, type ClipKey, type VoiceLang } from './clips';

export function clipUrl(key: ClipKey, lang: VoiceLang): string {
  return `${import.meta.env.BASE_URL ?? '/'}voice/${lang}/${key}.mp3`;
}

let shared: HTMLAudioElement | null = null;

export async function playClip(key: ClipKey, lang: Lang, audioFactory?: () => HTMLAudioElement): Promise<boolean> {
  const order: VoiceLang[] = voiceLangFor(lang) === 'en' ? ['en'] : [voiceLangFor(lang), 'en'];
  for (const l of order) {
    const audio = audioFactory ? audioFactory() : (shared ??= new Audio());
    audio.src = clipUrl(key, l);
    try {
      await audio.play();
      return true;
    } catch {
      /* try the next language */
    }
  }
  return false;
}
