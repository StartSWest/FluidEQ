/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { RefObject, useEffect } from 'react';

/**
 * How wide the wider of the titlebar's two ends is, published as
 * `--titlebar-side` on the bar.
 *
 * The meter is centred by the grid: two equal `1fr` tracks either side of an
 * `auto` one puts the middle track in the true middle of the window, whatever
 * is in the outer two. That only holds while the outer two FIT — a `1fr` track
 * hands back the same width to both ends, and the end that needs more than its
 * share simply overflows into the middle. Measured in the running window at
 * 1440px wide: the left end came to 380px and the right end to 519 — three
 * names, the pet, the actions button and three window controls — so the right
 * end overhung its 479px track and sat on top of the tab beside it.
 *
 * So the meter is what gives way, and this is the number it gives way to. The
 * wider end is measured, both ends are guaranteed it, and the spectrum takes
 * what is left. It only ever draws narrower, which is the cheapest thing in
 * this bar to lose and the order the titlebar has always given ground in.
 *
 * MEASURED, NOT WRITTEN DOWN, because the alternative is a constant that is
 * right in one language. "Online Media" is `Multimedia en línea` in Spanish and
 * `Онлайн-медиа` in Russian, and the names are most of what these ends are made
 * of.
 *
 * The sum is over the children rather than the cluster's own box, and that is
 * load-bearing: the cluster is a grid item, so its width is the track's width,
 * which is a function of the number published here. Reading it back would be a
 * loop that grows by its own output every pass. A child's box does not depend
 * on the track, and an `auto` margin between children — which is what holds the
 * names against the meter — contributes nothing to the sum, which is exactly
 * the elastic the ends need.
 */
export const useTitlebarSideWidth = (
  header: RefObject<HTMLElement | null>,
  left: RefObject<HTMLElement | null>,
  right: RefObject<HTMLElement | null>,
) => {
  useEffect(() => {
    const bar = header.current;
    const ends = [left.current, right.current].filter(
      (end): end is HTMLElement => !!end,
    );
    // `ResizeObserver` is absent in the jsdom the titlebar's tests run under —
    // see `useTransportStrip` for the same guard — so this is a no-op there
    // rather than something to mock.
    if (!bar || ends.length !== 2 || typeof ResizeObserver === 'undefined') {
      return undefined;
    }
    const contentWidth = (end: HTMLElement) => {
      const gap = Number.parseFloat(getComputedStyle(end).columnGap) || 0;
      const parts = Array.from(end.children).filter(
        (child): child is HTMLElement =>
          child instanceof HTMLElement && child.offsetWidth > 0,
      );
      const words = parts.reduce(
        (total, part) => total + part.getBoundingClientRect().width,
        0,
      );
      return words + Math.max(0, parts.length - 1) * gap;
    };
    const measure = () => {
      const widest = Math.max(...ends.map(contentWidth));
      bar.style.setProperty('--titlebar-side', `${Math.ceil(widest)}px`);
    };
    measure();
    const size = new ResizeObserver(measure);
    ends.forEach((end) => size.observe(end));
    // What is in an end changes without the end changing size: the pet leaves
    // when the chrome idles, the version drops off the identity at 1080, and
    // the media tab swaps its name for one word — which React writes into the
    // existing text node, so `characterData` rather than `childList` is what
    // notices it. None of those move the cluster's own box, because the box is
    // the grid track and the track is set from the number this publishes.
    const contents = new MutationObserver(measure);
    ends.forEach((end) =>
      contents.observe(end, {
        characterData: true,
        childList: true,
        subtree: true,
      }),
    );
    return () => {
      size.disconnect();
      contents.disconnect();
    };
  }, [header, left, right]);
};

export default useTitlebarSideWidth;
