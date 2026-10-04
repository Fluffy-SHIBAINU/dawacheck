// Builds a draft demo video from real screens of the live app (media/shots, from capture.ts),
// ElevenLabs narration and the app's own recorded voice clips. Output: media/dawacheck-demo-draft.mp4
// Steps are cached: delete media/narration or media/frames to redo them.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import ffmpegPath from 'ffmpeg-static';
import { chromium } from '@playwright/test';
import { env } from '../lib/env';

const FF = ffmpegPath as unknown as string;
const T = 0.4; // crossfade seconds
type Frame = { kind: 'phone' | 'wide' | 'card'; img?: string; kicker?: string; title: string; sub?: string; weight?: number };
type Segment = { id: string; say: string; appClip?: string; frames: Frame[]; higgsfield?: string };

export const STORY: Segment[] = [
  { id: 'intro', higgsfield: 'H1', say: 'One in ten medicines in low- and middle-income countries is fake or substandard. In rural Nigeria, three in four people buy medicine from a shop with no pharmacist, often with no internet.',
    frames: [
      { kind: 'card', kicker: 'World Health Organization', title: '1 in 10 medical products', sub: 'in low- and middle-income countries is substandard or falsified' },
      { kind: 'card', kicker: 'Rural Nigeria', title: '3 in 4 people', sub: 'go first to a medicine shop with no pharmacist' },
    ] },
  { id: 'offline', higgsfield: 'H2', say: 'DawaCheck works with no internet. Everything it needs is already on the phone.',
    frames: [
      { kind: 'phone', img: '01-welcome', kicker: 'DawaCheck', title: 'Check a medicine with no internet', sub: 'Hausa, English, Pidgin, Yoruba and Igbo' },
      { kind: 'phone', img: '03-home-ha-offline', kicker: 'Offline', title: 'Everything is on the phone', sub: '8,922 registered products and 84 NAFDAC alerts' },
    ] },
  { id: 'green', say: 'Take a photo of the box. DawaCheck reads the NAFDAC number on the phone, checks the full register, and says the answer in Hausa.', appClip: 'public/voice/ha/v_green.mp3',
    frames: [
      { kind: 'phone', img: '04-scan-reading', kicker: 'On-device OCR', title: 'Reads the box on the phone', sub: 'The photo never leaves the phone', weight: 0.8 },
      { kind: 'phone', img: '05-green-ha', kicker: 'Green', title: 'Registered with NAFDAC', sub: 'Shown and spoken in Hausa', weight: 1.6 },
    ] },
  { id: 'amber', higgsfield: 'H3', say: 'This box copies a real number, but the name and strength are different. DawaCheck catches it, and saves a report, even offline.',
    frames: [
      { kind: 'phone', img: '06-amber-en', kicker: 'Amber', title: 'The box does not match its number', sub: 'Fakes often copy a registered number' },
      { kind: 'phone', img: '07-report', kicker: 'Report', title: 'Report it in two taps', sub: 'No name or phone number', weight: 0.7 },
      { kind: 'phone', img: '08-report-saved', kicker: 'Offline', title: 'Saved on the phone', sub: 'Sends itself when there is signal', weight: 0.8 },
    ] },
  { id: 'red', say: 'Products named in NAFDAC alerts are red, in Pidgin, Hausa or English.', appClip: 'public/voice/pcm/v_red_alert.mp3',
    frames: [
      { kind: 'phone', img: '09-red-pcm', kicker: 'Red', title: 'Named in a NAFDAC alert', sub: 'Here in Nigerian Pidgin', weight: 2.4 },
      { kind: 'phone', img: '10-alert-detail-pcm', kicker: '84 alerts', title: 'The NAFDAC alert, offline', sub: 'Brands and batch numbers read by Claude', weight: 0.7 },
    ] },
  { id: 'find', say: 'If the number is hard to read, find the medicine by name, or search every NAFDAC alert. Still offline.',
    frames: [
      { kind: 'phone', img: '11-find-en', kicker: 'Find by name', title: 'Compare the box with the register', sub: 'Brand, ingredient or part of the number' },
      { kind: 'phone', img: '12-alerts-en', kicker: 'NAFDAC alerts', title: 'Search by medicine or batch', sub: 'For vendors and health workers' },
    ] },
  { id: 'sync', say: 'When any connection appears, reports go up, and fresh data comes down: new products, new alerts, and flags from other users.',
    frames: [
      { kind: 'phone', img: '13-home-en-synced', kicker: 'Back online', title: 'The report is sent', sub: 'Supabase, insert-only, no personal data' },
      { kind: 'phone', img: '02-home-ha-first-sync', kicker: 'It learns', title: 'Fresher data comes down', sub: 'Register updated: 8,910 to 8,922 products' },
    ] },
  { id: 'dashboard', say: 'NAFDAC sees where reports cluster, with no personal data.',
    frames: [{ kind: 'wide', img: '14-dashboard', kicker: 'Regulator view', title: 'Where reports cluster', sub: 'Live from the phones, aggregates only' }] },
  { id: 'numbers', say: 'About nineteen megabytes in total, voices included. No GPU, and no cloud for a verdict. Next: a pilot with medicine vendors in Kano, then Kenya and Ghana.',
    frames: [{ kind: 'card', kicker: 'Small AI', title: '19.0 MB', sub: 'Register 4.8 · OCR 10.9 · Voices 2.2 · Alerts 0.1 · App 0.5 (MB)' }] },
  { id: 'end', higgsfield: 'H4', say: 'DawaCheck. Check before you take.',
    frames: [{ kind: 'card', kicker: 'dawacheck-smoky.vercel.app', title: 'DawaCheck', sub: 'github.com/Fluffy-SHIBAINU/dawacheck · App screens recorded from the live app' }] },
];

