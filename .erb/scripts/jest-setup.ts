import { TextDecoder, TextEncoder } from 'util';

Object.assign(globalThis, { TextDecoder, TextEncoder });

/**
 * `ResizeObserver`, which jsdom does not implement and Electron always has.
 *
 * The library's list and grid mount only the rows near the viewport and size
 * the empty space that stands in for the rest from what they measure — the
 * pane's height included, which changes without the window doing so when the
 * graph is collapsed or the scan strip appears. A resize listener would miss
 * those; an observer is the only thing that catches them.
 *
 * Deliberately inert rather than a working implementation: jsdom has no
 * layout, so there is nothing for a real one to observe. Every view that uses
 * one already measures once itself on mount, which is the path the tests
 * exercise; this only stops the constructor throwing.
 */
if (!('ResizeObserver' in globalThis)) {
  Object.assign(globalThis, {
    ResizeObserver: class {
      observe(): void {}

      unobserve(): void {}

      disconnect(): void {}
    },
  });
}

// No `matchMedia` stub here, deliberately. jsdom does not implement it, and
// adding one globally changed what other suites saw: `KaraokeWorkspace`
// captures `window.matchMedia` at describe time and restores it after every
// test, so a stub answering `matches: false` where there had been nothing at
// all flipped that component onto its "the query says no" branch and took the
// pitch lane off the stage. Components that ask for it guard the call
// themselves — see `KaraokeWorkspace`, `KaraokeLyrics` and `NowPlayingBar`,
// all of which check it is a function first.
