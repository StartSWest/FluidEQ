/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import {
  GRAPH_PALETTES,
  GRAPH_STYLES,
  GRAPH_STYLE_LABELS,
  GraphPalette,
  GraphStyle,
  IGraphLook,
  MAX_GRAPH_COLUMNS,
  MIN_GRAPH_COLUMNS,
  clampGraphColumns,
  getGraphBallistics,
  getGraphColumnCount,
  hasGraphAccent,
  isFilledGraphStyle,
} from './graphStyles';

/**
 * A look the user made, rather than one of the seventy-two that ship.
 *
 * The forms themselves are not user-editable and deliberately so: every one of
 * them is a piece of geometry somebody drew, looked at, and gave its own
 * density and ballistics to. What a custom look changes is those numbers —
 * the settings the author chose by eye — while the geometry stays exactly the
 * code that is already tested. So there is no such thing as a custom look that
 * draws something invalid; the worst it can be is one somebody dislikes.
 *
 * That is also why this is a tuning of a named base form rather than a
 * free-form description of a drawing. A stored shape would have to be
 * validated, versioned and defended against every future change to the engine.
 * A stored base plus seven numbers cannot outlive the form it names, and if the
 * form is ever removed the look simply falls back like any unknown id.
 */
export interface ILookTuning {
  /** How many pieces a discrete form is broken into. Ignored by the rest. */
  columns: number;
  /** Milliseconds to halve the distance upward. */
  attackMs: number;
  /** Milliseconds to halve the distance downward. */
  releaseMs: number;
  /** Painted rather than stroked. */
  filled: boolean;
  /** Stroke width, when stroked. */
  strokeWidth: number;
  /** Fill alpha, when painted. */
  fillOpacity: number;
  /** Lit tips, for the forms that have them. */
  accents: boolean;
}

export interface ICustomLook {
  id: string;
  name: string;
  style: GraphStyle;
  palette: GraphPalette;
  tuning: ILookTuning;
}

/**
 * A look with every drawing question already answered.
 *
 * Built-in and custom looks arrive at the chart as the same shape, so `Line`
 * never asks which kind it has — it reads the tuning and draws. Without this
 * the drawing code would carry a branch per setting, each one deciding between
 * a table lookup and a stored value, and that branch would have to be right in
 * seven places.
 */
export interface IResolvedLook {
  id: string;
  label: string;
  style: GraphStyle;
  palette: GraphPalette;
  tuning: ILookTuning;
  isCustom: boolean;
}

/**
 * The width the live trace has always been stroked at, and the alpha it has
 * always been filled at.
 *
 * Named here because they are now defaults rather than constants: a custom look
 * can move them, and a built-in one is the look that leaves them alone.
 */
export const DEFAULT_STROKE_WIDTH = 2;
export const DEFAULT_FILL_OPACITY = 0.55;

export const MIN_ATTACK_MS = 1;
export const MAX_ATTACK_MS = 60;
export const MIN_RELEASE_MS = 4;
export const MAX_RELEASE_MS = 250;
export const MIN_STROKE_WIDTH = 1;
export const MAX_STROKE_WIDTH = 6;
export const MIN_FILL_OPACITY = 0.15;
export const MAX_FILL_OPACITY = 1;

/**
 * How many looks somebody may keep.
 *
 * Not a storage limit — fifty of these is a few kilobytes. It is a limit on the
 * picker, which is already seventy-two entries long and stops being a list you
 * can find anything in some way before it reaches two hundred.
 */
export const MAX_CUSTOM_LOOKS = 50;

/** The marker that tells a saved id apart from a built-in one. */
export const CUSTOM_LOOK_PREFIX = 'custom:';

export const isCustomLookId = (id: string): boolean =>
  id.startsWith(CUSTOM_LOOK_PREFIX);

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/**
 * A finite number inside its range, or the fallback.
 *
 * Everything here is read back from storage that a user can edit by hand and
 * that a future version may have written differently, so `NaN`, `null`, a
 * string and a missing key all have to land somewhere sensible rather than
 * reaching the drawing loop.
 */
const readNumber = (
  value: unknown,
  min: number,
  max: number,
  fallback: number,
): number =>
  typeof value === 'number' && Number.isFinite(value)
    ? clamp(value, min, max)
    : fallback;

