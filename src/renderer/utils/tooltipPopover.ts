/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import { prefersReducedMotion } from './bandReveal';
import '../styles/Tooltip.scss';

/**
 * The tooltip itself: the one element that shows the app's tooltips, where it
 * stands, and how it comes and goes. What it describes, and the titles lent
 * to it while it does, are `tooltipLayer.ts`'s.
 *
 * One element for the whole window, in the top layer, so the Help guide's
 * modal dialog cannot cover it.
 */

// How long the pointer rests on something before its tooltip appears — the
// wait the Gallery's loading ring holds for. Sweeping across a toolbar shows
// nothing; resting on a button reads as asking. It is the entrance's own
// delay, an animation on the tooltip that no code waits on, and it is kept
// with Animations off: the wait is the point there, not the motion.
const HOLD_MS = 500;
const ENTER_MS = 140;
// A tooltip leaving fades over this long, and while it is still on screen the
// next one takes its place at once — moving along a row of buttons reads each
// of them without the wait again at every one.
const LEAVE_MS = 150;
// `$ease-out` in `_motion.scss`.
const EASE_OUT = 'cubic-bezier(0.32, 0.72, 0, 1)';
const GAP_PX = 6;
const EDGE_PX = 8;
// Anything bigger than this — a list row, a canvas, a plot — is described
// where the pointer came onto it, a cursor's height below it, rather than
// under its middle, which could be half a window away.
const ANCHOR_MAX_WIDTH_PX = 240;
const ANCHOR_MAX_HEIGHT_PX = 64;
const CURSOR_CLEARANCE_PX = 20;

export type TPoint = { x: number; y: number };

let tip: HTMLDivElement | undefined;
let entrance: Animation | undefined;
let entranceDelay = 0;
let exit: Animation | undefined;
/** What the tooltip on screen describes, and whether it came by keyboard. */
let shown: { element: Element; byFocus: boolean } | undefined;

const tooltip = (): HTMLDivElement => {
  if (!tip) {
    tip = document.createElement('div');
    tip.className = 'app-tooltip';
    tip.setAttribute('role', 'tooltip');
    tip.popover = 'manual';
    document.body.append(tip);
  }
  return tip;
};

const isOpen = () => tip?.matches(':popover-open') === true;

/** Whether a tooltip can be seen right now, fading out included. */
const isSeen = (): boolean => {
  if (!isOpen()) {
    return false;
  }
  if (exit) {
    return exit.playState === 'running';
  }
  if (!entrance || entrance.playState === 'finished') {
    return true;
  }
  const time = entrance.currentTime;
  return typeof time === 'number' && time >= entranceDelay;
};

const place = (element: Element, point: TPoint | undefined) => {
  const box = tooltip();
  const anchor = element.getBoundingClientRect();
  const { width, height } = box.getBoundingClientRect();
  const viewWidth = document.documentElement.clientWidth;
  const viewHeight = document.documentElement.clientHeight;
  const atPointer =
    point !== undefined &&
    (anchor.width > ANCHOR_MAX_WIDTH_PX ||
      anchor.height > ANCHOR_MAX_HEIGHT_PX);
  const centre = atPointer ? point.x : anchor.left + anchor.width / 2;
  const below = atPointer
    ? point.y + CURSOR_CLEARANCE_PX
    : anchor.bottom + GAP_PX;
  const above = (atPointer ? point.y : anchor.top) - GAP_PX - height;
  const isBelow = below + height <= viewHeight - EDGE_PX || above < EDGE_PX;
  const top = Math.min(
    Math.max(isBelow ? below : above, EDGE_PX),
    viewHeight - EDGE_PX - height,
  );
  const left = Math.min(
    Math.max(centre - width / 2, EDGE_PX),
    viewWidth - EDGE_PX - width,
  );
  box.style.left = `${Math.round(left)}px`;
  box.style.top = `${Math.round(top)}px`;
  return isBelow;
};

/** What the tooltip describes now, if it is up. */
export const shownTooltip = () => shown;

/** Its text, whether or not it is up. */
export const tooltipText = () => tip?.textContent;

/** The tooltip already up for `element`, rewritten and placed again. */
export const retextTooltip = (
  element: Element,
  text: string,
  point: TPoint | undefined,
) => {
  tooltip().textContent = text;
  place(element, point);
};

export const showTooltip = (
  element: Element,
  text: string,
  point: TPoint | undefined,
  byFocus: boolean,
) => {
  const box = tooltip();
  const isWarm = isSeen();
  exit?.cancel();
  exit = undefined;
  entrance?.cancel();
  entrance = undefined;
  if (!isWarm && isOpen()) {
    // Shown again, so it is the newest thing in the top layer: a dialog
    // opened since would otherwise stand over it.
    box.hidePopover();
  }
  if (!isOpen()) {
    box.showPopover();
  }
  box.textContent = text;
  const isBelow = place(element, point);
  shown = { element, byFocus };
  if (isWarm) {
    return;
  }
  const isStill = prefersReducedMotion();
  entranceDelay = HOLD_MS;
  entrance = box.animate(
    isStill
      ? [{ opacity: 0 }, { opacity: 1 }]
      : [
          {
            opacity: 0,
            transform: `translateY(${isBelow ? -3 : 3}px) scale(0.98)`,
          },
          { opacity: 1, transform: 'none' },
        ],
    {
      duration: isStill ? 1 : ENTER_MS,
      delay: HOLD_MS,
      easing: EASE_OUT,
      fill: 'backwards',
    },
  );
};

export const hideTooltip = (isFading: boolean) => {
  shown = undefined;
  if (!isOpen()) {
    return;
  }
  const box = tooltip();
  const wasSeen = isSeen();
  entrance?.cancel();
  entrance = undefined;
  if (!isFading || !wasSeen || prefersReducedMotion()) {
    exit?.cancel();
    exit = undefined;
    box.hidePopover();
    return;
  }
  if (exit) {
    return;
  }
  const leaving = box.animate([{ opacity: 1 }, { opacity: 0 }], {
    duration: LEAVE_MS,
    easing: 'ease-out',
    fill: 'forwards',
  });
  exit = leaving;
  // Another tooltip taking this one's place cancels the fade, which does not
  // finish it.
  leaving.addEventListener('finish', () => {
    if (exit !== leaving) {
      return;
    }
    exit = undefined;
    leaving.cancel();
    box.hidePopover();
  });
};
