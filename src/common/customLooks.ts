/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

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
import { PRODUCT_NAME } from './branding';

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
  /**
   * How strongly the euphoria halo burns, from nothing to full.
   *
   * A setting rather than a constant because it trades two things off against
   * each other and only the person looking can say where the line is: the halo
   * is light thrown off the figure, and light thrown off a figure softens its
   * edges. Turned up it pumps; turned up too far the drawing stops being sharp
   * and the graph stops being readable. At zero the figure is exactly as crisp
   * as it is with the mode off.
   */
  glow: number;
  /**
   * Whether euphoria rings the graph in a colour that travels.
   *
   * Separate from the glow, because it is a different idea rather than more of
   * the same one: the glow is light off the figure and stays in the figure's
   * own colours, while this is the frame around the card cycling through the
   * whole wheel — the thing a room full of visualisers does, and the one part
   * of the mode that is decoration rather than a reading. Some looks want it
   * and some are ruined by it, so it is a switch rather than a rule.
   */
  border: boolean;
  /** How heavy that frame is, in pixels. */
  borderWidth: number;
}

export interface ICustomLook {
  id: string;
  name: string;
  style: GraphStyle;
  palette: GraphPalette;
  tuning: ILookTuning;
  /** Gradient stops. Empty means the palette's own built-in colours. */
  colours: string[];
}

/**
 * How few and how many colours a gradient may be built from.
 *
 * One is a flat fill, which is what the signal palette is. Above about six the
 * stops are closer together than the eye can separate on a bar a few pixels
 * wide, and the picture stops reading as a gradient and starts reading as
 * noise.
 */
export const MIN_LOOK_COLOURS = 1;
export const MAX_LOOK_COLOURS = 6;

/**
 * The colour the live trace is drawn in, for the designer to start from.
 *
 * Only a seed. The signal palette itself answers with no colours at all (see
 * below), so this is what the panel puts in the picker the moment somebody
 * decides to change it — starting them on the colour that is already on screen
 * rather than on an arbitrary one.
 *
 * Kept in step with `ColorEnum.ANALOGOUS2`, which is what the chart hands the
 * live curve. It is repeated rather than imported because that enum is in the
 * renderer's stylesheet layer and this file is shared with the main process.
 */
export const DEFAULT_SIGNAL_COLOUR = '#54ff8a';

/**
 * Quiet to loud.
 *
 * Cyan through green and amber into red — the same reading as every level meter
 * ever built, which is the point: nobody has to be told what the red end means.
 */
export const DEFAULT_LEVEL_COLOURS = [
  '#00e5cf',
  '#54ff8a',
  '#ffcc4d',
  '#ff4f4f',
];

/**
 * What a palette paints when nobody has chosen otherwise.
 *
 * Two of the three answer with nothing, and that is the point: empty means "the
 * colours already on screen", so every look that shipped before any of this
 * existed draws exactly as it did. `signal` keeps taking the colour the chart
 * hands the curve, and `rainbow` keeps painting from the full-spectrum gradient
 * in the chart's own `<defs>` — whose stops live in the renderer beside the
 * bands that share them, and copying those five values down here to hand back
 * would be the second copy the comment on the original warns will drift.
 *
 * `level` is the exception because it is new. There is no existing gradient for
 * it to point at, so it carries its own.
 */
export const getDefaultPaletteColours = (palette: GraphPalette): string[] =>
  palette === 'level' ? [...DEFAULT_LEVEL_COLOURS] : [];

/** `#rgb` or `#rrggbb`, which is all an SVG stop needs and all a colour input emits. */
const HEX_COLOUR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

export const isLookColour = (value: unknown): value is string =>
  typeof value === 'string' && HEX_COLOUR.test(value.trim());

/**
 * The stops a look will actually be painted with.
 *
 * Anything unreadable is dropped rather than repaired — there is no sensible
 * "nearest colour" to a value that is not one — and a look left with nothing
 * usable falls back to its palette's own colours rather than to a blank figure.
 */
export const getMaxLookColours = (palette: GraphPalette): number =>
  // A flat fill is one colour by definition. A second stop cannot be painted —
  // there is no axis to run it along — so it is not an option that does nothing,
  // it is not an option.
  palette === 'signal' ? 1 : MAX_LOOK_COLOURS;

export const normalizeLookColours = (
  raw: unknown,
  palette: GraphPalette,
): string[] => {
  if (!Array.isArray(raw)) {
    return getDefaultPaletteColours(palette);
  }
  const colours = raw
    .filter(isLookColour)
    .map((colour) => colour.trim().toLowerCase())
    .slice(0, getMaxLookColours(palette));
  return colours.length ? colours : getDefaultPaletteColours(palette);
};

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
  /** Gradient stops. Empty means the palette's own built-in colours. */
  colours: string[];
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
export const MIN_GLOW = 0;
export const MAX_GLOW = 1;

/**
 * How hard the halo burns on a look nobody has set it on.
 *
 * Low deliberately. The glow is the loudest thing on screen when it is up, and
 * a drawing read through its own light is not a drawing you can read — so the
 * default keeps the figure sharp and leaves the spectacle to whoever wants to
 * reach for it.
 */
export const DEFAULT_GLOW = 0.3;

/**
 * How heavy the euphoria frame may be.
 *
 * One pixel is the card's own edge lit up, which is the restrained reading;
 * eight is a band of colour around the picture, which is the other one. Both
 * are wanted by somebody, and neither is right for everyone.
 */
