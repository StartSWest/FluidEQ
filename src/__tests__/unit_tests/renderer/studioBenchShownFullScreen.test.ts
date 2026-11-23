/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Studio's stage in full screen keeps the window in its scene's colours
 * (Ivan, 2026-11-23: "the full screen mode is not honoring ... ambient is
 * kind of returning back to the app colors"). The stage goes full screen
 * through the Studio's grid, inside the bench, which left the bench outside
 * the full-screen element: called hidden, it let go of the window. Beside
 * it, the case that must still let go: something else in full screen.
 */
import observeBenchShown from '../../../renderer/studio/observeBenchShown';

let fullScreen: Element | null = null;
Object.defineProperty(document, 'fullscreenElement', {
  configurable: true,
  get: () => fullScreen,
});

const goFull = (element: Element | null) => {
  fullScreen = element;
  document.dispatchEvent(new Event('fullscreenchange'));
};

const setUp = () => {
  const bench = document.createElement('div');
  const grid = document.createElement('div');
  bench.append(grid);
  const elsewhere = document.createElement('div');
  document.body.append(bench, elsewhere);
  const seen: boolean[] = [];
  const stop = observeBenchShown(bench, (shown) => seen.push(shown));
  return { grid, elsewhere, seen, stop };
};

afterEach(() => {
  fullScreen = null;
  document.body.replaceChildren();
});

it('stays shown while the stage fills the screen from inside the bench', () => {
  const { grid, seen, stop } = setUp();
  expect(seen).toEqual([true]);
  goFull(grid);
  goFull(null);
  // Never let go: not once while full, not once on the way back.
  expect(seen).toEqual([true]);
  stop();
});

it('lets go while something outside the bench fills the screen', () => {
  const { elsewhere, seen, stop } = setUp();
  goFull(elsewhere);
  expect(seen).toEqual([true, false]);
  goFull(null);
  expect(seen).toEqual([true, false, true]);
  stop();
});

it('listens to nothing once stopped', () => {
  const { elsewhere, seen, stop } = setUp();
  stop();
  goFull(elsewhere);
  expect(seen).toEqual([true]);
});
