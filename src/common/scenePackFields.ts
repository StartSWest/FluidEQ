/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { GRAPH_STYLES, type GraphStyle } from './graphStyles';
import type { LocaleCode } from './i18n';
import { readPaletteValue, type IScenePaletteValue } from './scenePalette';
import { readShowWhen, type TShowWhen } from './sceneShowWhen';
import { COLOUR_TYPE, readColourValue } from './sceneColourControl';
import {
  choiceIndex,
  isChoiceEntry,
  readChoiceLook,
  type TChoiceIcon,
  MAX_CHOICE_NAME_LENGTH,
  MAX_CHOICE_OPTIONS,
  MIN_CHOICE_OPTIONS,
} from './sceneChoice';

/**
 * A scene pack's fields one at a time (`scenePacks.ts` reads the pack):
 * each bounded, each dropped rather than refused where this version cannot
 * use it, so a pack from a newer FluidEQ still plays here.
 */

/**
 * Bounds on what the driver is asked to compile.
 *
 * This was 64 KB, on the belief that compile time is superlinear in source
 * length. Measured on 2026-09-17, against Alpine through ANGLE on this
 * machine, that belief is wrong: 51 KB compiled in 11.32 s and the same scene
 * at 64 KB in 11.29 s — a quarter more text, no change at all. What actually
 * cost the time was seven CALL SITES of two big functions, because a driver
 * compiles a fresh copy of a body at each one: calling each once took the
 * same scene to 4.7 s, and with both removed it was 1.2 s.
 *
 * So length is a poor proxy and the old number mostly stopped authors being
 * ambitious. A quarter of a megabyte still bounds what a compromised server
 * could hand the GPU, which is the one thing a size cap is good for; what a
 * scene actually costs is held by the loop and pixel-work rules in
 * `memberSceneRules.ts`, which measure the work rather than the letters.
 */
export const MAX_SHADER_BYTES = 256 * 1024;
export const MAX_SCENE_PARAMS = 8;
/** The furthest a control's range may reach either side of zero. */
export const MAX_PARAM_MAGNITUDE = 1e6;
export const SCENE_PARAM_ID = /^[a-z][a-z0-9_]{0,23}$/;
export const MAX_SWATCH_COLOURS = 4;

/** English is mandatory: a row in the picker with no name is unusable. */
export type TLocalizedName = Partial<Record<LocaleCode, string>> & {
  en: string;
};

export interface IScenePackParam {
  /** Uniform suffix: the preamble declares `uniform float uParam_<id>`. */
  id: string;
  names: TLocalizedName;
  min: number;
  max: number;
  value: number;
  /**
   * A choice's options in order (contract 9, `sceneChoice.ts`): then `min`
   * is 0, `max` one less than their number and `value` the chosen one's.
   * Absent for a slider.
   */
  options?: readonly ISceneChoiceOption[];
  /**
   * Shown in the Studio only while the choices it names stand on one of the
   * listed options (`sceneShowWhen.ts`). Absent is always shown.
   */
  showWhen?: TShowWhen;
}

/** One option of a choice: its name, and what it wears beside it. */
export interface ISceneChoiceOption {
  names: TLocalizedName;
  /** One of FluidEQ's own pictures (`CHOICE_ICONS`). */
  icon?: TChoiceIcon;
  /** A chip of one to four colours. */
  swatch?: readonly string[];
}

export const PACK_ID = /^[a-z][a-z0-9-]{1,47}$/;
const HEX_COLOUR = /^#[0-9a-f]{6}$/i;
/** The one thing every pack must provide, at the top level of the source. */
const SCENE_ENTRY_POINT = /\bvec4\s+sceneColour\s*\(\s*vec2\s+\w+\s*\)/;

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export const readNumber = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

/**
 * A key that could be a language. Anything else is not a name in a language
 * nobody has: it is weight.
 *
 * Without it a pack could carry as many names as its file allowed — measured,
 * 120,001 of them were accepted, six megabytes that every listing then
 * stringified for its revision hash and handed to the window. The ambient
 * elements' own controls already keep exactly this rule.
 */
// Keep the finite name-key bound while admitting the shipped Chinese script.
const LOCALE = /^(?:[a-z]{2}|zh-Hant)$/;

/**
 * The name in each language. English is required; the rest are taken where
 * they are usable and dropped where they are not, so a pack that names a
 * language this version has not heard of keeps every other name it has.
 */
export const readNames = (value: unknown): TLocalizedName | null => {
  if (!isRecord(value) || typeof value.en !== 'string' || !value.en.trim()) {
    return null;
  }
  const names: Record<string, string> = {};
  Object.entries(value).forEach(([locale, name]) => {
    if (
      LOCALE.test(locale) &&
      typeof name === 'string' &&
      name.trim() &&
      name.length <= 80
    ) {
      names[locale] = name.trim();
    }
  });
  // Asked again once the length rule has run: an English name over eighty
  // characters passed the check above, was dropped by the loop, and the pack
  // came back with no English name — shown blank in every language that has
  // no name of its own.
  if (!names.en) {
    return null;
  }
  return names as TLocalizedName;
};

