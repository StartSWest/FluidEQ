/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The space at the bottom of the window that the now-playing bar is sitting in.
 *
 * `window.innerHeight` counts room a menu cannot actually use: a list opening
 * downward near the bottom of a panel runs under the bar and has its last rows
 * hidden by it, with no indication that there were more. Every floating menu in
 * the app has to subtract this, and the two that place themselves — the
 * dropdown and the anchored menu — were not both doing it.
 *
 * Read from the shell's own variables rather than measured or guessed. The
 * layout already publishes `--now-playing-bar-height` and reserves the same
 * space with it, so this agrees with the padding by construction instead of
 * being a second number to keep in step. Zero when nothing is playing, since
 * the class that carries them is not on the root then.
 */
export const bottomInset = (): number => {
  const root = document.getElementById('root');
  if (!root?.classList.contains('has-now-playing')) {
    return 0;
  }
  const shell = getComputedStyle(root);
  const height = parseFloat(shell.getPropertyValue('--now-playing-bar-height'));
  const gutter = parseFloat(shell.getPropertyValue('--shell-gutter-bottom'));
  return (
    (Number.isFinite(height) ? height : 86) +
    (Number.isFinite(gutter) ? gutter : 18)
  );
};
