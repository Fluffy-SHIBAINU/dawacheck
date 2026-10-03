import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AppProvider } from '../../../src/state/AppContext';
import { ListenButton } from '../../../src/components/ListenButton';
import { CLIPS } from '../../../src/voice/clips';
import { speak, unlockSpeech } from '../../../src/voice/speech';
import { playClip } from '../../../src/voice/player';
import { ALERTS, REGISTER } from '../../helpers/fixtures';

vi.mock('../../../src/voice/player', () => ({ playClip: vi.fn(async () => false) }));
vi.mock('../../../src/voice/speech', () => ({ speak: vi.fn(async () => true), unlockSpeech: vi.fn() }));

const loader = async () => ({ register: REGISTER, alerts: { version: 'v', fetchedAt: 'x', alerts: ALERTS }, flags: [], corrections: [], manifest: null });

function renderButton() {
  render(
    <AppProvider loader={loader}>
      <ListenButton clip="v_green" />
    </AppProvider>,
  );
}

test('falls back to the phone voice when the recorded clip is missing', async () => {
  renderButton();
  fireEvent.click(await screen.findByRole('button', { name: 'Listen' }));
  await waitFor(() => expect(speak).toHaveBeenCalledWith(CLIPS.v_green.en, 'en'));
  expect(screen.queryByTestId('voice-unavailable')).toBeNull();
});

test('says so when neither a clip nor a phone voice is available', async () => {
  vi.mocked(speak).mockResolvedValueOnce(false);
  renderButton();
  fireEvent.click(await screen.findByRole('button', { name: 'Listen' }));
  expect(await screen.findByTestId('voice-unavailable')).toBeInTheDocument();
});

test('unlocks speech inside the tap, before the clip attempt settles (iOS only allows speech from a gesture)', async () => {
  vi.mocked(speak).mockClear();
  vi.mocked(unlockSpeech).mockClear();
  vi.mocked(playClip).mockReturnValueOnce(new Promise(() => {}));
  renderButton();
  fireEvent.click(await screen.findByRole('button', { name: 'Listen' }));
  expect(unlockSpeech).toHaveBeenCalledTimes(1);
  expect(speak).not.toHaveBeenCalled();
});
