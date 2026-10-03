import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AppProvider } from '../../../src/state/AppContext';
import { Scan } from '../../../src/screens/Scan';
import { pendingScan } from '../../../src/lib/pendingScan';
import { runScan } from '../../../src/ocr/scan';
import { ALERTS, REGISTER } from '../../helpers/fixtures';

vi.mock('../../../src/ocr/scan', () => ({ runScan: vi.fn() }));
vi.mock('../../../src/components/CropBox', async () => {
  const { useEffect } = await import('react');
  return {
    CropBox: ({ onChange }: { onChange: (c: { x: number; y: number; w: number; h: number }) => void }) => {
      useEffect(() => onChange({ x: 0, y: 0, w: 1, h: 1 }), [onChange]);
      return null;
    },
  };
});

const loader = async () => ({ register: REGISTER, alerts: { version: 'v', fetchedAt: 'x', alerts: ALERTS }, flags: [], corrections: [], manifest: null });

test('reading a drawn box says "Reading", not the earlier "Trying another angle"', async () => {
  URL.createObjectURL = vi.fn(() => 'blob:photo');
  vi.mocked(runScan)
    .mockImplementationOnce(async (_file, opts) => {
      opts?.onStage?.('rotate');
      return { input: { nrnCandidates: [] }, text: '', ms: 1, pass: 2, rotation: 0, thumb: null, confidence: 0 } as never;
    })
    .mockImplementationOnce(() => new Promise(() => {}));
  pendingScan.set(new File(['x'], 'box.png', { type: 'image/png' }));
  render(
    <AppProvider loader={loader}>
      <MemoryRouter initialEntries={['/scan']}>
        <Routes>
          <Route path="/scan" element={<Scan />} />
        </Routes>
      </MemoryRouter>
    </AppProvider>,
  );
  fireEvent.click(await screen.findByRole('button', { name: 'Number unclear? Draw a box around it' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Read this area' }));
  expect(await screen.findByTestId('ocr-stage')).toHaveTextContent('Reading the label on this phone…');
});
