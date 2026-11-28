/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import crypto from 'crypto';
import ts from 'typescript';
import type { IUnit } from './sourceUnits';

/** What stands in a piece's code for a function left out of it. */
const NEVER_RAN = '<never-ran>';

/** A piece's code with some of the functions written in it left out. */
export interface IPieceView {
  /** Its tokens, each function left out one `NEVER_RAN` in its place. */
  code: string;
  /** The names it reads outside the functions left out. */
  reads: string[];
  /**
   * The functions left out, each named by a hash of the piece's code before
   * it. A name stays the function's own while nothing before it changes;
   * once something does, the function is no longer found by it, and the
   * piece reads as changed rather than leaving out what may now run.
   */
  leftOut: string[];
}

/**
 * `unit` of `text` as its code, the functions in it that `leaveOut` names
 * (by their name in `IPieceView.leftOut` and their extent) left out, each
 * whole: a callback a piece hands to something that never called it while
 * a still was drawn decided nothing about the still, whatever it holds.
 */
export const pieceView = (
  text: string,
  file: string,
  unit: IUnit,
  leaveOut: (name: string, extent: readonly [number, number]) => boolean,
): IPieceView => {
  // Outermost first, so a function inside one left out is never asked of.
  const functionAt = new Map<number, number>();
  unit.functions.forEach(([start, end]) => {
    if (!functionAt.has(start)) {
      functionAt.set(start, end);
    }
  });
  const before = crypto.createHash('sha256');
  const tokens: string[] = [];
  const leftOut: string[] = [];
  const skipped: (readonly [number, number])[] = [];
  const say = (token: string) => {
    tokens.push(token);
    before.update(` ${token}`);
  };
  let skipTo = -1;
  unit.ranges.forEach(([start, end]) => {
    const scanner = ts.createScanner(
      ts.ScriptTarget.Latest,
      true,
      /.[jt]sx$/.test(file)
        ? ts.LanguageVariant.JSX
        : ts.LanguageVariant.Standard,
      text,
      undefined,
      start,
      end - start,
    );
    for (
      let token = scanner.scan();
      token !== ts.SyntaxKind.EndOfFileToken;
      token = scanner.scan()
    ) {
      const at = scanner.getTokenStart();
      if (at >= skipTo) {
        const functionEnd = functionAt.get(at);
        const name =
          functionEnd === undefined
            ? undefined
            : before.copy().digest('hex').slice(0, 12);
        if (
          name !== undefined &&
          functionEnd !== undefined &&
          leaveOut(name, [at, functionEnd])
        ) {
          leftOut.push(name);
          skipped.push([at, functionEnd]);
          skipTo = functionEnd;
          say(NEVER_RAN);
        } else {
          say(scanner.getTokenText());
        }
      }
    }
  });
  const reads = [...unit.reads]
    .filter(([, places]) =>
      places.some(
        (place) => !skipped.some(([from, to]) => place >= from && place < to),
      ),
    )
    .map(([name]) => name);
  return { code: tokens.join(' '), reads, leftOut };
};
