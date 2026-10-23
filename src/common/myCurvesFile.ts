/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { IMPORT_EARS, type TImportEars } from './bandEars';
import {
  CURVE_LIST_MAX,
  CURVE_SOURCES,
  cleanCurveName,
  readCurveText,
  type IMyCurve,
  type TCurveSource,
} from './myCurves';

/**
 * Where My curves live: `my-curves.json` in the app's data folder, owned by
 * main and written whole, atomically, on every change. The window asks for
 * it and sends the next list back.
 *
 * It used to live in the window's own storage, which a full or refused
 * storage could fail to write without anybody being told: the curve showed
 * as added, and was gone at the next start.
 */
export const MY_CURVES_FILENAME = 'my-curves.json';
const MY_CURVES_STORE_VERSION = 1;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/** One kept curve, checked as an import's would be, or nothing. */
export const readStoredCurve = (value: unknown): IMyCurve | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }
  const { id, name, text, source, ears, addedAt } = value;
  if (
    typeof id !== 'string' ||
    id.length === 0 ||
    id.length > 100 ||
    typeof name !== 'string' ||
    typeof text !== 'string' ||
    !readCurveText(text)
  ) {
    return undefined;
  }
  return {
    id,
    name: cleanCurveName(name) || 'Curve',
    text,
    source: CURVE_SOURCES.includes(source as TCurveSource)
      ? (source as TCurveSource)
      : 'file',
    ears: IMPORT_EARS.includes(ears as TImportEars)
      ? (ears as TImportEars)
      : 'both',
    addedAt:
      typeof addedAt === 'number' && Number.isFinite(addedAt) ? addedAt : 0,
  };
};

/**
 * Whether a list the window sent is one main may keep as it is: every entry a
 * curve exactly as it would be read back, under its own id, no more of them
 * than the list holds. Anything else is refused whole rather than tidied,
 * because tidying would keep something other than what the window shows.
 */
export const isCurveListPayload = (value: unknown): value is IMyCurve[] => {
  if (!Array.isArray(value) || value.length > CURVE_LIST_MAX) {
    return false;
  }
  const ids = new Set<string>();
  return value.every((entry: unknown) => {
    const curve = readStoredCurve(entry);
    if (!curve || ids.has(curve.id) || !isRecord(entry)) {
      return false;
    }
    ids.add(curve.id);
    return (
      entry.name === curve.name &&
      entry.source === curve.source &&
      entry.ears === curve.ears &&
      entry.addedAt === curve.addedAt
    );
  });
};

export const toCurveStore = (curves: readonly IMyCurve[]): string =>
  `${JSON.stringify(
    {
      version: MY_CURVES_STORE_VERSION,
      curves: curves.map(({ id, name, source, ears, addedAt, text }) => ({
        id,
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
 * The kept list read back, an entry that holds no curve left out; or nothing
 * at all for a file that is not this store — damaged, or written by a newer
 * FluidEQ — which main sets aside rather than overwrite.
 */
export const fromCurveStore = (contents: string): IMyCurve[] | undefined => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(contents);
  } catch {
    return undefined;
  }
  if (
    !isRecord(parsed) ||
    parsed.version !== MY_CURVES_STORE_VERSION ||
    !Array.isArray(parsed.curves)
  ) {
    return undefined;
  }
  const ids = new Set<string>();
  return parsed.curves
    .map(readStoredCurve)
    .filter((curve): curve is IMyCurve => {
      if (!curve || ids.has(curve.id)) {
        return false;
      }
      ids.add(curve.id);
      return true;
    })
    .slice(0, CURVE_LIST_MAX);
};
