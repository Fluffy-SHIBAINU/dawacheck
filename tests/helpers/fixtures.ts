import type { Alert, Product, RegisterPack } from '../../src/core/types';

export function product(p: Partial<Product> & Pick<Product, 'nrn' | 'name'>): Product {
  return {
    nrnRaw: p.nrn,
    ingredient: '',
    strength: '',
    form: 'Tablet',
    route: 'Oral',
    applicant: 'Test Pharma Ltd',
    category: 'Drugs',
    regExpiry: '2027-12-31',
    status: 'Active',
    description: '',
    packSize: '',
    atc: null,
    ...p,
  };
}

export const ARTHEGET = product({
  nrn: 'A4-6238',
  name: 'Artheget EZ',
  ingredient: 'Artemether + Lumefantrine',
  strength: '80 mg; 480 mg',
  regExpiry: '2026-12-01',
  applicant: 'Example Pharma Ltd',
  description: 'Tablet Yellow colored, oblong shaped tablet plain on both sides',
  packSize: "2 x 3's (in Alu-Alu blisters)",
});
export const LAPSED = product({ nrn: 'B4-1111', name: 'Oldcillin', ingredient: 'Amoxicillin', strength: '500 mg', status: 'Inactive', regExpiry: '2025-01-01' });
export const EXPIRED_REG = product({ nrn: 'B4-2222', name: 'Paraclear', ingredient: 'Paracetamol', strength: '500 mg', regExpiry: '2026-01-31' });
export const DUP_A = product({ nrn: 'A11-0275', name: 'Coflu Syrup', ingredient: 'Chlorphenamine', strength: '2 mg/5 ml' });
export const DUP_B = product({ nrn: 'A11-0275', name: 'Coflu Tablets', ingredient: 'Chlorphenamine', strength: '4 mg' });
export const FORX = product({ nrn: 'B4-3030', name: 'Forxiga', ingredient: 'Dapagliflozin', strength: '10 mg' });
export const NEIGHBOR = product({ nrn: 'A4-6298', name: 'Zentel Plus', ingredient: 'Albendazole', strength: '400 mg' });

export const REGISTER: RegisterPack = {
  version: '2026-10-03',
  source: 'test',
  fetchedAt: '2026-10-03T00:00:00Z',
  products: [ARTHEGET, LAPSED, EXPIRED_REG, DUP_A, DUP_B, FORX, NEIGHBOR],
};

export const ALERTS: Alert[] = [
  {
    id: '036/2026', wpId: 36, url: 'https://nafdac.gov.ng/a36', date: '2026-08-10', title: 'Suspected counterfeit Forxiga',
    kind: 'counterfeit', appliesToNigeria: true, summary: 'Suspected counterfeit Forxiga in circulation.',
    products: [{ brand: 'Forxiga', ingredient: 'Dapagliflozin', strength: '10 mg', manufacturer: 'AstraZeneca', nrn: null, batches: ['FX123'] }],
  },
  {
    id: '035/2026', wpId: 35, url: 'https://nafdac.gov.ng/a35', date: '2026-08-01', title: 'Unregistered Menofix Composition',
    kind: 'unregistered', appliesToNigeria: true, summary: 'Menofix Composition is not registered.',
    products: [{ brand: 'Menofix Composition', ingredient: null, strength: null, manufacturer: null, nrn: null, batches: [] }],
  },
  {
    id: '042/2026', wpId: 42, url: 'https://nafdac.gov.ng/a42', date: '2026-08-19', title: 'Falsified BPPL Artemether/Lumefantrine',
    kind: 'counterfeit', appliesToNigeria: true, summary: 'Seizure of falsified BPPL artemether/lumefantrine.',
    products: [{ brand: 'BPPL Artemether/Lumefantrine', ingredient: 'Artemether/Lumefantrine', strength: '80mg/480mg', manufacturer: 'BPPL', nrn: null, batches: ['BP2201'] }],
  },
  {
    id: '025/2026', wpId: 25, url: 'https://nafdac.gov.ng/a25', date: '2026-07-01', title: 'Recall of antacid in South Africa',
    kind: 'recall', appliesToNigeria: false, summary: 'Foreign recall.',
    products: [{ brand: 'Citro-Soda', ingredient: null, strength: null, manufacturer: null, nrn: null, batches: ['CS1'] }],
  },
];

export const TODAY = new Date('2026-10-03T12:00:00Z');

export const DEMO_TEXT = {
  green: 'ARTHEGET EZ\nArtemether 80 mg + Lumefantrine 480 mg\n6 tablets\nNAFDAC REG. NO. A4-6238\nBATCH AE2511 EXP 11/2027\nDEMO PACK',
  mismatch: 'MALAQUICK\nArtemether 20 mg + Lumefantrine 120 mg\nNAFDAC REG. NO. A4-6238\nBATCH MQ0925 EXP 09/2027\nDEMO PACK',
  notfound: 'PARAMAX FORTE\nParacetamol 500 mg\nNAFDAC REG. NO. A4-99231\nBATCH PX7731 EXP 03/2028\nDEMO PACK',
  expired: 'ARTHEGET EZ\nArtemether 80 mg + Lumefantrine 480 mg\nNAFDAC REG. NO. A4-6238\nBATCH AE2402 EXP 08/2026\nDEMO PACK',
  alert: 'MENOFIX COMPOSITION\nHerbal mixture\nNAFDAC REG. NO. A4-0999\nBATCH MF0101 EXP 12/2027\nDEMO PACK',
};
