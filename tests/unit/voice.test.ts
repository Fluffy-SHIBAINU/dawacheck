import { clipForVerdict } from '../../src/voice/forVerdict';
import { clipUrl, playClip } from '../../src/voice/player';
import type { Verdict } from '../../src/core/types';

const v = (level: Verdict['level'], reasons: Verdict['reasons']) => ({ level, reasons }) as Verdict;

test.each([
  [v('green', ['registered']), 'v_green'],
  [v('green', ['registered', 'name_unconfirmed']), 'v_green_unconfirmed'],
  [v('amber', ['registered', 'name_mismatch']), 'v_amber_mismatch'],
  [v('amber', ['registered', 'alert_product']), 'v_amber_alert'],
  [v('amber', ['registered', 'community_flag']), 'v_amber_community'],
  [v('amber', ['registered', 'reg_lapsed']), 'v_amber_lapsed'],
  [v('red', ['not_in_register']), 'v_red_notfound'],
  [v('red', ['not_in_register', 'on_alert']), 'v_red_alert'],
  [v('red', ['registered', 'pack_expired']), 'v_red_expired'],
  [v('unknown', ['no_number_found']), 'v_unknown'],
])('clip for %o is %s', (verdict, clip) => {
  expect(clipForVerdict(verdict)).toBe(clip);
});

test('clip urls are under /voice', () => {
  expect(clipUrl('v_green', 'ha')).toBe('/voice/ha/v_green.mp3');
});

test('player falls back to English, then gives up quietly', async () => {
  const tried: string[] = [];
  const factory = () => {
    const a = { src: '', play: () => (tried.push(a.src), a.src.includes('/en/') ? Promise.resolve() : Promise.reject(new Error('404'))) };
    return a as unknown as HTMLAudioElement;
  };
  expect(await playClip('v_green', 'ha', factory)).toBe(true);
  expect(tried).toEqual(['/voice/ha/v_green.mp3', '/voice/en/v_green.mp3']);
  const none = () => ({ src: '', play: () => Promise.reject(new Error('x')) }) as unknown as HTMLAudioElement;
  expect(await playClip('v_green', 'ha', none)).toBe(false);
});
