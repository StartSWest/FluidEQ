/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Ivan, 2026-11-24: "when I open the window and I have a current visualizer
 * displaying, I want the window to reflect that, and that one should be
 * selected and in view". The window reopened on the place left last time, so
 * a look playing while that place was a scene category was in no column at
 * all: nothing marked, nothing to scroll to.
 */

import { fireEvent, render, screen, within } from '@testing-library/react';
import LookPicker from 'renderer/graph/LookPicker';

const PICKER = 'Styles and scenes';

const open = () =>
  fireEvent.click(screen.getByRole('button', { name: PICKER }));

/** Tiles marked as playing that name the playing look. */
const playingTiles = () =>
  within(screen.getByRole('dialog', { name: PICKER }))
    .queryAllByRole('button', { pressed: true })
    .filter((tile) => /Spectrogram/i.test(tile.textContent ?? '')).length;

const rail = () => screen.getByRole('navigation');

const activePlace = () =>
  within(rail())
    .getAllByRole('button')
    .find((place) => place.getAttribute('aria-current') === 'page');

const placeNamed = (name: string) =>
  within(rail())
    .getAllByRole('button')
    .find((place) => place.getAttribute('title') === name);

it('opens on the place that holds the playing look, with it marked', () => {
  render(
    <LookPicker
      value="spectrogram-auto"
      disabled={false}
      onChoose={() => {}}
    />,
  );
  open();
  // The control: on the place it was left, the playing look is marked.
  expect(playingTiles()).toBeGreaterThan(0);

  // Left on a place that cannot hold a standard look...
  const scenes = within(rail())
    .getAllByRole('button')
    .find((place) => place.getAttribute('title') === 'All scenes');
  if (!scenes) {
    throw new Error('no All scenes place in the rail');
  }
  fireEvent.click(scenes);
  expect(activePlace()).toBe(placeNamed('All scenes'));
  open(); // closes

  // ...it reopens on the look's own place, the look marked as playing.
  open();
  expect(activePlace()?.getAttribute('title')).not.toBe('All scenes');
  expect(playingTiles()).toBeGreaterThan(0);
});
