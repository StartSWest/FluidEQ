/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useSyncExternalStore } from 'react';

/**
 * The "Start here" guide a new project's starter scene comes with (Ivan,
 * 2026-10-21, after the mockup: "lets use that plan mockup like it so
 * proceed"): four steps that tick from what the member actually does, kept
 * per project so a step done yesterday stays done.
 *
 * A project joins the guide while its scene is still the starter's text
 * (`useStudioStarter`), and leaves it when the scene is published or the
 * member closes it — and stays left: the record is kept, closed, so a
 * starter opened again does not start the guide over. On disk, in the
 * window's own storage, because the guide is the member's progress and a
 * restart must not hand them step one again.
 */

/** The steps that tick themselves; the fourth, publishing, ends the guide. */
export type TStarterStep = 'heard' | 'dial' | 'asked';

export const STARTER_STEPS: readonly TStarterStep[] = [
  'heard',
  'dial',
  'asked',
];

export interface IStarterGuide {
  steps: readonly TStarterStep[];
  closed: boolean;
}

type TGuides = Record<string, IStarterGuide>;

const GUIDE_KEY = 'fluideq.studio.starterGuide';
const LABELS_KEY = 'fluideq.studio.starterLabels';

/**
 * More projects than anybody starts; past it the oldest records go, so the
 * storage cannot grow without end. An old project losing its closed record
 * would only show the guide again if its scene were still the untouched
 * starter.
 */
const MAX_GUIDES = 60;

const isStep = (value: unknown): value is TStarterStep =>
  typeof value === 'string' &&
  (STARTER_STEPS as readonly string[]).includes(value);

const readGuides = (): TGuides => {
  try {
    const parsed: unknown = JSON.parse(
      window.localStorage.getItem(GUIDE_KEY) ?? '{}',
    );
    if (typeof parsed !== 'object' || parsed === null) {
      return {};
    }
    const guides: TGuides = {};
    Object.entries(parsed).forEach(([id, value]: [string, unknown]) => {
      if (typeof value === 'object' && value !== null) {
        const { steps, closed } = value as Record<string, unknown>;
        guides[id] = {
          steps: Array.isArray(steps) ? steps.filter(isStep) : [],
          closed: closed === true,
        };
      }
    });
    return guides;
  } catch {
    // Storage refused or unreadable: the guide starts fresh, as on a first
    // visit.
    return {};
  }
};

const readLabels = (): boolean => {
  try {
    return window.localStorage.getItem(LABELS_KEY) !== 'off';
  } catch {
    return true;
  }
};

let guides = readGuides();
let labelsShown = readLabels();
const listeners = new Set<() => void>();

const store = (next: TGuides) => {
  const ids = Object.keys(next);
  // Insertion order is the order projects joined: the oldest go first.
  guides = Object.fromEntries(
    ids.slice(Math.max(0, ids.length - MAX_GUIDES)).map((id) => [id, next[id]]),
  );
  try {
    window.localStorage.setItem(GUIDE_KEY, JSON.stringify(guides));
  } catch {
    // Kept for this session only, as when it could not be read.
  }
  listeners.forEach((listener) => listener());
};

/** Starts the guide for a project, unless it has had one already. */
export const beginStarterGuide = (projectId: string) => {
  if (!guides[projectId]) {
    store({ ...guides, [projectId]: { steps: [], closed: false } });
  }
};

/** Ticks a step on a project's open guide; nothing for any other project. */
export const markStarterStep = (
  projectId: string | undefined,
  step: TStarterStep,
) => {
  const guide = projectId ? guides[projectId] : undefined;
  if (projectId && guide && !guide.closed && !guide.steps.includes(step)) {
    store({
      ...guides,
      [projectId]: { ...guide, steps: [...guide.steps, step] },
    });
  }
};

/** Ends a project's guide for good: published, or closed by the member. */
export const closeStarterGuide = (projectId: string) => {
  const guide = guides[projectId];
  if (guide && !guide.closed) {
    store({ ...guides, [projectId]: { ...guide, closed: true } });
  }
};

/** Whether the starter's parts are labelled on the stage; on until hidden. */
export const setStarterLabelsShown = (shown: boolean) => {
  labelsShown = shown;
  try {
    window.localStorage.setItem(LABELS_KEY, shown ? 'on' : 'off');
  } catch {
    // Kept for this session only.
  }
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** The project's guide while it is open; undefined once it is done. */
export const useStarterGuide = (
  projectId: string | undefined,
): IStarterGuide | undefined => {
  const guide = useSyncExternalStore(
    subscribe,
    () => (projectId ? guides[projectId] : undefined),
    () => undefined,
  );
  return guide && !guide.closed ? guide : undefined;
};

export const useStarterLabelsShown = (): boolean =>
  useSyncExternalStore(
    subscribe,
    () => labelsShown,
    () => true,
  );

/** For tests: forget every guide, where they were kept, and the listeners. */
export const resetStarterGuides = () => {
  guides = {};
  labelsShown = true;
  listeners.clear();
  window.localStorage.removeItem(GUIDE_KEY);
  window.localStorage.removeItem(LABELS_KEY);
};
