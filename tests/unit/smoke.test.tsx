import { render, screen } from '@testing-library/react';
import { App } from '../../src/App';
import { REGISTER, ALERTS } from '../helpers/fixtures';

test('app boots to the language picker on first run', async () => {
  const loader = async () => ({
    register: REGISTER,
    alerts: { version: '2026-10-03', fetchedAt: 'x', alerts: ALERTS },
    flags: [],
    corrections: [],
    manifest: null,
  });
  render(<App loader={loader} />);
  expect(await screen.findByText('Choose your language')).toBeInTheDocument();
});