const readBoolean = (value: unknown, fallback: boolean): boolean =>
  typeof value === 'boolean' ? value : fallback;

/**
 * How a form draws itself when nobody has tuned it.
 *
 * Read from the engine's own tables rather than copied, so a form whose
 * ballistics are retuned in `graphStyles.ts` moves the starting point of every
 * new look made from it, and the built-in look it is based on stays identical
 * to what it was before any of this existed.
 */
export const getDefaultTuning = (style: GraphStyle): ILookTuning => {
  const ballistics = getGraphBallistics(style);
  return {
    columns: getGraphColumnCount(style),
    attackMs: ballistics.attackMs,
    releaseMs: ballistics.releaseMs,
    filled: isFilledGraphStyle(style),
    strokeWidth: DEFAULT_STROKE_WIDTH,
    fillOpacity: DEFAULT_FILL_OPACITY,
    accents: hasGraphAccent(style),
  };
};

/**
 * A tuning that the drawing code can be handed without checking anything.
 *
 * The release floor is the interesting one. Every built-in form falls slower
 * than it rises, and that is not a stylistic accident — a meter that drops
 * faster than it climbs reads as broken, because a peak vanishes before the eye
 * that was drawn to it arrives. The designer stops the slider before it can
 * happen; this is the backstop for a hand-edited file, and it is why the
 * ballistics test's rule holds for a custom look too.
 */
export const normalizeTuning = (
  raw: unknown,
  style: GraphStyle,
): ILookTuning => {
  const defaults = getDefaultTuning(style);
  const source = (raw ?? {}) as Record<string, unknown>;
  const attackMs = readNumber(
    source.attackMs,
    MIN_ATTACK_MS,
    MAX_ATTACK_MS,
    defaults.attackMs,
  );
  return {
    columns: clampGraphColumns(
      readNumber(
        source.columns,
        MIN_GRAPH_COLUMNS,
        MAX_GRAPH_COLUMNS,
        defaults.columns,
      ),
    ),
    attackMs,
    releaseMs: Math.max(
      attackMs,
      readNumber(
        source.releaseMs,
        MIN_RELEASE_MS,
        MAX_RELEASE_MS,
        defaults.releaseMs,
      ),
    ),
    filled: readBoolean(source.filled, defaults.filled),
    strokeWidth: readNumber(
      source.strokeWidth,
      MIN_STROKE_WIDTH,
      MAX_STROKE_WIDTH,
      defaults.strokeWidth,
    ),
    fillOpacity: readNumber(
      source.fillOpacity,
      MIN_FILL_OPACITY,
      MAX_FILL_OPACITY,
      defaults.fillOpacity,
    ),
    // A form with no lit tips cannot be given them by asking: the accent is a
    // piece of geometry that only exists for the forms in the engine's table.
    accents: hasGraphAccent(style) && readBoolean(source.accents, true),
  };
};

const isGraphStyle = (value: unknown): value is GraphStyle =>
  typeof value === 'string' && GRAPH_STYLES.includes(value as GraphStyle);

const isGraphPalette = (value: unknown): value is GraphPalette =>
  typeof value === 'string' && GRAPH_PALETTES.includes(value as GraphPalette);

/**
 * The longest a name may be.
 *
 * The picker's trigger is sized for "Mirrored ridge · Rainbow" and the menu for
 * a little more; a name past this ellipsises in both, which makes two looks
 * with the same first thirty characters indistinguishable in the one place they
 * have to be told apart.
 */
export const MAX_LOOK_NAME_LENGTH = 32;

/**
 * Trimmed, collapsed, and short enough to read in the picker.
 *
 * Newlines are stripped rather than trimmed because a name is pasted as often
 * as it is typed, and one containing a line break renders as a blank row.
 */
export const normalizeLookName = (name: string): string =>
  name.replace(/\s+/g, ' ').trim().slice(0, MAX_LOOK_NAME_LENGTH);

let idCounter = 0;

/**
 * An id that will not collide with another made in the same millisecond.
 *
 * Deliberately not `crypto.randomUUID`: this runs under jsdom in the unit tests
 * as well as in Electron, and the point of the id is only to be unique within
 * one user's list of at most fifty.
 */
