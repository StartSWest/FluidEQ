/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import { useSyncExternalStore } from 'react';
import type { TranslationKey } from 'common/i18n';
import type { IScenePack } from 'common/scenePacks';
import { readStored, writeStored } from './graphStorage';
import {
  SCENE_SKY_MEASUREMENT,
  SCENE_TINT_TOKENS,
  tintThemePalette,
  type ISceneColour,
  type ISceneSky,
} from './sceneTint';
import { getTheme, type TTheme } from './theme';

/**
 * The window in a Plus visualizer's colour: the switch, what each scene's sky
 * was measured to be, and the one place the root is repainted from.
 *
 * THE TINT IS AN OVERRIDE, NEVER A THEME. It is written inline on the root
 * element, above whichever theme is chosen, and toned from that theme's own
 * values — so Black tinted violet is a violet-black and Ocean tinted violet a
 * violet slate, the theme picker still means what it says, and switching the
 * tint off is removing the overrides, after which the stylesheet is exactly
 * what it was.
 */

// *** The modes ***************************************************************

/**
 * What a scene does to the window: nothing — the theme as it is — its
 * colours, or its colours with the window beating along with it
 * (`ScenePulse.tsx`).
 */
export const SCENE_TINT_MODES = ['off', 'tint', 'pulse'] as const;
export type TSceneTintMode = (typeof SCENE_TINT_MODES)[number];

/** Each mode's name where there is room for it: the graph button's title. */
export const SCENE_TINT_MODE_NAMES: Record<TSceneTintMode, TranslationKey> = {
  off: 'graph.sceneTint.mode.off',
  tint: 'graph.sceneTint.mode.tint',
  pulse: 'graph.sceneTint.mode.pulse',
};

/** And in a word, for the Studio's tiles, 40 pixels wide in its narrowest card. */
export const SCENE_TINT_MODE_SHORT_NAMES: Record<
  TSceneTintMode,
  TranslationKey
> = {
  off: 'graph.sceneTint.short.off',
  tint: 'graph.sceneTint.short.tint',
  pulse: 'graph.sceneTint.short.pulse',
};

const isSceneTintMode = (value: unknown): value is TSceneTintMode =>
  typeof value === 'string' &&
  (SCENE_TINT_MODES as readonly string[]).includes(value);

/**
 * A remembered mode. It replaced an on/off switch kept under `legacyKey`, and
 * somebody who had turned that off keeps the theme, somebody who had it on
 * keeps the colours: the new mode starts as the old switch left it.
 */
const createModeSetting = (
  key: string,
  legacyKey: string,
  fallback: TSceneTintMode,
) => {
  const stored = readStored(key);
  const legacy = readStored(legacyKey);
  let value: TSceneTintMode = fallback;
  if (isSceneTintMode(stored)) {
    value = stored;
  } else if (legacy !== null) {
    value = legacy === 'true' ? 'tint' : 'off';
  }
  const modeListeners = new Set<() => void>();
  return {
    get: () => value,
    set: (next: TSceneTintMode) => {
      if (next === value) {
        return;
      }
      value = next;
      writeStored(key, next);
      modeListeners.forEach((listener) => listener());
    },
    subscribe: (listener: () => void) => {
      modeListeners.add(listener);
      return () => {
        modeListeners.delete(listener);
      };
    },
  };
};

/**
 * The colours from the start. Choosing a Plus visualizer is choosing how the
 * app looks, and the window taking its colour is the payoff of that choice
 * rather than a surprise; the control sits beside the picker for anyone who
 * wants the theme left alone, or wants more. The Studio's below is the
 * opposite, and says why.
 */
const setting = createModeSetting(
  'fluideq.sceneTintMode',
  'fluideq.sceneTint',
  'tint',
);

export const setSceneTintMode = (next: TSceneTintMode) => setting.set(next);
export const useSceneTintMode = () =>
  useSyncExternalStore(setting.subscribe, setting.get, () => 'off' as const);
export const useSceneTintEnabled = () => useSceneTintMode() !== 'off';

// *** The Studio's own mode ***************************************************

