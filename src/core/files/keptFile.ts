/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import fs from 'fs';
import type { ICoreLog } from '../coreLog';
import writeFileAtomically from './atomicWrite';

/**
 * Something the core keeps a copy of in a small JSON file of its own, so it
 * can act on it with no window to ask: the game profiles, the saved chains.
 *
 * Read once, on first use, and written only when what is handed in differs
 * from what is kept — the window hands its lists over at every launch and on
 * every change, and most of those are the same list again. A file that
 * cannot be read is the empty value; one that cannot be written keeps the
 * new value for this session and says so once, because the sound must not
 * wait on a disk.
 */
export interface IKeptFile<T> {
  read(): T;
  /** Keep `next`; whether it changed anything. */
  keep(next: T): boolean;
  onChange(listener: (value: T) => void): () => void;
}

export const createKeptFile = <T>({
  filePath,
  parse,
  empty,
  log,
}: {
  filePath: string;
  /** What the file holds, checked as anything read from disk is. */
  parse: (raw: unknown) => T;
  empty: T;
  log: ICoreLog;
}): IKeptFile<T> => {
  const listeners = new Set<(value: T) => void>();
  let kept: { value: T; text: string } | undefined;
  let hasComplained = false;

  const load = (): { value: T; text: string } => {
    if (kept) {
      return kept;
    }
    let value = empty;
    try {
      value = parse(JSON.parse(fs.readFileSync(filePath, 'utf8')));
    } catch {
      // Missing or unreadable is the empty value: nothing kept yet.
    }
    kept = { value, text: JSON.stringify(value) };
    return kept;
  };

  return {
    read: () => load().value,
    keep: (next) => {
      const text = JSON.stringify(next);
      if (text === load().text) {
        return false;
      }
      kept = { value: next, text };
      try {
        writeFileAtomically(filePath, text);
        hasComplained = false;
      } catch (error) {
        if (!hasComplained) {
          hasComplained = true;
          log.warn(`${filePath} could not be written: ${String(error)}`);
        }
      }
      listeners.forEach((listener) => listener(next));
      return true;
    },
    onChange: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
};
