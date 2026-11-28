/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { IPage } from '../help-captures/cdp';
import {
  lineStartsOf,
  originalAt,
  placeOf,
  readSourceMap,
  type IOriginal,
  type ISourceMap,
} from './sourceMap';
import { unitAt } from './sourceUnits';
import { refId, type SourceReader } from './stillSources';

/**
 * What ran while a look was drawn, as the browser counted it: V8's precise
 * coverage of the stills' bundle, each function that ran placed in the
 * source it was written in through the bundle's source map, and named by
 * the top-level piece of that source it is in (`sourceUnits.ts`).
 */

interface ICoverage {
  result: ReadonlyArray<{
    url: string;
    functions: ReadonlyArray<{
      ranges: ReadonlyArray<{
        startOffset: number;
        endOffset: number;
        count: number;
      }>;
    }>;
  }>;
}

/** Counting from before the page's code loads, so loading is counted too. */
export const startCoverage = async (page: IPage) => {
  await page.send('Profiler.enable');
  await page.send('Profiler.startPreciseCoverage', {
    callCount: true,
    detailed: false,
  });
};

/**
 * The bundle's functions that ran since coverage was last taken, as
 * [start, end) in the bundle's text. Taking it starts the count again.
 */
export const takeRan = async (
  page: IPage,
  bundle: string,
): Promise<[number, number][]> => {
  const { result } = await page.send<ICoverage>('Profiler.takePreciseCoverage');
  return result
    .filter((script) => script.url.endsWith(`/${bundle}`))
    .flatMap((script) =>
      script.functions.flatMap(({ ranges: [whole] }) =>
        whole && whole.count > 0
          ? [[whole.startOffset, whole.endOffset] as [number, number]]
          : [],
      ),
    );
};

/** A bundle's source paths as files from the root. */
const fileOf = (source: string): string =>
  source.replace(/^webpack:\/\/[^/]*\//, '').replace(/^\.\//, '');

export interface IPlaced {
  /** Every unit a function that ran is in (`refId`). */
  ran: Set<string>;
  /**
   * Where each function that ran starts and ends in its file. The start
   * lands on the function's own first token (checked over every function of
   * the bundle on 2026-11-27: all of the app's 4,925 did); the end can land
   * in a curried arrow's inner one, which only counts that one as run too.
   */
  at: Map<string, number[]>;
  /** Functions of webpack's own, of a package, or that span pieces: a module's wrapper. */
  skipped: number;
}

/** The stills' bundle, read for where each of its places was written. */
export class BundlePlaces {
  private readonly starts: number[];

  private readonly map: ISourceMap;

  private readonly sourceStarts = new Map<string, number[] | undefined>();

  constructor(
    bundleText: string,
    mapJson: { sources: string[]; mappings: string },
    private readonly reader: SourceReader,
  ) {
    this.starts = lineStartsOf(bundleText);
    this.map = readSourceMap(mapJson);
  }

  /** A bundle offset as a file of the app and an offset in its text. */
  private written(offset: number): { file: string; at: number } | undefined {
    const [line, column] = placeOf(this.starts, offset);
    const original: IOriginal | undefined = originalAt(this.map, line, column);
    if (!original) {
      return undefined;
    }
    const file = fileOf(original.source);
    if (!/^(src|scripts)\//.test(file)) {
      return undefined;
    }
    if (!this.sourceStarts.has(file)) {
      const text = this.reader.text(file);
      this.sourceStarts.set(
        file,
        text === undefined ? undefined : lineStartsOf(text),
      );
    }
    const starts = this.sourceStarts.get(file);
    const lineStart = starts?.[original.line];
    return lineStart === undefined
      ? undefined
      : { file, at: lineStart + original.column };
  }

  /**
   * The units the functions in `ran` are in. A function whose first and
   * last places fall in two pieces is not one of them: it is a module's
   * wrapper, and what it runs is the pieces' own load-time code, which
   * `closeOver` counts by file.
   */
  place(ran: ReadonlyArray<readonly [number, number]>): IPlaced {
    const placed = new Set<string>();
    const at = new Map<string, number[]>();
    let skipped = 0;
    ran.forEach(([start, end]) => {
      const first = this.written(start);
      const last = this.written(Math.max(start, end - 1));
      const units = first && this.reader.units(first.file);
      const unit = units && first ? unitAt(units, first.at) : undefined;
      const lastUnit =
        last && last.file === first?.file && units
          ? unitAt(units, last.at)
          : undefined;
      if (!first || !unit || (lastUnit && lastUnit !== unit)) {
        skipped += 1;
        return;
      }
      placed.add(refId({ file: first.file, key: unit.key }));
      const places = at.get(first.file) ?? [];
      places.push(first.at);
      if (last && last.file === first.file) {
        places.push(last.at);
      }
      at.set(first.file, places);
    });
    return { ran: placed, at, skipped };
  }
}
