/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import '@testing-library/jest-dom';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ISceneStore } from '../../../common/sceneStore';
import StarterWelcome from '../../../renderer/components/StarterWelcome';
import StarterCard from '../../../renderer/plus/StarterCard';
import {
  CARD_AWAY_DAYS,
  DIALOG_AGAIN_DAYS,
  isCardDue,
  isDialogDue,
  readRecord,
} from '../../../renderer/plus/starterWelcome';

// The starter credits offered (Ivan, 2026-11-13: "las dos"): the welcome
// dialog once after the first sign-in and once more 3+ days after a Later;
// the Visualizers card every visit while unclaimed, Later putting it away
// for 7 days; neither once claimed, on any computer; after claiming, the
// gallery with Not mine yet on. Each refusal beside the case that shows.

const ME = '4f1c2b9e-8d3a-4e7b-9c11-2a6f0d5e7b30';
const DAY = 24 * 60 * 60 * 1000;
const KEY = `fluideq.starterWelcome.${ME}`;

const mockStore: { current?: ISceneStore } = {};
const mockClaim = jest.fn();
const mockNotMine = jest.fn();
const mockPlusTab = jest.fn();
const mockTurn = { allowed: true };

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    locale: 'en',
    t: (key: string, vars?: Record<string, string | number>) =>
      vars ? `${key}:${Object.values(vars).join('|')}` : key,
  }),
}));
jest.mock('../../../renderer/plus/sceneStore', () => ({
  useSceneStore: () => ({
    store: mockStore.current,
    owner: ME,
    loading: false,
  }),
  claimStarterCredits: () => mockClaim(),
}));
jest.mock('../../../renderer/account/accountStore', () => ({
  useAccount: () => ({ status: 'signed-in', identity: { id: ME } }),
}));
jest.mock('../../../renderer/utils/noticeTurn', () => ({
  useNoticeTurn: (_claim: string, wants: boolean) => wants && mockTurn.allowed,
}));
jest.mock('../../../renderer/plus/plusNavigation', () => ({
  openNotMineYet: () => mockNotMine(),
}));
jest.mock('../../../renderer/plus/plusTabRequest', () => ({
  requestPlusTab: () => mockPlusTab(),
}));

const withStore = (more: Partial<ISceneStore> = {}) => {
  mockStore.current = {
    balance: 0,
    starterClaimed: false,
    owned: [],
    packs: [],
    ...more,
  };
};
const remember = (record: object) =>
  window.localStorage.setItem(KEY, JSON.stringify(record));
const remembered = () => JSON.parse(window.localStorage.getItem(KEY) ?? '{}');

beforeEach(() => {
  jest.clearAllMocks();
  window.localStorage.clear();
  mockTurn.allowed = true;
  withStore();
  mockClaim.mockResolvedValue({
    ok: true,
    store: { balance: 3, starterClaimed: true, owned: [], packs: [] },
  });
});

describe('when the starter credits are offered', () => {
  const now = Date.UTC(2026, 10, 13);

  it('offers the dialog first, and once more only 3 days after a Later', () => {
    expect(isDialogDue({ dialogAnswers: 0 }, now)).toBe(true);
    const later = { dialogAnswers: 1, dialogLaterAt: now };
    expect(isDialogDue(later, now + DIALOG_AGAIN_DAYS * DAY - 1)).toBe(false);
    expect(isDialogDue(later, now + DIALOG_AGAIN_DAYS * DAY)).toBe(true);
    // Answered without a Later (claimed, or the way to the gallery): never.
    expect(isDialogDue({ dialogAnswers: 1 }, now + 30 * DAY)).toBe(false);
    // Answered twice: never again, however long.
    expect(
      isDialogDue({ dialogAnswers: 2, dialogLaterAt: now }, now + 90 * DAY),
    ).toBe(false);
  });

  it('puts the card away for 7 days after a Later', () => {
    expect(isCardDue({ dialogAnswers: 0 }, now)).toBe(true);
    const later = { dialogAnswers: 0, cardLaterAt: now };
    expect(isCardDue(later, now + CARD_AWAY_DAYS * DAY - 1)).toBe(false);
    expect(isCardDue(later, now + CARD_AWAY_DAYS * DAY)).toBe(true);
  });

  it('reads anything unreadable as nothing answered', () => {
    expect(readRecord(null)).toEqual({ dialogAnswers: 0 });
    expect(readRecord('not json')).toEqual({ dialogAnswers: 0 });
    expect(readRecord('{"dialogAnswers":-2,"cardLaterAt":"soon"}')).toEqual({
      dialogAnswers: 0,
    });
    expect(
      readRecord('{"dialogAnswers":1,"dialogLaterAt":5,"cardLaterAt":7}'),
    ).toEqual({ dialogAnswers: 1, dialogLaterAt: 5, cardLaterAt: 7 });
  });
});

