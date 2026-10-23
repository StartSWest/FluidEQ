/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * How long people listen, in the window (premium 0068): the notice that asks
 * an account once, the account panel's switch, and the admin's page.
 */

import '@testing-library/jest-dom';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type {
  IAdminListening,
  IListeningStatus,
  TListeningOutcome,
} from '../../../common/listening';
import ListeningCard from '../../../renderer/account/ListeningCard';
import ListeningNotice from '../../../renderer/components/ListeningNotice';
import AdminListening from '../../../renderer/plus/AdminListening';
import { resetListeningStore } from '../../../renderer/usage/listeningStore';

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    locale: 'en',
    t: (key: string, vars?: Record<string, string | number>) =>
      vars ? `${key}:${Object.values(vars).join(',')}` : key,
  }),
}));

const status = (over: Partial<IListeningStatus> = {}): IListeningStatus => ({
  signedIn: true,
  choice: 'unasked',
  todayMinutes: 0,
  ...over,
});

let current: IListeningStatus;
let setSharing: jest.Mock<Promise<TListeningOutcome>, [boolean]>;

const bridge = (over: Record<string, unknown> = {}) => {
  setSharing = jest.fn(async (sharing: boolean) => {
    current = { ...current, choice: sharing ? 'sharing' : 'off' };
    return { ok: true as const, status: current };
  });
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: {
      ipcRenderer: {
        listeningStatus: jest.fn(async () => current),
        onListeningStatus: jest.fn(() => () => undefined),
        setListeningSharing: setSharing,
        ...over,
      },
    },
  });
};

beforeEach(() => {
  resetListeningStore();
});

