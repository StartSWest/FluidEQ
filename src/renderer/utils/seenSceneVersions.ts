/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useSyncExternalStore } from 'react';
import { readStored, writeStored } from './graphStorage';

/**
 * The version of each Plus look this computer last played on the graph, so
 * the look picker can mark one that changed since and the graph can say so
 * once when the look it is playing updates.
 *
 * A look never played has no entry and is never marked: "new" means new to
 * somebody who knew the look before, not every scene they have yet to try.
 * Kept by look id, newest played first, and bounded.
 */

const KEY = 'fluideq.seenSceneVersions';
const MAX_LOOKS = 200;

type TSeen = Readonly<Record<string, number>>;

const read = (): TSeen => {
  try {
    const parsed: unknown = JSON.parse(readStored(KEY) ?? '{}');
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      return {};
    }
    return Object.fromEntries(
      Object.entries(parsed).filter(
        ([lookId, version]) =>
          lookId.length <= 200 &&
          typeof version === 'number' &&
          Number.isInteger(version) &&
          version > 0,
      ),
    );
  } catch {
    return {};
  }
};

let seen: TSeen = read();
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** The version of `lookId` last played here, if it ever was. */
export const seenSceneVersion = (lookId: string): number | undefined =>
  seen[lookId];

/**
 * `lookId` was just played at `version`. Answers the version played before,
 * when it was an older one — which is when the graph tells the listener.
 */
export const markSceneVersionSeen = (
  lookId: string,
  version: number,
): number | undefined => {
  const before = seen[lookId];
  if (before === version) {
    return undefined;
  }
  const { [lookId]: _previous, ...rest } = seen;
  // Newest first, so the bound lets go of the looks played longest ago.
  seen = Object.fromEntries(
    [[lookId, version] as const, ...Object.entries(rest)].slice(0, MAX_LOOKS),
  );
  writeStored(KEY, JSON.stringify(seen));
  listeners.forEach((listener) => listener());
  return before !== undefined && before < version ? before : undefined;
};

/** Whether `version` of `lookId` is newer than the one last played here. */
export const isUnseenSceneVersion = (
  lookId: string,
  version: number | undefined,
): boolean => {
  const before = seen[lookId];
  return before !== undefined && version !== undefined && version > before;
};

/** Re-renders whenever a look is played at a new version. */
export const useSeenSceneVersions = () =>
  useSyncExternalStore(
    subscribe,
    () => seen,
    () => seen,
  );