describe('the welcome dialog', () => {
  it('offers the credits to a member who has not claimed them', () => {
    render(<StarterWelcome />);
    expect(
      screen.getByRole('dialog', { name: 'store.welcome.title.other:3' }),
    ).toBeInTheDocument();
    // The claim is the loud button, Later the quiet one.
    const claim = screen.getByRole('button', {
      name: 'store.starter.claim:store.credit.other:3',
    });
    expect(claim).toHaveClass('button', 'small');
    expect(claim).not.toHaveClass('subtle');
    expect(
      screen.getByRole('button', { name: 'store.welcome.later' }),
    ).toHaveClass('subtle');
  });

  it.each([
    ['claimed', { starterClaimed: true }],
    ['an admin with every scene', { everything: true }],
    [
      'a suspended account',
      {
        suspension: {
          deletesAt: '2026-11-28T00:00:00Z',
          windowFrom: '2026-10-29T00:00:00Z',
          windowTo: '2026-11-13T00:00:00Z',
          refundCents: 0,
          maker: false,
        },
      },
    ],
  ])('offers nothing to %s', (_, more: Partial<ISceneStore>) => {
    withStore(more);
    render(<StarterWelcome />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('waits its turn behind the notices before it', () => {
    mockTurn.allowed = false;
    render(<StarterWelcome />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('records a Later, and does not come back until 3 days have passed', async () => {
    const first = render(<StarterWelcome />);
    await userEvent.click(
      screen.getByRole('button', { name: 'store.welcome.later' }),
    );
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(remembered().dialogAnswers).toBe(1);
    expect(typeof remembered().dialogLaterAt).toBe('number');
    first.unmount();
    // The next launch, the same day.
    render(<StarterWelcome />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('comes back once more at a launch 3 days after the Later', () => {
    remember({ dialogAnswers: 1, dialogLaterAt: Date.now() - 4 * DAY });
    render(<StarterWelcome />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('takes Escape as Later', async () => {
    render(<StarterWelcome />);
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(typeof remembered().dialogLaterAt).toBe('number');
  });

  it('claims on the spot, says they are in, and leads to the scenes not owned yet', async () => {
    render(<StarterWelcome />);
    await userEvent.click(
      screen.getByRole('button', {
        name: 'store.starter.claim:store.credit.other:3',
      }),
    );
    expect(mockClaim).toHaveBeenCalledTimes(1);
    // Still up although the store now says claimed: it is telling them so.
    expect(
      screen.getByRole('dialog', {
        name: 'store.welcome.claimedTitle.other:3',
      }),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: 'store.welcome.pick' }),
    );
    expect(mockNotMine).toHaveBeenCalledTimes(1);
    expect(mockPlusTab).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
    // Answered without a Later: it never comes back.
    expect(remembered().dialogLaterAt).toBeUndefined();
  });

  it('says why a claim failed and lets it be tried again', async () => {
    mockClaim.mockResolvedValueOnce({ ok: false, reason: 'unconfirmed' });
    render(<StarterWelcome />);
    const claim = screen.getByRole('button', {
      name: 'store.starter.claim:store.credit.other:3',
    });
    await userEvent.click(claim);
    expect(screen.getByRole('alert')).toHaveTextContent(
      'store.error.unconfirmed',
    );
    await userEvent.click(claim);
    expect(mockClaim).toHaveBeenCalledTimes(2);
  });

  it('claims once however fast it is pressed', async () => {
    let finish: (value: unknown) => void = () => undefined;
    mockClaim.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    render(<StarterWelcome />);
    const claim = screen.getByRole('button', {
      name: 'store.starter.claim:store.credit.other:3',
    });
    act(() => {
      claim.click();
      claim.click();
    });
    await act(async () => {
      finish({ ok: true, store: {} });
    });
    expect(mockClaim).toHaveBeenCalledTimes(1);
  });
});

describe('the dialog and the card together', () => {
  it('keep each other’s answers when both are answered in one session', async () => {
    render(
      <>
        <StarterWelcome />
        <StarterCard accountId={ME} />
      </>,
    );
    const laters = screen.getAllByRole('button', {
      name: 'store.welcome.later',
    });
    // The dialog first, then the card, each from its own copy.
    await userEvent.click(laters[0]);
    await userEvent.click(
      screen.getByRole('button', { name: 'store.welcome.later' }),
    );
    expect(remembered().dialogAnswers).toBe(1);
    expect(typeof remembered().dialogLaterAt).toBe('number');
    expect(typeof remembered().cardLaterAt).toBe('number');
  });
});

describe('the card in Visualizers', () => {
  it('offers the credits on every visit while they are not claimed', () => {
    render(<StarterCard accountId={ME} />);
    expect(
      screen.getByRole('heading', { name: 'store.welcome.cardTitle.other:3' }),
    ).toBeInTheDocument();
  });

  it('is gone once they are claimed, on any computer', () => {
    withStore({ starterClaimed: true });
    render(<StarterCard accountId={ME} />);
    expect(screen.queryByRole('heading')).toBeNull();
  });

  it('puts itself away for 7 days with Later, and leaves the dialog’s answers alone', async () => {
    remember({ dialogAnswers: 1, dialogLaterAt: 123 });
    const first = render(<StarterCard accountId={ME} />);
    await userEvent.click(
      screen.getByRole('button', { name: 'store.welcome.later' }),
    );
    expect(screen.queryByRole('heading')).toBeNull();
    expect(remembered()).toMatchObject({
      dialogAnswers: 1,
      dialogLaterAt: 123,
    });
    expect(typeof remembered().cardLaterAt).toBe('number');
    first.unmount();
    render(<StarterCard accountId={ME} />);
    expect(screen.queryByRole('heading')).toBeNull();
  });

  it('comes back on a visit 7 days after its Later', () => {
    remember({ dialogAnswers: 0, cardLaterAt: Date.now() - 8 * DAY });
    render(<StarterCard accountId={ME} />);
    expect(screen.getByRole('heading')).toBeInTheDocument();
  });

  it('claims, switches the gallery to Not mine yet, and says the credits are ready', async () => {
    render(<StarterCard accountId={ME} />);
    await userEvent.click(
      screen.getByRole('button', {
        name: 'store.starter.claim:store.credit.other:3',
      }),
    );
    expect(mockNotMine).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole('heading', {
        name: 'store.welcome.cardClaimedTitle.other:3',
      }),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: 'store.welcome.gotIt' }),
    );
    expect(screen.queryByRole('heading')).toBeNull();
  });
});