/**
 * The Studio has a mode of its own, apart from the graph's, because the two
 * answer different questions: the graph's is how somebody wants their app to
 * look, the Studio's is a way of judging a scene that is not finished — and a
 * member who wants the second has not necessarily asked for the first.
 *
 * The theme until chosen. A scene half made changes colour with every save,
 * and a window repainting itself while somebody reads the code pane is only
 * welcome when they asked for it.
 */
const studioSetting = createModeSetting(
  'fluideq.studioTintMode',
  'fluideq.studioTint',
  'off',
);

export const setStudioTintMode = (next: TSceneTintMode) =>
  studioSetting.set(next);
export const useStudioTintMode = () =>
  useSyncExternalStore(
    studioSetting.subscribe,
    studioSetting.get,
    () => 'off' as const,
  );
export const useStudioTintEnabled = () => useStudioTintMode() !== 'off';

/** The Studio's project, while it is on the bench with the switch on. */
export interface IStudioTintSource {
  project: string;
  /**
   * The build playing on the stage — a new save is a new build — with its
   * pack. Absent while the project is still loading or cannot play: the
   * Studio still owns the window's colour then, it just has nothing new to
   * measure.
   */
  playing?: { build: string; pack: IScenePack };
}

let studioSource: IStudioTintSource | undefined;
const studioListeners = new Set<() => void>();

/** Where a Studio project's colour is remembered, beside the graph's looks. */
export const studioSkyKey = (project: string) => `studio:${project}`;

/**
 * Set by the Studio while a project is on its bench with the switch on, and
 * cleared the moment the switch goes off or the Studio closes. While it is
 * set it wins over the graph's choice: somebody looking at their own scene in
 * the Studio is judging that one, whatever the graph happens to be showing —
 * and moving to another project must not pass through the graph's colour on
 * the way.
 */
export const setStudioTintSource = (next: IStudioTintSource | undefined) => {
  if (
    next?.project === studioSource?.project &&
    next?.playing?.build === studioSource?.playing?.build &&
    next?.playing?.pack === studioSource?.playing?.pack
  ) {
    return;
  }
  studioSource = next;
  studioListeners.forEach((listener) => listener());
};

const subscribeStudio = (listener: () => void) => {
  studioListeners.add(listener);
  return () => {
    studioListeners.delete(listener);
  };
};

export const useStudioTintSource = () =>
  useSyncExternalStore(
    subscribeStudio,
    () => studioSource,
    () => undefined,
  );

// *** What each scene's sky was measured to be ********************************

const SKIES_KEY = 'fluideq.sceneTint.skies';
/**
 * Every Plus look and a Studio's worth of member scenes. Past this the one
 * measured longest ago is forgotten; measuring it again is a second of GPU
 * work the next time it is chosen.
 */
const MAX_REMEMBERED_SKIES = 64;

export interface IRememberedSky {
  /** The scene version it was measured from. */
  version: string;
  /** Null for a scene measured and found to have no colour to lend. */
  sky: ISceneSky | null;
}

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const isColour = (value: unknown): value is ISceneColour =>
  typeof value === 'object' &&
  value !== null &&
  'lightness' in value &&
  isFiniteNumber(value.lightness) &&
  'chroma' in value &&
  isFiniteNumber(value.chroma) &&
  'hue' in value &&
  isFiniteNumber(value.hue) &&
  'share' in value &&
  isFiniteNumber(value.share);

const isSky = (value: unknown): value is ISceneSky =>
  isColour(value) &&
  'accent' in value &&
  (value.accent === null || isColour(value.accent)) &&
  'active' in value &&
  (value.active === null || isColour(value.active));

/**
 * Stored as `{ measurement, rows }`, the rows `[lookId, version, sky]` oldest
 * first, so the order that decides what is forgotten survives a restart.
 *
 * Skies measured under any other `SCENE_SKY_MEASUREMENT` are all dropped.
 * They are keyed by the scene's version, so without it a scene measured once
 * would keep that answer through every later change to how it is measured —
 * which is exactly what happened to the first cut of the accent, whose
 * answers outlived the fix to it in a running window.
 */
