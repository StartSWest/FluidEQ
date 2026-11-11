/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useSyncExternalStore } from 'react';

/**
 * What the member picked on the stage for their next message: things of a
 * 3D world, or numbered marks on a painted scene. They stand as chips in the
 * composer and go with the message as its first line, so the member's AI is
 * told exactly which parts are meant and to leave the rest alone.
 */

export interface IEditPick {
  /** What the chip says: the thing's name, or a mark's number. */
  label: string;
  /** Where the AI finds it: `world.nodes[7]`, or what a mark is. */
  where: string;
}

const EMPTY: readonly IEditPick[] = [];
const picks = new Map<string, readonly IEditPick[]>();
const listeners = new Set<() => void>();

const notify = () => listeners.forEach((listener) => listener());

export const setEditPicks = (projectId: string, next: readonly IEditPick[]) => {
  if (next.length === 0) {
    picks.delete(projectId);
  } else {
    picks.set(projectId, next);
  }
  notify();
};

export const editPicksOf = (projectId: string): readonly IEditPick[] =>
  picks.get(projectId) ?? EMPTY;

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const useEditPicks = (projectId: string): readonly IEditPick[] =>
  useSyncExternalStore(subscribe, () => editPicksOf(projectId));

/** The message with its picks said first; `lead` is the sentence before them. */
export const withEditPicks = (
  text: string,
  chosen: readonly IEditPick[],
  lead: string,
): string =>
  chosen.length === 0
    ? text
    : `${lead} ${chosen
        .map((pick) => `"${pick.label}" (${pick.where})`)
        .join('; ')}\n\n${text}`;
