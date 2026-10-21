/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { useSyncExternalStore } from 'react';
import {
  CURVE_LIST_MAX,
  CURVE_SOURCES,
  cleanCurveName,
  readCurveText,
  uniqueCurveName,
  type IMyCurve,
  type TCurveSource,
} from '../../common/myCurves';
import { IMPORT_EARS, type TImportEars } from '../../common/bandEars';

/**
 * The listener's own curves, kept in this window's storage beside the rooms
 * they save (`savedRooms.ts`): something they made, which "Reset all
 * settings" leaves alone.
 *
 * Read once, then held: every change writes the whole list and tells every
 * picture of it, and another window of the app changing it arrives through
 * the `storage` event.
 */
const STORAGE_KEY = 'fluideq.myCurves.v1';

type TListener = () => void;
const listeners = new Set<TListener>();
let cache: readonly IMyCurve[] | undefined;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/** One stored curve, checked as an import's would be, or nothing. */
const readStored = (value: unknown): IMyCurve | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }
  const { id, name, text, source, ears, addedAt } = value;
  if (
    typeof id !== 'string' ||
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
    addedAt: typeof addedAt === 'number' ? addedAt : 0,
  };
};

const load = (): readonly IMyCurve[] => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .map(readStored)
      .filter((curve): curve is IMyCurve => curve !== undefined);
  } catch {
    // A storage that cannot be read is an empty list, never a broken page.
    return [];
  }
};

const read = (): readonly IMyCurve[] => {
  cache = cache ?? load();
  return cache;
};

const write = (next: readonly IMyCurve[]) => {
  cache = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // A full or refused storage keeps the list for this session: the page
    // shows what was done, and the next start shows what could be kept.
  }
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: TListener) => {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      cache = undefined;
      listener();
    }
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
};

export const useMyCurves = (): readonly IMyCurve[] =>
  useSyncExternalStore(subscribe, read, read);

export const getMyCurves = (): readonly IMyCurve[] => read();

const newId = () =>
  `curve-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export interface INewCurve {
  name: string;
  text: string;
  source: TCurveSource;
  ears: TImportEars;
}

/**
 * Keep a curve, at the top of the list. A name already taken is numbered
 * rather than refused: a second "HD 600" is somebody's second try at it.
 * Nothing is kept for text that holds no curve.
 */
export const addMyCurve = (curve: INewCurve): IMyCurve | undefined => {
  const current = read();
  if (!readCurveText(curve.text) || current.length >= CURVE_LIST_MAX) {
    return undefined;
  }
  const kept: IMyCurve = {
    id: newId(),
    name: uniqueCurveName(
      cleanCurveName(curve.name) || 'Curve',
      current.map((entry) => entry.name),
    ),
    text: curve.text,
    source: curve.source,
    ears: curve.ears,
    addedAt: Date.now(),
  };
  write([kept, ...current]);
  return kept;
};

/** Rename one curve; a name another curve holds is numbered. */
export const renameMyCurve = (id: string, name: string) => {
  const current = read();
  const others = current
    .filter((curve) => curve.id !== id)
    .map((curve) => curve.name);
  const clean = cleanCurveName(name);
  if (!clean) {
    return;
  }
  write(
    current.map((curve) =>
      curve.id === id
        ? { ...curve, name: uniqueCurveName(clean, others) }
        : curve,
    ),
  );
};

export const removeMyCurve = (id: string) =>
  write(read().filter((curve) => curve.id !== id));

/** A copy right under the curve, numbered after it. */
export const duplicateMyCurve = (id: string): IMyCurve | undefined => {
  const current = read();
  const index = current.findIndex((curve) => curve.id === id);
  if (index < 0 || current.length >= CURVE_LIST_MAX) {
    return undefined;
  }
  const source = current[index];
  const copy: IMyCurve = {
    ...source,
    id: newId(),
    name: uniqueCurveName(
      source.name,
      current.map((curve) => curve.name),
    ),
    addedAt: Date.now(),
  };
  write([...current.slice(0, index + 1), copy, ...current.slice(index + 1)]);
  return copy;
};

/** An import's decided rows, applied at once: replaced in place, or added. */
export const importMyCurves = (
  rows: ReadonlyArray<{
    curve: INewCurve;
    replaces?: string;
  }>,
): number => {
  let current = [...read()];
  const added: IMyCurve[] = [];
  let replaced = 0;
  rows.forEach(({ curve, replaces }) => {
    if (!readCurveText(curve.text)) {
      return;
    }
    if (replaces && current.some((entry) => entry.id === replaces)) {
      replaced += 1;
      current = current.map((entry) =>
        entry.id === replaces
          ? {
              ...entry,
              text: curve.text,
              source: curve.source,
              ears: curve.ears,
            }
          : entry,
      );
      return;
    }
    if (current.length + added.length >= CURVE_LIST_MAX) {
      return;
    }
    added.push({
      id: newId(),
      name: uniqueCurveName(curve.name, [
        ...current.map((entry) => entry.name),
        ...added.map((entry) => entry.name),
      ]),
      text: curve.text,
      source: curve.source,
      ears: curve.ears,
      addedAt: Date.now(),
    });
  });
  write([...added, ...current]);
  return added.length + replaced;
};

/** For a test, which starts from what storage holds now. */
export const forgetMyCurvesCache = () => {
  cache = undefined;
};