const readSkies = (): Map<string, IRememberedSky> => {
  const skies = new Map<string, IRememberedSky>();
  const stored = readStored(SKIES_KEY);
  if (stored === null) {
    return skies;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(stored);
  } catch {
    // A damaged entry costs one measurement per scene, not the switch.
    return skies;
  }
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('measurement' in parsed) ||
    parsed.measurement !== SCENE_SKY_MEASUREMENT ||
    !('rows' in parsed) ||
    !Array.isArray(parsed.rows)
  ) {
    return skies;
  }
  parsed.rows.forEach((row: unknown) => {
    if (
      Array.isArray(row) &&
      row.length === 3 &&
      typeof row[0] === 'string' &&
      typeof row[1] === 'string' &&
      (row[2] === null || isSky(row[2]))
    ) {
      skies.set(row[0], { version: row[1], sky: row[2] });
    }
  });
  return skies;
};

let skies: Map<string, IRememberedSky> | undefined;
const skyListeners = new Set<() => void>();

const rememberedSkies = () => {
  skies ??= readSkies();
  return skies;
};

export const recallSceneSky = (lookId: string): IRememberedSky | undefined =>
  rememberedSkies().get(lookId);

export const rememberSceneSky = (
  lookId: string,
  version: string,
  sky: ISceneSky | null,
) => {
  const all = rememberedSkies();
  // Deleted first so it moves to the newest end of the order.
  all.delete(lookId);
  all.set(lookId, { version, sky });
  [...all.keys()]
    .slice(0, Math.max(0, all.size - MAX_REMEMBERED_SKIES))
    .forEach((stale) => all.delete(stale));
  writeStored(
    SKIES_KEY,
    JSON.stringify({
      measurement: SCENE_SKY_MEASUREMENT,
      rows: [...all].map(([id, entry]) => [id, entry.version, entry.sky]),
    }),
  );
  skyListeners.forEach((listener) => listener());
};

const subscribeSkies = (listener: () => void) => {
  skyListeners.add(listener);
  return () => {
    skyListeners.delete(listener);
  };
};

/**
 * `lookId`'s remembered sky, kept up to date: the graph paints it behind a
 * scene that is still loading, and the first time a scene is chosen its
 * measurement usually lands before the graph's own first frame does.
 */
export const useRememberedSceneSky = (lookId: string) =>
  useSyncExternalStore(
    subscribeSkies,
    () => recallSceneSky(lookId)?.sky ?? undefined,
    () => undefined,
  );

// *** Painting ****************************************************************

/** The sky the window should be in; undefined for the theme as it is. */
let wanted: ISceneSky | undefined;
/** What the root carries now, and the theme it was toned against. */
let painted: { sky: ISceneSky | undefined; theme: TTheme } = {
  sky: undefined,
  theme: getTheme(),
};
const wantedListeners = new Set<() => void>();

const SCENE_TINT_TRANSITION = 'scene-tint';

const sameColour = (left: ISceneColour | null, right: ISceneColour | null) =>
  left === right ||
  (left !== null &&
    right !== null &&
    left.hue === right.hue &&
    left.chroma === right.chroma &&
    left.lightness === right.lightness &&
    left.share === right.share);

const sameSky = (left?: ISceneSky, right?: ISceneSky) =>
  left === right ||
  (left !== undefined &&
    right !== undefined &&
    sameColour(left, right) &&
    sameColour(left.accent, right.accent) &&
    sameColour(left.active, right.active));

/**
 * The theme's own values for the tinted tokens, read once per theme.
 *
 * Reading them means lifting the overrides first — they are what the computed
 * style would otherwise answer — and that is a whole style pass of its own on
 * top of the one the new colours cost. Read on every change, both passes
 * landed on the first frame of the fade. A stylesheet edited under a running
 * development window is not seen here until the theme changes or it reloads.
 */
let themeBase: { theme: TTheme; values: Record<string, string> } | undefined;

const readThemeBase = (theme: TTheme) => {
  if (themeBase?.theme === theme) {
    return themeBase.values;
  }
  const root = document.documentElement;
  const held = SCENE_TINT_TOKENS.map(
    (token) => [token, root.style.getPropertyValue(token)] as const,
  );
  held.forEach(([token]) => root.style.removeProperty(token));
  const computed = getComputedStyle(root);
  const values = Object.fromEntries(
    SCENE_TINT_TOKENS.map((token) => [
      token,
      computed.getPropertyValue(token).trim(),
    ]),
  );
  held.forEach(([token, value]) => {
    if (value) {
      root.style.setProperty(token, value);
    }
  });
  themeBase = { theme, values };
  return values;
};

