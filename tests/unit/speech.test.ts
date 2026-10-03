import { pickVoice, speak, unlockSpeech } from '../../src/voice/speech';

const voice = (lang: string, localService = true, name = lang) => ({ lang, localService, name, default: false, voiceURI: name }) as SpeechSynthesisVoice;

class FakeUtterance {
  text: string; voice: SpeechSynthesisVoice | null = null; lang = ''; rate = 1; volume = 1;
  onend: (() => void) | null = null; onerror: ((e: { error: string }) => void) | null = null;
  constructor(text: string) { this.text = text; }
}

function fakeSynth(voices: SpeechSynthesisVoice[], outcome: 'end' | 'error' = 'end', error = 'synthesis-failed') {
  const spoken: FakeUtterance[] = [];
  return {
    spoken,
    getVoices: () => voices,
    cancel: vi.fn(),
    speak: (u: FakeUtterance) => { spoken.push(u); queueMicrotask(() => (outcome === 'end' ? u.onend?.() : u.onerror?.({ error }))); },
    addEventListener: vi.fn(), removeEventListener: vi.fn(),
  };
}

test('prefers a local Nigerian English voice, then British, then US', () => {
  expect(pickVoice([voice('en-US'), voice('en-GB'), voice('en-NG')], 'en')?.lang).toBe('en-NG');
  expect(pickVoice([voice('en-US'), voice('en-GB')], 'pcm')?.lang).toBe('en-GB');
  expect(pickVoice([voice('en_US')], 'en')?.lang).toBe('en_US');
});

test('ignores network voices and has no voice for Hausa, Yoruba or Igbo', () => {
  expect(pickVoice([voice('en-NG', false)], 'en')).toBeNull();
  for (const l of ['ha', 'yo', 'ig'] as const) expect(pickVoice([voice('en-US')], l)).toBeNull();
});

test('speak resolves true when speech ends and uses the picked voice', async () => {
  const s = fakeSynth([voice('en-US')]);
  await expect(speak('Registered with NAFDAC', 'en', s as never, FakeUtterance as never)).resolves.toBe(true);
  expect(s.spoken[0].text).toBe('Registered with NAFDAC');
  expect(s.spoken[0].voice?.lang).toBe('en-US');
});

test('speak resolves false on error, for Hausa, and when speech is unsupported', async () => {
  await expect(speak('x', 'en', fakeSynth([voice('en-US')], 'error') as never, FakeUtterance as never)).resolves.toBe(false);
  const s = fakeSynth([voice('en-US')]);
  await expect(speak('x', 'ha', s as never, FakeUtterance as never)).resolves.toBe(false);
  expect(s.spoken).toHaveLength(0);
  await expect(speak('x', 'en', undefined, undefined)).resolves.toBe(false);
});

test('an utterance cut off by a newer tap still counts as spoken', async () => {
  for (const error of ['interrupted', 'canceled']) {
    await expect(speak('x', 'en', fakeSynth([voice('en-US')], 'error', error) as never, FakeUtterance as never)).resolves.toBe(true);
  }
  await expect(speak('x', 'en', fakeSynth([voice('en-US')], 'error', 'synthesis-failed') as never, FakeUtterance as never)).resolves.toBe(false);
});

test('unlockSpeech speaks one silent empty utterance, only the first time', () => {
  expect(() => unlockSpeech(undefined, undefined)).not.toThrow();
  const s = fakeSynth([voice('en-US')]);
  unlockSpeech(s as never, FakeUtterance as never);
  unlockSpeech(s as never, FakeUtterance as never);
  expect(s.spoken).toHaveLength(1);
  expect(s.spoken[0]).toMatchObject({ text: '', volume: 0 });
});
