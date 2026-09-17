/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Studio's side column folds away everything but its meter.
 *
 * Four cards at once do not fit on a laptop: reaching the response sliders
 * took the scene being tuned off the top of the screen. What it hears now
 * stays open whatever happens — a meter nobody can see is a meter that was
 * not consulted — and the other three remember how they were left.
 *
 * The fold is CSS — the contents stay in the page, because the height
 * transition needs them there — so what a test can hold is that a folded card
 * says so, that Tab and a screen reader are kept out of it, that the reading
 * on the test card survives its own fold, and that each card remembers how it
 * was left.
 */

import '@testing-library/jest-dom';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StudioTestCard from '../../../renderer/studio/StudioTestCard';
import StudioFoldCard from '../../../renderer/studio/StudioFoldCard';
import { DEFAULT_STUDIO_WAVE } from '../../../renderer/studio/studioWave';

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    locale: 'en',
    t: (key: string, vars?: Record<string, string | number>) =>
      vars ? `${key}:${Object.values(vars).join(',')}` : key,
  }),
}));

/** What the head opens and closes, by the id the head points at. */
const foldedAway = (head: HTMLElement) => {
  const id = head.getAttribute('aria-controls');
  const reveal = id ? document.getElementById(id) : null;
  if (!reveal) {
    throw new Error('the head controls nothing');
  }
  return reveal.hasAttribute('inert');
};

const testCard = () =>
  render(
    <StudioTestCard
      signal="live"
      onSignal={jest.fn()}
      size="graph"
      onSize={jest.fn()}
      wave={DEFAULT_STUDIO_WAVE}
      onWave={jest.fn()}
      idle={false}
      cost="studio.cost.full"
      percent={100}
      readingRef={{ current: null }}
    />,
  );

beforeEach(() => {
  window.localStorage.clear();
});

it('folds a card by its own title, and folds its contents away with it', async () => {
  testCard();
  const head = screen.getByRole('button', { name: /studio\.test\.title/ });
  expect(head).toHaveAttribute('aria-expanded', 'true');
  expect(
    screen.getByRole('group', { name: 'studio.signals.title' }),
  ).toBeInTheDocument();

  expect(foldedAway(head)).toBe(false);

  await userEvent.click(head);
  expect(head).toHaveAttribute('aria-expanded', 'false');
  // Folded, its contents are still in the page for the height transition to
  // work on — but nothing can tab into them or read them out.
  expect(foldedAway(head)).toBe(true);
});

it('carries how the scene is drawn on the same card as what it is played with', () => {
  testCard();
  // One card, not two: the rows that decide how hard the GPU is driven sit
  // with the signals, the size and the wave, above the reading that says how
  // the scene is keeping up under them.
  const rows = within(
    screen.getByRole('menu', { name: 'studio.performance.title' }),
  ).getAllByRole('menuitem');
  expect(rows.length).toBeGreaterThan(3);
});

it('keeps how the scene is running on screen while the card is folded', async () => {
  testCard();
  await userEvent.click(
    screen.getByRole('button', { name: /studio\.test\.title/ }),
  );
  // The one live reading on the card: folding the controls is not a reason to
  // lose it.
  expect(screen.getByText('studio.cost.full:100')).toBeVisible();
});

it('remembers each card on its own, across a fresh page', async () => {
  const { unmount } = render(
    <>
      <StudioFoldCard fold="settings" title="Settings">
        <p>the sliders</p>
      </StudioFoldCard>
      <StudioFoldCard fold="ship" title="Ready">
        <p>the actions</p>
      </StudioFoldCard>
    </>,
  );
  await userEvent.click(screen.getByRole('button', { name: 'Settings' }));
  expect(foldedAway(screen.getByRole('button', { name: 'Settings' }))).toBe(
    true,
  );
  expect(foldedAway(screen.getByRole('button', { name: 'Ready' }))).toBe(false);
  unmount();

  render(
    <StudioFoldCard fold="settings" title="Settings">
      <p>the sliders</p>
    </StudioFoldCard>,
  );
  expect(screen.getByRole('button', { name: 'Settings' })).toHaveAttribute(
    'aria-expanded',
    'false',
  );
});

it('opens every card the first time, so nothing has to be found', () => {
  render(
    <StudioFoldCard fold="test" title="Trying it">
      <p>what it plays</p>
    </StudioFoldCard>,
  );
  const card = screen.getByRole('button', { name: 'Trying it' });
  expect(card).toHaveAttribute('aria-expanded', 'true');
  expect(
    within(screen.getByRole('region', { name: 'Trying it' })).getByText(
      'what it plays',
    ),
  ).toBeInTheDocument();
});
