import type { ScanInput } from '../core/types';
import { parseScan } from '../core/parse';
import { recognize } from './engine';
import { binarizeOtsu, grayscaleStretch, loadSource, rotateCanvas, thumbnail, toCanvas, type Crop } from './preprocess';
import { recognizeWithRotation, type Rotation } from './retry';

export interface ScanResult {
  input: ScanInput;
  text: string;
  ms: number;
  /** 1 grayscale, 2 + binarized, 3 user crop, 4 found after turning the photo. */
  pass: 1 | 2 | 3 | 4;
  rotation: Rotation;
  thumb: Blob | null;
  confidence: number;
}

/**
 * Below this mean confidence the first two passes read almost nothing, which on a box usually means the
 * photo is sideways (measured: upright cartons ~93, the same carton turned 90° reads 0).
 * Above it the text was readable, so turning the photo would only cost time.
 */
const UPRIGHT_CONFIDENCE = 50;

export async function runScan(
  file: Blob,
  opts: { onProgress?: (p: number) => void; onStage?: (stage: 'rotate') => void; crop?: Crop; previousText?: string } = {},
): Promise<ScanResult> {
  const src = await loadSource(file);
  const thumb = await thumbnail(src);
  if (opts.crop) {
    const c = grayscaleStretch(toCanvas(src, 2400, opts.crop, 2));
    const r = await recognize(c, 'line', opts.onProgress);
    const text = `NAFDAC ${r.text.trim()}\n${opts.previousText ?? ''}`;
    return { input: parseScan(text), text, ms: r.ms, pass: 3, rotation: 0, thumb, confidence: r.confidence };
  }
  const a = grayscaleStretch(toCanvas(src, 1600));
  const r1 = await recognize(a, 'sparse', opts.onProgress);
  const first = parseScan(r1.text);
  if (first.nrnCandidates.length) return { input: first, text: r1.text, ms: r1.ms, pass: 1, rotation: 0, thumb, confidence: r1.confidence };
  const r2 = await recognize(binarizeOtsu(a), 'sparse', opts.onProgress);
  const text = `${r1.text}\n${r2.text}`;
  const second = parseScan(text);
  const confidence = Math.max(r1.confidence, r2.confidence);
  let ms = r1.ms + r2.ms;
  if (second.nrnCandidates.length || confidence >= UPRIGHT_CONFIDENCE) return { input: second, text, ms, pass: 2, rotation: 0, thumb, confidence };

  opts.onStage?.('rotate');
  const turned = await recognizeWithRotation(
    async (deg) => {
      if (deg === 0) return text;
      const r = await recognize(rotateCanvas(a, deg), 'sparse', opts.onProgress);
      ms += r.ms;
      return r.text;
    },
    (t) => parseScan(t).nrnCandidates.length > 0,
  );
  if (turned.rotation === 0) return { input: second, text, ms, pass: 2, rotation: 0, thumb, confidence };
  return { input: parseScan(turned.text), text: turned.text, ms, pass: 4, rotation: turned.rotation, thumb, confidence };
}
