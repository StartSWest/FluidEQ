/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import fs from 'fs';
import path from 'path';
import { BYTES, ROOT, type IUnitRef, type SourceReader } from './stillSources';

export { codeOf } from './sourceUnits';
export { ROOT } from './stillSources';

/**
 * What each shipped still was drawn from (`stillSources.ts`): per look, the
 * pieces of code that ran while its stills were drawn and what those read,
 * each with its hash. A look is stale when one of its pieces has changed,
 * and then `lookStillsFresh.test.ts` fails, naming it, and `pnpm
 * stills:looks` draws that look again and no other.
 *
 * It used to be every file the stills' page bundled, hashed whole: a
 * context provider the page never mounts, the look history, a texture's
 * painter the shipped palette has no texture for - four unrelated landings
 * on 2026-11-27 each turned the check red and each cost a full run of the
 * generator, half an hour, after which no still had moved.
 *
 * What it does not count, as before: the stylesheets (a still's colours
 * are the window's, solved as roles, and a role the drawing reads that the
 * stills do not know fails the generator's own measure), the packages, and
 * the browser. Code a worker runs is not in the page's coverage, so the
 * generator refuses to draw a look that starts one.
 */

/** Where the list is kept, beside the stills. */
export const SOURCES_FILE = path.join(
  ROOT,
  'src',
  'renderer',
  'graph',
  'lookStills',
  'stills',
  'sources.json',
);

export const SOURCES_VERSION = 2;

export interface IStillSources {
  version: typeof SOURCES_VERSION;
  /**
   * Every piece a still was drawn from, as `file key hash leftOut`, sorted:
   * `leftOut` the functions written in it that never ran (`pieceView`),
   * comma-separated, or `-`.
   */
  units: readonly string[];
  /**
   * Each look's pieces, as places in `units`: runs (`12-40`) and single
   * places, space-separated. Most of every look is the same runs, so the
   * list stays a few lines a look.
   */
  looks: Readonly<Record<string, string>>;
}

/** One piece a look was drawn from, as it was then. */
export interface IPiece {
  ref: IUnitRef;
  /** The functions written in it that never ran, by name (`pieceView`). */
  leftOut: readonly string[];
  hash: string;
}

/** The list as kept, or nothing if it is missing or of an older kind. */
export const readKept = (): IStillSources | undefined => {
  if (!fs.existsSync(SOURCES_FILE)) {
    return undefined;
  }
  const kept = JSON.parse(fs.readFileSync(SOURCES_FILE, 'utf8')) as {
    version?: number;
    units?: unknown;
  };
  const isList =
    kept.version === SOURCES_VERSION &&
    Array.isArray(kept.units) &&
    kept.units.every(
      (line) => typeof line === 'string' && line.split(' ').length === 4,
    );
  return isList ? (kept as IStillSources) : undefined;
};

const placesOf = (runs: string): number[] =>
  runs
    .split(' ')
    .filter(Boolean)
    .flatMap((run) => {
      const [from, to = from] = run.split('-').map(Number);
      return Array.from({ length: to - from + 1 }, (_, step) => from + step);
    });

const runsOf = (places: readonly number[]): string => {
  const runs: string[] = [];
  places.forEach((place, index) => {
    if (index > 0 && place === places[index - 1] + 1) {
      return;
    }
    let to = index;
    while (to + 1 < places.length && places[to + 1] === places[to] + 1) {
      to += 1;
    }
    runs.push(to > index ? `${place}-${places[to]}` : `${place}`);
  });
  return runs.join(' ');
};

const pieceAt = (kept: IStillSources, index: number): IPiece => {
  const [file, key, hash, leftOut] = kept.units[index].split(' ');
  return {
    ref: { file, key },
    hash,
    leftOut: leftOut === '-' ? [] : leftOut.split(','),
  };
};

const lineOf = ({ ref: { file, key }, hash, leftOut }: IPiece) => {
  if (/\s/.test(`${file}${key}`)) {
    throw new Error(`A piece the list cannot hold: ${file} ${key}`);
  }
  return `${file} ${key} ${hash} ${leftOut.length > 0 ? leftOut.join(',') : '-'}`;
};

/** Each look's pieces, as `IStillSources` keeps them. */
export const sourcesOf = (
  looks: ReadonlyMap<string, readonly IPiece[]>,
): IStillSources => {
  // Sorted, so a run that changes nothing writes the same file.
  const units = [
    ...new Set([...looks.values()].flatMap((pieces) => pieces.map(lineOf))),
  ].sort();
  const at = new Map(units.map((line, index) => [line, index]));
  return {
    version: SOURCES_VERSION,
    units,
    looks: Object.fromEntries(
      [...looks.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([look, pieces]) => [
          look,
          runsOf(
            [
              ...new Set(pieces.map((piece) => at.get(lineOf(piece)) ?? 0)),
            ].sort((left, right) => left - right),
          ),
        ]),
    ),
  };
};

/** The pieces `look` was drawn from, as they were then. */
export const piecesOf = (kept: IStillSources, look: string): IPiece[] =>
  placesOf(kept.looks[look] ?? '').map((index) => pieceAt(kept, index));

/** Every piece some look was drawn from. */
export const everyPiece = (kept: IStillSources): IPiece[] =>
  kept.units.map((_, index) => pieceAt(kept, index));

/** A piece that is not as it was when a look was drawn from it. */
export interface IChanged {
  file: string;
  key: string;
  /** `changed`, or `gone`: the file or the piece is not there any more. */
  how: 'changed' | 'gone';
}

/**
 * Every look whose still is not drawn from the code as it is now, with
 * what changed under it. A look not in the list at all is stale too.
 */
export const staleLooks = (
  kept: IStillSources | undefined,
  reader: SourceReader,
  looks: readonly string[],
): Map<string, IChanged[]> => {
  const now = new Map<number, IChanged | undefined>();
  const changedAt = (index: number): IChanged | undefined => {
    if (!kept) {
      return undefined;
    }
    if (!now.has(index)) {
      const { ref, hash, leftOut } = pieceAt(kept, index);
      const current = reader.hashOf(ref, leftOut);
      now.set(
        index,
        current === hash
          ? undefined
          : { ...ref, how: current === undefined ? 'gone' : 'changed' },
      );
    }
    return now.get(index);
  };
  const stale = new Map<string, IChanged[]>();
  looks.forEach((look) => {
    const runs = kept?.looks[look];
    if (runs === undefined) {
      stale.set(look, []);
      return;
    }
    const changed = placesOf(runs).flatMap((index) => changedAt(index) ?? []);
    if (changed.length > 0) {
      stale.set(look, changed);
    }
  });
  return stale;
};

/** The demo song every still is drawn on. */
export const DEMO_SONG = 'assets/studio/publish-demo-loop.m4a';

/**
 * What makes a still's bytes outside the page, followed whole whatever ran:
 * the generator's requests (`request.ts`), its layering of the answer
 * (`sprite.ts`) and its PNG writer, and the song.
 */
export const BYTES_MADE_BY = [
  'scripts/look-stills/request.ts',
  'scripts/look-stills/sprite.ts',
  'scripts/look-stills/png.ts',
];

export const alwaysUnits = (reader: SourceReader): IUnitRef[] => [
  ...BYTES_MADE_BY.flatMap((file) =>
    (reader.units(file)?.units ?? []).map((unit) => ({ file, key: unit.key })),
  ),
  { file: DEMO_SONG, key: BYTES },
];
