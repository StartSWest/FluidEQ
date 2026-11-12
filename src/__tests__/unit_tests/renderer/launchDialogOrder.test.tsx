/**
 * One dialog at a time at launch (Ivan, 2026-11-11): the licence gate, then
 * What's New. The real gate, with a stand-in for What's New wired as
 * `ShellDialogs` wires it — shown only once the gate says it is accepted.
 * What's New used to open under the gate. Nothing here waits on a clock.
 */
import '@testing-library/jest-dom';
import { useCallback, useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DisclaimerGate, {
  isDisclaimerAccepted,
} from '../../../renderer/components/DisclaimerGate';

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    locale: 'en',
    t: (key: string, vars?: Record<string, string | number>) =>
      vars ? `${key}:${Object.values(vars).join(',')}` : key,
  }),
}));

/** The gate and What's New, wired as `ShellDialogs` wires them. */
function Launch({ tourDue }: { tourDue: boolean }) {
  const [gateOpen, setGateOpen] = useState(() => !isDisclaimerAccepted());
  const closeGate = useCallback(() => setGateOpen(false), []);
  const [tour, setTour] = useState(tourDue);
  return (
    <>
      {tour && !gateOpen && (
        <div role="dialog" aria-label="tour">
          <button type="button" onClick={() => setTour(false)}>
            close tour
          </button>
        </div>
      )}
      <DisclaimerGate onAccepted={closeGate} />
    </>
  );
}

const gate = () => screen.queryByRole('alertdialog', { name: /./ });

beforeEach(() => {
  window.localStorage.clear();
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: { ipcRenderer: { closeApp: () => undefined } },
  });
});

it('shows the licence gate alone, and What’s New only once it is accepted', async () => {
  render(<Launch tourDue />);

  expect(gate()).toBeInTheDocument();
  expect(screen.queryByRole('dialog', { name: 'tour' })).toBeNull();

  await userEvent.click(screen.getByRole('button', { name: /accept/i }));
  expect(
    await screen.findByRole('dialog', { name: 'tour' }),
  ).toBeInTheDocument();
  expect(gate()).toBeNull();
});

it('opens What’s New at once when the gate was accepted on an earlier launch', async () => {
  const first = render(<Launch tourDue={false} />);
  await userEvent.click(screen.getByRole('button', { name: /accept/i }));
  first.unmount();

  render(<Launch tourDue />);
  expect(gate()).toBeNull();
  expect(screen.getByRole('dialog', { name: 'tour' })).toBeInTheDocument();
});