export const createCustomLookId = (): string => {
  idCounter += 1;
  return `${CUSTOM_LOOK_PREFIX}${Date.now().toString(36)}-${idCounter.toString(
    36,
  )}-${Math.floor(Math.random() * 0xffffff).toString(36)}`;
};

/**
 * One stored entry, or `null` if it cannot be made into a look.
 *
 * A missing id or an unrecognised form are the two failures that cannot be
 * repaired by clamping — an id is how the selection points at it, and a form is
 * the geometry itself. Everything else has a defensible default, so a look with
 * a nonsense release time is loaded with a sensible one rather than discarded:
 * losing somebody's saved look over a number is a worse outcome than drawing it
 * slightly differently from how they left it.
 */
export const normalizeCustomLook = (raw: unknown): ICustomLook | null => {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const source = raw as Record<string, unknown>;
  const id = typeof source.id === 'string' ? source.id : '';
  if (!id || !isCustomLookId(id)) {
    return null;
  }
  // Pulled out before the guard rather than after it, so the narrowing lands on
  // a plain local. A type guard applied to an index-signature property does not
  // survive being destructured out of it afterwards.
  const { style } = source;
  if (!isGraphStyle(style)) {
    return null;
  }
  const name =
    typeof source.name === 'string' ? normalizeLookName(source.name) : '';
  return {
    id,
    // A look with no name is still a look; naming it after the form it came
    // from is more use than dropping it or showing an empty row.
    name: name || GRAPH_STYLE_LABELS[style],
    style,
    palette: isGraphPalette(source.palette) ? source.palette : 'signal',
    tuning: normalizeTuning(source.tuning, style),
  };
};

/**
 * Everything readable in the stored list.
 *
 * Never throws. Storage holds whatever was last written there, which after a
 * crash, a downgrade or a hand edit may be truncated JSON — and a visualiser
 * setting is not worth failing to start the graph over.
 */
export const parseCustomLooks = (json: string | null): ICustomLook[] => {
  if (!json) {
    return [];
  }
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return [];
  }
  if (!Array.isArray(raw)) {
    return [];
  }
  const looks: ICustomLook[] = [];
  const seen = new Set<string>();
  raw.forEach((entry) => {
    const look = normalizeCustomLook(entry);
    // Duplicate ids would give the picker two rows that select each other.
    if (look && !seen.has(look.id) && looks.length < MAX_CUSTOM_LOOKS) {
      seen.add(look.id);
      looks.push(look);
    }
  });
  return looks;
};

export const serializeCustomLooks = (looks: readonly ICustomLook[]): string =>
  JSON.stringify(looks);

/**
 * A new look, starting from where the given form already is.
 *
 * Starting from the form's own settings rather than from the middle of every
 * slider is what makes the panel feel like an adjustment: open it on Bars and
 * the first thing shown is Bars, unchanged, and every move from there is
 * visibly the user's.
 */
export const createDraftLook = (
  style: GraphStyle,
  palette: GraphPalette,
  name = '',
): ICustomLook => ({
  id: createCustomLookId(),
  name,
  style,
  palette,
  tuning: getDefaultTuning(style),
});

/**
 * The same look, retuned for a different base form.
 *
 * Changing the form mid-edit is a change of geometry, so the settings that
 * described the old one no longer mean anything — sixty-four columns of stems
 * is not twenty-six of skyline, and a fill on a form that is drawn as strokes
 * is a different picture. Everything moves to the new form's own defaults, and
 * only the name and the palette carry over, because those are choices about the
 * look rather than about the shape.
 */
export const rebaseDraftLook = (
  draft: ICustomLook,
  style: GraphStyle,
): ICustomLook =>
  draft.style === style
    ? draft
    : { ...draft, style, tuning: getDefaultTuning(style) };

export const resolveBuiltInLook = (look: IGraphLook): IResolvedLook => ({
  id: look.id,
  label: look.label,
  style: look.style,
  palette: look.palette,
  tuning: getDefaultTuning(look.style),
  isCustom: false,
});

export const resolveCustomLook = (look: ICustomLook): IResolvedLook => ({
  id: look.id,
  label: look.name,
  style: look.style,
  palette: look.palette,
  tuning: look.tuning,
  isCustom: true,
});
