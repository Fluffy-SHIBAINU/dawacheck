import { readFileSync } from 'node:fs';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Dashboard } from '../../src/screens/Dashboard';
import { EXAMPLE_DASHBOARD } from '../../src/demo/dashboardExample';
import { getView } from '../../src/sync/api';

vi.mock('../../src/sync/api', () => ({ getView: vi.fn() }));

test('with the backend off, the dashboard shows labelled example data and fetches nothing', async () => {
  render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>,
  );
  expect(await screen.findByTestId('example-notice')).toHaveTextContent(/example data/i);
  expect(screen.getByText(/Last 7 days · Example data/)).toBeInTheDocument();
  expect(screen.getByTestId('dashboard')).toHaveTextContent(String(EXAMPLE_DASHBOARD.a.checks));
  expect(screen.getByTestId('dashboard')).toHaveTextContent('Kano');
  expect(getView).not.toHaveBeenCalled();
});

test('example numbers are not real registered products', () => {
  const reg = JSON.parse(readFileSync('public/packs/register.json', 'utf8')) as { products: { nrn: string }[] };
  const real = new Set(reg.products.map((p) => p.nrn));
  const shown = [...EXAMPLE_DASHBOARD.u, ...EXAMPLE_DASHBOARD.f].map((x) => x.nrn);
  expect(shown.length).toBeGreaterThan(0);
  for (const nrn of shown) expect(real.has(nrn), nrn).toBe(false);
});
