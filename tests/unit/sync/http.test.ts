import { fetchWithRetry } from '../../../src/sync/http';

const fast = { tries: 3, delays: [0, 0, 0], timeoutMs: 1000 };

test('retries a server error, then returns the good response', async () => {
  let n = 0;
  const f = (async () => (++n < 3 ? new Response('busy', { status: 503 }) : new Response('ok', { status: 200 }))) as unknown as typeof fetch;
  const res = await fetchWithRetry(f, 'http://x', {}, fast);
  expect(res.status).toBe(200);
  expect(n).toBe(3);
});

test('gives up after the last try with the last error', async () => {
  let n = 0;
  const f = (async () => {
    n++;
    throw new TypeError('Failed to fetch');
  }) as unknown as typeof fetch;
  await expect(fetchWithRetry(f, 'http://x', {}, fast)).rejects.toThrow('Failed to fetch');
  expect(n).toBe(3);
});

test('client errors come back at once, without retrying', async () => {
  let n = 0;
  const f = (async () => {
    n++;
    return new Response('later', { status: 429 });
  }) as unknown as typeof fetch;
  expect((await fetchWithRetry(f, 'http://x', {}, fast)).status).toBe(429);
  expect(n).toBe(1);
});

test('a request that hangs is aborted after the timeout and retried', async () => {
  let n = 0;
  const f = ((_url: string, init?: RequestInit) => {
    n++;
    if (n === 1) {
      return new Promise((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))));
    }
    return Promise.resolve(new Response('ok', { status: 200 }));
  }) as unknown as typeof fetch;
  const res = await fetchWithRetry(f, 'http://x', {}, { tries: 2, delays: [0], timeoutMs: 20 });
  expect(res.status).toBe(200);
  expect(n).toBe(2);
});
