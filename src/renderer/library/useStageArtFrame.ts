/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect } from 'react';

/**
 * What any picture drawn behind an expanded or full-screen graph needs from
 * the window: the box it stands in, and the marker that lifts the plot over
 * it.
 *
 * Shared by the two backdrops — the Library's song and the machine's own —
 * because they are the same picture in the same place with a different source,
 * and two copies of a measured layout are two layouts that come apart the
 * first time one of them is fixed.
 */

/**
 * Where layout put the column, not where an entrance is carrying it this frame.
 *
 * `getBoundingClientRect` counts transforms, and the column rises 8px into
 * place every time it appears (`rise-in`) — which includes every return from
 * the amp, since the player takes `#root` out of the page and putting it back
 * restarts the entrance. Measured mid-rise, the record was published 8px low;
 * the rise then ends without the column changing size, so nothing measured it
 * again, and the record stood out under the bottom of the graph's card (Ivan,
 * 2026-09-23). Offsets are layout's own numbers and carry no transform.
 */
const layoutBox = (element: HTMLElement) => {
  // Document coordinates first, then the window's own scroll taken off, which
  // is what makes them the viewport's like the rectangle they replace.
  let top = element.offsetTop - window.scrollY;
  let left = element.offsetLeft - window.scrollX;
  let parent = element.offsetParent;
  while (parent instanceof HTMLElement) {
    top += parent.offsetTop + parent.clientTop;
    left += parent.offsetLeft + parent.clientLeft;
    parent = parent.offsetParent;
  }
  return {
    top,
    left,
    width: element.offsetWidth,
    bottom: top + element.offsetHeight,
  };
};

/**
 * The box the picture stands in, measured and published to the stylesheet.
 *
 * The graph has two of these modes, not one: expanded keeps the sidebars and
 * takes the middle column, full screen takes the window. A picture fixed to the
 * window is right for the second and covers the sidebars in the first, so the
 * column is measured and both the picture and the card are laid on the result.
 * In full screen the column *is* the window and the numbers come out the same,
 * which is why there is one path rather than a mode flag.
 *
 * Clamped to what is on screen. The library column is as tall as the list
 * inside it — 2618px against a 1440px window is a measured case — so the raw
 * rectangle would centre the record a screen and a half below the fold.
 */
const useStageBox = () => {
  useEffect(() => {
    // On the document, not on `#root`. The picture is portalled to the body
    // and is therefore `#root`'s *sibling*: custom properties inherit down the
    // tree and never sideways, so written there the card read them and the
    // record did not — measured, as the record still covering the sidebars in
    // expanded mode while the card sat correctly in the column.
    const host = document.documentElement;
    const column = document.querySelector('.center-workspace');
    if (!(column instanceof HTMLElement)) {
      return undefined;
    }

    const publish = () => {
      const rect = layoutBox(column);
      const top = Math.max(rect.top, 0);
      const bottom = Math.min(rect.bottom, window.innerHeight);
      host.style.setProperty('--stage-art-left', `${Math.round(rect.left)}px`);
      host.style.setProperty(
        '--stage-art-width',
        `${Math.round(rect.width)}px`,
      );
      host.style.setProperty('--stage-art-top', `${Math.round(top)}px`);
      // The same clamp, expressed from the column's own top edge. The card is
      // fixed *inside* the column — `.center-workspace` carries `will-change:
      // transform`, which makes it the containing block for fixed children —
      // so it needs the offset, not the viewport coordinate. Zero whenever the
      // column starts on screen, which is both of these modes today.
      host.style.setProperty(
        '--stage-art-shift',
        `${Math.round(top - rect.top)}px`,
      );
      host.style.setProperty(
        '--stage-art-height',
        `${Math.round(Math.max(0, bottom - top))}px`,
      );
    };

    publish();

    // The column, the shell around it and the window: between them they cover
    // entering the mode, opening a side pane and resizing the window, which is
    // every way this rectangle moves.
    const observer = new ResizeObserver(publish);
    observer.observe(column);
    observer.observe(document.documentElement);
    window.addEventListener('resize', publish);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', publish);
      host.style.removeProperty('--stage-art-left');
      host.style.removeProperty('--stage-art-width');
      host.style.removeProperty('--stage-art-top');
      host.style.removeProperty('--stage-art-shift');
      host.style.removeProperty('--stage-art-height');
    };
  }, []);
};

/**
 * The marker and the box, for as long as a backdrop is mounted.
 *
 * `has-stage-art` is the one stylesheet rule a backdrop needs from the graph:
 * its plot lifted over the picture. Scoped to this class rather than written
 * into the graph's own full-screen rules, so nothing about the Media tab's
 * full screen changes because of a picture that belongs to somebody else.
 */
const useStageArtFrame = (): void => {
  useEffect(() => {
    const root = document.getElementById('root');
    root?.classList.add('has-stage-art');
    return () => root?.classList.remove('has-stage-art');
  }, []);

  useStageBox();
};

export default useStageArtFrame;
