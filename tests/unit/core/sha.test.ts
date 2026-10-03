// @vitest-environment node
import { sha256Hex } from '../../../src/core/sha';

test('sha256 of "abc"', async () => {
  expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});

test('sha256 of bytes equals sha256 of the same string', async () => {
  expect(await sha256Hex(new TextEncoder().encode('abc'))).toBe(await sha256Hex('abc'));
});
