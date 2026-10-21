/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { useSyncExternalStore } from 'react';
import {
  CURVE_LIST_MAX,
  cleanCurveName,
  readCurveText,
  uniqueCurveName,
  type IMyCurve,
  type TCurveSource,
} from '../../common/myCurves';
import { readStoredCurve } from '../../common/myCurvesFile';
import type { TImportEars } from '../../common/bandEars';
import { readMyCurves, writeMyCurves } from '../utils/equalizerApi';

/**
 * The listener's own curves, as main keeps them in `my-curves.json`
 * (`main/ipc/myCurves.ts`): read once, then held here, and every change sent
 * back whole. A change shows at once and is taken back if main cannot keep
 * it, so the list on screen is never one that will not be there next time.
 *
 * Changes run one after another, each from the list the one before left, so
 * two quick presses never write over each other.
 */

export interface IMyCurvesState {
  curves: readonly IMyCurve[];
  /** Main has answered with the list. */
  isLoaded: boolean;
  /** Main could not read the list; nothing may change it until it can. */
  isFailed: boolean;
}

const UNREAD: IMyCurvesState = { curves: [], isLoaded: false, isFailed: false };

/**
 * Where the first 2.1 builds kept the list, in the window's own storage. Read
 * once, handed to main when main has none, and then forgotten.
 */
const LEFT_IN_WINDOW_KEY = 'fluideq.myCurves.v1';

type TListener = () => void;
const listeners = new Set<TListener>();
let state: IMyCurvesState = UNREAD;
let loading: Promise<void> | undefined;
let queue: Promise<unknown> = Promise.resolve();

const publish = (next: IMyCurvesState) => {
  state = next;
  listeners.forEach((listener) => listener());
};