export const readParam = (value: unknown): IScenePackParam | null => {
  if (!isRecord(value) || typeof value.id !== 'string') {
    return null;
  }
  // A control of another kind - a palette (`scenePalette.ts`), or one a
  // newer FluidEQ added - is not a slider, and read as one it would be a
  // slider that moves nothing. A choice is a slider's uniform with names.
  if (
    value.type !== undefined &&
    value.type !== 'slider' &&
    !isChoiceEntry(value)
  ) {
    return null;
  }
  if (!SCENE_PARAM_ID.test(value.id)) {
    return null;
  }
  const names = readNames(value.names);
  if (!names) {
    return null;
  }
  if (isChoiceEntry(value)) {
    // The options that have a name, up to eight: one this version cannot
    // name is left out, and fewer than two is no choice.
    const options = (Array.isArray(value.options) ? value.options : [])
      .map((option: unknown): ISceneChoiceOption | null => {
        const named = isRecord(option) ? readNames(option.names) : null;
        if (!named) {
          return null;
        }
        return {
          names: Object.fromEntries(
            Object.entries(named).map(([locale, name]) => [
              locale,
              name.slice(0, MAX_CHOICE_NAME_LENGTH),
            ]),
          ) as TLocalizedName,
          ...readChoiceLook(option),
        };
      })
      .filter((option): option is ISceneChoiceOption => option !== null)
      .slice(0, MAX_CHOICE_OPTIONS);
    const rule = readShowWhen(value.showWhen);
    if (options.length < MIN_CHOICE_OPTIONS) {
      return null;
    }
    return {
      id: value.id,
      names,
      min: 0,
      max: options.length - 1,
      value: choiceIndex(value.value, options.length),
      options,
      ...(rule ? { showWhen: rule } : {}),
    };
  }
  // A range written the wrong way round is still the author's range, and a
  // bound past a million is no slider anyone can move: beyond it the track's
  // span overflowed to Infinity and every position on it read as NaN.
  const first = clamp(
    readNumber(value.min, 0),
    -MAX_PARAM_MAGNITUDE,
    MAX_PARAM_MAGNITUDE,
  );
  const second = clamp(
    readNumber(value.max, 1),
    -MAX_PARAM_MAGNITUDE,
    MAX_PARAM_MAGNITUDE,
  );
  const min = Math.min(first, second);
  const max = Math.max(first, second);
  const shown = readShowWhen(value.showWhen);
  return {
    id: value.id,
    names,
    min,
    max,
    value: clamp(readNumber(value.value, min), min, max),
    ...(shown ? { showWhen: shown } : {}),
  };
};

/** A palette among `params` (contract 9, `scenePalette.ts`). */
export interface IScenePackPalette extends IScenePaletteValue {
  /** Uniform suffix: the preamble declares `uniform sampler2D uPalette_<id>`. */
  id: string;
  names: TLocalizedName;
  /** Shown only while these choices stand as listed (`sceneShowWhen.ts`). */
  showWhen?: TShowWhen;
}

/** A single colour among `params` (contract 9, `sceneColourControl.ts`). */
export interface IScenePackColour {
  /** Uniform suffix: the preamble declares `uniform vec3 uColour_<id>`. */
  id: string;
  names: TLocalizedName;
  /** `#rrggbb`, lower case, as the member picked it. */
  value: string;
  showWhen?: TShowWhen;
}

/** A single colour declared in `params`, or `null`. */
export const readColourControl = (value: unknown): IScenePackColour | null => {
  if (!isRecord(value) || value.type !== COLOUR_TYPE) {
    return null;
  }
  if (typeof value.id !== 'string' || !SCENE_PARAM_ID.test(value.id)) {
    return null;
  }
  const names = readNames(value.names);
  const colour = readColourValue(value.value);
  if (!names || !colour) {
    return null;
  }
  const rule = readShowWhen(value.showWhen);
  return {
    id: value.id,
    names,
    value: colour,
    ...(rule ? { showWhen: rule } : {}),
  };
};

/** A palette declared in `params`, or `null` for one this version cannot draw. */
export const readPalette = (value: unknown): IScenePackPalette | null => {
  if (!isRecord(value) || value.type !== 'palette') {
    return null;
  }
  if (typeof value.id !== 'string' || !SCENE_PARAM_ID.test(value.id)) {
    return null;
  }
  const names = readNames(value.names);
  const colours = readPaletteValue(value.stops, value.positions);
  if (!names || !colours) {
    return null;
  }
  const rule = readShowWhen(value.showWhen);
  return {
    id: value.id,
    names,
    ...colours,
    ...(rule ? { showWhen: rule } : {}),
  };
};

export const readSwatch = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((entry): entry is string => typeof entry === 'string')
    .filter((entry) => HEX_COLOUR.test(entry))
    .slice(0, MAX_SWATCH_COLOURS)
    .map((entry) => entry.toLowerCase());
};

export const isGraphStyle = (value: unknown): value is GraphStyle =>
  typeof value === 'string' && GRAPH_STYLES.some((style) => style === value);

/**
 * The source, or nothing.
 *
 * Refuses a `#version` line, because the app supplies one and a second is a
 * compile error on every driver. Refuses a source with no `sceneColour`, since
 * the app's `main()` calls it and a shader without it fails to link with a
 * message that names nothing the author wrote.
 */
export const readSource = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }
  if (
    value.length === 0 ||
    new TextEncoder().encode(value).byteLength > MAX_SHADER_BYTES
  ) {
    return null;
  }
  if (/^\s*#version\b/m.test(value)) {
    return null;
  }
  return SCENE_ENTRY_POINT.test(value) ? value : null;
};

/**
 * The band the live dB scale is drawn in, or nothing.
 *
 * Dropped rather than refused when it cannot be read, and a band narrower
 * than a fifth of the panel is not a band: the scene then gets the whole
 * frame, which is exactly what a scene that asks for no band gets.
 */
export const readSpectrumRange = (
  value: unknown,
): readonly [number, number] | undefined => {
  if (!Array.isArray(value) || value.length !== 2) {
    return undefined;
  }
  const [bottom, top] = value;
  if (
    typeof bottom !== 'number' ||
    typeof top !== 'number' ||
    !Number.isFinite(bottom) ||
    !Number.isFinite(top) ||
    bottom < 0 ||
    top > 1 ||
    top - bottom < 0.2
  ) {
    return undefined;
  }
  return [bottom, top];
};
