import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { env, sleep } from './lib/env';
import { CLIPS, CLIP_KEYS, type VoiceLang } from '../src/voice/clips';

const key = env('ELEVENLABS_API_KEY');
if (!key) {
  console.error('ELEVENLABS_API_KEY not set: the app will run text-only. Add the key to .env and rerun `npm run voice`.');
  process.exit(2);
}
const force = process.argv.includes('--force');
const model = env('ELEVENLABS_MODEL') ?? 'eleven_v3';
const voiceFor = (l: VoiceLang) => env(`ELEVENLABS_VOICE_ID_${l.toUpperCase()}`) ?? env('ELEVENLABS_VOICE_ID') ?? 'JBFqnCBsd6RMkjVDRZzb';

async function tts(text: string, lang: VoiceLang): Promise<ArrayBuffer> {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceFor(lang)}?output_format=mp3_44100_64`;
  const attempt = async (body: Record<string, unknown>) =>
    fetch(url, { method: 'POST', headers: { 'xi-api-key': key!, 'Content-Type': 'application/json', Accept: 'audio/mpeg' }, body: JSON.stringify(body) });
  let res = await attempt({ text, model_id: model, ...(lang === 'ha' ? { language_code: 'ha' } : {}) });
  if (res.status >= 400 && res.status < 500 && lang === 'ha') res = await attempt({ text, model_id: model });
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.arrayBuffer();
}

let made = 0;
for (const lang of ['en', 'ha', 'pcm'] as VoiceLang[]) {
  mkdirSync(`public/voice/${lang}`, { recursive: true });
  for (const k of CLIP_KEYS) {
    const path = `public/voice/${lang}/${k}.mp3`;
    if (existsSync(path) && !force) continue;
    writeFileSync(path, Buffer.from(await tts(CLIPS[k][lang], lang)));
    made++;
    console.log(`voice ${path}`);
    await sleep(300);
  }
}
console.log(`voice clips generated: ${made}`);
