/**
 * The Signed Edition on screen (session 22's frame 5c, and the un-activated
 * notice): which edition this copy is, in About, and the one quiet notice a
 * signed copy shows while no owning account is signed in. Every state is a
 * working app; none of them is a fault.
 */
import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ISignedEditionStatus } from '../../../common/signedEdition';
import EditionLine from '../../../renderer/edition/EditionLine';
import UnactivatedNotice from '../../../renderer/edition/UnactivatedNotice';

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    locale: 'en',
    t: (key: string, vars?: Record<string, string | number>) =>
      vars ? `${key}:${Object.values(vars).join(',')}` : key,
  }),
}));

let mockSignedIn = true;
jest.mock('../../../renderer/account/accountStore', () => ({
  useAccount: () =>
    mockSignedIn
      ? {
          status: 'signed-in',
          identity: { id: 'me', email: 'me@example.com' },
        }
      : { status: 'signed-out' },
}));

const mockOpenAccount = jest.fn();
jest.mock('../../../renderer/account/accountPanel', () => ({
  requestAccountPanel: () => mockOpenAccount(),
}));

const bridge = {
  signedEditionStatus: jest.fn(),
  signedEditionBuy: jest.fn(),
};
const answer = (status: ISignedEditionStatus) =>
  bridge.signedEditionStatus.mockResolvedValue(status);

beforeEach(() => {
  jest.clearAllMocks();
  mockSignedIn = true;
  bridge.signedEditionBuy.mockResolvedValue(true);
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: { ipcRenderer: bridge },
  });
});

describe('the edition line in About', () => {
  it('a signed copy with its owner signed in: the publisher from the build, and that it updates itself', async () => {
    answer({
      signedCopy: true,
      publisher: 'Ivan Carmenates Garcia',
      account: 'owned',
      price: '$19',
    });
    render(<EditionLine />);
    expect(
      await screen.findByText(
        'edition.updates:edition.signedBy:Ivan Carmenates Garcia',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText('edition.signedInAs:me@example.com'),
    ).toBeInTheDocument();
    // Nothing to do: no button at all.
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('a signed copy signed out asks for the sign-in, loud, and says the app keeps working', async () => {
    mockSignedIn = false;
    answer({ signedCopy: true, publisher: 'X', account: 'signed-out' });
    render(<EditionLine />);
    expect(await screen.findByText('edition.signIn')).toBeInTheDocument();
    expect(screen.getByText('edition.signInHint')).toBeInTheDocument();
    const signIn = screen.getByRole('button', { name: 'account.signIn' });
    expect(signIn).not.toHaveClass('subtle');
    await userEvent.click(signIn);
    expect(mockOpenAccount).toHaveBeenCalledTimes(1);
  });

  it('a signed copy whose account does not own it says so, with the offer quiet', async () => {
    answer({ signedCopy: true, account: 'not-owned', price: '$19' });
    render(<EditionLine />);
    expect(await screen.findByText('edition.notActivated')).toBeInTheDocument();
    const offer = screen.getByRole('button', {
      name: 'update.onSite.getAuto:$19',
    });
    expect(offer).toHaveClass('subtle');
    await userEvent.click(offer);
    expect(bridge.signedEditionBuy).toHaveBeenCalledTimes(1);
  });

  it('the free copy says where new versions are, with the offer quiet and priced by the server', async () => {
    answer({ signedCopy: false, account: 'signed-out', price: '$29' });
    render(<EditionLine />);
    expect(await screen.findByText('edition.free')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'update.onSite.getAuto:$29' }),
    ).toHaveClass('subtle');
  });

  it('a question the server did not answer is the plain edition, never "not activated"', async () => {
    answer({ signedCopy: true, publisher: 'X', account: 'unknown' });
    render(<EditionLine />);
    expect(await screen.findByText('edition.signedBy:X')).toBeInTheDocument();
    expect(screen.queryByText('edition.notActivated')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('draws nothing before the answer, and no price the server gave none of', async () => {
    let settle: (status: ISignedEditionStatus) => void = () => undefined;
    bridge.signedEditionStatus.mockReturnValue(
      new Promise((resolve) => {
        settle = resolve;
      }),
    );
    const { container } = render(<EditionLine />);
    expect(container).toBeEmptyDOMElement();
    settle({ signedCopy: false, account: 'unknown' });
    expect(
      await screen.findByRole('button', {
        name: 'update.onSite.getAutoNoPrice',
      }),
    ).toBeInTheDocument();
  });
});

describe('the un-activated notice', () => {
  it('a signed copy signed out: Sign in loud, the offer quiet, and it can be put away', async () => {
    mockSignedIn = false;
    answer({ signedCopy: true, account: 'signed-out', price: '$19' });
    render(<UnactivatedNotice />);
    expect(await screen.findByText('edition.notActivated')).toBeInTheDocument();
    expect(screen.getByText('edition.notActivatedSignIn')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'account.signIn' }),
    ).not.toHaveClass('subtle');
    expect(
      screen.getByRole('button', { name: 'update.onSite.getAuto:$19' }),
    ).toHaveClass('subtle');
    // A notice, not a dialog: it blocks nothing.
    expect(screen.getByRole('status')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'app.dismiss' }));
    expect(screen.queryByText('edition.notActivated')).toBeNull();
  });

  it('a signed copy whose signed-in account does not own it: only the offer', async () => {
    answer({ signedCopy: true, account: 'not-owned' });
    render(<UnactivatedNotice />);
    expect(
      await screen.findByText('edition.notActivatedHint'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'account.signIn' })).toBeNull();
  });

  it.each<[string, ISignedEditionStatus]>([
    ['an activated signed copy', { signedCopy: true, account: 'owned' }],
    [
      'a signed copy the server did not answer for',
      { signedCopy: true, account: 'unknown' },
    ],
    ['the free copy, signed out', { signedCopy: false, account: 'signed-out' }],
    ['the free copy, not owning', { signedCopy: false, account: 'not-owned' }],
  ])('says nothing on %s', async (_label, status) => {
    answer(status);
    const { container } = render(<UnactivatedNotice />);
    await waitFor(() => expect(bridge.signedEditionStatus).toHaveBeenCalled());
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });
});
