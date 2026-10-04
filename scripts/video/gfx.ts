// Shared HTML graphics for the DawaCheck videos (rendered to 1920x1080 PNGs with Playwright).
import { readFileSync } from 'node:fs';

const FONTS = `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@700;800&family=Atkinson+Hyperlegible:wght@400;700&family=IBM+Plex+Mono:wght@500;600&display=swap">`;
const BASE = `*{margin:0;box-sizing:border-box}body{width:1920px;height:1080px;overflow:hidden;font-family:'Atkinson Hyperlegible',sans-serif;color:#F2F7F4}.dc{font-family:'Archivo',sans-serif;font-weight:800}.g{color:#45C08D}.mono{font-family:'IBM Plex Mono',monospace}
.phone{position:absolute;width:470px;height:802px;border-radius:60px;background:#050B08;padding:20px;box-shadow:0 40px 90px rgba(0,0,0,.55)}.phone img{width:100%;height:100%;object-fit:cover;object-position:top;border-radius:42px}
.box{border-radius:22px;background:rgba(9,20,15,.85);border:1px solid rgba(69,192,141,.35);padding:26px 30px}.k{font-family:'Archivo',sans-serif;font-weight:800;font-size:26px;letter-spacing:6px;color:#45C08D}`;
export const BG = 'radial-gradient(circle at 30% 40%,#123a2a 0,#0B1410 65%)';
export const page = (body: string, bg = 'transparent') => `<!doctype html><html><head>${FONTS}<style>${BASE}body{background:${bg}}</style></head><body>${body}</body></html>`;
export const shot = (name: string) => `data:image/png;base64,${readFileSync(`media/shots/${name}.png`).toString('base64')}`;

export const phoneFrame = (img: string, kicker: string, title: string, sub: string) =>
  page(`<div class="phone" style="left:330px;top:46px"><img src="${shot(img)}"></div><div style="position:absolute;left:960px;top:270px;width:820px"><p class="k">${kicker}</p><p class="dc" style="font-size:84px;line-height:1.05;margin-top:12px">${title}</p><p style="font-size:38px;color:#BFD8D0;margin-top:18px">${sub}</p></div>`, BG);

export const wideFrame = (img: string, kicker: string, title: string, sub: string) =>
  page(`<div style="position:absolute;left:120px;top:140px;width:1680px"><p class="k">${kicker}</p><p class="dc" style="font-size:72px;margin-top:8px">${title}</p><p style="font-size:36px;color:#BFD8D0;margin-top:6px">${sub}</p></div><div style="position:absolute;left:120px;top:400px;width:1680px;height:430px;border-radius:24px;overflow:hidden;background:#F6F9F7;box-shadow:0 30px 80px rgba(0,0,0,.5)"><img src="${shot(img)}" style="width:2199px;height:auto;margin-left:-259px"></div>`, BG);

export const endCard = (sub: string) =>
  page(`<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px"><div style="display:flex;align-items:center;gap:22px"><span style="width:44px;height:44px;border-radius:50%;background:#45C08D;box-shadow:0 0 40px #45C08D"></span><span class="dc" style="font-size:150px">DawaCheck</span></div><p class="dc g" style="font-size:52px;letter-spacing:4px">CHECK BEFORE YOU TAKE.</p><p style="font-size:32px;color:#BFD8D0;margin-top:26px">dawacheck-smoky.vercel.app &middot; github.com/Fluffy-SHIBAINU/dawacheck</p><p style="font-size:24px;color:#7FA595;margin-top:6px">${sub}</p></div>`, 'radial-gradient(circle at 50% 45%,#123a2a 0,#070D0A 70%)');

export const captionHtml = (words: string[], highlight: Set<string>) =>
  page(`<div style="position:absolute;left:0;right:0;bottom:84px;text-align:center"><span class="dc" style="display:inline-block;max-width:1500px;font-size:58px;line-height:1.15;letter-spacing:1px;padding:10px 26px;border-radius:14px;background:rgba(0,0,0,.42);text-shadow:0 3px 14px rgba(0,0,0,.6)">${words.map((w) => `<span class="${highlight.has(w.replace(/[^A-Z0-9$-]/g, '')) ? 'g' : ''}">${w}</span>`).join(' ')}</span></div>`);

export const logoBug = () =>
  page(`<div style="position:absolute;left:56px;top:44px;display:flex;align-items:center;gap:12px;padding:12px 20px;border-radius:999px;background:rgba(9,20,15,.55)"><span style="width:18px;height:18px;border-radius:50%;background:#45C08D;box-shadow:0 0 12px #45C08D"></span><span class="dc" style="font-size:30px">DawaCheck</span></div>`);

// Technical diagrams
const node = (label: string, sub: string, on: boolean) =>
  `<div class="box" style="width:300px;text-align:center;${on ? 'border-color:#45C08D;box-shadow:0 0 40px rgba(69,192,141,.35)' : 'opacity:.55'}"><p class="dc" style="font-size:34px">${label}</p><p style="font-size:24px;color:#9FC2B2;margin-top:6px">${sub}</p></div>`;
