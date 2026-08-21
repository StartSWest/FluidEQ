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

/**
 * Pointer capture, which jsdom does not implement and every browser does.
 *
 * The cover flow drags: a press on the fan captures the pointer so that a
 * drag which leaves the element still arrives, and releases it on the way up.
 * jsdom has the pointer events but not the capture API, so the release threw
 * `hasPointerCapture is not a function` and took the whole click with it —
 * which is every test that clicks a cover, now that the fan is the library's
 * first view.
 *
 * A record rather than a no-op: `hasPointerCapture` has to answer honestly or
 * the guard around the release is testing nothing.
 */
// Guarded on `Element` itself and not just on the method: the main-process
// suites run in the node environment, where there is no DOM at all, and
// reaching for `Element.prototype` here took two of them down with a
// ReferenceError before either had run a line.
if (
  typeof Element !== 'undefined' &&
  !('hasPointerCapture' in Element.prototype)
) {
  const captured = new WeakMap<Element, Set<number>>();

  Object.assign(Element.prototype, {
    setPointerCapture(pointerId: number): void {
      const ids = captured.get(this as Element) ?? new Set<number>();
      ids.add(pointerId);
      captured.set(this as Element, ids);
    },
    releasePointerCapture(pointerId: number): void {
      captured.get(this as Element)?.delete(pointerId);
    },
    hasPointerCapture(pointerId: number): boolean {
      return captured.get(this as Element)?.has(pointerId) ?? false;
    },
  });
}
