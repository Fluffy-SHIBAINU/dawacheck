import { CORE_KEYS, LANGS, translate, type MessageKey } from '../../src/i18n';
import { en } from '../../src/i18n/en';
import { ha } from '../../src/i18n/ha';
import { pcm } from '../../src/i18n/pcm';
import { yo } from '../../src/i18n/yo';
import { ig } from '../../src/i18n/ig';
import { CLIPS, CLIP_KEYS, voiceLangFor } from '../../src/voice/clips';

const keys = Object.keys(en) as MessageKey[];

test('Hausa and Pidgin cover every key with non-empty text', () => {
  for (const dict of [ha, pcm]) for (const k of keys) expect(dict[k]?.trim().length, k).toBeGreaterThan(0);
});

test('Yoruba and Igbo drafts cover the core keys', () => {
  for (const dict of [yo, ig]) for (const k of CORE_KEYS) expect(dict[k]?.trim().length, k).toBeGreaterThan(0);
});

test('placeholders are preserved in every translation', () => {
  for (const dict of [ha, pcm, yo, ig] as Partial<Record<MessageKey, string>>[]) {
    for (const k of keys) {
      const s = dict[k];
      if (!s) continue;
      const want = (en[k].match(/\{\w+\}/g) ?? []).sort();
      const got = (s.match(/\{\w+\}/g) ?? []).sort();
      expect(got, `${k}`).toEqual(want);
    }
  }
});

test('translate interpolates and falls back to English', () => {
  expect(translate('en', 'status_pending', { n: 3 })).toBe('Reports waiting: 3');
  // Fallback: remove one Yoruba string for a moment; English shows instead.
  const dict = yo as Record<string, string | undefined>;
  const saved = dict.settings_title;
  delete dict.settings_title;
  expect(translate('yo', 'settings_title')).toBe(en.settings_title);
  dict.settings_title = saved;
  expect(translate('ha', 'v_green_title')).toBe('An yi rajista da NAFDAC');
});

test('copy rules: no "safe", "genuine" or "authentic" in English UI text', () => {
  for (const s of Object.values(en)) expect(s).not.toMatch(/\b(safe|genuine|authentic)\b/i);
  expect(en.v_green_title).toBe('Registered with NAFDAC');
  expect(en.about_body).toBe(
    'DawaCheck checks NAFDAC records and what is printed on the box. It cannot test what is inside. If in doubt, do not take it and ask a health worker.',
  );
});

test('languages list marks Yoruba and Igbo as drafts', () => {
  expect(LANGS.map((l) => l.code)).toEqual(['ha', 'en', 'pcm', 'yo', 'ig']);
  expect(LANGS.filter((l) => l.draft).map((l) => l.code)).toEqual(['yo', 'ig']);
});

test('voice clips exist in en, ha and pcm for every key', () => {
  for (const k of CLIP_KEYS) for (const l of ['en', 'ha', 'pcm'] as const) expect(CLIPS[k][l].length, `${k}/${l}`).toBeGreaterThan(10);
  expect(voiceLangFor('yo')).toBe('en');
  expect(voiceLangFor('ha')).toBe('ha');
});

const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

test.each([['ha', ha], ['pcm', pcm], ['yo', yo], ['ig', ig]] as const)('%s has every key with the same placeholders', (lang, m) => {
  for (const k of Object.keys(en) as (keyof typeof en)[]) {
    const s = (m as Partial<Record<keyof typeof en, string>>)[k];
    expect(s, `${lang}.${k}`).toBeTruthy();
    expect(vars(s!), `${lang}.${k}`).toEqual(vars(en[k]));
  }
});
