/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { parseEqText } from './apoText';
import { IMPORT_EARS, type TImportEars } from './bandEars';
import { layerGainLimit } from './correctionRange';

/**
 * My Curves: the listener's own list of EQ curves beside OPRA's, each kept as
 * the ParametricEQ text it came as (Ivan, 2026-10-20: "users can add and name
 * the curves and create nice list they can export and import the list").
 *
 * The text is the curve. Squiglink, AutoEQ and Equalizer APO all write it,
 * FluidEQ already plays it as EQ or as a headphone correction
 * (`importEqText`), and kept verbatim nothing in it is rounded or reread
 * through another model on the way back out — a curve exported, imported on
 * another computer and played is the curve that was saved.
 */

/** Where a curve came from: drawn as a chip on its row. */
export type TCurveSource = 'squiglink' | 'file' | 'eq' | 'opra';

export const CURVE_SOURCES: readonly TCurveSource[] = [
  'squiglink',
  'file',
  'eq',
  'opra',
];

export interface IMyCurve {
  id: string;
  name: string;
  /** The curve: a ParametricEQ or GraphicEQ text, preamp included. */
  text: string;
  source: TCurveSource;
  /** Which ears it was saved for, played as it says when applied as EQ. */
  ears: TImportEars;
  /** Epoch milliseconds. */
  addedAt: number;
}

/** What the list file holds, and what any FluidEQ reads back whole. */
export const CURVE_LIST_FORMAT = 'fluideq-curves';
export const CURVE_LIST_VERSION = 1;
/** The extension Save As offers. */
export const CURVE_LIST_EXTENSION = 'fqcurves';

export const CURVE_NAME_MAX = 80;
/** A long GraphicEQ line is a few kilobytes; nothing real comes near this. */
export const CURVE_TEXT_MAX = 64 * 1024;
/** More than anybody keeps, and a bound on what one import can add. */
export const CURVE_LIST_MAX = 500;
/** A list file of the largest list is far under this. */
export const CURVE_LIST_FILE_MAX = CURVE_LIST_MAX * (CURVE_TEXT_MAX + 512);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/** A name as kept: trimmed, single-spaced, never longer than the limit. */
export const cleanCurveName = (name: string): string =>
  name.replace(/\s+/g, ' ').trim().slice(0, CURVE_NAME_MAX);

/**
 * What a curve's text plays, read the way the correction layer reads it, or
 * nothing when it holds no curve at all.
 */
export const readCurveText = (text: string) => {
  if (text.length === 0 || text.length > CURVE_TEXT_MAX) {
    return undefined;
  }
  const parsed = parseEqText(text, { gainLimit: layerGainLimit('headphone') });
  return parsed.isEmpty ? undefined : parsed;
};

/**
 * A name nobody in `taken` has yet: the name itself, or the first of
 * "Name (2)", "Name (3)"… that is free. Compared without case, as a reader
 * scanning the list would.
 */
export const uniqueCurveName = (
  name: string,
  taken: readonly string[],
): string => {
  const base = cleanCurveName(name);
  const used = new Set(taken.map((entry) => entry.toLowerCase()));
  if (!used.has(base.toLowerCase())) {
    return base;
  }
  for (let count = 2; ; count += 1) {
    const suffix = ` (${count})`;
    const candidate = `${base.slice(0, CURVE_NAME_MAX - suffix.length)}${suffix}`;
    if (!used.has(candidate.toLowerCase())) {
      return candidate;
    }
  }
};

/** One curve out of a list file, checked whole, or nothing. */
const readListedCurve = (
  value: unknown,
): (Omit<IMyCurve, 'id' | 'addedAt'> & { addedAt?: number }) | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }
  const { name, text, source, ears, addedAt } = value;
  if (
    typeof name !== 'string' ||
    typeof text !== 'string' ||
    cleanCurveName(name).length === 0 ||
    !readCurveText(text)
  ) {
    return undefined;
  }
  return {
    name: cleanCurveName(name),
    text,
    source: CURVE_SOURCES.includes(source as TCurveSource)
      ? (source as TCurveSource)
      : 'file',
    ears: IMPORT_EARS.includes(ears as TImportEars)
      ? (ears as TImportEars)
      : 'both',
    addedAt:
      typeof addedAt === 'number' && Number.isFinite(addedAt)
        ? addedAt
        : undefined,
  };
};

export interface ICurveFileReading {
  curves: Array<Omit<IMyCurve, 'id' | 'addedAt'> & { addedAt?: number }>;
  /** Entries in the file that held no usable curve, by their place in it. */
  skipped: number;
}

/**
 * A list file read back: every curve that holds one, and how many did not.
 * Anything that is not a list file at all — another program's JSON, a file
 * from a newer FluidEQ — reads as nothing, never as an empty list.
 */
export const fromCurveListFile = (
  contents: string,
): ICurveFileReading | undefined => {
  if (contents.length > CURVE_LIST_FILE_MAX) {
    return undefined;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(contents);
  } catch {
    return undefined;
  }
  if (
    !isRecord(parsed) ||
    parsed.format !== CURVE_LIST_FORMAT ||
    parsed.version !== CURVE_LIST_VERSION ||
    !Array.isArray(parsed.curves)
  ) {
    return undefined;
  }
  const curves: ICurveFileReading['curves'] = [];
  let skipped = 0;
  parsed.curves.slice(0, CURVE_LIST_MAX).forEach((entry: unknown) => {
    const curve = readListedCurve(entry);
    if (curve) {
      curves.push(curve);
    } else {
      skipped += 1;
    }
  });
  skipped += Math.max(0, parsed.curves.length - CURVE_LIST_MAX);
  return { curves, skipped };
};

/** The list as a file another FluidEQ imports whole. */
export const toCurveListFile = (curves: readonly IMyCurve[]): string =>
  `${JSON.stringify(
    {
      format: CURVE_LIST_FORMAT,
      version: CURVE_LIST_VERSION,
      curves: curves.map(({ name, text, source, ears, addedAt }) => ({
        name,
        source,
        ears,
        addedAt,
        text,
      })),
    },
    null,
    2,
  )}\n`;

/**
 * A curve's file name in a folder of .txt files: its name with the characters
 * no file system takes left out, numbered when two come out the same.
 */
export const curveFileNames = (curves: readonly IMyCurve[]): string[] => {
  const taken: string[] = [];
  return curves.map((curve) => {
    const safe =
      curve.name
        .replace(/[<>:"/\\|?*]/g, '')
        // Control characters, which no file system allows in a name either.
        .split('')
        .filter((character) => character.charCodeAt(0) >= 32)
        .join('')
        .replace(/[. ]+$/, '')
        .trim() || 'Curve';
    const name = uniqueCurveName(safe, taken);
    taken.push(name);
    return `${name}.txt`;
  });
};

/** What an import does with one incoming curve. */
export type TCurveImportChoice = 'keep-both' | 'replace' | 'skip';

export interface ICurveImportRow {
  name: string;
  text: string;
  source: TCurveSource;
  ears: TImportEars;
  /** The id of a kept curve with the same name, which a choice decides on. */
  clashesWith?: string;
}

/** The incoming curves beside the kept ones: which names are taken already. */
export const planCurveImport = (
  incoming: ICurveFileReading['curves'],
  kept: readonly IMyCurve[],
): ICurveImportRow[] => {
  const byName = new Map(
    kept.map((curve) => [curve.name.toLowerCase(), curve.id] as const),
  );
  return incoming.map(({ name, text, source, ears }) => ({
    name,
    text,
    source,
    ears,
    clashesWith: byName.get(name.toLowerCase()),
  }));
};
