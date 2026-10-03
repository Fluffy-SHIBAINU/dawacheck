import { recognizeWithRotation } from '../../src/ocr/retry';
import { rotatedSize } from '../../src/ocr/preprocess';

const has = (t: string) => t.includes('A4-6238');

test('stops after the first pass when it finds a number', async () => {
  const rec = vi.fn(async () => 'NAFDAC REG NO A4-6238');
  expect(await recognizeWithRotation(rec, has)).toEqual({ text: 'NAFDAC REG NO A4-6238', rotation: 0 });
  expect(rec).toHaveBeenCalledTimes(1);
});

test('tries 90 then 270 then 180 degrees', async () => {
  const seen: number[] = [];
  const rec = async (deg: number) => { seen.push(deg); return deg === 270 ? 'A4-6238' : 'noise'; };
  expect(await recognizeWithRotation(rec as never, has)).toEqual({ text: 'A4-6238', rotation: 270 });
  expect(seen).toEqual([0, 90, 270]);
});

test('returns the upright text when no angle finds a number', async () => {
  const rec = async (deg: number) => `pass ${deg}`;
  expect(await recognizeWithRotation(rec as never, has)).toEqual({ text: 'pass 0', rotation: 0 });
});

test('rotatedSize swaps width and height for quarter turns', () => {
  expect(rotatedSize(400, 300, 90)).toEqual({ w: 300, h: 400 });
  expect(rotatedSize(400, 300, 180)).toEqual({ w: 400, h: 300 });
});
