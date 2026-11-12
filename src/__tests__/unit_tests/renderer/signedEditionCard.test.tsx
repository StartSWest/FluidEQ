/**
 * The Signed Edition in the account panel (Ivan, 2026-11-11): the offer that
 * says to pay with this account's email, the owner's download and two lines
 * of support, and the quiet way round for a purchase paid with another
 * address: a code sent to it, typed back here.
 */
import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ISignedEditionStatus } from '../../../common/signedEdition';
import SignedEditionCard from '../../../renderer/edition/SignedEditionCard';

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    locale: 'en',
    t: (key: string, vars?: Record<string, string | number>) =>
      vars ? `${key}:${Object.values(vars).join(',')}` : key,
  }),
}));
jest.mock('../../../renderer/account/accountStore', () => ({
  useAccount: () => ({
    status: 'signed-in',
    identity: { id: 'me', email: 'me@example.com' },
  }),
}));

const bridge = {
  signedEditionStatus: jest.fn(),
  signedEditionBuy: jest.fn(),
  signedEditionDownload: jest.fn(),
  signedEditionLinkStart: jest.fn(),
  signedEditionLinkFinish: jest.fn(),
};
const ORDER = 'txn_01hv8wptq8987qeep44cyrewp9';
const NOT_OWNED: ISignedEditionStatus = {
  signedCopy: false,
  account: 'not-owned',
  price: '$19',
};
const OWNED: ISignedEditionStatus = {
  signedCopy: false,
  account: 'owned',
  order: ORDER,
  price: '$19',
};

beforeEach(() => {
  jest.clearAllMocks();
  bridge.signedEditionBuy.mockResolvedValue(true);
  bridge.signedEditionStatus.mockResolvedValue(NOT_OWNED);
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: { ipcRenderer: bridge },
  });
});

const openLinking = async () => {
  render(<SignedEditionCard />);
  await userEvent.click(
    await screen.findByRole('button', { name: 'edition.card.other' }),
  );
};
const askForCode = async (email = 'paid@example.com') => {
  await userEvent.type(screen.getByLabelText('edition.card.email'), email);
  await userEvent.click(
    screen.getByRole('button', { name: 'edition.card.send' }),
  );
};

describe('the offer', () => {
  it('says to pay with this account’s email, and opens the checkout priced by the server', async () => {
    render(<SignedEditionCard />);
    expect(
      await screen.findByText(/edition\.card\.payHint/),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: 'edition.card.buy:$19' }),
    );
    expect(bridge.signedEditionBuy).toHaveBeenCalledTimes(1);
    // The way round is there, and quiet: nothing of it shows until asked for.
    expect(
      screen.getByRole('button', { name: 'edition.card.other' }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('edition.card.email')).toBeNull();
  });

  it('makes the offer without a price when the server gave none', async () => {
    bridge.signedEditionStatus.mockResolvedValue({
      signedCopy: false,
      account: 'not-owned',
    });
    render(<SignedEditionCard />);
    expect(
      await screen.findByRole('button', { name: 'edition.card.buyNoPrice' }),
    ).toBeInTheDocument();
  });

  it.each<[string, ISignedEditionStatus]>([
    ['nobody is signed in', { signedCopy: false, account: 'signed-out' }],
    ['the server did not answer', { signedCopy: true, account: 'unknown' }],
  ])('draws nothing when %s', async (_label, status) => {
    bridge.signedEditionStatus.mockResolvedValue(status);
    const { container } = render(<SignedEditionCard />);
    await waitFor(() => expect(bridge.signedEditionStatus).toHaveBeenCalled());
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });
});

