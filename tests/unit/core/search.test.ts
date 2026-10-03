import { buildRegisterIndex } from '../../../src/core/registerIndex';
import { searchRegister } from '../../../src/core/search';
import { REGISTER, product } from '../../helpers/fixtures';

const idx = buildRegisterIndex(REGISTER);
const names = (q: string, i = idx) => searchRegister(i, q).map((p) => p.name);

test('brand prefix in any case', () => {
  expect(names('arthe')).toEqual(['Artheget EZ']);
  expect(names('ARTHEGET ez')).toEqual(['Artheget EZ']);
});

test('needs at least 3 letters or digits', () => {
  expect(names('ar')).toEqual([]);
  expect(names('  - ')).toEqual([]);
});

test('every word must match', () => {
  expect(names('coflu syr')).toEqual(['Coflu Syrup']);
  expect(names('coflu')).toEqual(['Coflu Syrup', 'Coflu Tablets']);
  expect(names('coflu forte')).toEqual([]);
});

test('ingredient matches count', () => {
  expect(names('artemether')).toEqual(['Artheget EZ']);
  expect(names('albendazole')).toEqual(['Zentel Plus']);
});

test('active products come before inactive ones', () => {
  const i = buildRegisterIndex({ ...REGISTER, products: [...REGISTER.products, product({ nrn: 'B4-9999', name: 'Oldcillin Forte', ingredient: 'Amoxicillin' })] });
  expect(names('oldc', i)).toEqual(['Oldcillin Forte', 'Oldcillin']);
});

test('NAFDAC number prefix, with or without the hyphen', () => {
  expect(searchRegister(idx, 'A4-62').map((p) => p.nrn)).toEqual(['A4-6238', 'A4-6298']);
  expect(searchRegister(idx, 'a46238').map((p) => p.nrn)).toEqual(['A4-6238']);
});

test('limit', () => {
  expect(searchRegister(idx, 'coflu', 1)).toHaveLength(1);
});
