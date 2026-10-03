import { normalizeAll, normalizeRecord, type GreenbookRow } from '../../scripts/lib/normalizeRegister';

const row: GreenbookRow = {
  NAFDAC: 'A4-6238',
  product_name: 'Artheget EZ##',
  ingredient_name: 'Artemether + Lumefantrine',
  strength: '80 mg; 480 mg',
  form_name: 'Tablet',
  route_name: 'Oral',
  applicant_name: 'Example Pharma Ltd',
  category_name: 'Drugs',
  expiry_date: '2026-12-01',
  status: 'Active',
  product_description: 'Tablet\r\nYellow colored, oblong shaped tablet plain on both sides',
  pack_size: '2 x 3&#039;s (in Alu-Alu blisters)',
  atc: 'P01BF01',
};

test('normalizes a Greenbook row into a Product', () => {
  expect(normalizeRecord(row)).toEqual({
    nrn: 'A4-6238',
    nrnRaw: 'A4-6238',
    name: 'Artheget EZ',
    ingredient: 'Artemether + Lumefantrine',
    strength: '80 mg; 480 mg',
    form: 'Tablet',
    route: 'Oral',
    applicant: 'Example Pharma Ltd',
    category: 'Drugs',
    regExpiry: '2026-12-01',
    status: 'Active',
    description: 'Tablet Yellow colored, oblong shaped tablet plain on both sides',
    packSize: "2 x 3's (in Alu-Alu blisters)",
    atc: 'P01BF01',
  });
});

test('drops rows without a valid NRN and reports them', () => {
  const { products, dropped } = normalizeAll([row, { ...row, NAFDAC: 'NA' }, { ...row, NAFDAC: '04 – 1486' }]);
  expect(products.map((p) => p.nrn)).toEqual(['A4-6238', '04-1486']);
  expect(dropped).toEqual(['NA']);
});

test('handles missing optional fields', () => {
  const p = normalizeRecord({ NAFDAC: 'B4-0001', product_name: 'X*', expiry_date: 'bad' });
  expect(p).not.toBeNull();
  expect(p!.name).toBe('X');
  expect(p!.regExpiry).toBeNull();
  expect(p!.status).toBe('Unknown');
  expect(p!.atc).toBeNull();
});
