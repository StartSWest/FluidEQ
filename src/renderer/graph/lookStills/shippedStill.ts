/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useMemo, useSyncExternalStore } from 'react';
import type { IResolvedLook } from 'common/customLooks';
import { subscribeRoot } from '../../utils/theme';
import { subscribeWindowSide } from '../../utils/windowSide';
import { getWindowTintSecondary } from '../../utils/windowTint';
import SHIPPED_STILL_FILES from './shippedStillFiles';
import {
  readStillRoles,
  stillColours,
  stillSide,
  type TStillColours,
  type TStillSide,
} from './stillRoles';

/**
 * The look picker's shipped stills (`stillRoles.ts`): which one a standard
 * look shows in the window's colours now, and the colours its layers are
 * filled with.
 */

/** One shipped still: its layers' picture and the roles they are, in order. */
export interface IShippedStillFile {
  url: string;
  roles: readonly string[];
}

export const shippedStillKey = (
  style: string,
  palette: string,
  side: TStillSide,
  colours: TStillColours,
) => `${style} ${palette} ${side} ${colours}`;

/** What a still has to be painted in: the window as the looks would see it. */
export interface IStillWindow {
  side: TStillSide;
  colours: TStillColours;
  /** Each role's colour (`readStillRoles`). */
  roles: Readonly<Record<string, string>>;
}

let known: IStillWindow | undefined;
let knownKey = '';
let readFor = '';

/**
 * Everything the window's colours can change with, read without asking for
 * a style (as `rootStateOf` in `theme.ts`): the root's inline style, where
 * the stops and a scene's tint are written, its class and shade, the side,
 * the Tint's second colour, the stylesheets.
 */
const windowStateKey = (): string => {
  const root = document.documentElement;
  return `${root.getAttribute('style') ?? ''}|${root.className}|${
    root.getAttribute('data-theme-shade') ?? ''
  }|${stillSide()}|${getWindowTintSecondary() ?? ''}|${
    document.styleSheets.length
  }`;
};

/**
 * The window now, as one object for as long as nothing in it changes, so
 * every tile shares it and re-renders only when a colour does. Worked out
 * once per change of the window, however many tiles ask.
 */
const readStillWindow = (): IStillWindow => {
  const state = windowStateKey();
  if (known && state === readFor) {
    return known;
  }
  readFor = state;
  const side = stillSide();
  const colours = stillColours();
  const roles = readStillRoles(colours);
  const key = `${side}|${colours}|${Object.entries(roles)
    .map(([name, colour]) => `${name}=${colour}`)
    .join(',')}`;
  if (!known || key !== knownKey) {
    known = { side, colours, roles };
    knownKey = key;
  }
  return known;
};

/**
 * Which set of stills the window takes - its side, and one colour or many -
 * without the colours themselves: for what only fetches the pictures, so it
 * is not drawn again at every step of a colour's fade.
 */
const readStillKind = (): string => `${stillSide()} ${stillColours()}`;

/**
 * Every change of the window's colours: the accent, the Tint's stops
 * (written on `:root`, `rainbowPalette.ts`), the Brightness and a scene's
 * tint all change an attribute of the root, which is what `subscribeRoot`
 * hears; the side of the Brightness is told as well, the moment it turns.
 */
const subscribeStillWindow = (listener: () => void) => {
  const leaveRoot = subscribeRoot(listener);
  const leaveSide = subscribeWindowSide(listener);
  return () => {
    leaveRoot();
    leaveSide();
  };
};

export const useStillWindow = (): IStillWindow =>
  useSyncExternalStore(subscribeStillWindow, readStillWindow, readStillWindow);

/** `readStillKind`, followed: the side and the colours' count, as one word. */
export const useStillKind = (): Pick<IStillWindow, 'side' | 'colours'> => {
  const kind = useSyncExternalStore(
    subscribeStillWindow,
    readStillKind,
    readStillKind,
  );
  const [side, colours] = kind.split(' ') as [TStillSide, TStillColours];
  return useMemo(() => ({ side, colours }), [side, colours]);
};

/**
 * A standard look's shipped still for a window on `painted`'s side, in one
 * colour or many, or undefined for a look the generator never drew: one the
 * member made or coloured, or a palette nobody ships.
 */
export const shippedStillOf = (
  look: IResolvedLook,
  painted: Pick<IStillWindow, 'side' | 'colours'>,
): IShippedStillFile | undefined =>
  look.isCustom || look.colours.length > 0
    ? undefined
    : SHIPPED_STILL_FILES[
        shippedStillKey(look.style, look.palette, painted.side, painted.colours)
      ];
