/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

/**
 * Just enough of a source map (version 3) to say which line and column of
 * which source a place in the stills' bundle was written at: the coverage
 * the generator takes (`coverage.ts`) counts places in the bundle, and the
 * freshness counts pieces of the sources.
 */

export interface IOriginal {
  source: string;
  /** From 0, as the map counts them. */
  line: number;
  column: number;
}

/** One mapped place on a generated line: [column, source, line, column]. */
type TSegment = readonly [number, number, number, number];

const BASE64 =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const DIGIT = new Map([...BASE64].map((letter, index) => [letter, index]));

/** One segment's fields, each a base64 VLQ, sign in the lowest bit. */
const fieldsOf = (text: string): number[] => {
  const fields: number[] = [];
  let value = 0;
  let shift = 0;
  [...text].forEach((letter) => {
    const digit = DIGIT.get(letter);
    if (digit === undefined) {
      throw new Error(`Not a source map digit: ${letter}`);
    }
    // Five bits of value a digit, and above them whether more follow.
    value += (digit % 32) * 2 ** shift;
    shift += 5;
    if (digit < 32) {
      const magnitude = Math.floor(value / 2);
      fields.push(value % 2 === 1 ? -magnitude : magnitude);
      value = 0;
      shift = 0;
    }
  });
  return fields;
};

export interface ISourceMap {
  sources: readonly string[];
  /** Each generated line's mapped places, by column. */
  lines: ReadonlyArray<readonly TSegment[]>;
}

export const readSourceMap = (json: {
  sources: string[];
  mappings: string;
}): ISourceMap => {
  let source = 0;
  let line = 0;
  let column = 0;
  const lines = json.mappings.split(';').map((group) => {
    let generated = 0;
    const segments: TSegment[] = [];
    group
      .split(',')
      .filter(Boolean)
      .forEach((text) => {
        const fields = fieldsOf(text);
        generated += fields[0];
        // A place with no source: webpack's own code.
        if (fields.length >= 4) {
          source += fields[1];
          line += fields[2];
          column += fields[3];
          segments.push([generated, source, line, column]);
        }
      });
    return segments;
  });
  return { sources: json.sources, lines };
};

/**
 * Where a generated place was written: the last mapped place at or before
 * it on its own line, or nothing when its line maps nothing before it.
 */
export const originalAt = (
  map: ISourceMap,
  line: number,
  column: number,
): IOriginal | undefined => {
  const segments = map.lines[line] ?? [];
  let found: TSegment | undefined;
  segments.forEach((segment) => {
    if (segment[0] <= column) {
      found = segment;
    }
  });
  return found
    ? { source: map.sources[found[1]], line: found[2], column: found[3] }
    : undefined;
};

/** Each line's first offset, to turn an offset into a line and column. */
export const lineStartsOf = (text: string): number[] => {
  const starts = [0];
  for (let at = text.indexOf('\n'); at >= 0; at = text.indexOf('\n', at + 1)) {
    starts.push(at + 1);
  }
  return starts;
};

/** `offset` as [line, column], both from 0. */
export const placeOf = (
  starts: readonly number[],
  offset: number,
): [number, number] => {
  let low = 0;
  let high = starts.length - 1;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (starts[middle] <= offset) {
      low = middle;
    } else {
      high = middle - 1;
    }
  }
  return [low, offset - starts[low]];
};