const OUT = 'media';
const dur = (file: string): number => {
  let out = '';
  try {
    execFileSync(FF, ['-hide_banner', '-i', file], { stdio: 'pipe' });
  } catch (e) {
    out = String((e as { stderr?: Buffer }).stderr ?? '');
  }
  const m = /Duration: (\d+):(\d+):([\d.]+)/.exec(out);
  if (!m) throw new Error(`no duration for ${file}`);
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
};

async function narrate(): Promise<void> {
  const key = env('ELEVENLABS_API_KEY');
  if (!key) throw new Error('ELEVENLABS_API_KEY missing');
  const voice = env('ELEVENLABS_NARRATOR_VOICE_ID') ?? env('ELEVENLABS_VOICE_ID') ?? 'JBFqnCBsd6RMkjVDRZzb';
  mkdirSync(`${OUT}/narration`, { recursive: true });
  for (const s of STORY) {
    const path = `${OUT}/narration/${s.id}.mp3`;
    if (existsSync(path)) continue;
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`, {
      method: 'POST',
      headers: { 'xi-api-key': key, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
      body: JSON.stringify({ text: s.say, model_id: 'eleven_multilingual_v2', voice_settings: { stability: 0.5, similarity_boost: 0.75 } }),
    });
    if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 200)}`);
    writeFileSync(path, Buffer.from(await res.arrayBuffer()));
    console.log('narration', path);
  }
}

const css = `
*{margin:0;box-sizing:border-box}body{width:1920px;height:1080px;background:#0E1A15;color:#F2F7F4;font-family:'Atkinson Hyperlegible',Verdana,sans-serif;overflow:hidden}
.k{font-size:30px;letter-spacing:5px;text-transform:uppercase;color:#45C08D;font-weight:700}
.t{font-family:'Archivo',Arial,sans-serif;font-weight:800;line-height:1.05}
.s{font-size:40px;line-height:1.3;color:#BFD8D0}
.phone{position:absolute;left:250px;top:50px;width:574px;height:980px;border-radius:64px;background:#050B08;padding:22px;box-shadow:0 30px 80px rgba(0,0,0,.5)}
.phone img{width:100%;height:100%;object-fit:cover;object-position:top;border-radius:44px}
.cap{position:absolute;left:940px;top:0;width:860px;height:1080px;display:flex;flex-direction:column;justify-content:center;gap:28px}
.cap .t{font-size:84px}
.card{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;padding:0 180px;gap:30px}
.card .t{font-size:150px;color:#FBFCFB}
.card .s{font-size:48px;max-width:1500px}
.wide{position:absolute;left:120px;top:330px;width:1680px;height:450px;border-radius:24px;overflow:hidden;background:#F6F9F7;box-shadow:0 30px 80px rgba(0,0,0,.5)}
.wide img{width:2199px;height:auto;margin-left:-259px}
.whead{position:absolute;left:120px;top:70px;width:1680px;display:flex;flex-direction:column;gap:12px}
.whead .t{font-size:72px}
`;

function html(f: Frame): string {
  const img = f.img ? `data:image/png;base64,${readFileSync(`${OUT}/shots/${f.img}.png`).toString('base64')}` : '';
  const kicker = f.kicker ? `<p class="k">${f.kicker}</p>` : '';
  const sub = f.sub ? `<p class="s">${f.sub}</p>` : '';
  const body =
    f.kind === 'phone'
      ? `<div class="phone"><img src="${img}"></div><div class="cap">${kicker}<h1 class="t">${f.title}</h1>${sub}</div>`
      : f.kind === 'wide'
        ? `<div class="whead">${kicker}<h1 class="t">${f.title}</h1>${sub}</div><div class="wide"><img src="${img}"></div>`
        : `<div class="card">${kicker}<h1 class="t">${f.title}</h1>${sub}</div>`;
  return `<!doctype html><html><head><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@800&family=Atkinson+Hyperlegible:wght@400;700&display=swap"><style>${css}</style></head><body>${body}</body></html>`;
}

