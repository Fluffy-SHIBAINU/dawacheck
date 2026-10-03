import type { ScanInput } from '../core/types';
import { parseScan } from '../core/parse';
import { recognize } from './engine';
import { binarizeOtsu, grayscaleStretch, loadSource, thumbnail, toCanvas, type Crop } from './preprocess';

export interface ScanResult {
  input: ScanInput;
  text: string;
  ms: number;
  pass: 1 | 2 | 3;
  thumb: Blob | null;
  confidence: number;
}

export async function runScan(file: Blob, opts: { onProgress?: (p: number) => void; crop?: Crop; previousText?: string } = {}): Promise<ScanResult> {
  const src = await loadSource(file);
  const thumb = await thumbnail(src);
  if (opts.crop) {
    const c = grayscaleStretch(toCanvas(src, 2400, opts.crop, 2));
    const r = await recognize(c, 'line', opts.onProgress);
    const text = `NAFDAC ${r.text.trim()}\n${opts.previousText ?? ''}`;
    return { input: parseScan(text), text, ms: r.ms, pass: 3, thumb, confidence: r.confidence };
  }
  const a = grayscaleStretch(toCanvas(src, 1600));
  const r1 = await recognize(a, 'sparse', opts.onProgress);
  const first = parseScan(r1.text);
  if (first.nrnCandidates.length) return { input: first, text: r1.text, ms: r1.ms, pass: 1, thumb, confidence: r1.confidence };
  const r2 = await recognize(binarizeOtsu(a), 'sparse', opts.onProgress);
  const text = `${r1.text}\n${r2.text}`;
  return { input: parseScan(text), text, ms: r1.ms + r2.ms, pass: 2, thumb, confidence: Math.max(r1.confidence, r2.confidence) };
}