/**
 * The root, repainted to whatever is wanted at the moment it runs — never to
 * what was wanted when a fade was asked for. A fade's update waits for the
 * old frame to be captured, and a change that lands at once in between would
 * otherwise be painted over by the older one.
 */
const paint = () => {
  const { style } = document.documentElement;
  const theme = getTheme();
  const palette = wanted
    ? tintThemePalette(readThemeBase(theme), wanted)
    : undefined;
  SCENE_TINT_TOKENS.forEach((token) => {
    const value = palette?.[token];
    if (value) {
      style.setProperty(token, value);
    } else {
      style.removeProperty(token);
    }
  });
  // For what keeps a resting look of its own and takes the scene's only while
  // it is lent — the knobs, the titlebar wave, the level meter — without each
  // of them guessing from the tokens.
  document.documentElement.toggleAttribute(
    'data-scene-tint',
    palette !== undefined,
  );
  painted = { sky: wanted, theme };
};

const needsPaint = () =>
  !sameSky(painted.sky, wanted) ||
  (wanted !== undefined && painted.theme !== getTheme());

/**
 * Whether the change can cross-fade.
 *
 * As one captured frame fading into the live window on the compositor, never
 * as the colours stepped from script: a custom property on the root is
 * inherited by every element, and measured in this window writing the tinted
 * colours on every frame dropped one frame in ten — the fade itself stuttering
 * with them. A cross-fade drops frames for the page's own drawing when the
 * machine is busy, but the fade does not wait on those frames to move.
 *
 * At once when motion is turned down, when the window is hidden and nothing
 * would be captured, and while a film is on the video tab: it plays in a guest
 * page drawn by another process, and a capture that misses it would blink the
 * film out for the length of the fade.
 */
const canFade = () =>
  'startViewTransition' in document &&
  !document.hidden &&
  !window.matchMedia('(prefers-reduced-motion: reduce)').matches &&
  document.querySelector('webview') === null;

/** The fade on screen, while there is one. */
let fading: ViewTransition | undefined;

/**
 * One fade at a time, each to whatever is wanted when it starts.
 *
 * Starting a view transition while another runs does not queue the new one:
 * the running one skips to its end, which on screen is the window jumping to
 * a colour it was halfway toward. That happened every time two changes came
 * close together — a Studio save landing mid-fade, the auto-cycle moving on.
 * A change during a fade therefore waits for that fade to finish and then
 * fades on from where it landed.
 */
const fadeToWanted = () => {
  if (fading || !needsPaint()) {
    return;
  }
  if (!canFade()) {
    paint();
    return;
  }
  const transition = document.startViewTransition({
    update: paint,
    types: [SCENE_TINT_TRANSITION],
  });
  fading = transition;
  // Rejected when the window refuses the animation — hidden the instant it
  // was asked for — and the update then paints without one.
  transition.ready.catch(() => undefined);
  const fadeOnward = () => {
    fading = undefined;
    fadeToWanted();
  };
  transition.finished.then(fadeOnward, fadeOnward);
};

/**
 * Put the window in `sky`'s colour, or back in the theme's own for undefined.
 * `fade` cross-fades when the window can; the first paint of a launch should
 * not, since there is no earlier colour to fade from.
 */
export const showSceneSky = (sky: ISceneSky | undefined, fade: boolean) => {
  if (!sameSky(sky, wanted)) {
    wanted = sky;
    wantedListeners.forEach((listener) => listener());
  }
  if (!needsPaint()) {
    return;
  }
  if (fade) {
    fadeToWanted();
  } else {
    paint();
  }
};

const subscribeWanted = (listener: () => void) => {
  wantedListeners.add(listener);
  return () => {
    wantedListeners.delete(listener);
  };
};

/** The sky the window is in or on its way to, for the switch's swatch. */
export const useShownSceneSky = () =>
  useSyncExternalStore(
    subscribeWanted,
    () => wanted,
    () => undefined,
  );
