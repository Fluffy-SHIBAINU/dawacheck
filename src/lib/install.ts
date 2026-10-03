export const INSTALL_HINT_KEY = 'dc_install_hint_dismissed';

export function isIos(ua: string, maxTouchPoints: number): boolean {
  if (/iPhone|iPad|iPod/.test(ua)) return true;
  return /Macintosh/.test(ua) && maxTouchPoints > 1;
}

export function isStandalone(w: Window = window): boolean {
  const nav = w.navigator as Navigator & { standalone?: boolean };
  return w.matchMedia?.('(display-mode: standalone)').matches === true || nav?.standalone === true;
}

type Persist = Pick<StorageManager, 'persist' | 'persisted'>;

export async function requestPersistence(storage: Persist | null | undefined = globalThis.navigator?.storage): Promise<'granted' | 'denied' | 'unsupported'> {
  if (!storage?.persist || !storage.persisted) return 'unsupported';
  try {
    if (await storage.persisted()) return 'granted';
    return (await storage.persist()) ? 'granted' : 'denied';
  } catch {
    return 'unsupported';
  }
}
