type SwLike = Pick<ServiceWorkerContainer, 'controller' | 'addEventListener'>;

/**
 * On the first visit the page loads before the service worker controls it. A worker started later in
 * that same visit may not be served from the offline cache, so a scan after losing signal would fail.
 * Start the OCR worker as soon as the service worker takes control (while still online) and keep it
 * for the visit. Later visits are controlled from the start and need nothing here.
 */
export function prewarmOcrOnFirstVisit(
  sw: SwLike | undefined = typeof navigator === 'undefined' ? undefined : navigator.serviceWorker,
  warm: () => Promise<unknown>,
): void {
  if (!sw || sw.controller) return;
  let started = false;
  sw.addEventListener('controllerchange', () => {
    if (started) return;
    started = true;
    void warm().catch(() => undefined);
  });
}
