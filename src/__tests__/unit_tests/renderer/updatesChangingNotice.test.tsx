/**
 * The free edition's one-time word about updates (session 22's frame 5b):
 * 2.5 is the last version that reaches it by itself. Told once per computer,
 * on the free copy of 2.5 alone.
 */
import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ISignedEditionStatus } from '../../../common/signedEdition';
import UpdatesChangingNotice from '../../../renderer/edition/UpdatesChangingNotice';

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

const bridge = {
  signedEditionStatus: jest.fn(),
  signedEditionBuy: jest.fn(),
};
const FREE: ISignedEditionStatus = {
  signedCopy: false,
  account: 'signed-out',
  price: '$19',
};

/** The notice as a build of that version carries it. */
const noticeOf = (version: string) =>
  function Notice() {
    return <UpdatesChangingNotice version={version} />;
  };

beforeEach(() => {
  jest.clearAllMocks();
  window.localStorage.clear();
  bridge.signedEditionBuy.mockResolvedValue(true);
  bridge.signedEditionStatus.mockResolvedValue(FREE);
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: { ipcRenderer: bridge },
  });
});

it('tells the free copy of 2.5 once: Got it loud, the edition quiet, the price and the publisher said', async () => {
  const Notice = noticeOf('2.5.0');
  const first = render(<Notice />);
  expect(await screen.findByText('edition.changing.title')).toBeInTheDocument();
  expect(screen.getByText('edition.changing.free')).toBeInTheDocument();
  expect(
    screen.getByText('edition.changing.signed:$19,Ivan Carmenates Garcia'),
  ).toBeInTheDocument();
  const gotIt = screen.getByRole('button', { name: 'edition.changing.gotIt' });
  expect(gotIt).not.toHaveClass('subtle');
  expect(gotIt).toHaveFocus();
  expect(
    screen.getByRole('button', { name: 'edition.changing.see:$19' }),
  ).toHaveClass('subtle');
  await userEvent.click(gotIt);
  expect(screen.queryByText('edition.changing.title')).toBeNull();
  first.unmount();

  // The next launch says nothing.
  const again = render(<Notice />);
  await waitFor(() =>
    expect(bridge.signedEditionStatus).toHaveBeenCalledTimes(2),
  );
  expect(again.container.ownerDocument.body).not.toHaveTextContent(
    'edition.changing.title',
  );
});

it('opens the edition from the quiet answer, and that counts as told', async () => {
  const Notice = noticeOf('2.5.1');
  render(<Notice />);
  await userEvent.click(
    await screen.findByRole('button', { name: 'edition.changing.see:$19' }),
  );
  expect(bridge.signedEditionBuy).toHaveBeenCalledTimes(1);
  expect(screen.queryByText('edition.changing.title')).toBeNull();
  expect(window.localStorage.getItem('fluideq.updatesChanging.told')).toBe(
    '2.5.1',
  );
});

it('is put away by Escape, and says the sentence without a price the server gave none of', async () => {
  bridge.signedEditionStatus.mockResolvedValue({
    signedCopy: false,
    account: 'unknown',
  });
  const Notice = noticeOf('2.5.0');
  render(<Notice />);
  expect(
    await screen.findByText(
      'edition.changing.signedNoPrice:Ivan Carmenates Garcia',
    ),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'edition.changing.seeNoPrice' }),
  ).toBeInTheDocument();
  await userEvent.keyboard('{Escape}');
  expect(screen.queryByText('edition.changing.title')).toBeNull();
  expect(
    window.localStorage.getItem('fluideq.updatesChanging.told'),
  ).not.toBeNull();
});

it.each<[string, string, ISignedEditionStatus]>([
  ['a signed copy', '2.5.0', { signedCopy: true, account: 'owned' }],
  ['a later free version', '2.6.0', FREE],
  ['an earlier free version', '2.4.0', FREE],
])('says nothing on %s', async (_label, version, status) => {
  bridge.signedEditionStatus.mockResolvedValue(status);
  const Notice = noticeOf(version);
  render(<Notice />);
  await waitFor(() => expect(bridge.signedEditionStatus).toHaveBeenCalled());
  await waitFor(() =>
    expect(screen.queryByText('edition.changing.title')).toBeNull(),
  );
  expect(
    window.localStorage.getItem('fluideq.updatesChanging.told'),
  ).toBeNull();
});