const arrow = `<span class="dc g" style="font-size:56px">&rarr;</span>`;
export const archDiagram = (step: 1 | 2) =>
  page(`<div style="position:absolute;left:120px;top:140px"><p class="k">ON THE PHONE &middot; 19 MB &middot; WORKS OFFLINE</p><p class="dc" style="font-size:70px;margin-top:8px">${step === 1 ? 'Every verdict runs on the phone' : 'Reading the box'}</p></div>
  <div style="position:absolute;left:110px;top:430px;display:flex;align-items:center;gap:18px">${node('Camera', 'photo of the box', step === 1)}${arrow}${node('OCR', 'Tesseract &middot; WebAssembly', true)}${arrow}${node('Parser', 'number, batch, expiry, strength', step === 2)}${arrow}${node('Verdict', 'TypeScript rules', step === 1)}</div>
  <div style="position:absolute;left:1050px;top:700px;width:760px" class="box"><p class="k" style="font-size:22px">STORED ON THE PHONE (INDEXEDDB)</p><p style="font-size:30px;margin-top:10px">NAFDAC register: <b>8,922</b> products &middot; <b>84</b> alerts &middot; 42 voice clips</p></div>`, BG);

export const codeCard = () =>
  page(`<div style="position:absolute;left:120px;top:140px;width:1680px"><p class="k">VERDICT ENGINE &middot; PURE TYPESCRIPT</p><p class="dc" style="font-size:66px;margin-top:8px">A fake number can never be &ldquo;fixed&rdquo; into a real one</p></div>
  <div class="box mono" style="position:absolute;left:120px;top:390px;width:1680px;font-size:30px;line-height:1.6;padding:36px 44px;background:#07110C">
  <div><span style="color:#7FA595">// OCR misread: only correct when the brand on the box confirms the neighbour</span></div>
  <div><span style="color:#45C08D">const</span> named = variants.<span style="color:#E8C468">filter</span>((x) =&gt;</div>
  <div>&nbsp;&nbsp;register.byNrn.get(x.nrn).<span style="color:#E8C468">some</span>((p) =&gt; <span style="color:#E8C468">brandScore</span>(p, boxTokens) &gt;= t.nameMatch));</div>
  <div><span style="color:#45C08D">if</span> (named.length === 1) resolved = named[0].nrn; <span style="color:#7FA595">// else: red, not in the register</span></div></div>
  <div style="position:absolute;left:120px;top:720px;display:flex;gap:28px">${['8,922 products', '84 NAFDAC alerts', 'green &middot; amber &middot; red'].map((x) => `<div class="box"><p class="dc" style="font-size:36px">${x}</p></div>`).join('')}</div>`, BG);

export const dataCard = () =>
  page(`<div style="position:absolute;left:120px;top:140px"><p class="k">REAL DATA, BUILT WITH AI</p><p class="dc" style="font-size:70px;margin-top:8px">Official sources, ready offline</p></div>
  <div style="position:absolute;left:120px;top:390px;display:grid;grid-template-columns:repeat(3,540px);gap:30px">${[
    ['NAFDAC Greenbook', '8,922', 'registered products with what the real tablet and pack look like'],
    ['Claude', '307', 'batch numbers and brands extracted from 84 NAFDAC alerts'],
    ['ElevenLabs', '42', 'recorded verdict voices in Hausa, English and Pidgin'],
  ].map(([a, b, c]) => `<div class="box" style="padding:34px"><p class="k" style="font-size:24px">${a}</p><p class="dc" style="font-size:120px;line-height:1;margin-top:14px">${b}</p><p style="font-size:30px;color:#BFD8D0;margin-top:14px">${c}</p></div>`).join('')}</div>`, BG);

export const syncCard = () =>
  page(`<div style="position:absolute;left:120px;top:140px"><p class="k">SYNC AND LEARNING &middot; SUPABASE</p><p class="dc" style="font-size:70px;margin-top:8px">Online, it learns. Offline, it still works.</p></div>
  <div style="position:absolute;left:120px;top:390px;width:760px;display:flex;flex-direction:column;gap:22px">${[
    ['&uarr; Reports', 'insert-only security rules, 20 per phone per day'],
    ['&darr; Community flags', '3 reports from 2 phones turn a number amber'],
    ['&darr; Fresh data packs', 'sha-256 checked before they replace the old ones'],
  ].map(([a, b]) => `<div class="box"><p class="dc" style="font-size:40px">${a}</p><p style="font-size:28px;color:#BFD8D0;margin-top:6px">${b}</p></div>`).join('')}</div>
  <div style="position:absolute;left:960px;top:390px;width:840px;height:440px;border-radius:24px;overflow:hidden;background:#F6F9F7;box-shadow:0 30px 80px rgba(0,0,0,.5)"><img src="${shot('14-dashboard')}" style="width:1100px;height:auto;margin-left:-130px"></div>`, BG);

export const testsCard = () =>
  page(`<div style="position:absolute;left:120px;top:140px"><p class="k">BUILT WITH CLAUDE CODE AND AI AGENTS</p><p class="dc" style="font-size:70px;margin-top:8px">Tested like it matters</p></div>
  <div class="box mono" style="position:absolute;left:120px;top:390px;width:1680px;font-size:34px;line-height:1.75;padding:40px 48px;background:#07110C">
  <div><span class="g">&#10003;</span> 223 unit tests &middot; verdict rules, parsers, sync, offline fallbacks</div>
  <div><span class="g">&#10003;</span> 22 end-to-end tests &middot; airplane mode, iPhone WebKit, cold-start offline OCR</div>
  <div><span class="g">&#10003;</span> accessibility (axe) clean &middot; captions and voice for low literacy</div>
  <div><span class="g">&#10003;</span> live: dawacheck-smoky.vercel.app &middot; open source on GitHub</div></div>`, BG);
