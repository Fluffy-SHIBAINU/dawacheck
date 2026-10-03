import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AppProvider } from '../../../src/state/AppContext';
import { Report } from '../../../src/screens/Report';
import { saveCheck } from '../../../src/data/checks';
import { db } from '../../../src/data/db';
import { decide } from '../../../src/core/verdict';
import { manualInput } from '../../../src/core/parse';
import { buildRegisterIndex } from '../../../src/core/registerIndex';
import { buildConfusion } from '../../../src/core/confusion';
import { DEFAULT_THRESHOLDS } from '../../../src/core/types';
import { ALERTS, REGISTER, TODAY } from '../../helpers/fixtures';

const loader = async () => ({ register: REGISTER, alerts: { version: 'v', fetchedAt: 'x', alerts: ALERTS }, flags: [], corrections: [], manifest: null });

test('saving a report queues it and shows SMS backup and hotline', async () => {
  const ctx = { register: buildRegisterIndex(REGISTER), alerts: ALERTS, flags: new Map(), confusion: buildConfusion([]), today: TODAY, thresholds: DEFAULT_THRESHOLDS };
  const input = manualInput('A4-99231')!;
  const row = await saveCheck(input, decide(input, ctx), null);
  render(
    <AppProvider loader={loader}>
      <MemoryRouter initialEntries={[`/report/${row.id}`]}>
        <Routes>
          <Route path="/report/:id" element={<Report />} />
        </Routes>
      </MemoryRouter>
    </AppProvider>,
  );
  fireEvent.click(await screen.findByRole('button', { name: 'Save report' }));
  await waitFor(() => expect(screen.getByTestId('report-saved')).toBeInTheDocument());
  const reports = await db.reports.toArray();
  expect(reports.at(-1)).toMatchObject({ nrn: 'A4-99231', reason: 'not_in_register', verdict: 'red', syncedAt: null });
  expect(screen.getByText('0800-162-3322')).toHaveClass('code');
  expect(screen.getByRole('link', { name: 'Send by SMS now' }).getAttribute('href')).toContain('sms:');
});
