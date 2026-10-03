export const NG_STATES: { code: string; name: string }[] = [
  { code: 'AB', name: 'Abia' }, { code: 'AD', name: 'Adamawa' }, { code: 'AK', name: 'Akwa Ibom' }, { code: 'AN', name: 'Anambra' },
  { code: 'BA', name: 'Bauchi' }, { code: 'BY', name: 'Bayelsa' }, { code: 'BE', name: 'Benue' }, { code: 'BO', name: 'Borno' },
  { code: 'CR', name: 'Cross River' }, { code: 'DE', name: 'Delta' }, { code: 'EB', name: 'Ebonyi' }, { code: 'ED', name: 'Edo' },
  { code: 'EK', name: 'Ekiti' }, { code: 'EN', name: 'Enugu' }, { code: 'FC', name: 'Federal Capital Territory' }, { code: 'GO', name: 'Gombe' },
  { code: 'IM', name: 'Imo' }, { code: 'JI', name: 'Jigawa' }, { code: 'KD', name: 'Kaduna' }, { code: 'KN', name: 'Kano' },
  { code: 'KT', name: 'Katsina' }, { code: 'KE', name: 'Kebbi' }, { code: 'KO', name: 'Kogi' }, { code: 'KW', name: 'Kwara' },
  { code: 'LA', name: 'Lagos' }, { code: 'NA', name: 'Nasarawa' }, { code: 'NI', name: 'Niger' }, { code: 'OG', name: 'Ogun' },
  { code: 'ON', name: 'Ondo' }, { code: 'OS', name: 'Osun' }, { code: 'OY', name: 'Oyo' }, { code: 'PL', name: 'Plateau' },
  { code: 'RI', name: 'Rivers' }, { code: 'SO', name: 'Sokoto' }, { code: 'TA', name: 'Taraba' }, { code: 'YO', name: 'Yobe' },
  { code: 'ZA', name: 'Zamfara' },
];

export function stateName(code: string | null): string | null {
  return NG_STATES.find((s) => s.code === code)?.name ?? null;
}
