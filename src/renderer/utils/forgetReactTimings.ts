/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * In development, lets go of the timing entries React writes for DevTools.
 *
 * React 19.2's development build draws its Performance-panel tracks
 * ("Components ⚛", "Scheduler ⚛") with `performance.measure` whenever a
 * component renders with changed props and on every state update — each entry
 * carrying a copy of what changed — and never clears them. The browser keeps
 * every user-timing entry for the life of the page: there is no buffer limit
 * for them. Measured on 2026-09-26 in the dev window on the EQ page: 48 entries
 * a second, 29 of them from the live-audio provider's state alone, about 8 KB
 * each; clearing 12,427 of them gave back 103 MB, and the window's renderer
 * had grown from 0.5 GB at launch to 1.9 GB in half an hour.
 *
 * Nothing is lost by clearing. A Performance recording reads user timing from
 * the trace, which gets its event when the entry is made, not from this
 * buffer; and nothing in the app reads the buffer. The observer is called
 * because entries arrived, so the clearing follows them rather than a clock.
 * React's production build writes none of these, and production installs
 * nothing.
 */
const forgetReactTimings = (): void => {
  if (
    process.env.NODE_ENV !== 'development' ||
    typeof PerformanceObserver !== 'function' ||
    !PerformanceObserver.supportedEntryTypes?.includes('measure')
  ) {
    return;
  }
  new PerformanceObserver(() => performance.clearMeasures()).observe({
    type: 'measure',
  });
};

export default forgetReactTimings;
