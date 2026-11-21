/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  afterNextFrame,
  untilViewportIsWindow,
} from '../player/windowModeStore';
import { prefersReducedMotion } from '../utils/bandReveal';

/**
 * THE WINDOW INTO FULL SCREEN AND BACK, IN ONE STEP AND ONE RISE.
 *
 * Ivan, 2026-11-19: "I never liked how Fluid looks when I go to full screen
 * from the graph and restore back. It's kind of glitchy." Every step of the
 * change used to be on screen, and each was a glitch of its own:
 *
 *  - The layout changed before the window did. The press flipped the page to
 *    its full-screen layout at once, so the picture first filled the small
 *    window, and on the way out the docked panes were laid out across the
 *    whole display — and only then did the window change size.
 *  - Windows shows the page's last frame stretched over the window's new size
 *    until the page draws one at that size, so each of those layouts was seen
 *    pulled to the wrong size for a frame or more (`untilViewportIsWindow`).
 *  - The space Windows opens as the window grows is filled with the window's
 *    own background, which full screen sets to black (`windowBackdrop.ts`):
 *    black strips beside a light window's stretched page.
 *  - The full-screen frame's own motion ran across all of it: both side
 *    panels slid off as drawers and the header slid up, for 220ms, over a
 *    window that was changing size under them.
 *
 * So the press puts a cover over the page in the same task that changes the
 * layout, and the first frame painted after it is the cover: full screen's
 * black on the way in, the window's floor on the way out — each the colour
 * the window itself is filled with at that moment, so a stretched frame of it
 * and the strip beside it are the same colour. The layout and the window
 * change behind it with every transition held (`WindowRefit.scss`), and the
 * new view rises out of it once the page has drawn it at the window's new
 * size: the player's picture goes full screen the same way
 * (`visFullScreen.ts`, Ivan 2026-09-24). The cover goes up at once rather
 * than fading up: a fade would have to hold the layout back for its length,
 * and every caller of the graph's view reads it the moment it is set.
 *
 * Every step waits on the thing it needs, never on a clock: main's answer,
 * the page reaching the size main reports for the window, a frame drawn at
 * it. A later change takes the cover over and the earlier one leaves it to
 * that one. A press on the cover lets it go at once, so nothing can leave the
 * window covered. On a Mac the window animates into a space of its own and
 * this stands aside, as `visFullScreen.ts` does.
 */

/** The rise, on the full-screen frame's clock (`$motion-base`). */
const RISE_MS = 220;

/** On `<html>` while the layout changes behind the cover: transitions held. */
const REFITTING = 'data-window-refitting';

/**
 * The app's Animations switch first, as every other motion here: with motion
 * off the cover still stands for the change and goes in one step, because
 * the stretch it hides is not motion anybody chose.
 */
const time = (ms: number) => (prefersReducedMotion() ? 0 : ms);

/**
 * Whether there is a window to cover: not in a test's document, not on a Mac,
 * and not while the page cannot be seen — a hidden page draws no frames, and
 * the rise waits on one.
 */
const canCover = () =>
  typeof document !== 'undefined' &&
  typeof document.body?.animate === 'function' &&
  document.visibilityState === 'visible' &&
  window.electron?.platform !== 'darwin';

interface ICover {
  element: HTMLElement;
  /** Resolves when the cover is pressed: let go of the window, now. */
  pressed: Promise<void>;
  /** The rise under way, which a newer change stops. */
  rise?: Animation;
}

let cover: ICover | undefined;
/** The newest change; an older one that finishes leaves the cover to it. */
let turn = 0;

const raiseCover = (towardFullScreen: boolean): ICover => {
  const element = document.createElement('div');
  element.className = 'window-refit-cover';
  element.toggleAttribute('data-toward-full-screen', towardFullScreen);
  element.setAttribute('aria-hidden', 'true');
  const pressed = new Promise<void>((resolve) => {
    element.addEventListener('pointerdown', () => resolve(), { once: true });
  });
  // In the top layer, so it is over everything a full screen can have open —
  // a modal dialog and the window's own drawn edge (`body::after`) included —
  // whatever their z-index says. A popover that is not shown is not drawn at
  // all, so the attribute goes on only where it can be shown; elsewhere the
  // stylesheet's own z-index is all there is.
  const canPopOver = typeof element.showPopover === 'function';
  if (canPopOver) {
    element.setAttribute('popover', 'manual');
  }
  document.body.appendChild(element);
  if (canPopOver) {
    element.showPopover();
  }
  return { element, pressed };
};

const dropCover = (element: HTMLElement) => {
  if (element.hasAttribute('popover') && element.matches(':popover-open')) {
    element.hidePopover();
  }
  element.remove();
};

/** The cover up and opaque, now — a rise under way is taken back. */
const takeCover = (towardFullScreen: boolean): ICover => {
  if (cover) {
    cover.rise?.cancel();
    cover.rise = undefined;
    cover.element.classList.remove('is-rising');
    // Its colour follows the newest direction: the colour the window is
    // filled with is the one the last request leaves it in.
    cover.element.toggleAttribute('data-toward-full-screen', towardFullScreen);
    return cover;
  }
  cover = raiseCover(towardFullScreen);
  return cover;
};

const rise = async (current: ICover, held: number) => {
  // Every value has settled with the transitions held, so letting them go
  // starts none.
  document.documentElement.removeAttribute(REFITTING);
  current.element.classList.add('is-rising');
  const animation = current.element.animate([{ opacity: 1 }, { opacity: 0 }], {
    duration: time(RISE_MS),
    easing: 'ease-out',
    fill: 'forwards',
  });
  current.rise = animation;
  // A cancelled rise rejects: a newer change took the cover back.
  const finished = await animation.finished.then(
    () => true,
    () => false,
  );
  if (finished && held === turn && cover === current) {
    cover = undefined;
    dropCover(current.element);
  }
};

/**
 * Runs `change` — whatever takes the layout and the window into full screen
 * (`towardFullScreen`) or out of it — behind the cover. Called in the same
 * task as the layout's own change, and before React renders it, so the
 * cover and the held transitions are in place for its first frame; `change`
 * itself runs inside this call. Resolves once the new view is showing, or at
 * once where there is nothing to cover.
 */
const refitWindow = async (
  towardFullScreen: boolean,
  change: () => Promise<unknown>,
): Promise<void> => {
  if (!canCover() && !cover) {
    await change().catch(() => undefined);
    return;
  }
  turn += 1;
  const held = turn;
  const current = takeCover(towardFullScreen);
  document.documentElement.setAttribute(REFITTING, '');
  try {
    await Promise.race([
      (async () => {
        await change();
        // Drawn at the size main gave the window, so the first frame the
        // rise shows is that one.
        await untilViewportIsWindow();
        await afterNextFrame();
      })(),
      current.pressed,
    ]);
  } catch {
    // The change reports its own failure; the window is shown either way.
  }
  if (held !== turn || cover !== current) {
    return;
  }
  await rise(current, held);
};

export default refitWindow;
