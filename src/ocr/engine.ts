import { createWorker, PSM, type Worker } from 'tesseract.js';

let workerP: Promise<Worker> | null = null;
let progressCb: ((p: number) => void) | null = null;

function base(): string {
  return import.meta.env.BASE_URL ?? '/';
}

// wasm-feature-detect SIMD probe. Pointing corePath at one file stops the worker from also
// wanting the relaxed-SIMD build, so only two core files need to ship.
const SIMD_PROBE = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11]);

function coreFile(): string {
  let simd = false;
  try {
    simd = typeof WebAssembly === 'object' && WebAssembly.validate(SIMD_PROBE);
  } catch {
    simd = false;
  }
  return simd ? 'tesseract-core-simd-lstm.wasm.js' : 'tesseract-core-lstm.wasm.js';
}

export function getWorker(): Promise<Worker> {
  workerP ??= createWorker('eng', 1, {
    workerPath: `${base()}tesseract/worker.min.js`,
    // Start the worker from its own same-origin URL, not a blob: URL. A blob worker is not always
    // served by the service worker, so on a phone that goes offline right after the first visit the
    // OCR scripts could fail to load. A same-origin worker script is matched by the SW scope.
    workerBlobURL: false,
    corePath: `${base()}tesseract/${coreFile()}`,
    langPath: `${base()}tesseract/lang`,
    gzip: true,
    cacheMethod: 'none',
    logger: (m: { status: string; progress: number }) => {
      if (m.status === 'recognizing text') progressCb?.(m.progress);
    },
  });
  return workerP;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => reject(new Error('OCR timed out')), ms);
    p.then(
      (v) => {
        clearTimeout(id);
        resolve(v);
      },
      (e) => {
        clearTimeout(id);
        reject(e);
      },
    );
  });
}

export async function recognize(
  image: HTMLCanvasElement | Blob | string,
  mode: 'sparse' | 'line',
  onProgress?: (p: number) => void,
): Promise<{ text: string; confidence: number; ms: number }> {
  progressCb = onProgress ?? null;
  const w = await getWorker();
  await w.setParameters(
    mode === 'sparse'
      ? { tessedit_pageseg_mode: PSM.SPARSE_TEXT, tessedit_char_whitelist: '' }
      : { tessedit_pageseg_mode: PSM.SINGLE_LINE, tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-/ ' },
  );
  const t0 = performance.now();
  const { data } = await withTimeout(w.recognize(image), 20_000);
  return { text: data.text, confidence: data.confidence, ms: Math.round(performance.now() - t0) };
}
