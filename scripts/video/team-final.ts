// Team introduction (<= 60 s): Shawn's own recording (media/team/aroll.mp4, from team-aroll.py),
// Higgsfield b-roll (media/hf/*.mp4), real app screens, HTML-rendered graphics and captions, ElevenLabs music.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import ffmpegPath from 'ffmpeg-static';
import { chromium } from '@playwright/test';

const FF = ffmpegPath as unknown as string;
const OUT = 'media/team';
const G = `${OUT}/gfx`;
mkdirSync(G, { recursive: true });

const OPEN = 1.2; // cold-open globe before the A-roll starts
const AROLL = JSON.parse(readFileSync(`${OUT}/edl.json`, 'utf8')).total as number;
const END = 2.0; // end card hold after the A-roll (total stays under 60 s)
const TOTAL = OPEN + AROLL + END;
const words = (JSON.parse(readFileSync(`${OUT}/words-out.json`, 'utf8')) as { w: string; s: number; e: number }[]).map((x) => ({ ...x, s: x.s + OPEN, e: x.e + OPEN }));
const norm = (w: string) => w.replace(/[^A-Za-z0-9$-]/g, '').toLowerCase();
const at = (needle: string, nth = 0) => {
  const hits = words.filter((x) => norm(x.w) === norm(needle));
  if (!hits[nth]) throw new Error(`no word ${needle} #${nth}`);
  return hits[nth].s;
};

// ---------- captions: short phrases, key words in green ----------
const HL = new Set(['DAWACHECK', 'CLAUDE', 'CODE', 'AI', 'AGENTS', 'SEVEN-YEAR', '$700', 'MILLION', 'DCPS', 'IMMIGRANT', 'PHARMACY', 'LABEL', 'DEADLY', 'ONE', 'TEN', 'FAKE', 'SUBSTANDARD', 'PHOTO', 'NIGERIAS', 'NO', 'INTERNET', 'OUT', 'LOUD', 'HAUSA', 'ENGLISH', 'PIDGIN', 'STANDALONE', 'PHONE']);
type Cap = { text: string[]; s: number; e: number };
const caps: Cap[] = [];
let cur: typeof words = [];
const flush = () => {
  if (!cur.length) return;
  let text = cur.map((x) => x.w.toUpperCase());
  const joined = text.join(' ');
  if (joined.includes('SEVEN HUNDRED MILLION DOLLAR')) text = joined.replace('SEVEN HUNDRED MILLION DOLLAR', '$700 MILLION').split(' ');
  caps.push({ text, s: cur[0].s, e: cur[cur.length - 1].e + 0.15 });
  cur = [];
};
for (const w of words) {
  cur.push(w);
  // Break at punctuation, at 5 words, and where the edit joined two sentences ("device | There's").
  if (/[.,?!]$/.test(w.w) || cur.length >= 5 || norm(w.w) === 'device') flush();
}
flush();
for (let i = 0; i < caps.length - 1; i++) caps[i].e = Math.min(caps[i].e + 0.25, caps[i + 1].s);

// ---------- timeline (seconds in the final video) ----------
const T = {
  pharmacy: [at('When'), at('label')+ 0.45],
  market: [at('for', 1) - 0.05, at('countries') - 0.3],
  vendor: [at('countries') - 0.3, at('So') - 0.1],
  stat: [at('One') - 0.05, at('So') - 0.1],
  scan: [at('Snap') - 0.05, at('Your') - 0.05],
  appA: [at('Your') - 0.05, at('says') - 0.05],
  appB: [at('says') - 0.05, at('in', 3) - 0.05],
  langs: [at('in', 3) - 0.05, at('Next') - 0.05],
  device: [at('Next') - 0.05, at('DawaCheck', 3) - 0.05],
  end: [at('DawaCheck', 3) - 0.05, TOTAL],
};
console.log(JSON.stringify(T));

