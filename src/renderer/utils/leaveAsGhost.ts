/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** The keyframes a closing question's frame plays (`DialogFrame.scss`). */
export const COMPACT_EXIT = 'compact-shrink';

/**
 * Lets a question that has just been answered shrink away instead of
 * blinking out (Ivan, 2026-11-17: "expand to the size animation on closing
 * and opening for those small confirmation dialogues").
 *
 * Each question is mounted by whatever asked it, behind its own condition,
 * so React removes it the moment that condition turns false and there is no
 * frame left to animate. Rather than teach each of the places that ask one
 * to hold it open, the frame, as it unmounts, leaves an inert copy of its
 * layer (the scrim and the frame) where it stood: marked closing, so the
 * stylesheet plays the shrink and the scrim's fade, and removed by its own
 * animation finishing. No duration is written here; the stylesheet decides
 * how long leaving takes. Where nothing plays (reduced motion) the copy goes
 * at once.
 *
 * Only a modal question portalled straight into the document gets one: a
 * notice drawn inside a page leaves with the page.
 */
export default function leaveAsGhost(frame: HTMLElement | null) {
  const layer = frame?.parentElement;
  if (
    !frame ||
    !layer ||
    layer.parentElement !== document.body ||
    frame.getAttribute('aria-modal') !== 'true'
  ) {
    return;
  }
  const ghost = layer.cloneNode(true);
  if (!(ghost instanceof HTMLElement)) {
    return;
  }
  ghost.inert = true;
  ghost.setAttribute('aria-hidden', 'true');
  ghost.dataset.closing = '';
  document.body.append(ghost);
  const leaving = ghost
    .getAnimations({ subtree: true })
    .filter(
      (animation) =>
        animation instanceof CSSAnimation &&
        animation.animationName === COMPACT_EXIT,
    );
  if (leaving.length === 0) {
    ghost.remove();
    return;
  }
  // Removed whether the shrink finishes or is cancelled (a style change
  // that stops it rejects `finished`, which `allSettled` absorbs): a copy
  // left behind would sit over the window, inert but seen.
  Promise.allSettled(leaving.map((animation) => animation.finished)).then(
    () => ghost.remove(),
    () => ghost.remove(),
  );
}
