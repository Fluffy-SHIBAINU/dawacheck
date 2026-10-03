import { render, screen, fireEvent } from '@testing-library/react';
import { VerdictView } from '../../../src/components/VerdictView';
import { decide } from '../../../src/core/verdict';
import { manualInput, parseScan } from '../../../src/core/parse';
import { buildRegisterIndex } from '../../../src/core/registerIndex';
import { buildConfusion } from '../../../src/core/confusion';
import { DEFAULT_THRESHOLDS } from '../../../src/core/types';
import { translate } from '../../../src/i18n';
import { ALERTS, DEMO_TEXT, REGISTER, TODAY } from '../../helpers/fixtures';

const ctx = { register: buildRegisterIndex(REGISTER), alerts: ALERTS, flags: new Map(), confusion: buildConfusion([]), today: TODAY, thresholds: DEFAULT_THRESHOLDS };
const t = (k: Parameters<typeof translate>[1], v?: Record<string, string | number>) => translate('en', k, v);

test('green verdict shows the registered title, product and look-alike description', () => {
  render(<VerdictView verdict={decide(parseScan(DEMO_TEXT.green), ctx)} t={t} />);
  expect(screen.getByTestId('verdict')).toHaveAttribute('data-level', 'green');
  expect(screen.getByText('Registered with NAFDAC')).toBeInTheDocument();
  expect(screen.getByText('Artheget EZ')).toBeInTheDocument();
  expect(screen.getByText(/Yellow colored, oblong/)).toBeInTheDocument();
  expect(screen.getByText('A4-6238')).toHaveClass('code');
});

test('amber mismatch shows the box versus register comparison', () => {
  render(<VerdictView verdict={decide(parseScan(DEMO_TEXT.mismatch), ctx)} t={t} />);
  expect(screen.getByTestId('verdict')).toHaveAttribute('data-level', 'amber');
  expect(screen.getByText('MALAQUICK')).toBeInTheDocument();
  expect(screen.getByText(/does not match this NAFDAC number/)).toBeInTheDocument();
});

test('red verdict for an unknown number offers suggestions', () => {
  const picked: string[] = [];
  render(<VerdictView verdict={decide(manualInput('A4-6239')!, ctx)} t={t} onPickSuggestion={(n) => picked.push(n)} />);
  expect(screen.getByText('Do not take this medicine')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /A4-6238/ }));
  expect(picked).toEqual(['A4-6238']);
});

test('alert verdict shows the alert card', () => {
  render(<VerdictView verdict={decide(parseScan(DEMO_TEXT.alert), ctx)} t={t} />);
  expect(screen.getByText('NAFDAC alert 035/2026')).toBeInTheDocument();
});
