import { prewarmOcrOnFirstVisit } from '../../src/ocr/prewarm';

function fakeSw(controller: object | null) {
  const listeners: Record<string, (() => void)[]> = {};
  return {
    controller,
    addEventListener: (type: string, cb: () => void) => (listeners[type] ??= []).push(cb),
    fire: (type: string) => (listeners[type] ?? []).forEach((cb) => cb()),
  };
}

test('first visit: starts the OCR worker once the service worker takes control', async () => {
  const sw = fakeSw(null);
  const warm = vi.fn(async () => undefined);
  prewarmOcrOnFirstVisit(sw as never, warm);
  expect(warm).not.toHaveBeenCalled();
  sw.fire('controllerchange');
  expect(warm).toHaveBeenCalledTimes(1);
});

test('later visits are already controlled, so nothing is started early', () => {
  const sw = fakeSw({});
  const warm = vi.fn(async () => undefined);
  prewarmOcrOnFirstVisit(sw as never, warm);
  sw.fire('controllerchange');
  expect(warm).not.toHaveBeenCalled();
});

test('no service worker support: does nothing', () => {
  const warm = vi.fn(async () => undefined);
  expect(() => prewarmOcrOnFirstVisit(undefined, warm)).not.toThrow();
  expect(warm).not.toHaveBeenCalled();
});

test('a failing warm-up is swallowed (the scan will retry)', async () => {
  const sw = fakeSw(null);
  const warm = vi.fn(async () => Promise.reject(new Error('offline')));
  prewarmOcrOnFirstVisit(sw as never, warm);
  expect(() => sw.fire('controllerchange')).not.toThrow();
  await Promise.resolve();
  expect(warm).toHaveBeenCalledTimes(1);
});
