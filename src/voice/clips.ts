import type { Lang } from '../core/types';

export const CLIP_KEYS = [
  'welcome', 'howto', 'v_green', 'v_green_unconfirmed', 'v_amber_mismatch', 'v_amber_lapsed', 'v_amber_alert',
  'v_amber_community', 'v_red_notfound', 'v_red_alert', 'v_red_expired', 'v_unknown', 'report_saved', 'sync_done',
] as const;
export type ClipKey = (typeof CLIP_KEYS)[number];
export type VoiceLang = 'en' | 'ha' | 'pcm';

export function voiceLangFor(lang: Lang): VoiceLang {
  return lang === 'ha' || lang === 'pcm' ? lang : 'en';
}

export const CLIPS: Record<ClipKey, Record<VoiceLang, string>> = {
  welcome: {
    en: 'Welcome to DawaCheck. Choose your language.',
    ha: 'Barka da zuwa DawaCheck. Zaɓi harshenka.',
    pcm: 'Welcome to DawaCheck. Choose your language.',
  },
  howto: {
    en: 'To check a medicine, press the big button and take a photo of the box. Make sure the NAFDAC number is clear. You can also type the number.',
    ha: 'Don duba magani, danna babban maɓalli ka ɗauki hoton kwalin. Ka tabbata lambar NAFDAC ta fito sosai. Kana iya rubuta lambar ma.',
    pcm: 'To check medicine, press the big button and snap the box. Make sure say the NAFDAC number clear. You fit type the number too.',
  },
  v_green: {
    en: 'This number is registered with NAFDAC. Check that the medicine looks like the description on the screen.',
    ha: 'An yi wa wannan lambar rajista da NAFDAC. Ka tabbata maganin yana kama da bayanin da ke kan allo.',
    pcm: 'NAFDAC don register this number. Check say the medicine resemble wetin dey the screen.',
  },
  v_green_unconfirmed: {
    en: 'This number is registered with NAFDAC. Check that the name on the box matches the name on the screen.',
    ha: 'An yi wa wannan lambar rajista da NAFDAC. Ka tabbata sunan da ke kan kwalin ya yi daidai da sunan da ke kan allo.',
    pcm: 'NAFDAC don register this number. Check say the name for the box match the name for the screen.',
  },
  v_amber_mismatch: {
    en: 'Be careful. The box does not match its NAFDAC number. Ask a pharmacist or health worker before taking it.',
    ha: 'A kula. Kwalin bai yi daidai da lambarsa ta NAFDAC ba. Tambayi masanin magunguna ko maʼaikacin lafiya kafin ka sha.',
    pcm: 'Take care. This box no match im NAFDAC number. Ask pharmacist or health worker before you take am.',
  },
  v_amber_lapsed: {
    en: 'Be careful. The NAFDAC registration of this product is not active. Ask a pharmacist before using it.',
    ha: 'A kula. Rajistar NAFDAC ta wannan magani ba ta aiki. Tambayi masanin magunguna kafin amfani.',
    pcm: 'Take care. The NAFDAC registration for this medicine no dey active. Ask pharmacist before you use am.',
  },
  v_amber_alert: {
    en: 'Be careful. NAFDAC has warned about fake versions of this medicine. Compare the batch number with a health worker.',
    ha: 'A kula. NAFDAC ta yi gargaɗi game da jabun wannan magani. Kwatanta lambar batch tare da maʼaikacin lafiya.',
    pcm: 'Take care. NAFDAC don warn about fake ones of this medicine. Compare the batch number with health worker.',
  },
  v_amber_community: {
    en: 'Be careful. Other people have reported this number. Ask a health worker before taking it.',
    ha: 'A kula. Wasu mutane sun kai rahoton wannan lambar. Tambayi maʼaikacin lafiya kafin ka sha.',
    pcm: 'Take care. Other people don report this number. Ask health worker before you take am.',
  },
  v_red_notfound: {
    en: 'Warning. This number is not in the NAFDAC register. Do not take this medicine. Show it to a health worker and report it.',
    ha: 'Gargaɗi. Wannan lambar ba ta cikin rajistar NAFDAC. Kada ka sha wannan magani. Nuna shi ga maʼaikacin lafiya kuma ka kai rahoto.',
    pcm: 'Warning. This number no dey NAFDAC register. No take this medicine. Show am to health worker and report am.',
  },
  v_red_alert: {
    en: 'Warning. NAFDAC has issued an alert about this medicine. Do not take it. Report it.',
    ha: 'Gargaɗi. NAFDAC ta fitar da gargaɗi game da wannan magani. Kada ka sha shi. Ka kai rahoto.',
    pcm: 'Warning. NAFDAC don give alert about this medicine. No take am. Report am.',
  },
  v_red_expired: {
    en: 'Warning. This medicine has expired. Do not take it.',
    ha: 'Gargaɗi. Wannan magani ya wuce ranar ƙarewarsa. Kada ka sha shi.',
    pcm: 'Warning. This medicine don expire. No take am.',
  },
  v_unknown: {
    en: 'We could not read the number. Try again in good light, or type the number.',
    ha: 'Ba mu iya karanta lambar ba. Sake gwadawa a wuri mai haske, ko ka rubuta lambar.',
    pcm: 'We no fit read the number. Try again for better light, or type the number.',
  },
  report_saved: {
    en: 'Your report is saved. It will be sent when you have internet.',
    ha: 'An ajiye rahotonka. Za a aika shi idan akwai intanet.',
    pcm: 'We don save your report. E go send when network come.',
  },
  sync_done: {
    en: 'DawaCheck is up to date.',
    ha: 'DawaCheck ta sabunta.',
    pcm: 'DawaCheck don update.',
  },
};
