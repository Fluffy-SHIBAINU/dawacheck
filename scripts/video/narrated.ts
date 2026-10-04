// Narrated product videos (<= 60 s): ElevenLabs narration with word timings, Higgsfield b-roll (media/hf),
// real app screens (media/shots), HTML-rendered graphics, captions with green key words, ElevenLabs music.
// Usage: npx tsx scripts/video/narrated.ts --video=demo|tech
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import ffmpegPath from 'ffmpeg-static';
import { chromium } from '@playwright/test';
import { env } from '../lib/env';
import { DEMO, TECH, type Story } from './stories';
import { captionHtml, logoBug } from './gfx';

const FF = ffmpegPath as unknown as string;
const VIDEO = process.argv.find((a) => a.startsWith('--video='))?.split('=')[1] ?? 'demo';
const STORY: Story = VIDEO === 'tech' ? TECH : DEMO;
const OUT = `media/${VIDEO}`;
const G = `${OUT}/gfx`;
mkdirSync(G, { recursive: true });
mkdirSync(`${OUT}/voice`, { recursive: true });
mkdirSync(`${OUT}/parts`, { recursive: true });
const T = 0.35; // crossfade

const dur = (file: string): number => {
  let out = '';
  try { execFileSync(FF, ['-hide_banner', '-i', file], { stdio: 'pipe' }); } catch (e) { out = String((e as { stderr?: Buffer }).stderr ?? ''); }
  const m = /Duration: (\d+):(\d+):([\d.]+)/.exec(out);
  if (!m) throw new Error(`no duration for ${file}`);
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
};

