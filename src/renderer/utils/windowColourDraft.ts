/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useMemo, useSyncExternalStore } from 'react';
import type { ISceneWindowColours } from 'common/sceneWindowColours';
import {
  withChosenStop,
  type TSceneStopColours,
  type TWindowColourStop,
} from './sceneDayColours';

/**
 * THE COLOUR BEING PICKED, ON THE WHOLE WINDOW (Ivan, 2026-11-18: "I want
 * when the color is chosen to change the app so I can see it right there and
 * accept it or cancel it"). While a window colour editor's picker moves, the
 * set it shows for the open point stands here, and the window wears it at
 * that point as if it were chosen (`SceneTint`, `RainbowSource`); Accept
 * writes it where it is kept, Cancel puts the set it opened with back, and
 * either lets this go. Pressing a point moves the hour onto it
 * (`useEditedStop`), so what the window shows is that point's colours.
 *
 * `owner` says whose colours they are - a graph look's id, or the Studio's
 * project (`studioDraftOwner`) - so a draft for one scene never paints
 * another.
 */

export interface IWindowColourDraft {
  owner: string;
  stop: TWindowColourStop;
  colours: ISceneWindowColours;
}

let draft: IWindowColourDraft | undefined;
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const announce = () => listeners.forEach((listener) => listener());

/** The Studio project `project`'s colours, as a draft's owner. */
export const studioDraftOwner = (project: string) => `studio:${project}`;

/** Shows `colours` at `stop` on the whole window, for `owner`'s scene. */
export const showWindowColourDraft = (next: IWindowColourDraft) => {
  if (
    draft?.owner === next.owner &&
    draft.stop === next.stop &&
    draft.colours.surface === next.colours.surface &&
    draft.colours.accent === next.colours.accent &&
    draft.colours.glow === next.colours.glow
  ) {
    return;
  }
  draft = next;
  announce();
};

/** Lets `owner`'s draft go, if it is still the one shown. */
export const dropWindowColourDraft = (owner: string) => {
  if (draft?.owner === owner) {
    draft = undefined;
    announce();
  }
};

/** The draft on the window now, whoever's it is. */
export const useWindowColourDraft = () =>
  useSyncExternalStore(
    subscribe,
    () => draft,
    () => undefined,
  );

/** `sides` with `owner`'s draft standing in at its point, if there is one. */
export const useDraftedSides = (
  owner: string,
  sides: TSceneStopColours,
): TSceneStopColours => {
  const current = useWindowColourDraft();
  return useMemo(
    () =>
      owner && current?.owner === owner
        ? withChosenStop(sides, current.stop, current.colours)
        : sides,
    [owner, current, sides],
  );
};

/** For tests: nothing drafted. */
export const resetWindowColourDraftForTesting = () => {
  draft = undefined;
};
