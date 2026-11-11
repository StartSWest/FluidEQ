/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { translate } from 'common/i18n';
import type { IRecoveredProfile } from 'common/recoveredProfiles';
import ProfileRecoveredNotice from 'renderer/components/ProfileRecoveredNotice';

/**
 * What the window says about an output whose profile the launch replaced
 * (`recoverMissingProfiles`): once, in the corner, and gone for good when put
 * away.
 */
jest.mock('renderer/utils/noticeTurn', () => ({
  useNoticeTurn: (_name: string, wants: boolean) => wants,
}));

const RECOVERED: IRecoveredProfile[] = [
  {
    deviceName: 'Headphones (Razer Base Station V2 Chroma)',
    missing: 'Kraken V3 Pro',
    now: 'Kraken V3 Pro',
    how: 'copied',
  },
  {
    deviceName: 'Speakers (Boom Audio)',
    missing: 'Desk',
    now: 'Untitled profile 1',
    how: 'new',
  },
];

const serve = (recovered: IRecoveredProfile[]) => {
  const seen = jest.fn(() => Promise.resolve());
  Object.assign(window, {
    electron: {
      ipcRenderer: {
        getRecoveredProfiles: () => Promise.resolve(recovered),
        recoveredProfilesSeen: seen,
      },
    },
  });
  return seen;
};

afterEach(() => {
  Object.assign(window, { electron: undefined });
});

it('names each output and what it plays now, and tells main once it is put away', async () => {
  const seen = serve(RECOVERED);
  await act(async () => {
    render(<ProfileRecoveredNotice />);
  });

  expect(
    screen.getByText(translate('en', 'notice.profileRecovered.titleMany')),
  ).toBeVisible();
  expect(
    screen.getByText('Headphones (Razer Base Station V2 Chroma)'),
  ).toBeVisible();
  expect(
    screen.getByText(
      translate('en', 'notice.profileRecovered.copied', {
        missing: 'Kraken V3 Pro',
        now: 'Kraken V3 Pro',
      }),
    ),
  ).toBeVisible();
  expect(
    screen.getByText(
      translate('en', 'notice.profileRecovered.new', {
        missing: 'Desk',
        now: 'Untitled profile 1',
      }),
    ),
  ).toBeVisible();

  fireEvent.click(
    screen.getByRole('button', { name: translate('en', 'app.dismiss') }),
  );
  expect(seen).toHaveBeenCalledTimes(1);
  expect(
    screen.queryByText('Headphones (Razer Base Station V2 Chroma)'),
  ).not.toBeInTheDocument();
});

it('calls an automatic profile what the output picker calls it, never its file name', async () => {
  serve([
    {
      deviceName: 'Speakers (Realtek(R) Audio)',
      missing: 'Movie night',
      now: '.fluideq-auto-60afadfab7ad',
      how: 'own',
    },
  ]);
  await act(async () => {
    render(<ProfileRecoveredNotice />);
  });
  expect(
    screen.getByText(
      translate('en', 'notice.profileRecovered.own', {
        missing: 'Movie night',
        now: translate('en', 'output.mapping.live'),
      }),
    ),
  ).toBeVisible();
  expect(screen.queryByText(/fluideq-auto/)).not.toBeInTheDocument();
});

it('draws nothing when no output lost its profile', async () => {
  // The control: the card above is drawn by the list alone.
  serve([]);
  const { container } = await act(async () =>
    render(<ProfileRecoveredNotice />),
  );
  expect(container).toBeEmptyDOMElement();
});
