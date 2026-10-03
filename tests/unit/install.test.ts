import { isIos, isStandalone, requestPersistence } from '../../src/lib/install';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const IPAD_DESKTOP = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36';

test('detects iPhone and iPadOS, not Android or a Mac', () => {
  expect(isIos(IPHONE, 5)).toBe(true);
  expect(isIos(IPAD_DESKTOP, 5)).toBe(true);
  expect(isIos(IPAD_DESKTOP, 0)).toBe(false);
  expect(isIos(ANDROID, 5)).toBe(false);
});

test('standalone from display-mode or navigator.standalone', () => {
  const w = (matches: boolean, standalone?: boolean) => ({ matchMedia: () => ({ matches }), navigator: { standalone } }) as unknown as Window;
  expect(isStandalone(w(true))).toBe(true);
  expect(isStandalone(w(false, true))).toBe(true);
  expect(isStandalone(w(false))).toBe(false);
});

test('persistence: already kept, granted, denied, unsupported', async () => {
  const persist = vi.fn(async () => true);
  expect(await requestPersistence({ persisted: async () => true, persist })).toBe('granted');
  expect(persist).not.toHaveBeenCalled();
  expect(await requestPersistence({ persisted: async () => false, persist: async () => true })).toBe('granted');
  expect(await requestPersistence({ persisted: async () => false, persist: async () => false })).toBe('denied');
  expect(await requestPersistence(null)).toBe('unsupported');
});