const leftInWindow = (): IMyCurve[] => {
  try {
    const raw = window.localStorage.getItem(LEFT_IN_WINDOW_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed
          .map(readStoredCurve)
          .filter((curve): curve is IMyCurve => curve !== undefined)
          .slice(0, CURVE_LIST_MAX)
      : [];
  } catch {
    // Nothing readable was left there; main's list stands alone.
    return [];
  }
};

const forgetLeftInWindow = () => {
  try {
    window.localStorage.removeItem(LEFT_IN_WINDOW_KEY);
  } catch {
    // A store that cannot be reached holds nothing to hand over again.
  }
};

const load = async () => {
  const kept = await readMyCurves();
  const left = leftInWindow();
  if (kept.length === 0 && left.length > 0) {
    await writeMyCurves(left);
    publish({ curves: left, isLoaded: true, isFailed: false });
  } else {
    publish({ curves: kept, isLoaded: true, isFailed: false });
  }
  forgetLeftInWindow();
};

const ensureLoaded = (): Promise<void> => {
  loading =
    loading ??
    load().catch((error: unknown) => {
      loading = undefined;
      publish({ ...UNREAD, isFailed: true });
      throw error;
    });
  return loading;
};

/** Ask main again, after it could not read the list. */
export const retryMyCurves = (): Promise<void> => {
  publish(UNREAD);
  return ensureLoaded();
};

const subscribe = (listener: TListener) => {
  listeners.add(listener);
  if (!state.isLoaded && !state.isFailed) {
    // The failure is the state the subscriber is about to read.
    ensureLoaded().catch(() => undefined);
  }
  return () => {
    listeners.delete(listener);
  };
};

const readState = () => state;

export const useMyCurvesState = (): IMyCurvesState =>
  useSyncExternalStore(subscribe, readState, readState);

export const useMyCurves = (): readonly IMyCurve[] => useMyCurvesState().curves;

export const getMyCurves = (): readonly IMyCurve[] => state.curves;

/**
 * One change to the list: `make` gets the list as it stands and returns the
 * next one, or the same one for no change. Shown at once, kept by main, and
 * taken back if main refuses — the promise then rejects with main's reason.
 */
const change = <T>(
  make: (curves: readonly IMyCurve[]) => {
    next: readonly IMyCurve[];
    value: T;
  },
): Promise<T> => {
  const run = queue.then(async () => {
    await ensureLoaded();
    const before = state.curves;
    const { next, value } = make(before);
    if (next === before) {
      return value;
    }
    publish({ curves: next, isLoaded: true, isFailed: false });
    try {
      await writeMyCurves(next);
    } catch (error) {
      publish({ curves: before, isLoaded: true, isFailed: false });
      throw error;
    }
    return value;
  });
  queue = run.catch(() => undefined);
  return run;
};

const newId = () =>
  `curve-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export interface INewCurve {
  name: string;
  text: string;
  source: TCurveSource;
  ears: TImportEars;
}

/** No more curves fit. */
export const isMyCurvesFull = (curves: readonly IMyCurve[]) =>
  curves.length >= CURVE_LIST_MAX;

/**
 * Keep a curve, at the top of the list. A name already taken is numbered
 * rather than refused: a second "HD 600" is somebody's second try at it.
 * Nothing is kept for text that holds no curve, or past a full list.
 */
export const addMyCurve = (curve: INewCurve): Promise<IMyCurve | undefined> =>
  change((current) => {
    if (!readCurveText(curve.text) || isMyCurvesFull(current)) {
      return { next: current, value: undefined };
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
    return { next: [kept, ...current], value: kept };
  });

/**
 * A curve's name, bands and ears changed in place (Edit bands): it keeps its
 * place, its source and its date. A name another curve holds is numbered.
 */
export const updateMyCurve = (
  id: string,
  edit: Pick<IMyCurve, 'name' | 'text' | 'ears'>,
): Promise<IMyCurve | undefined> =>
  change((current) => {
    const clean = cleanCurveName(edit.name);
    const target = current.find((curve) => curve.id === id);
    if (!target || !clean || !readCurveText(edit.text)) {
      return { next: current, value: undefined };
    }
    const others = current
      .filter((curve) => curve.id !== id)
      .map((curve) => curve.name);
    const updated: IMyCurve = {
      ...target,
      name: uniqueCurveName(clean, others),
      text: edit.text,
      ears: edit.ears,
    };
    return {
      next: current.map((curve) => (curve.id === id ? updated : curve)),
      value: updated,
    };
  });

/** Rename one curve; a name another curve holds is numbered. */
export const renameMyCurve = (id: string, name: string): Promise<void> =>
  change((current) => {
    const clean = cleanCurveName(name);
    if (!clean) {
      return { next: current, value: undefined };
    }
    const others = current
      .filter((curve) => curve.id !== id)
      .map((curve) => curve.name);
    return {
      next: current.map((curve) =>
        curve.id === id
          ? { ...curve, name: uniqueCurveName(clean, others) }
          : curve,
      ),
      value: undefined,
    };
  });

export const removeMyCurve = (id: string): Promise<void> =>
  change((current) => ({
    next: current.filter((curve) => curve.id !== id),
    value: undefined,
  }));

/** A copy right under the curve, numbered after it. */
export const duplicateMyCurve = (id: string): Promise<IMyCurve | undefined> =>
  change((current) => {
    const index = current.findIndex((curve) => curve.id === id);
    if (index < 0 || isMyCurvesFull(current)) {
      return { next: current, value: undefined };
    }
    const original = current[index];
    const copy: IMyCurve = {
      ...original,
      id: newId(),
      name: uniqueCurveName(
        original.name,
        current.map((curve) => curve.name),
      ),
      addedAt: Date.now(),
    };
    return {
      next: [...current.slice(0, index + 1), copy, ...current.slice(index + 1)],
      value: copy,
    };
  });

export interface ICurveImportOutcome {
  added: number;
  replaced: number;
  /** Curves that did not fit in a full list. */
  refused: number;
}

/**
 * An import's decided rows, applied at once: replaced in place (the kept
 * curve's name and place stay), or added on top, numbered where a name is
 * taken, until the list is full; what did not fit is counted, never dropped
 * without saying so.
 */
export const importMyCurves = (
  rows: ReadonlyArray<{
    curve: INewCurve;
    replaces?: string;
  }>,
): Promise<ICurveImportOutcome> =>
  change((current) => {
    let kept = [...current];
    const added: IMyCurve[] = [];
    const outcome: ICurveImportOutcome = { added: 0, replaced: 0, refused: 0 };
    rows.forEach(({ curve, replaces }) => {
      if (!readCurveText(curve.text)) {
        return;
      }
      if (replaces && kept.some((entry) => entry.id === replaces)) {
        outcome.replaced += 1;
        kept = kept.map((entry) =>
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
      if (isMyCurvesFull([...kept, ...added])) {
        outcome.refused += 1;
        return;
      }
      added.push({
        id: newId(),
        name: uniqueCurveName(curve.name, [
          ...kept.map((entry) => entry.name),
          ...added.map((entry) => entry.name),
        ]),
        text: curve.text,
        source: curve.source,
        ears: curve.ears,
        addedAt: Date.now(),
      });
    });
    outcome.added = added.length;
    return {
      next:
        outcome.added + outcome.replaced > 0 ? [...added, ...kept] : current,
      value: outcome,
    };
  });

/** For a test: start again from nothing read. */
export const forgetMyCurvesCache = () => {
  state = UNREAD;
  loading = undefined;
  queue = Promise.resolve();
};
