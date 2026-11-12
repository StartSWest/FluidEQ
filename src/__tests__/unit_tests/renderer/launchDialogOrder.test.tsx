/**
 * One dialog at a time at launch (Ivan, 2026-11-11): the licence gate, then
 * What's New, then the free edition's word that updates are changing. The
 * real gate and the real notice, with a stand-in for What's New, joined by
 * the same rule the shell uses (`launchTurn`) and the same signals: the
 * gate's own acceptance and the tour's own open state. Nothing here waits
 * on a clock.
 */
import '@testing-library/jest-dom';
import { useCallback, useState } from 'react';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DisclaimerGate, {
  isDisclaimerAccepted,
} from '../../../renderer/components/DisclaimerGate';
import UpdatesChangingNotice from '../../../renderer/edition/UpdatesChangingNotice';
import { launchTurn } from '../../../renderer/shell/launchDialogs';

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    locale: 'en',
    t: (key: string, vars?: Record<string, string | number>) =>
      vars ? `${key}:${Object.values(vars).join(',')}` : key,
  }),
}));
jest.mock('../../../renderer/account/accountStore', () => ({
  useAccount: () => ({ status: 'signed-out' }),
}));

/** The shell's three launch dialogs, wired as `ShellDialogs` wires them. */
function Launch({ tourDue }: { tourDue: boolean }) {
  const [gateOpen, setGateOpen] = useState(() => !isDisclaimerAccepted());
  const closeGate = useCallback(() => setGateOpen(false), []);
  const [tour, setTour] = useState(tourDue);
  const turn = launchTurn({ gate: gateOpen, tour, whatsNew: false });
  return (
    <>
      {turn === 'notices' && <UpdatesChangingNotice version="2.5.0" />}
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

const NOTICE = 'edition.changing.title';
const gate = () => screen.queryByRole('alertdialog', { name: /./ });

beforeEach(() => {
  window.localStorage.clear();
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: {
      ipcRenderer: {
        closeApp: () => undefined,
        signedEditionStatus: async () => ({
          signedCopy: false,
          account: 'signed-out',
          price: '$19',
        }),
        signedEditionBuy: async () => true,
      },
    },
  });
});

/** Lets the edition's answer land, so the notice would show if it might. */
const settled = () =>
  act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });

it('shows the three one after another when all are due at once', async () => {
  render(<Launch tourDue />);
  await settled();

  // First the licence gate, alone.
  expect(gate()).toBeInTheDocument();
  expect(screen.queryByRole('dialog', { name: 'tour' })).toBeNull();
  expect(screen.queryByText(NOTICE)).toBeNull();

  // Accepted: What's New, alone.
  await userEvent.click(screen.getByRole('button', { name: /accept/i }));
  expect(
    await screen.findByRole('dialog', { name: 'tour' }),
  ).toBeInTheDocument();
  expect(gate()).toBeNull();
  await settled();
  expect(screen.queryByText(NOTICE)).toBeNull();

  // Closed: the notice, and nothing else.
  await userEvent.click(screen.getByRole('button', { name: 'close tour' }));
  expect(await screen.findByText(NOTICE)).toBeInTheDocument();
  expect(screen.queryByRole('dialog', { name: 'tour' })).toBeNull();
});

it('goes straight to the notice when the others have nothing to say', async () => {
  // Accepted on an earlier launch, and no tour due.
  render(<Launch tourDue />);
  await userEvent.click(screen.getByRole('button', { name: /accept/i }));
  await userEvent.click(
    await screen.findByRole('button', { name: 'close tour' }),
  );
  await userEvent.click(
    await screen.findByRole('button', { name: 'edition.changing.gotIt' }),
  );
  // The next launch: gate accepted, notice told. With a tour due, only it.
  const { unmount } = render(<Launch tourDue />);
  await settled();
  expect(gate()).toBeNull();
  expect(screen.getAllByRole('dialog', { name: 'tour' })).toHaveLength(1);
  expect(screen.queryByText(NOTICE)).toBeNull();
  unmount();
});

it('the rule itself: the gate before What’s New before the notices', () => {
  expect(launchTurn({ gate: true, tour: true, whatsNew: true })).toBe('gate');
  expect(launchTurn({ gate: true, tour: false, whatsNew: false })).toBe('gate');
  expect(launchTurn({ gate: false, tour: true, whatsNew: false })).toBe('news');
  expect(launchTurn({ gate: false, tour: false, whatsNew: true })).toBe('news');
  expect(launchTurn({ gate: false, tour: false, whatsNew: false })).toBe(
    'notices',
  );
});
