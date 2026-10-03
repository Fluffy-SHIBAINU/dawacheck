import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AppProvider, useApp } from '../../../src/state/AppContext';
import { ALERTS, REGISTER } from '../../helpers/fixtures';

const loader = async () => ({ register: REGISTER, alerts: { version: 'v', fetchedAt: 'x', alerts: ALERTS }, flags: [], corrections: [], manifest: null });

function Switcher() {
  const { updateSettings, settings } = useApp();
  return (
    <button type="button" onClick={() => void updateSettings({ lang: 'ha' })}>
      {settings.lang}
    </button>
  );
}

test('the page language follows the chosen language (screen readers pick the right voice)', async () => {
  render(
    <AppProvider loader={loader}>
      <Switcher />
    </AppProvider>,
  );
  await waitFor(() => expect(document.documentElement.lang).toBe('en'));
  fireEvent.click(screen.getByRole('button'));
  await waitFor(() => expect(document.documentElement.lang).toBe('ha'));
});