export const MIN_BORDER_WIDTH = 1;
export const MAX_BORDER_WIDTH = 8;
export const DEFAULT_BORDER_WIDTH = 2;

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
    glow: DEFAULT_GLOW,
    // Off unless asked for. It is the one part of the mode that decorates the
    // window rather than the drawing, and a frame nobody chose is furniture.
    border: false,
    borderWidth: DEFAULT_BORDER_WIDTH,
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
    glow: readNumber(source.glow, MIN_GLOW, MAX_GLOW, defaults.glow),
    border: readBoolean(source.border, defaults.border),
    borderWidth: readNumber(
      source.borderWidth,
      MIN_BORDER_WIDTH,
      MAX_BORDER_WIDTH,
      defaults.borderWidth,
    ),
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
  const palette = isGraphPalette(source.palette) ? source.palette : 'signal';
  return {
    id,
    // A look with no name is still a look; naming it after the form it came
    // from is more use than dropping it or showing an empty row.
    name: name || GRAPH_STYLE_LABELS[style],
    style,
    palette,
    tuning: normalizeTuning(source.tuning, style),
    // Looks saved before palettes were colourable have no stops at all, which
    // is exactly the value that means "the palette's own" — so they keep
    // drawing as they did.
    colours: normalizeLookColours(source.colours, palette),
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
  colours: getDefaultPaletteColours(palette),
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

/**
 * The same look, recoloured for a different palette.
 *
 * The stops go with the palette rather than surviving it, because they mean
 * different things in each: four colours running quiet-to-loud up the decibel
 * axis are not four colours running bass-to-treble across the frequency axis,
 * and carrying them over would hand somebody a level ramp that reads as a
 * spectrum. The form and its tuning are untouched — this is a change of
 * colouring, not of shape.
 */
export const recolourDraftLook = (
  draft: ICustomLook,
  palette: GraphPalette,
): ICustomLook =>
  draft.palette === palette
    ? draft
    : { ...draft, palette, colours: getDefaultPaletteColours(palette) };

/**
 * The version of the look file format.
 *
 * Written into every export and read back on import. It is one number and it
 * costs nothing now; without it, the first change to the shape of a look turns
 * every file anybody has shared into something that has to be guessed at.
 *
 * A reader older than the file it is given cannot be trusted to understand it,
 * so it declines rather than importing half of one.
 */
export const LOOK_FILE_SCHEMA = 1;

/** What a `.fluideq-look.json` file holds. */
export interface ILookFile {
  schema: number;
  /** Informational. The app that wrote it, for anybody reading one by hand. */
  app: string;
  looks: readonly ICustomLook[];
}

/**
 * Looks as a file somebody can send to somebody else.
 *
 * Indented, because the whole point of a text format is that it can be opened
 * and read — and a look is a couple of dozen values, not a database. The cost
 * of the whitespace is nothing against being able to see what you are sharing.
 */
export const serializeLookFile = (looks: readonly ICustomLook[]): string =>
  `${JSON.stringify(
    {
      schema: LOOK_FILE_SCHEMA,
      app: PRODUCT_NAME,
      looks,
    } satisfies ILookFile,
    null,
    2,
  )}\n`;

/**
 * Everything readable in a look file, or empty if it is not one.
 *
 * Never throws. This is a file chosen from a disk by a person, which means it
 * is as likely to be a screenshot they misclicked as a look — and the answer to
 * that is a message saying nothing was found, not a stack trace.
 *
 * Every look still goes through `normalizeCustomLook`, so a hand-edited file
 * gets exactly the same clamping and validation as the stored list. A file is
 * no more trustworthy than local storage; it is rather less.
 */
export const parseLookFile = (json: string): ICustomLook[] => {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return [];
  }
  if (!raw || typeof raw !== 'object') {
    return [];
  }
  const file = raw as Partial<ILookFile>;
  // A newer file than this build understands. Better to say so than to import
  // the parts that happen to still parse and leave somebody with a look that
  // quietly lost whatever the new version added.
  if (typeof file.schema !== 'number' || file.schema > LOOK_FILE_SCHEMA) {
    return [];
  }
  if (!Array.isArray(file.looks)) {
    return [];
  }
  const looks: ICustomLook[] = [];
  const seen = new Set<string>();
  file.looks.forEach((entry) => {
    const look = normalizeCustomLook(entry);
    if (look && !seen.has(look.id) && looks.length < MAX_CUSTOM_LOOKS) {
      seen.add(look.id);
      looks.push(look);
    }
  });
  return looks;
};

/** A filename that survives being saved on any of the three platforms. */
export const toLookFileName = (name: string): string =>
  `${
    name
      .replace(/[^a-z0-9]+/gi, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase() || 'look'
  }.fluideq-look.json`;

export const resolveBuiltInLook = (look: IGraphLook): IResolvedLook => ({
  id: look.id,
  label: look.label,
  style: look.style,
  palette: look.palette,
  tuning: getDefaultTuning(look.style),
  colours: getDefaultPaletteColours(look.palette),
  isCustom: false,
});

export const resolveCustomLook = (look: ICustomLook): IResolvedLook => ({
  id: look.id,
  label: look.name,
  style: look.style,
  palette: look.palette,
  tuning: look.tuning,
  colours: look.colours,
  isCustom: true,
});