type Word = { w: string; s: number; e: number };
async function narrate(): Promise<void> {
  const key = env('ELEVENLABS_API_KEY')!;
  const voice = env('ELEVENLABS_NARRATOR_VOICE_ID') ?? env('ELEVENLABS_VOICE_ID') ?? 'JBFqnCBsd6RMkjVDRZzb';
  for (const s of STORY.segments) {
    if (!s.say || existsSync(`${OUT}/voice/${s.id}.mp3`)) continue;
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}/with-timestamps?output_format=mp3_44100_128`, {
      method: 'POST',
      headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: s.say, model_id: 'eleven_multilingual_v2', voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.15 } }),
    });
    if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const j = (await res.json()) as { audio_base64: string; alignment: { characters: string[]; character_start_times_seconds: number[]; character_end_times_seconds: number[] } };
    writeFileSync(`${OUT}/voice/${s.id}.mp3`, Buffer.from(j.audio_base64, 'base64'));
    const words: Word[] = [];
    let cur: Word | null = null;
    j.alignment.characters.forEach((c, i) => {
      if (/\s/.test(c)) { if (cur) words.push(cur); cur = null; return; }
      if (!cur) cur = { w: '', s: j.alignment.character_start_times_seconds[i], e: 0 };
      cur.w += c;
      cur.e = j.alignment.character_end_times_seconds[i];
    });
    if (cur) words.push(cur);
    writeFileSync(`${OUT}/voice/${s.id}.json`, JSON.stringify(words));
    console.log('voice', s.id);
  }
}

// ---------- graphics ----------
async function renderGraphics(): Promise<string[]> {
  const jobs: [string, string, boolean][] = [];
  for (const s of STORY.segments) for (const [i, v] of s.visuals.entries()) if (v.html) jobs.push([`${s.id}-${i}`, v.html, true]);
  jobs.push(['logo', logoBug(), false]);
  const browser = await chromium.launch();
  const p = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  for (const [k, html, opaque] of jobs) {
    await p.setContent(html, { waitUntil: 'networkidle' });
    await p.evaluate(async () => { await document.fonts.ready; });
    await p.screenshot({ path: `${G}/${k}.png`, omitBackground: !opaque });
  }
  await browser.close();
  // captions are rendered later, once timings are known
  return jobs.map((j) => j[0]);
}

async function renderCaptions(caps: { text: string[] }[]): Promise<void> {
  const browser = await chromium.launch();
  const p = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  for (const [i, c] of caps.entries()) {
    await p.setContent(captionHtml(c.text, STORY.highlight), { waitUntil: 'networkidle' });
    await p.evaluate(async () => { await document.fonts.ready; });
    await p.screenshot({ path: `${G}/cap${i}.png`, omitBackground: true });
  }
  await browser.close();
}

async function main() {
  await narrate();
  await renderGraphics();
  // build() returns the timeline via a side channel to keep the flow simple
  const tl = timeline();
  await renderCaptions(tl.caps);
  assemble(tl);
}

function timeline() {
  type Item = { file: string; d: number; kind: 'clip' | 'still'; from?: number };
  const items: Item[] = [];
  const audio: { file: string; at: number; trim?: number }[] = [];
  const words: Word[] = [];
  let t = 0;
  let endStart = 0;
  for (const s of STORY.segments) {
    const nd = s.say ? dur(`${OUT}/voice/${s.id}.mp3`) : 0;
    const clipLen = s.appClip ? Math.min(dur(s.appClip), s.appClipMax ?? 4.2) : 0;
    const segLen = Math.max(nd + 0.45 + (clipLen ? clipLen + 0.35 : 0), s.min ?? 0);
    if (s.id === 'end') endStart = t;
    if (s.say) {
      audio.push({ file: `${OUT}/voice/${s.id}.mp3`, at: t + 0.25 });
      for (const w of JSON.parse(readFileSync(`${OUT}/voice/${s.id}.json`, 'utf8')) as Word[]) words.push({ w: w.w, s: w.s + t + 0.25, e: w.e + t + 0.25 });
    }
    if (s.appClip) audio.push({ file: s.appClip, at: t + 0.25 + nd + 0.3, trim: clipLen });
    const wsum = s.visuals.reduce((a, v) => a + (v.weight ?? 1), 0);
    s.visuals.forEach((v, i) => {
      const d = (segLen * (v.weight ?? 1)) / wsum;
      items.push(v.clip ? { file: `media/hf/${v.clip}.mp4`, d, kind: 'clip', from: v.from ?? 0 } : { file: `${G}/${s.id}-${i}.png`, d, kind: 'still' });
    });
    t += segLen;
  }
  const caps: { text: string[]; s: number; e: number }[] = [];
  let cur: Word[] = [];
  const flush = () => { if (cur.length) caps.push({ text: cur.map((x) => x.w.toUpperCase()), s: cur[0].s, e: cur[cur.length - 1].e + 0.2 }); cur = []; };
  for (const w of words) { cur.push(w); if (/[.,?!:]$/.test(w.w) || cur.length >= 5) flush(); }
  flush();
  for (let i = 0; i < caps.length - 1; i++) caps[i].e = Math.min(caps[i].e + 0.2, caps[i + 1].s);
  return { items, audio, caps, total: t, endStart };
}

function assemble(tl: ReturnType<typeof timeline>) {
  const { items, audio, caps, total, endStart } = tl;
  if (total > 60) console.warn(`WARNING: ${total.toFixed(1)} s is over 60 s`);
  items.forEach((it, i) => {
    const out = `${OUT}/parts/${String(i).padStart(2, '0')}.mp4`;
    const len = it.d + T;
    const frames = Math.ceil(len * 30);
    const args = it.kind === 'still'
      ? ['-loop', '1', '-framerate', '30', '-t', len.toFixed(3), '-i', it.file, '-vf', `scale=2304:1296,zoompan=z='1+0.05*on/${frames}':d=1:s=1920x1080:fps=30:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)',format=yuv420p,setsar=1`]
      : ['-i', it.file, '-vf', `trim=${it.from}:5,setpts=${Math.max(1, Math.min(1.4, len / (5 - (it.from ?? 0)))).toFixed(3)}*(PTS-STARTPTS),scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,fps=30,format=yuv420p,setsar=1,tpad=stop_mode=clone:stop_duration=3`];
    execFileSync(FF, ['-y', '-hide_banner', '-loglevel', 'error', ...args, '-t', len.toFixed(3), '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '16', out]);
  });
  const args = ['-y', '-hide_banner', '-loglevel', 'error'];
  const inputs: string[] = [];
  let count = 0;
  const add = (...a: string[]) => { inputs.push(...a); return count++; };
  const partIdx = items.map((_, i) => add('-i', `${OUT}/parts/${String(i).padStart(2, '0')}.mp4`));
  const f: string[] = [];
  let last = `${partIdx[0]}:v`;
  let start = 0;
  for (let i = 1; i < items.length; i++) {
    start += items[i - 1].d;
    const out = `x${i}`;
    f.push(`[${last}][${partIdx[i]}:v]xfade=transition=fade:duration=${T}:offset=${(start).toFixed(3)}[${out}]`);
    last = out;
  }
  let n = 0;
  const overlayPng = (file: string, a: number, b: number, region: [number, number, number, number], d = 0.12) => {
    const len = Math.max(0.2, b - a);
    const i = add('-loop', '1', '-framerate', '30', '-t', (len + 0.05).toFixed(2), '-i', file);
    const [x, y, w, h] = region;
    f.push(`[${i}:v]format=rgba,crop=${w}:${h}:${x}:${y},fade=t=in:st=0:d=${d}:alpha=1,fade=t=out:st=${Math.max(0, len - d).toFixed(2)}:d=${d}:alpha=1,setpts=PTS-STARTPTS+${a.toFixed(2)}/TB[g${n}]`);
    f.push(`[${last}][g${n}]overlay=${x}:${y}:enable='between(t,${a.toFixed(2)},${b.toFixed(2)})':eof_action=pass[y${n}]`);
    last = `y${n++}`;
  };
  overlayPng(`${G}/logo.png`, 0.4, endStart || total, [0, 0, 560, 170], 0.3);
  caps.forEach((c, i) => { if (!endStart || c.s < endStart) overlayPng(`${G}/cap${i}.png`, c.s, Math.min(c.e, endStart || total), [0, 800, 1920, 280]); });
  // audio: narration + app clips, music ducked under the voice
  const aLabels: string[] = [];
  audio.forEach((a, j) => {
    const i = add('-i', a.file);
    f.push(`[${i}:a]aformat=sample_rates=48000:channel_layouts=stereo,${a.trim ? `atrim=0:${a.trim.toFixed(2)},afade=t=out:st=${(a.trim - 0.3).toFixed(2)}:d=0.3,` : ''}adelay=${Math.round(a.at * 1000)}:all=1[a${j}]`);
    aLabels.push(`[a${j}]`);
  });
  const mus = add('-i', `media/music-${VIDEO}.mp3`);
  f.push(`[${mus}:a]aformat=sample_rates=48000:channel_layouts=stereo,atrim=0:${total.toFixed(2)},volume='if(gt(t,${(endStart || total).toFixed(2)}),0.45,0.11)':eval=frame,afade=t=in:d=0.6,afade=t=out:st=${(total - 1.2).toFixed(2)}:d=1.2[m]`);
  f.push(`${aLabels.join('')}amix=inputs=${aLabels.length}:normalize=0[vox]`);
  f.push(`[vox]loudnorm=I=-16:TP=-1.5:LRA=9[voxn]`);
  f.push(`[voxn][m]amix=inputs=2:normalize=0,alimiter=limit=0.95,apad=whole_dur=${total.toFixed(2)}[aout]`);
  writeFileSync(`${OUT}/filter.txt`, f.join(';\n'));
  execFileSync(FF, [...args, ...inputs, '-filter_complex_script', `${OUT}/filter.txt`, '-map', `[${last}]`, '-map', '[aout]', '-t', total.toFixed(2), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'medium', '-crf', '18', '-r', '30', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-movflags', '+faststart', `media/dawacheck-${VIDEO}-final.mp4`], { stdio: 'inherit' });
  console.log(`done: media/dawacheck-${VIDEO}-final.mp4 (${total.toFixed(1)} s)`);
}

await main();
