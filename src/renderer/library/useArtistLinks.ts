/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * WHICH NAMES IN AN ARTIST LINE OPEN A PAGE, asked of main a screen at a
 * time.
 *
 * Only main can say it: "Simon & Garfunkel" is one band and "Bad Bunny, Jhay
 * Cortez" two people, and what tells them apart is whether the library knows
 * a half as an artist (`artistLinkParts`). Every artist cell of a table asks,
 * so the lines drawn in one pass are gathered and sent together once that
 * pass is over (a microtask, not a timer: it runs the moment the render's
 * effects have), and the answers are held by line. A line already answered
 * keeps drawing its answer while the library changes under it, and is asked
 * again once per change, with the rest of the screen.
 */

import { useEffect, useSyncExternalStore } from 'react';
import {
  type IArtistLinkPart,
  MAX_ARTIST_LINE,
} from '../../common/library/artistCredits';
import { useLibrary } from './LibraryContext';

/** Lines held: a few screens of a table and then some, never a library. */
const MAX_HELD = 2000;

/** One ask's lines: what main takes at once (`libraryRequestGuard.ts`). */
const MAX_BATCH = 500;

interface IHeld {
  version: number;
  parts: IArtistLinkPart[];
}

const held = new Map<string, IHeld>();
/** Wanted, with the library version each was wanted at. */
const wanted = new Map<string, number>();
const asking = new Set<string>();
const listeners = new Set<() => void>();
let isSendQueued = false;

const notify = () => listeners.forEach((listener) => listener());

const keep = (line: string, answer: IHeld) => {
  // Re-inserted, so the Map's order is the order lines were last answered
  // and the oldest go first.
  held.delete(line);
  held.set(line, answer);
  while (held.size > MAX_HELD) {
    const oldest = held.keys().next();
    if (oldest.done) {
      break;
    }
    held.delete(oldest.value);
  }
};

const send = () => {
  isSendQueued = false;
  const batch = [...wanted.entries()]
    .filter(([line]) => !asking.has(line))
    .slice(0, MAX_BATCH);
  if (batch.length === 0) {
    return;
  }
  batch.forEach(([line]) => {
    wanted.delete(line);
    asking.add(line);
  });
  const lines = batch.map(([line]) => line);
  window.electron.ipcRenderer
    .queryLibrary({ type: 'artistLinks', lines })
    .then((answers) => {
      batch.forEach(([line, version], index) => {
        asking.delete(line);
        keep(line, { version, parts: answers[index] ?? [{ text: line }] });
      });
      notify();
      if (wanted.size > 0) {
        send();
      }
      return undefined;
    })
    .catch((error: unknown) => {
      batch.forEach(([line]) => asking.delete(line));
      // eslint-disable-next-line no-console -- context-rich error before it is dropped; the names stay plain text
      console.error('Could not ask which artist names open a page', error);
    });
};

const want = (line: string, version: number) => {
  const answer = held.get(line);
  if (answer !== undefined && answer.version >= version) {
    return;
  }
  wanted.set(line, Math.max(version, wanted.get(line) ?? 0));
  if (!isSendQueued) {
    isSendQueued = true;
    queueMicrotask(send);
  }
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/**
 * The line as runs to draw, a name that opens a page carrying its id, or
 * nothing until main has answered (the line is then drawn plain). Nothing
 * for an empty line or one too long to send.
 */
const useArtistLinks = (
  line: string | undefined,
): IArtistLinkPart[] | undefined => {
  const { summary } = useLibrary();
  const { version } = summary;
  const asked =
    line !== undefined && line.trim() !== '' && line.length <= MAX_ARTIST_LINE
      ? line
      : undefined;
  const parts = useSyncExternalStore(subscribe, () =>
    asked === undefined ? undefined : held.get(asked)?.parts,
  );
  useEffect(() => {
    if (asked !== undefined) {
      want(asked, version);
    }
  }, [asked, version]);
  return parts;
};

export default useArtistLinks;