// ---------- graphics (HTML -> PNG) ----------
const FONTS = `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@700;800&family=Atkinson+Hyperlegible:wght@400;700&display=swap">`;
const BASE = `*{margin:0;box-sizing:border-box}body{width:1920px;height:1080px;overflow:hidden;font-family:'Atkinson Hyperlegible',sans-serif;color:#F2F7F4}
.dc{font-family:'Archivo',sans-serif;font-weight:800}.g{color:#45C08D}`;
const shot = (name: string) => `data:image/png;base64,${readFileSync(`media/shots/${name}.png`).toString('base64')}`;
const page = (body: string, css = '', bg = 'transparent') => `<!doctype html><html><head>${FONTS}<style>${BASE}body{background:${bg}}${css}</style></head><body>${body}</body></html>`;
const PHONE_CSS = `.phone{position:absolute;width:520px;height:888px;border-radius:60px;background:#050B08;padding:20px;box-shadow:0 40px 90px rgba(0,0,0,.55)}.phone img{width:100%;height:100%;object-fit:cover;object-position:top;border-radius:42px}`;
const GFX: Record<string, { html: string; opaque?: boolean }> = {
  logo: { html: page(`<div style="position:absolute;left:56px;top:44px;display:flex;align-items:center;gap:12px;padding:12px 20px;border-radius:999px;background:rgba(9,20,15,.55);backdrop-filter:blur(6px)"><span style="width:18px;height:18px;border-radius:50%;background:#45C08D;box-shadow:0 0 12px #45C08D"></span><span class="dc" style="font-size:30px;letter-spacing:.5px">DawaCheck</span></div>`) },
  open: { html: page(`<div style="position:absolute;left:0;right:0;top:400px;text-align:center"><p class="dc" style="font-size:30px;letter-spacing:10px;color:#45C08D">MEET THE TEAM</p><p class="dc" style="font-size:120px;margin-top:10px">DawaCheck</p><p style="font-size:34px;color:#CFE6DB;margin-top:8px">Check a medicine with no internet</p></div>`, '', 'rgba(0,0,0,.25)') },
  lower: { html: page(`<div style="position:absolute;left:96px;bottom:250px;padding:22px 34px;border-left:6px solid #45C08D;background:rgba(9,20,15,.78);border-radius:6px 18px 18px 6px"><p class="dc" style="font-size:46px;letter-spacing:1px">SHAWN YOON</p><p style="font-size:28px;color:#CFE6DB;margin-top:4px">Founder, DawaCheck &middot; with Claude Code and AI agents</p></div>`) },
  team: { html: page(`<div style="position:absolute;right:90px;top:250px;width:560px;display:flex;flex-direction:column;gap:18px">${['Shawn Yoon', 'Claude Code', 'AI agents'].map((n, i) => `<div style="display:flex;align-items:center;gap:20px;padding:20px 26px;border-radius:20px;background:rgba(9,20,15,.82);border:1px solid rgba(69,192,141,.4)"><span class="dc" style="width:56px;height:56px;border-radius:50%;display:grid;place-items:center;background:${i ? '#163828' : '#45C08D'};color:${i ? '#45C08D' : '#0B1410'};font-size:28px">${i + 1}</span><span class="dc" style="font-size:40px">${n}</span></div>`).join('')}</div>`) },
  dcps: { html: page(`<div style="position:absolute;right:90px;top:230px;width:600px;padding:34px 38px;border-radius:24px;background:rgba(9,20,15,.85);border:1px solid rgba(69,192,141,.4)"><p class="dc g" style="font-size:26px;letter-spacing:6px">BEFORE DAWACHECK</p><p class="dc" style="font-size:64px;margin-top:10px;line-height:1.05">DCPS</p><p style="font-size:30px;color:#CFE6DB;margin-top:6px">Disability Case Processing System</p><div style="display:flex;gap:40px;margin-top:26px"><div><p class="dc" style="font-size:58px">7 yrs</p><p style="font-size:24px;color:#9FC2B2">national project</p></div><div><p class="dc g" style="font-size:58px">$700M</p><p style="font-size:24px;color:#9FC2B2">modernization</p></div></div></div>`) },
  stat: { html: page(`<div style="position:absolute;left:0;top:0;bottom:0;width:1100px;background:linear-gradient(90deg,rgba(7,13,10,.88) 0,rgba(7,13,10,.7) 70%,rgba(7,13,10,0) 100%)"></div><div style="position:absolute;left:110px;top:250px;width:860px"><p class="dc g" style="font-size:30px;letter-spacing:8px">WORLD HEALTH ORGANIZATION</p><p class="dc" style="font-size:210px;line-height:1;margin-top:6px">1 in 10</p><p style="font-size:48px;color:#E7F3ED;margin-top:14px">medicines in low- and middle-income countries is <span class="dc g">fake or substandard</span></p></div>`) },
  appA: { opaque: true, html: page(`<div class="phone" style="left:300px;top:96px"><img src="${shot('04-scan-reading')}"></div><div style="position:absolute;left:960px;top:330px;width:820px"><p class="dc g" style="font-size:30px;letter-spacing:6px">ON THE PHONE</p><p class="dc" style="font-size:84px;line-height:1.05;margin-top:12px">Reads the box. No internet.</p><p style="font-size:38px;color:#BFD8D0;margin-top:18px">Checked against Nigeria&rsquo;s official NAFDAC register: 8,922 products</p></div>`, PHONE_CSS, 'radial-gradient(circle at 30% 40%,#123a2a 0,#0B1410 65%)') },
  appB: { opaque: true, html: page(`<div class="phone" style="left:300px;top:96px"><img src="${shot('05-green-ha')}"></div><div style="position:absolute;left:960px;top:330px;width:820px"><p class="dc g" style="font-size:30px;letter-spacing:6px">THE ANSWER</p><p class="dc" style="font-size:84px;line-height:1.05;margin-top:12px">Registered with NAFDAC</p><p style="font-size:38px;color:#BFD8D0;margin-top:18px">Shown and spoken out loud, here in Hausa</p></div>`, PHONE_CSS, 'radial-gradient(circle at 30% 40%,#123a2a 0,#0B1410 65%)') },
  langs: { opaque: true, html: page(`${[['05-green-ha', 'HAUSA', 160], ['06-amber-en', 'ENGLISH', 700], ['09-red-pcm', 'PIDGIN', 1240]].map(([img, label, x]) => `<div class="phone" style="left:${x}px;top:120px;width:470px;height:802px"><img src="${shot(String(img))}"></div><p class="dc" style="position:absolute;left:${x}px;top:950px;width:470px;text-align:center;font-size:44px;letter-spacing:6px">${label}</p>`).join('')}`, PHONE_CSS, 'radial-gradient(circle at 50% 40%,#123a2a 0,#0B1410 65%)') },
  concept: { html: page(`<div style="position:absolute;right:90px;top:120px;width:640px;padding:30px 34px;border-radius:22px;background:rgba(9,20,15,.82);border:1px solid rgba(69,192,141,.45);text-align:left"><p class="dc g" style="font-size:24px;letter-spacing:6px">CONCEPT &middot; NEXT</p><p class="dc" style="font-size:60px;line-height:1.05;margin-top:8px">A DawaCheck device</p><p style="font-size:32px;color:#CFE6DB;margin-top:8px">Standalone. No phone needed.</p></div>`) },
  end: { opaque: true, html: page(`<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px"><div style="display:flex;align-items:center;gap:22px"><span style="width:44px;height:44px;border-radius:50%;background:#45C08D;box-shadow:0 0 40px #45C08D"></span><span class="dc" style="font-size:150px">DawaCheck</span></div><p class="dc g" style="font-size:52px;letter-spacing:4px">CHECK BEFORE YOU TAKE.</p><p style="font-size:32px;color:#BFD8D0;margin-top:26px">dawacheck-smoky.vercel.app &middot; github.com/Fluffy-SHIBAINU/dawacheck</p><p style="font-size:24px;color:#7FA595;margin-top:6px">Shawn Yoon with Claude Code &middot; scenes generated with Higgsfield</p></div>`, '', 'radial-gradient(circle at 50% 45%,#123a2a 0,#070D0A 70%)') },
};
caps.forEach((c, i) => {
  const html = c.text.map((w) => `<span class="${HL.has(w.replace(/[^A-Z0-9$-]/g, '')) ? 'g' : ''}">${w}</span>`).join(' ');
  GFX[`cap${i}`] = { html: page(`<div style="position:absolute;left:0;right:0;bottom:84px;text-align:center"><span class="dc" style="display:inline-block;max-width:1500px;font-size:58px;line-height:1.15;letter-spacing:1px;padding:10px 26px;border-radius:14px;background:rgba(0,0,0,.42);text-shadow:0 3px 14px rgba(0,0,0,.6)">${html}</span></div>`) };
});

