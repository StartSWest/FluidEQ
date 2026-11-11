/**
 * The free edition's news of a new version (Ivan, 2026-11-11): it says the
 * version is on the site, with Download as the answer it asks for and the
 * Signed Edition as the quiet one, priced as the server words it.
 */
import '@testing-library/jest-dom';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { APP_UPDATE_EVENT } from '../../../common/constants';
import UpdateNotice from '../../../renderer/components/UpdateNotice';

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    locale: 'en',
    t: (key: string, vars?: Record<string, string | number>) =>
      vars ? `${key}:${Object.values(vars).join(',')}` : key,
  }),
}));

let announce: (status: unknown) => void = () => undefined;
const bridge = {
  on: jest.fn((event: string, listener: (status: unknown) => void) => {
    if (event === APP_UPDATE_EVENT) {
      announce = listener;
    }
    return () => undefined;
  }),
  installUpdate: jest.fn(),
  signedEditionStatus: jest.fn(),
  signedEditionBuy: jest.fn().mockResolvedValue(true),
};

beforeEach(() => {
  jest.clearAllMocks();
  bridge.signedEditionBuy.mockResolvedValue(true);
  bridge.signedEditionStatus.mockResolvedValue({
    signedCopy: false,
    account: 'signed-out',
    price: '$19',
  });
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: { ipcRenderer: bridge },
  });
});

const onSite = async () => {
  render(<UpdateNotice />);
  await act(async () => {
    announce({ phase: 'on-site', version: '2.6.0' });
  });
};

it('says the version is on the site, with Download loud and the offer quiet and priced by the server', async () => {
  await onSite();
  expect(screen.getByText('update.onSite.title')).toBeInTheDocument();
  expect(screen.getByText('update.onSite.body:2.6.0')).toBeInTheDocument();
  const download = screen.getByRole('link', { name: 'update.onSite.download' });
  expect(download).toHaveAttribute('href', 'https://fluideq.com/download');
  expect(download).toHaveClass('button', 'small');
  expect(download).not.toHaveClass('subtle');
  const offer = await screen.findByRole('button', {
    name: 'update.onSite.getAuto:$19',
  });
  expect(offer).toHaveClass('subtle');
  // Nothing here installs anything.
  expect(screen.queryByText('update.restart')).toBeNull();
});

it('makes the offer without a price when the server gave none, never a guessed one', async () => {
  bridge.signedEditionStatus.mockResolvedValue({
    signedCopy: false,
    account: 'unknown',
  });
  await onSite();
  await waitFor(() => expect(bridge.signedEditionStatus).toHaveBeenCalled());
  expect(
    screen.getByRole('button', { name: 'update.onSite.getAutoNoPrice' }),
  ).toBeInTheDocument();
  expect(screen.queryByText(/19/)).toBeNull();
});

it('opens the checkout from the offer, and goes away when dismissed', async () => {
  await onSite();
  await userEvent.click(
    await screen.findByRole('button', { name: 'update.onSite.getAuto:$19' }),
  );
  expect(bridge.signedEditionBuy).toHaveBeenCalledTimes(1);
  await userEvent.click(screen.getByRole('button', { name: 'app.dismiss' }));
  expect(screen.queryByText('update.onSite.title')).toBeNull();
});

// The control: the signed edition's banner is the one it always was.
it('control: a version on its way is still the downloading banner', async () => {
  render(<UpdateNotice />);
  await act(async () => {
    announce({ phase: 'available', version: '2.6.0' });
  });
  expect(screen.getByText('update.available:2.6.0')).toBeInTheDocument();
  expect(screen.queryByText('update.onSite.title')).toBeNull();
  expect(bridge.signedEditionStatus).not.toHaveBeenCalled();
});
