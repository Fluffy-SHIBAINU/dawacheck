import type { Level } from '../core/types';

export interface Carton {
  n: number;
  key: 'green' | 'mismatch' | 'notfound' | 'expired' | 'alert';
  brand: string;
  lines: string[];
  nrn: string;
  batch: string;
  exp: string;
  expected: Level;
  accent: string;
}

export const CARTONS: Carton[] = [
  { n: 1, key: 'green', brand: 'ARTHEGET EZ', lines: ['Artemether 80 mg + Lumefantrine 480 mg', '6 tablets'], nrn: 'A4-6238', batch: 'AE2511', exp: '11/2027', expected: 'green', accent: '#7A1F1F' },
  { n: 2, key: 'mismatch', brand: 'MALAQUICK', lines: ['Artemether 20 mg + Lumefantrine 120 mg'], nrn: 'A4-6238', batch: 'MQ0925', exp: '09/2027', expected: 'amber', accent: '#1F4E7A' },
  { n: 3, key: 'notfound', brand: 'PARAMAX FORTE', lines: ['Paracetamol 500 mg'], nrn: 'A4-99231', batch: 'PX7731', exp: '03/2028', expected: 'red', accent: '#5B2B82' },
  { n: 4, key: 'expired', brand: 'ARTHEGET EZ', lines: ['Artemether 80 mg + Lumefantrine 480 mg'], nrn: 'A4-6238', batch: 'AE2402', exp: '08/2026', expected: 'red', accent: '#7A1F1F' },
  { n: 5, key: 'alert', brand: 'MENOFIX COMPOSITION', lines: ['Herbal mixture'], nrn: 'A4-0999', batch: 'MF0101', exp: '12/2027', expected: 'red', accent: '#2B6B3F' },
];

export function cartonText(c: Carton): string {
  return [c.brand, ...c.lines, `NAFDAC REG. NO. ${c.nrn}`, `BATCH ${c.batch} EXP ${c.exp}`, 'DEMO PACK'].join('\n');
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

export function cartonHtml(c: Carton): string {
  return `<div class="carton" data-carton="${c.n}" style="width:720px;padding:36px 40px;background:#FFFDF6;color:#111;border:2px solid #ddd;border-radius:6px;font-family:Arial,Helvetica,sans-serif;display:flex;flex-direction:column;gap:14px">
  <div style="font-weight:800;font-size:56px;letter-spacing:1px;color:${c.accent}">${esc(c.brand)}</div>
  ${c.lines.map((l) => `<div style="font-size:30px">${esc(l)}</div>`).join('')}
  <div style="font-size:34px;font-weight:700;font-family:'Courier New',monospace">NAFDAC REG. NO. ${esc(c.nrn)}</div>
  <div style="font-size:30px;font-family:'Courier New',monospace">BATCH ${esc(c.batch)} EXP ${esc(c.exp)}</div>
  <div style="font-size:18px;color:#666">DEMO PACK</div>
</div>`;
}