describe('the notice', () => {
  it('asks an account never asked, with keeping it on as the suggested answer', async () => {
    current = status();
    bridge();
    render(<ListeningNotice />);
    const notice = await screen.findByRole('dialog', {
      name: 'listening.notice.title',
    });
    const keep = within(notice).getByRole('button', {
      name: 'listening.notice.keep',
    });
    const off = within(notice).getByRole('button', {
      name: 'listening.notice.off',
    });
    expect(keep).toHaveClass('button', 'small');
    expect(keep).not.toHaveClass('subtle');
    expect(off).toHaveClass('subtle');
    // No way to put it away unanswered: an account must be one or the other.
    expect(
      within(notice).queryByRole('button', { name: 'app.dismiss' }),
    ).toBeNull();

    await userEvent.click(off);
    expect(setSharing).toHaveBeenCalledWith(false);
    expect(
      screen.queryByRole('dialog', { name: 'listening.notice.title' }),
    ).toBeNull();
  });

  it.each([
    ['an account that kept it on', status({ choice: 'sharing' })],
    ['an account that switched it off', status({ choice: 'off' })],
    [
      'an account the server has not answered for',
      status({ choice: 'unknown' }),
    ],
    ['nobody signed in', status({ signedIn: false })],
  ])('says nothing to %s', async (_, shown) => {
    current = shown;
    bridge();
    render(<ListeningNotice />);
    await act(async () => {});
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('the account panel’s card', () => {
  it('shows today’s minutes while on, and switching off says what it deleted', async () => {
    current = status({ choice: 'sharing', todayMinutes: 95 });
    bridge();
    render(<ListeningCard />);
    const toggle = await screen.findByRole('checkbox', {
      name: 'listening.card.switch',
    });
    expect(toggle).toBeChecked();
    expect(
      screen.getByText(/insights\.time\.hoursMinutes/),
    ).toBeInTheDocument();

    await userEvent.click(toggle);
    expect(setSharing).toHaveBeenCalledWith(false);
    expect(
      await screen.findByText('listening.card.offNote'),
    ).toBeInTheDocument();
    expect(screen.getByText('listening.card.notCounted')).toBeInTheDocument();
  });

  it('holds the switch until the server has answered', async () => {
    current = status({ choice: 'unknown' });
    bridge();
    render(<ListeningCard />);
    expect(
      await screen.findByRole('checkbox', { name: 'listening.card.switch' }),
    ).toBeDisabled();
    expect(screen.getByText('listening.card.unknownNote')).toBeInTheDocument();
  });

  it('says why an answer did not go through, and keeps the switch where it was', async () => {
    current = status({ choice: 'sharing' });
    bridge({
      setListeningSharing: jest.fn(async () => ({
        ok: false,
        reason: 'offline',
        status: current,
      })),
    });
    render(<ListeningCard />);
    const toggle = await screen.findByRole('checkbox', {
      name: 'listening.card.switch',
    });
    await userEvent.click(toggle);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'listening.error.offline',
    );
    expect(toggle).toBeChecked();
  });

  it('is not there for nobody signed in', async () => {
    current = status({ signedIn: false });
    bridge();
    const { container } = render(<ListeningCard />);
    await act(async () => {});
    expect(container).toBeEmptyDOMElement();
  });
});

describe('the admin’s page', () => {
  // The chart ends on the admin's own today, so the days are counted back
  // from it, the way the page does.
  const today = new Date();
  const keyOf = (daysAgo: number) => {
    const at = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() - daysAgo,
    );
    const month = String(at.getMonth() + 1).padStart(2, '0');
    const day = String(at.getDate()).padStart(2, '0');
    return `${at.getFullYear()}-${month}-${day}`;
  };
  const label = (daysAgo: number) =>
    new Intl.DateTimeFormat('en', {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(`${keyOf(daysAgo)}T00:00:00Z`));

  const figures = (over: Partial<IAdminListening> = {}): IAdminListening => ({
    days: [
      { day: keyOf(2), listeners: 1, minutes: 30 },
      { day: keyOf(1), listeners: 2, minutes: 150 },
    ],
    listeners: 2,
    minutes: 180,
    listenerDays: 3,
    accounts: 10,
    sharing: 4,
    declined: 1,
    ...over,
  });

  const show = (value: IAdminListening) => {
    const asked = jest.fn(async () => ({ ok: true, value }));
    bridge({ adminListening: asked });
    render(<AdminListening />);
    return asked;
  };

  const gaugeOf = (label: string) => {
    const gauge = screen
      .getByRole('heading', { name: label })
      .closest('section');
    if (!gauge) {
      throw new Error(`no gauge for ${label}`);
    }
    return gauge;
  };

  it('shows the period’s time, listeners, an ordinary day and who shares', async () => {
    current = status();
    const asked = show(figures());
    await screen.findByRole('heading', { name: 'listening.admin.time' });
    expect(asked).toHaveBeenCalledWith(30);
    expect(gaugeOf('listening.admin.time')).toHaveTextContent('3h');
    expect(gaugeOf('listening.admin.listeners')).toHaveTextContent(
      'listening.admin.listenersNote:10',
    );
    expect(gaugeOf('listening.admin.average')).toHaveTextContent('1h');
    // Four said yes, one no, and five never asked, of ten.
    expect(gaugeOf('listening.admin.sharing')).toHaveTextContent(
      'listening.admin.sharingNote:1,5',
    );
    expect(gaugeOf('listening.admin.sharing')).toHaveTextContent('40%');
  });

  it('draws a column for every day of the period and reads the busiest at rest', async () => {
    current = status();
    show(figures());
    const days = await screen.findAllByRole('listitem');
    expect(days).toHaveLength(30);
    expect(
      screen.getByText(
        `listening.admin.peak:${label(1)},insights.time.hoursMinutes:2h,30m`,
      ),
    ).toBeInTheDocument();
    await userEvent.hover(days[days.length - 1]);
    expect(
      screen.getByText(`listening.admin.day:${label(0)},0s,0`),
    ).toBeInTheDocument();
  });

  it('asks again for another period', async () => {
    current = status();
    const asked = show(figures());
    await screen.findByRole('heading', { name: 'listening.admin.time' });
    await userEvent.click(
      screen.getByRole('button', { name: 'insights.period.week' }),
    );
    expect(asked).toHaveBeenLastCalledWith(7);
  });

  it('says nobody listened rather than drawing an empty chart', async () => {
    current = status();
    show(figures({ days: [], minutes: 0, listeners: 0, listenerDays: 0 }));
    expect(
      await screen.findByText('listening.admin.empty'),
    ).toBeInTheDocument();
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });

  it('says why it could not read, and only the admin may', async () => {
    current = status();
    bridge({
      adminListening: jest.fn(async () => ({ ok: false, reason: 'forbidden' })),
    });
    render(<AdminListening />);
    expect(
      await screen.findByText('insights.error.forbidden'),
    ).toBeInTheDocument();
  });
});
