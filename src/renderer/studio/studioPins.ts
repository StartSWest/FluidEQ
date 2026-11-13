/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useSyncExternalStore } from 'react';
import { getAccountSnapshot } from '../account/accountStore';
import { reportError } from '../utils/logger';

/**
 * The Studio's pins (Ivan, 2026-11-13: "we need to add pin feature to the
 * studio so they can pin chats / projects to the top"): projects pinned to
 * the top of the project picker, and a project's earlier chats pinned to the
 * top of its list.
 *
 * Kept on this computer for each account, across restarts, and never sent
 * anywhere: one stored name per account, so a second member signing in on
 * the same computer finds their own. The newest pin stands first - the row
 * just pinned goes to the top, where the member is looking - and a row
 * unpinned goes back to its own place among the rest.
 *
 * A pin is dropped with what it pins: a project left out of the list the
 * Studio reads (forgotten, or its folder gone), a chat deleted. A chat that
 * is opened leaves the earlier list while it is the open one and keeps its
 * pin for when it goes back, so only a delete drops a chat's.
 */

export interface IStudioPins {
  /** Project ids, newest pin first. */
  projects: readonly string[];
  /** Each project's pinned earlier chats, newest pin first. */
  chats: Readonly<Record<string, readonly string[]>>;
}

const STEM = 'fluideq.studio.pins.v1:';
const NONE: IStudioPins = { projects: [], chats: {} };

const keyFor = (accountId: string | undefined) =>
  `${STEM}${accountId ?? 'signed-out'}`;

const isStrings = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === 'string');

/** What was stored, or nothing pinned for anything that is not pins. */
export const readStoredPins = (raw: string | null): IStudioPins => {
  if (!raw) {
    return NONE;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) {
      return NONE;
    }
    const { projects, chats } = parsed as Record<string, unknown>;
    const kept: Record<string, string[]> = {};
    if (typeof chats === 'object' && chats !== null) {
      Object.entries(chats).forEach(([projectId, ids]) => {
        if (isStrings(ids) && ids.length > 0) {
          kept[projectId] = ids;
        }
      });
    }
    return { projects: isStrings(projects) ? projects : [], chats: kept };
  } catch (error) {
    // A name hand-edited or half-written reads as nothing pinned, never as
    // a Studio that will not open.
    reportError('Studio pins could not be read; starting with none', error);
    return NONE;
  }
};

let cache: { key: string; pins: IStudioPins } | undefined;
const listeners = new Set<() => void>();

const currentKey = () => keyFor(getAccountSnapshot().identity?.id);

const read = (key: string): IStudioPins => {
  if (cache?.key !== key) {
    let raw: string | null = null;
    try {
      raw = window.localStorage.getItem(key);
    } catch (error) {
      reportError('Studio pins: storage unavailable', error);
    }
    cache = { key, pins: readStoredPins(raw) };
  }
  return cache.pins;
};

const write = (pins: IStudioPins) => {
  const key = currentKey();
  cache = { key, pins };
  try {
    window.localStorage.setItem(key, JSON.stringify(pins));
  } catch (error) {
    // Kept for this session at least; the next start reads what was stored.
    reportError('Studio pins could not be saved', error);
  }
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** The signed-in account's pins, kept current as they change. */
// The account is read, never watched: watching it from here started the
// account store's own sign-in check wherever a pin was drawn. The Studio is
// drawn again whenever its account changes (its projects are that
// account's), and each drawing reads that account's pins.
export const useStudioPins = (): IStudioPins =>
  useSyncExternalStore(
    subscribe,
    () => read(currentKey()),
    () => NONE,
  );

/** Pinned first, newest pin at the top; the rest as they were given. */
export const pinnedFirst = <T>(
  items: readonly T[],
  pinned: readonly string[],
  idOf: (item: T) => string,
): T[] => {
  const rank = new Map(pinned.map((id, index) => [id, index]));
  const pins = items
    .filter((item) => rank.has(idOf(item)))
    .sort((a, b) => (rank.get(idOf(a)) ?? 0) - (rank.get(idOf(b)) ?? 0));
  return [...pins, ...items.filter((item) => !rank.has(idOf(item)))];
};

const toggled = (list: readonly string[], id: string) =>
  list.includes(id) ? list.filter((entry) => entry !== id) : [id, ...list];

export const toggleProjectPin = (projectId: string) => {
  const pins = read(currentKey());
  write({ ...pins, projects: toggled(pins.projects, projectId) });
};

export const toggleChatPin = (projectId: string, chatId: string) => {
  const pins = read(currentKey());
  const chats = { ...pins.chats };
  const next = toggled(chats[projectId] ?? [], chatId);
  if (next.length > 0) {
    chats[projectId] = next;
  } else {
    delete chats[projectId];
  }
  write({ ...pins, chats });
};

/** A deleted chat takes its pin with it. */
export const dropChatPin = (projectId: string, chatId: string) => {
  const pins = read(currentKey());
  if (pins.chats[projectId]?.includes(chatId)) {
    toggleChatPin(projectId, chatId);
  }
};

/**
 * Pins kept only for the projects the Studio lists: one forgotten, or whose
 * folder is gone, takes its pin and its chats' pins with it. Written only
 * when something was dropped.
 */
export const keepPinsFor = (projectIds: readonly string[]) => {
  const pins = read(currentKey());
  const listed = new Set(projectIds);
  const projects = pins.projects.filter((id) => listed.has(id));
  const chats = Object.fromEntries(
    Object.entries(pins.chats).filter(([id]) => listed.has(id)),
  );
  if (
    projects.length !== pins.projects.length ||
    Object.keys(chats).length !== Object.keys(pins.chats).length
  ) {
    write({ projects, chats });
  }
};

/** For tests: forget the cached read, as a fresh window would. */
export const resetStudioPinsCache = () => {
  cache = undefined;
};