async function renderFrames(): Promise<void> {
  mkdirSync(`${OUT}/frames`, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  for (const s of STORY) {
    for (const [i, f] of s.frames.entries()) {
      const path = `${OUT}/frames/${s.id}-${i}.png`;
      if (existsSync(path)) continue;
      await page.setContent(html(f), { waitUntil: 'networkidle' });
      await page.evaluate(async () => { await document.fonts.ready; });
      await page.screenshot({ path });
      console.log('frame', path);
    }
  }
  await browser.close();
}

function build(): void {
  // Each segment lasts narration + 0.6 s, plus the app's own clip (played after the narration) + 0.5 s.
  const clips: { png: string; d: number; video?: boolean }[] = [];
  const audio: { file: string; at: number }[] = [];
  let t = 0;
  for (const s of STORY) {
    const nd = dur(`${OUT}/narration/${s.id}.mp3`);
    const ad = s.appClip ? dur(s.appClip) + 0.5 : 0;
    // Optional Higgsfield scene (media/higgsfield/<H>.mp4): plays first in the segment, under the narration.
    const scenePath = s.higgsfield ? `${OUT}/higgsfield/${s.higgsfield}.mp4` : '';
    const scene = scenePath && existsSync(scenePath) ? Math.max(0, Math.min(dur(scenePath) - T, 6)) : 0;
    const nClips = s.frames.length + (scene ? 1 : 0);
    const segLen = Math.max(nd + 0.6 + ad, s.id === 'end' ? 5 : 0) + scene + T * (nClips - 1);
    audio.push({ file: `${OUT}/narration/${s.id}.mp3`, at: t + 0.3 });
    if (s.appClip) audio.push({ file: s.appClip, at: t + 0.3 + Math.max(nd + 0.4, scene) });
    if (scene) clips.push({ png: scenePath, d: scene + T, video: true });
    const rest = segLen - (scene ? scene + T : 0);
    const wsum = s.frames.reduce((a, f) => a + (f.weight ?? 1), 0);
    s.frames.forEach((f, i) => clips.push({ png: `${OUT}/frames/${s.id}-${i}.png`, d: (rest * (f.weight ?? 1)) / wsum }));
    t += segLen - T * (nClips - 1);
    t -= T; // the next segment's first frame crossfades into this one
  }
  // Timing model: clip i starts fading in at S_i = sum over earlier clips of (d - T) and its input lasts d,
  // so each crossfade overlaps the end of one clip with the start of the next. The audio offsets above use
  // the same model (a segment advances by the sum of its clips' d - T).
  const starts: number[] = [];
  let acc = 0;
  for (const c of clips) {
    starts.push(acc);
    acc += c.d - T;
  }
  const total = starts[starts.length - 1] + clips[clips.length - 1].d;
  const args = ['-y', '-hide_banner', '-loglevel', 'error'];
  for (const c of clips) args.push(...(c.video ? [] : ['-loop', '1']), '-t', c.d.toFixed(3), '-i', c.png);
  for (const a of audio) args.push('-i', a.file);
  const v: string[] = [];
  clips.forEach((c, i) => v.push(`[${i}:v]scale=1920:1080${c.video ? ':force_original_aspect_ratio=increase,crop=1920:1080' : ''},fps=30,format=yuv420p,setsar=1[v${i}]`));
  let last = 'v0';
  for (let i = 1; i < clips.length; i++) {
    const out = i === clips.length - 1 ? 'vout' : `x${i}`;
    v.push(`[${last}][v${i}]xfade=transition=fade:duration=${T}:offset=${starts[i].toFixed(3)}[${out}]`);
    last = out;
  }
  const n = clips.length;
  audio.forEach((a, j) => v.push(`[${n + j}:a]aresample=44100,adelay=${Math.round(a.at * 1000)}:all=1[a${j}]`));
  v.push(`${audio.map((_, j) => `[a${j}]`).join('')}amix=inputs=${audio.length}:normalize=0,alimiter=limit=0.95,apad=whole_dur=${total.toFixed(3)}[aout]`);
  writeFileSync(`${OUT}/filter.txt`, v.join(';\n'));
  args.push('-filter_complex_script', `${OUT}/filter.txt`, '-map', '[vout]', '-map', '[aout]', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'medium', '-crf', '20', '-c:a', 'aac', '-b:a', '160k', '-t', total.toFixed(3), '-movflags', '+faststart', `${OUT}/dawacheck-demo-draft.mp4`);
  execFileSync(FF, args, { stdio: 'inherit' });
  // Timeline for the edit list (where each segment starts in the final video).
  const lines: string[] = [];
  let at = 0;
  for (const s of STORY) {
    const hasScene = Boolean(s.higgsfield && existsSync(`${OUT}/higgsfield/${s.higgsfield}.mp4`));
    const segClips = clips.splice(0, s.frames.length + (hasScene ? 1 : 0));
    lines.push(`${new Date(at * 1000).toISOString().slice(14, 19)}  ${s.id}${s.higgsfield ? `  (Higgsfield ${s.higgsfield}: ${hasScene ? 'included' : `drop media/higgsfield/${s.higgsfield}.mp4 to add`})` : ''}`);
    at += segClips.reduce((a, c) => a + c.d, 0) - T * segClips.length;
  }
  writeFileSync(`${OUT}/timeline.txt`, lines.join('\n') + '\n');
  console.log(lines.join('\n'));
}

await narrate();
await renderFrames();
build();
console.log(`done: ${OUT}/dawacheck-demo-draft.mp4 (${dur(`${OUT}/dawacheck-demo-draft.mp4`).toFixed(1)} s)`);
