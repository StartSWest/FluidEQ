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
  lentSkyReach,
  tintThemePalette,
  type ISceneColour,
  type ISceneSky,
} from './sceneTint';
import { getThemeShade, subscribeTheme } from './theme';
import {
  THEME_SHADE_MAX,
  THEME_SHADE_MIN,
  THEME_SHADE_TOKENS,
  themeShadeTokens,
} from './themeShade';

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
 * colours, its colours with the window beating along with it
 * (`ScenePulse.tsx`) and its elements around it — Ambient — or all of that
 * with the scene itself behind the whole window, the graph still its frame:
 * the Backdrop (`SceneCover.tsx`; Ivan, 2026-09-25: "cover the app bg … as
 * the 4th option").
 */
export const SCENE_TINT_MODES = ['off', 'tint', 'pulse', 'cover'] as const;
export type TSceneTintMode = (typeof SCENE_TINT_MODES)[number];

/**
 * Whether the window beats with the scene and wears its elements: Ambient,
 * and the Backdrop, which is Ambient with the scene behind the window too.
 */
export const isAmbientMode = (mode: TSceneTintMode): boolean =>
  mode === 'pulse' || mode === 'cover';

/** Each mode's name where there is room for it: the graph button's title. */
export const SCENE_TINT_MODE_NAMES: Record<TSceneTintMode, TranslationKey> = {
  off: 'graph.sceneTint.mode.off',
  tint: 'graph.sceneTint.mode.tint',
  pulse: 'graph.sceneTint.mode.pulse',
  cover: 'graph.sceneTint.mode.cover',
};

/**
 * And in a word: the Studio's tiles, 40 pixels wide in its narrowest card,
 * and the graph's menu, on its button and over each choice.
 */
export const SCENE_TINT_MODE_SHORT_NAMES: Record<
  TSceneTintMode,
  TranslationKey
> = {
  off: 'graph.sceneTint.short.off',
  tint: 'graph.sceneTint.short.tint',
  pulse: 'graph.sceneTint.short.pulse',
  cover: 'graph.sceneTint.short.cover',
};

/** What each does to the window, in a line under its name in that menu. */
export const SCENE_TINT_MODE_ABOUT: Record<TSceneTintMode, TranslationKey> = {
  off: 'graph.sceneTint.about.off',
  tint: 'graph.sceneTint.about.tint',
  pulse: 'graph.sceneTint.about.pulse',
  cover: 'graph.sceneTint.about.cover',
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
 * The Backdrop from the start: the visualizer behind the whole window, with
 * Ambient's colours and light around it (Ivan, 2026-09-29: "when the user
 * selects a Plus viz the settings are Backdrop"; it was Ambient from
 * 2026-09-13). Choosing a Plus visualizer is choosing how the app looks, and
 * somebody who has just become a member should see everything a scene does
 * without first finding the control that turns it on; it sits beside the
 * picker for anyone who wants less. Only a profile that never chose starts
 * here — a mode picked before, or the old on/off switch, is kept. A free
 * look never wears it: the Backdrop needs a Plus visualizer to stand behind
 * the panes (`useIsBackdrop`).
 *
 * The app's mode, the graph's Window colours. The Studio has its own
 * (`useStudioTintMode`, below), and neither ever sets the other.
 */
const setting = createModeSetting(
  'fluideq.sceneTintMode',
  'fluideq.sceneTint',
  'cover',
);

export const setSceneTintMode = (next: TSceneTintMode) => setting.set(next);
export const useSceneTintMode = () =>
  useSyncExternalStore(setting.subscribe, setting.get, () => 'off' as const);
export const useSceneTintEnabled = () => useSceneTintMode() !== 'off';

/**
 * THE STUDIO'S OWN CHOICE, independent of the app's (Ivan, 2026-09-27: "the
 * studio options are independent of the global ones, you can't modify the
 * global ones ... you simply have to use the option that is in the global").
 * Theme is the app's own choice, whatever it is — the Studio then claims
 * nothing and the window is what the graph's Window colours make it; the
 * other two are the app's Colours and Ambient with the project on the bench
 * as the scene, while the bench is on screen (`useStudioTint`). Not the
 * app's Backdrop: this page has no graph for a scene to stand behind, and
 * it showed as Ambient here (Ivan, 2026-09-28: "remove backdrop option from
 * studio only").
 *
 * The tiles set the app's mode for a day (09-27, "make studio ambient use
 * same mechanism that we use on EQ and graph"), so picking Theme in the
 * Studio put the whole app on Original. A new key, starting on Theme: the
 * old `fluideq.studioTintMode` holds whatever an earlier version left there,
 * and following the app is what the Studio did all that day.
 */
export const STUDIO_TINT_MODES = ['theme', 'tint', 'pulse'] as const;
export type TStudioTintMode = (typeof STUDIO_TINT_MODES)[number];

const isStudioTintMode = (value: unknown): value is TStudioTintMode =>
  typeof value === 'string' &&
  (STUDIO_TINT_MODES as readonly string[]).includes(value);

const STUDIO_MODE_KEY = 'fluideq.studioWindowMode';
let studioMode: TStudioTintMode = (() => {
  const stored = readStored(STUDIO_MODE_KEY);
  return isStudioTintMode(stored) ? stored : 'theme';
})();
const studioModeListeners = new Set<() => void>();

export const setStudioTintMode = (next: TStudioTintMode) => {
  if (next === studioMode) {
    return;
  }
  studioMode = next;
  writeStored(STUDIO_MODE_KEY, next);
  studioModeListeners.forEach((listener) => listener());
};

const subscribeStudioMode = (listener: () => void) => {
  studioModeListeners.add(listener);
  return () => {
    studioModeListeners.delete(listener);
  };
};

export const useStudioTintMode = () =>
  useSyncExternalStore(
    subscribeStudioMode,
    () => studioMode,
    () => 'theme' as const,
  );

/** The Studio's project, while it is on the bench and the mode is not Original. */
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
 * Set by the Studio while a project is on its bench and the mode lends the
 * window a scene's colours, and cleared the moment the mode is Original, the
 * bench leaves the screen or the Studio closes. While it is set the project
 * wins over the graph's look: somebody looking at their own scene in
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

/**
 * The mode the window is in now: the Studio's own while its project holds
 * the window's colour — its bench on screen and its choice not Theme — and
 * the app's otherwise. What is drawn round the window reads this (the glow,
 * the scene's elements, the Studio's own note on them); the app's Window
 * colours menu shows and sets the app's alone.
 */
export const useWindowTintMode = (): TSceneTintMode => {
  const app = useSceneTintMode();
  const studio = useStudioTintMode();
  const source = useStudioTintSource();
  return source && studio !== 'theme' ? studio : app;
};

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
  (value.active === null || isColour(value.active)) &&
  (!('palette' in value) ||
    (Array.isArray(value.palette) && value.palette.every(isColour)));

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

/**
 * How a sky's colours meet the window's Brightness.
 *
 * - `lent`: the window's own, with no visualizer chosen (`lendSceneSky`). It
 *   fades out toward Black, which is black and grey (`lentSkyReach`).
 * - `held`: a Plus visualizer's, in Colours and Ambient. The whole slider
 *   runs over a shorter walk, from `HELD_SHADE_FLOOR` at 0 to the theme's
 *   light end at 100, evenly. Toned at the Brightness all the way down, a
 *   surface can only carry as much colour as it has light
 *   (`SURFACE_CHROMA_PER_LIGHTNESS`), and at Black the panes came out the
 *   theme's own near-black: Colours and Ambient looked switched off (Ivan,
 *   2026-09-28: "when bringing brightness down it disables the ambient or
 *   color of the visualizer … only on standard viz we do that, but on plus
 *   viz we keep the viz original color when moving the app brightness").
 *   Held at Ocean below Ocean instead, 0 was far too light ("too bright, 0
 *   needs to be darker", "just do normal, no need for keypoint").
 * - `follow`: a Plus visualizer's under the Backdrop, at the Brightness all
 *   the way: there the panes are glass over the picture, and a darker glass
 *   is what keeps their words on a bright scene.
 */
export type TSkyTone = 'lent' | 'held' | 'follow';

/** The sky the window should be in; undefined for the theme as it is. */
let wanted: ISceneSky | undefined;
let wantedTone: TSkyTone = 'follow';

/**
 * Where a held sky's 0 stands on the theme's walk: the darkest shade at which
 * a scene's colour still reads on the panes as the scene's rather than as
 * black. Chosen on panes toned from Aurora's, Alpine's and Neon City's
 * measured skies at 0, 15, 25, 35, 45 and 75: Aurora's pane is #001309 at 0,
 * which reads as black beside Black's own #0c0e12, and a plain dark green,
 * #001d11 to #002014, from 25 to 35.
 */
const HELD_SHADE_FLOOR = 30;

/** The theme's shade a sky of `tone` is toned against, at `shade`. */
const toneShadeOf = (tone: TSkyTone, shade: number) =>
  tone === 'held'
    ? Math.round(
        HELD_SHADE_FLOOR +
          ((shade - THEME_SHADE_MIN) / (THEME_SHADE_MAX - THEME_SHADE_MIN)) *
            (THEME_SHADE_MAX - HELD_SHADE_FLOOR),
      )
    : shade;

/**
 * What the root carries now, and the theme's shade it was toned against.
 *
 * A visualizer's colours stand at exactly the theme's lightness for the
 * shade they are toned against, with the scene's hue: the window's
 * Brightness is one slider for every mode and for the Studio too, since it
 * is the theme's (Ivan, 2026-09-25: "in total I want only two options
 * brightness and transparency"), and at 100% Original and Colours are as
 * light as each other (2026-09-26: "when I choose tema is darker than when I
 * choose colores … with same 100% brightness"); below it a held sky stands
 * lighter, so its colour survives (`TSkyTone`). They used to be lifted past
 * the theme by a lift of their own, which is now the theme's light end
 * (`themeShade.ts`).
 */
let painted: { sky: ISceneSky | undefined; tone: TSkyTone; shade: number } = {
  sky: undefined,
  tone: 'follow',
  shade: getThemeShade(),
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
 * The theme's own values for the tinted tokens at `shade`.
 *
 * Every one the Brightness slider moves is worked out, not read: the slider
 * is `themeShadeTokens`, a table walked in OKLab, and the same table gives
 * the theme's value for any shade straight away. They used to be read off
 * the root, which meant lifting the tint's overrides — they are what the
 * computed style would otherwise answer — reading, and putting them back:
 * a whole style pass of the window of its own, on every step of a Brightness
 * drag with a tint on, which with Rainbow mode on by default is always.
 * Measured on the window's 1,300 elements, that was one of the three style
 * passes a step cost, and the slider moved at 20 frames a second.
 *
 * The rest (`--active`) no shade changes, so it is read once, the same way.
 * A stylesheet edited under a running development window is not seen here
 * until it reloads.
 */
const SHADE_TOKENS: ReadonlySet<string> = new Set(THEME_SHADE_TOKENS);
let fixedBase: Record<string, string> | undefined;

const readFixedBase = () => {
  if (fixedBase) {
    return fixedBase;
  }
  const root = document.documentElement;
  const fixed = SCENE_TINT_TOKENS.filter((token) => !SHADE_TOKENS.has(token));
  const held = fixed.map(
    (token) => [token, root.style.getPropertyValue(token)] as const,
  );
  held.forEach(([token]) => root.style.removeProperty(token));
  const computed = getComputedStyle(root);
  fixedBase = Object.fromEntries(
    fixed.map((token) => [token, computed.getPropertyValue(token).trim()]),
  );
  held.forEach(([token, value]) => {
    if (value) {
      root.style.setProperty(token, value);
    }
  });
  return fixedBase;
};

let themeBase: { shade: number; values: Record<string, string> } | undefined;

const readThemeBase = (shade: number) => {
  if (themeBase?.shade !== shade) {
    themeBase = {
      shade,
      values: { ...readFixedBase(), ...themeShadeTokens(shade) },
    };
  }
  return themeBase.values;
};

/**
 * The root, repainted to whatever is wanted at the moment it runs — never to
 * what was wanted when a fade was asked for. A fade's update waits for the
 * old frame to be captured, and a change that lands at once in between would
 * otherwise be painted over by the older one.
 */
const paint = () => {
  const { style } = document.documentElement;
  const shade = toneShadeOf(wantedTone, getThemeShade());
  const reach = wantedTone === 'lent' ? lentSkyReach(shade) : 1;
  // A lent sky at Black lends nothing, so the window is the theme's own there
  // — the knobs, the wave and the meter included, which take a scene's
  // colours only while `data-scene-tint` says one is lent.
  const palette =
    wanted && reach > 0
      ? tintThemePalette(readThemeBase(shade), wanted, reach)
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
  painted = { sky: wanted, tone: wantedTone, shade };
};

const needsPaint = () =>
  !sameSky(painted.sky, wanted) ||
  painted.tone !== wantedTone ||
  (wanted !== undefined &&
    painted.shade !== toneShadeOf(wantedTone, getThemeShade()));

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
const showSky = (sky: ISceneSky | undefined, tone: TSkyTone, fade: boolean) => {
  if (!sameSky(sky, wanted) || tone !== wantedTone) {
    wanted = sky;
    wantedTone = tone;
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

/**
 * A visualizer's own sky: `held` in Colours and Ambient, `follow` under the
 * Backdrop (`TSkyTone`).
 */
export const showSceneSky = (
  sky: ISceneSky | undefined,
  fade: boolean,
  tone: Exclude<TSkyTone, 'lent'> = 'follow',
) => showSky(sky, tone, fade);

/**
 * Lend the window `sky` as its own, with no visualizer chosen: toned like a
 * visualizer's, except that it fades out toward Black (`lentSkyReach`).
 */
export const lendSceneSky = (sky: ISceneSky, fade: boolean) =>
  showSky(sky, 'lent', fade);

/**
 * A Brightness move lands at once, in the same task as the theme's own rule:
 * the slider moves under the pointer, and a cross-fade on every step would be
 * the window lagging behind it. Mid-fade it waits for the fade, which
 * repaints to whatever is wanted when it ends.
 *
 * Not deferred to the next frame. Deferred, the theme's rule changed in the
 * input event and the tint's overrides in a frame callback queued behind
 * every drawing's own — and the drawings read the root's colours in between,
 * so each step of a drag paid for the window's whole style twice (1,300
 * elements, measured). Written together, the next read or frame pays once;
 * two steps landing in one frame cost two sets of property writes, which
 * restyle nothing until something reads.
 */
const repaintShade = () => {
  if (!fading && needsPaint()) {
    paint();
  }
};
subscribeTheme(repaintShade);

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
