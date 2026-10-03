import type { Lang } from '../core/types';

export interface SynthLike {
  getVoices(): SpeechSynthesisVoice[];
  speak(u: SpeechSynthesisUtterance): void;
  cancel(): void;
  addEventListener?(type: 'voiceschanged', cb: () => void): void;
  removeEventListener?(type: 'voiceschanged', cb: () => void): void;
}
type UtteranceCtor = new (text: string) => SpeechSynthesisUtterance;

const PREFERRED = ['en-ng', 'en-gb', 'en-us'];

export function pickVoice(voices: SpeechSynthesisVoice[], lang: Lang): SpeechSynthesisVoice | null {
  if (lang !== 'en' && lang !== 'pcm') return null;
  const local = voices.filter((v) => v.localService && v.lang.toLowerCase().replace('_', '-').startsWith('en'));
  for (const p of PREFERRED) {
    const v = local.find((x) => x.lang.toLowerCase().replace('_', '-') === p);
    if (v) return v;
  }
  return local[0] ?? null;
}

/** iOS fills the voice list a moment after load. Wait up to 1 s for it. */
function voices(synth: SynthLike): Promise<SpeechSynthesisVoice[]> {
  const now = synth.getVoices();
  if (now.length || !synth.addEventListener) return Promise.resolve(now);
  return new Promise((resolve) => {
    const done = () => { synth.removeEventListener?.('voiceschanged', done); resolve(synth.getVoices()); };
    synth.addEventListener!('voiceschanged', done);
    setTimeout(done, 1000);
  });
}

export async function speak(
  text: string,
  lang: Lang,
  synth: SynthLike | undefined = globalThis.speechSynthesis,
  Utterance: UtteranceCtor | undefined = globalThis.SpeechSynthesisUtterance,
): Promise<boolean> {
  if (!synth || !Utterance) return false;
  const voice = pickVoice(await voices(synth), lang);
  if (!voice) return false;
  return new Promise((resolve) => {
    const u = new Utterance(text);
    u.voice = voice;
    u.lang = voice.lang;
    u.rate = 0.95;
    u.onend = () => resolve(true);
    u.onerror = () => resolve(false);
    synth.cancel();
    synth.speak(u);
  });
}