describe('the owner', () => {
  beforeEach(() => bridge.signedEditionStatus.mockResolvedValue(OWNED));

  it('has the download, the two lines of support, and the order to quote', async () => {
    bridge.signedEditionDownload.mockResolvedValue({
      ok: true,
      version: '2.5.0',
      url: 'https://x',
    });
    render(<SignedEditionCard />);
    expect(await screen.findByText('edition.card.yours')).toBeInTheDocument();
    expect(screen.getByText('edition.card.receipt')).toBeInTheDocument();
    expect(
      screen.getByText('edition.card.support:support@fluideq.com'),
    ).toBeInTheDocument();
    expect(screen.getByText(`edition.card.order:${ORDER}`)).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: 'edition.card.download' }),
    );
    expect(bridge.signedEditionDownload).toHaveBeenCalledTimes(1);
    // Nothing to buy and nothing to link.
    expect(
      screen.queryByRole('button', { name: /edition\.card\.buy/ }),
    ).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'edition.card.other' }),
    ).toBeNull();
  });

  it.each([
    ['no-release', 'edition.card.noRelease'],
    ['failed', 'edition.card.downloadFailed'],
    ['not-owned', 'edition.card.downloadFailed'],
  ])('says so when the download answers %s', async (reason, words) => {
    bridge.signedEditionDownload.mockResolvedValue({ ok: false, reason });
    render(<SignedEditionCard />);
    await userEvent.click(
      await screen.findByRole('button', { name: 'edition.card.download' }),
    );
    expect(await screen.findByText(words)).toBeInTheDocument();
  });
});

describe('a purchase paid with another email', () => {
  it('sends a code to the address, then links with the code typed back, and becomes the owner’s card', async () => {
    bridge.signedEditionLinkStart.mockResolvedValue('sent');
    bridge.signedEditionLinkFinish.mockImplementation(async () => {
      bridge.signedEditionStatus.mockResolvedValue(OWNED);
      return 'linked';
    });
    await openLinking();
    // No code field before a code was asked for.
    expect(screen.queryByLabelText('edition.card.code')).toBeNull();
    await askForCode();
    expect(bridge.signedEditionLinkStart).toHaveBeenCalledWith(
      'paid@example.com',
    );
    expect(await screen.findByText('edition.card.sent')).toBeInTheDocument();
    const link = screen.getByRole('button', { name: 'edition.card.link' });
    expect(link).toBeDisabled();
    // Letters are not part of a code.
    await userEvent.type(
      screen.getByLabelText('edition.card.code'),
      '12a34x56',
    );
    expect(screen.getByLabelText('edition.card.code')).toHaveValue('123456');
    await userEvent.click(link);
    expect(bridge.signedEditionLinkFinish).toHaveBeenCalledWith(
      'paid@example.com',
      '123456',
    );
    expect(await screen.findByText('edition.card.yours')).toBeInTheDocument();
  });

  it.each([
    ['no', 'edition.card.wrong'],
    ['too-soon', 'edition.card.tooSoon'],
    ['failed', 'edition.card.failed'],
    ['signed-out', 'edition.card.failed'],
  ])(
    'says what a %s answer means, and stays the offer',
    async (outcome, words) => {
      bridge.signedEditionLinkStart.mockResolvedValue('sent');
      bridge.signedEditionLinkFinish.mockResolvedValue(outcome);
      await openLinking();
      await askForCode();
      await userEvent.type(
        await screen.findByLabelText('edition.card.code'),
        '123456',
      );
      await userEvent.click(
        screen.getByRole('button', { name: 'edition.card.link' }),
      );
      expect(await screen.findByText(words)).toBeInTheDocument();
      expect(screen.queryByText('edition.card.yours')).toBeNull();
      expect(bridge.signedEditionStatus).toHaveBeenCalledTimes(1);
    },
  );

  it.each([
    ['limited', 'edition.card.limited'],
    ['failed', 'edition.card.failed'],
  ])('offers no code field when asking answers %s', async (outcome, words) => {
    bridge.signedEditionLinkStart.mockResolvedValue(outcome);
    await openLinking();
    await askForCode();
    expect(await screen.findByText(words)).toBeInTheDocument();
    expect(screen.queryByLabelText('edition.card.code')).toBeNull();
  });
});
