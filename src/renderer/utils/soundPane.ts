/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  type RefObject,
  useLayoutEffect,
  useState,
  useSyncExternalStore,
} from 'react';
import { readStoredFlag, writeStored } from './graphStorage';

/**
 * Whether the sound panel on the right — the output, its profiles, the second
 * output, the driver — is folded to its rail (Ivan, 2026-09-27: "make right
 * side pane collapsible nicely with animation … when studio opens it auto
 * collapses and when studio closes it restores back").
 *
 * Two answers kept apart: what the member chose, remembered across launches,
 * and a hold the Studio puts on it while its bench is on screen. The Studio
 * wants the width for the stage, not the member's preference changed: it
 * folds the panel when it opens and gives back exactly what was there when
 * it closes. Unfolding it by hand while the Studio holds it is the member's
 * say for that visit, and the hold's end still puts back what they had
 * before the Studio opened, which is the only state they chose on purpose.
 */

const STORAGE_KEY = 'fluideq.soundPaneFolded';

let chosen = readStoredFlag(STORAGE_KEY);
/** Set while the Studio holds the panel: the member's choice to go back to. */
let beforeHold: boolean | undefined;
let folded = chosen;

const listeners = new Set<() => void>();
const publish = (next: boolean) => {
  if (next === folded) {
    return;
  }
  folded = next;
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** The fold button: remembered, unless the Studio holds the panel. */
export const setSoundPaneFolded = (next: boolean) => {
  if (beforeHold === undefined) {
    chosen = next;
    writeStored(STORAGE_KEY, String(next));
  }
  publish(next);
};

/** The Studio's bench came on screen: fold, remembering what was there. */
export const holdSoundPaneForStudio = () => {
  if (beforeHold !== undefined) {
    return;
  }
  beforeHold = chosen;
  publish(true);
};

/** The Studio's bench went away: put back what the member had. */
export const releaseSoundPaneFromStudio = () => {
  if (beforeHold === undefined) {
    return;
  }
  const back = beforeHold;
  beforeHold = undefined;
  publish(back);
};

export const useSoundPaneFolded = (): boolean =>
  useSyncExternalStore(subscribe, () => folded);

/**
 * Asks for the panel on screen, for something that stands in it: the EQ mode
 * card pinned into it is revealed with the panel folded or shut (Ivan,
 * 2026-10-06: "it needs to open the side menu if closed"). The shell answers
 * (`subscribeSoundPaneRequests`), because only the shell knows whether the
 * panel unfolds beside the page or opens over it.
 */
const paneRequests = new Set<() => void>();

export const requestSoundPane = () => {
  paneRequests.forEach((show) => show());
};

export const subscribeSoundPaneRequests = (show: () => void) => {
  paneRequests.add(show);
  return () => {
    paneRequests.delete(show);
  };
};

/** The panel's own slide, as the browser runs it: its transform's transition. */
const slidesOf = (panel: HTMLElement | null): Animation[] =>
  panel
    ?.getAnimations?.()
    .filter(
      (animation) =>
        'transitionProperty' in animation &&
        animation.transitionProperty === 'transform',
    ) ?? [];

/**
 * Whether the panel is sliding: from the moment it is told to show or hide
 * until its slide has finished, as the browser reports it — never a guess at
 * how long a slide takes.
 *
 * The column it folds from is held narrow for that long, and the panel keeps
 * a floor under it, so the page is laid out once per fold: at the start of a
 * fold, which the panel covers as it slides away, and at the end of an
 * unfold, under the panel that has slid in. The column used to ease its own
 * width, and every frame of the fold laid the page out again at a new width —
 * the graph, the bands and every pane (Ivan, 2026-09-27: "when the side pane
 * expand and collapse it is fast and not making ui to recalculate on each
 * frame").
 */
export const useSoundPaneSlide = (
  panel: RefObject<HTMLElement | null>,
  isShown: boolean,
): boolean => {
  const [seen, setSeen] = useState(isShown);
  const [isSliding, setSliding] = useState(false);
  // Set in the render that changes it, so the column is never laid out at
  // its new width for one frame before the slide is known to have begun.
  if (seen !== isShown) {
    setSeen(isShown);
    setSliding(true);
  }
  useLayoutEffect(() => {
    if (!isSliding) {
      return undefined;
    }
    // After the class change and before the paint: asking for the panel's
    // animations resolves its style, so the slide just started is among them.
    const slides = slidesOf(panel.current);
    if (slides.length === 0) {
      // No slide to wait on — reduced motion, or nothing moved.
      setSliding(false);
      return undefined;
    }
    let isCurrent = true;
    Promise.all(slides.map((slide) => slide.finished)).then(
      () => {
        if (isCurrent) {
          setSliding(false);
        }
        return undefined;
      },
      // Cancelled by the next fold, which waits on its own slide.
      () => undefined,
    );
    return () => {
      isCurrent = false;
    };
  }, [isSliding, isShown, panel]);
  return isSliding;
};

/** For tests: back to the stored choice, with no hold. */
export const resetSoundPaneForTesting = () => {
  chosen = readStoredFlag(STORAGE_KEY);
  beforeHold = undefined;
  folded = chosen;
};