async function render() {
  const browser = await chromium.launch();
  const p = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  for (const [k, v] of Object.entries(GFX)) {
    const path = `${G}/${k}.png`;
    await p.setContent(v.html, { waitUntil: 'networkidle' });
    await p.evaluate(async () => { await document.fonts.ready; });
    await p.screenshot({ path, omitBackground: !v.opaque });
  }
  await browser.close();
}

function build() {
  const args = ['-y', '-hide_banner', '-loglevel', 'error'];
  const inputs: string[] = [];
  const add = (...a: string[]) => { inputs.push(...a); return inputs.filter((x) => x === '-i').length - 1; };
  const aroll = add('-i', `${OUT}/aroll.mp4`);
  const globe = add('-i', 'media/hf/globe.mp4');
  const music = add('-i', 'media/music-team.mp3');
  const png = (k: string, len: number) => add('-loop', '1', '-framerate', '30', '-t', len.toFixed(2), '-i', `${G}/${k}.png`);
  const clip = (k: string) => add('-i', `media/hf/${k}.mp4`);
  const f: string[] = [];
  // Base: globe cold open, A-roll, then hold for the end card (the end card PNG covers it).
  f.push(`[${globe}:v]trim=0.6:${0.6 + OPEN},setpts=PTS-STARTPTS,scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,fps=30,setsar=1,format=yuv420p[g0]`);
  f.push(`[${aroll}:v]fps=30,format=yuv420p,setsar=1[a0]`);
  f.push(`color=c=0x070D0A:s=1920x1080:r=30:d=${END + 0.2},format=yuv420p,setsar=1[e0]`);
  f.push(`[g0][a0][e0]concat=n=3:v=1:a=0[base]`);
  let last = 'base';
  let n = 0;
  const over = (label: string, a: number, b: number) => {
    const out = `o${n++}`;
    f.push(`[${last}][${label}]overlay=0:0:enable='between(t,${a.toFixed(2)},${b.toFixed(2)})':eof_action=pass[${out}]`);
    last = out;
  };
  // Only the region a graphic occupies is composited, and only while it is on screen.
  const REGION: Record<string, [number, number, number, number]> = {
    logo: [0, 0, 560, 170], stat: [0, 0, 1100, 1080], lower: [0, 560, 1300, 340], team: [1180, 220, 740, 540], dcps: [1140, 200, 780, 560], concept: [1150, 100, 770, 340],
  };
  const fadePng = (k: string, a: number, b: number, d = 0.2) => {
    const len = Math.max(0.2, b - a);
    const i = png(k, len + 0.05);
    const [x, y, w, h] = k.startsWith('cap') ? [0, 800, 1920, 280] : REGION[k] ?? [0, 0, 1920, 1080];
    const lab = `p${n}_${k}`;
    f.push(`[${i}:v]format=rgba,crop=${w}:${h}:${x}:${y},fade=t=in:st=0:d=${d}:alpha=1,fade=t=out:st=${Math.max(0, len - d).toFixed(2)}:d=${d}:alpha=1,setpts=PTS-STARTPTS+${a.toFixed(2)}/TB[${lab}]`);
    const out = `o${n++}`;
    f.push(`[${last}][${lab}]overlay=${x}:${y}:enable='between(t,${a.toFixed(2)},${b.toFixed(2)})':eof_action=pass[${out}]`);
    last = out;
  };
  const broll = (k: string, a: number, b: number, from = 0) => {
    if (!existsSync(`media/hf/${k}.mp4`)) { console.log('missing clip', k); return; }
    const i = clip(k);
    const len = b - a;
    const lab = `c${n}_${k}`;
    // Fit the clip to the slot: slow it down if the slot is longer than the clip (max 1.35x), with a slow push-in.
    const speed = Math.max(1, Math.min(1.35, len / (5 - from)));
    f.push(`[${i}:v]trim=${from}:5,setpts=${speed.toFixed(3)}*(PTS-STARTPTS)+${a.toFixed(2)}/TB,scale=2016:1134:force_original_aspect_ratio=increase,crop=1920:1080,fps=30,setsar=1,format=yuv420p,fade=t=in:st=${a.toFixed(2)}:d=0.25[${lab}]`);
    over(lab, a, b);
  };
  fadePng('open', 0.15, OPEN + 0.05, 0.25);
  fadePng('logo', OPEN + 0.3, T.end[0], 0.3);
  fadePng('lower', at('Shawn') + 0.2, at('I') - 0.3, 0.3);
  fadePng('team', at('Me') - 0.1, at('I') - 0.2, 0.25);
  fadePng('dcps', at('worked') - 0.1, at('also') - 0.2, 0.25);
  broll('pharmacy', T.pharmacy[0], T.pharmacy[1]);
  broll('market', T.market[0], T.market[1]);
  broll('vendor', T.vendor[0], T.vendor[1]);
  fadePng('stat', T.stat[0], T.stat[1], 0.25);
  broll('scan', T.scan[0], T.scan[1], 1.2);
  fadePng('appA', T.appA[0], T.appA[1], 0.25);
  fadePng('appB', T.appB[0], T.appB[1], 0.25);
  fadePng('langs', T.langs[0], T.langs[1], 0.25);
  broll('device', T.device[0], T.device[1]);
  fadePng('concept', T.device[0] + 0.2, T.device[1], 0.25);
  caps.forEach((c, i) => { if (c.s < T.end[0] - 0.05) fadePng(`cap${i}`, c.s, Math.min(c.e, T.end[0]), 0.08); });
  fadePng('end', T.end[0], TOTAL + 0.1, 0.35);
  // Audio: Shawn's voice after the cold open; music up in the open and the end card, low under the voice.
  f.push(`[${aroll}:a]adelay=${Math.round(OPEN * 1000)}:all=1[vox]`);
  f.push(`[${music}:a]atrim=0:${TOTAL.toFixed(2)},volume='if(lt(t,${OPEN}),0.55,if(gt(t,${T.end[0].toFixed(2)}),0.5,0.12))':eval=frame,afade=t=out:st=${(TOTAL - 1.2).toFixed(2)}:d=1.2[mus]`);
  f.push(`[vox][mus]amix=inputs=2:normalize=0,alimiter=limit=0.95,apad=whole_dur=${TOTAL.toFixed(2)}[aout]`);
  writeFileSync(`${OUT}/final-filter.txt`, f.join(';\n'));
  execFileSync(FF, [...args, ...inputs, '-filter_complex_script', `${OUT}/final-filter.txt`, '-map', `[${last}]`, '-map', '[aout]', '-t', TOTAL.toFixed(2), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'medium', '-crf', '18', '-r', '30', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-movflags', '+faststart', 'media/dawacheck-team-final.mp4'], { stdio: 'inherit' });
  console.log(`done: media/dawacheck-team-final.mp4 (${TOTAL.toFixed(1)} s)`);
}

await render();
build();
