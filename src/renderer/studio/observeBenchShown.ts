/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import observeShown from '../utils/observeShown';

/**
 * Whether the Studio's bench is on screen, for what the bench lends the
 * window while it is (its scene's colours, Ambient and the app colours:
 * `useStudioTint`, `useStudioAppColours`; the sound panel folded and the
 * chat's column, `useStudioBenchLayout`), reported only when it changes.
 * `seen` is `observeShown`'s: a layout passes `{ visibilityProperty: true }`.
 *
 * The bench, OR SOMETHING INSIDE IT IN FULL SCREEN (Ivan, 2026-11-23: "the
 * full screen mode is not honoring ... ambient is kind of returning back to
 * the app colors"). The stage goes full screen through the Studio's grid,
 * inside the bench, so the bench itself is outside the full-screen element,
 * and `observeShown` rightly calls it hidden: the Studio let go of the window
 * the moment the stage filled the screen, and the grid's panes over the scene
 * went back to the app's colours. The bench's own answer is kept for
 * everything else — another page, the player, a minimised window.
 */
export default function observeBenchShown(
  bench: Element,
  onChange: (shown: boolean) => void,
  seen?: CheckVisibilityOptions,
): () => void {
  const fullInside = () => {
    const full = document.fullscreenElement;
    // `null` while nothing is full, and absent altogether in jsdom.
    return (
      !document.hidden &&
      full !== null &&
      full !== undefined &&
      full !== bench &&
      bench.contains(full)
    );
  };
  let inside = fullInside();
  let benchShown = false;
  let shown: boolean | undefined;
  const report = () => {
    const next = benchShown || inside;
    if (next !== shown) {
      shown = next;
      onChange(next);
    }
  };
  // ONE ANSWER PER CHANGE, NEVER A BLINK. The bench's own watcher hears the
  // same events, and each order alone let go of the window for a moment:
  // read after it, going in called the bench hidden while nothing here knew
  // yet that the stage was full; read before it, coming out called the
  // stage not full while the bench was still marked hidden. So the stage
  // going full is read before the bench's watcher, and everything after it.
  const enter = () => {
    if (fullInside()) {
      inside = true;
      report();
    }
  };
  const recheck = () => {
    inside = fullInside();
    report();
  };
  document.addEventListener('fullscreenchange', enter);
  document.addEventListener('visibilitychange', enter);
  const stop = observeShown(
    bench,
    (next) => {
      benchShown = next;
      report();
    },
    seen,
  );
  document.addEventListener('fullscreenchange', recheck);
  document.addEventListener('visibilitychange', recheck);
  report();
  return () => {
    stop();
    document.removeEventListener('fullscreenchange', enter);
    document.removeEventListener('visibilitychange', enter);
    document.removeEventListener('fullscreenchange', recheck);
    document.removeEventListener('visibilitychange', recheck);
  };
}
