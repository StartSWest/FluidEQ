/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Studio's card folds a group at a time, and holds them in the order the
 * graph's View menu holds the same settings in.
 *
 * Everything a scene is tried and tuned with is one card, which is taller
 * than the column it stands in: reaching the response sliders took the scene
 * being tuned off the top of the screen. A group is the useful thing to put
 * away — somebody tuning the response wants the sliders and nothing else —
 * and each remembers how it was left. Nothing else in the column folds: a
 * fold around all four groups was a second way to do the same thing, and the
 * card of actions at the foot is the one thing that must never be hidden.
 *
 * The fold is CSS — the contents stay in the page, because the height
 * transition needs them there — so what a test can hold is that a folded
 * group says so, that Tab and a screen reader are kept out of it, that the
 * live reading survives a fold, and that each group remembers how it was
 * left.
 */

import '@testing-library/jest-dom';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StudioTestCard from '../../../renderer/studio/StudioTestCard';
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
      settings={<p>the settings of the scene</p>}
    />,
  );

beforeEach(() => {
  window.localStorage.clear();
});

// First in the file on purpose: a fold is remembered in the module as well
// as in storage, so a group folded by any test below stays folded for the
// rest of the file whatever storage says. This is the one case that needs
// every group as a fresh window finds it.
it('opens every group the first time, so nothing has to be found', () => {
  testCard();
  ['studioOnly', 'picture', 'visualizer', 'drawing'].forEach((group) => {
    expect(
      screen.getByRole('button', { name: `settings.group.${group}` }),
    ).toHaveAttribute('aria-expanded', 'true');
  });
  expect(
    within(
      screen.getByRole('region', { name: 'settings.group.drawing' }),
    ).getByRole('group', { name: 'studio.performance.title' }),
  ).toBeInTheDocument();
});

it('folds a group by its own name, and folds its rows away with it', async () => {
  testCard();
  const head = screen.getByRole('button', {
    name: 'settings.group.studioOnly',
  });
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

it('gives the card no fold of its own, now that every group has one', () => {
  testCard();
  // Four groups that put themselves away, and no fifth control that puts all
  // four away at once — Ivan, once the groups could fold: "the root one no".
  expect(
    screen.queryByRole('button', { name: /studio\.test\.title/ }),
  ).toBeNull();
  expect(screen.getByText('studio.test.title')).toBeInTheDocument();
  expect(
    screen.getAllByRole('button', { name: /^settings\.group\./ }),
  ).toHaveLength(4);
});

it('carries how the scene is drawn on the same card as what it is played with', () => {
  testCard();
  // One card, not two: the rows that decide how hard the GPU is driven sit
  // with the signals, the size and the wave, above the reading that says how
  // the scene is keeping up under them.
  const rows = within(
    // A group, not a menu: nothing in this card floats, and everything the
    // app calls a menu is given a surface of its own to float on.
    screen.getByRole('group', { name: 'studio.performance.title' }),
  ).getAllByRole('menuitem');
  expect(rows.length).toBeGreaterThan(3);
});

it('folds one group away without touching the rest', async () => {
  testCard();
  const head = screen.getByRole('button', { name: 'settings.group.picture' });
  expect(head).toHaveAttribute('aria-expanded', 'true');
  await userEvent.click(head);
  expect(head).toHaveAttribute('aria-expanded', 'false');
  expect(foldedAway(head)).toBe(true);
  // Every other group stays exactly as it was: a group is the useful size to
  // put away, which is why the card around them has no fold of its own.
  expect(
    foldedAway(
      screen.getByRole('button', { name: 'settings.group.visualizer' }),
    ),
  ).toBe(false);
});

it('reads down in the order both surfaces share', () => {
  const { container } = testCard();
  // The graph's menu and this card name and order the same groups
  // (`common/settingsGroups.ts`); what only the Studio has comes first, and
  // everything the two share follows in one order.
  const groups = [
    ...container.querySelectorAll('.studio-card__eyebrow--group'),
  ].map((heading) => heading.textContent);
  expect(groups).toEqual([
    'settings.group.studioOnly',
    'settings.group.picture',
    'settings.group.visualizer',
    'settings.group.drawing',
  ]);
  // And the scene's own settings are inside the card, between the two.
  expect(screen.getByText('the settings of the scene')).toBeInTheDocument();
});

it('keeps how the scene is running on screen while a group is folded', async () => {
  testCard();
  await userEvent.click(
    screen.getByRole('button', { name: 'settings.group.drawing' }),
  );
  // The one live reading on the card, under every group: putting the rows it
  // describes away is not a reason to lose it.
  expect(screen.getByText('studio.cost.full:100')).toBeVisible();
});

it('remembers each group on its own, across a fresh page', async () => {
  const { unmount } = testCard();
  const otherWas = foldedAway(
    screen.getByRole('button', { name: 'settings.group.drawing' }),
  );
  await userEvent.click(
    screen.getByRole('button', { name: 'settings.group.visualizer' }),
  );
  expect(
    foldedAway(
      screen.getByRole('button', { name: 'settings.group.visualizer' }),
    ),
  ).toBe(true);
  // Folding one says nothing about any other.
  expect(
    foldedAway(screen.getByRole('button', { name: 'settings.group.drawing' })),
  ).toBe(otherWas);
  unmount();

  testCard();
  expect(
    screen.getByRole('button', { name: 'settings.group.visualizer' }),
  ).toHaveAttribute('aria-expanded', 'false');
  expect(
    foldedAway(screen.getByRole('button', { name: 'settings.group.drawing' })),
  ).toBe(otherWas);
});
