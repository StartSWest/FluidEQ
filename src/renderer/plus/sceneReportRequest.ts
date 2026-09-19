/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useSyncExternalStore } from 'react';
import { getAccountSnapshot, useAccount } from '../account/accountStore';

/**
 * Reporting a scene from somewhere that cannot hold the dialog itself — the
 * look picker, a menu that closes on the first press outside it, which is
 * where the dialog opens. The place that knows the scene asks; the dialog
 * lives at the app root (`SceneReportHost`) and outlives the menu.
 *
 * Also remembers, for the session, which scenes each account reported, so the
 * button that sent one says so instead of offering to send it again — for
 * that account only: somebody else signing in on this computer has reported
 * nothing, and their Report must not read as sent.
 */

export interface ISceneReportTarget {
  lookId: string;
  authorId: string;
  sceneId: string;
  name: string;
}

interface IReportState {
  target?: ISceneReportTarget;
  /** Look ids reported this session, by the account that reported them. */
  reportedBy: ReadonlyMap<string, ReadonlySet<string>>;
}

const NOTHING_REPORTED: ReadonlySet<string> = new Set();

let state: IReportState = { reportedBy: new Map() };
const listeners = new Set<() => void>();

const publish = (next: IReportState) => {
  state = next;
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const getSnapshot = () => state;

/** The dialog asked for, and what the account signed in now has reported. */
export const useSceneReport = (): {
  target?: ISceneReportTarget;
  reported: ReadonlySet<string>;
} => {
  const { target, reportedBy } = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getSnapshot,
  );
  const me = useAccount().identity?.id;
  return {
    target,
    reported: (me && reportedBy.get(me)) || NOTHING_REPORTED,
  };
};

export const requestSceneReport = (target: ISceneReportTarget) =>
  publish({ ...state, target });

/** The dialog closed; `sent` when the report reached the server. */
export const closeSceneReport = (sent: boolean) => {
  const { target, reportedBy } = state;
  const me = getAccountSnapshot().identity?.id;
  if (!sent || !target || !me) {
    publish({ reportedBy });
    return;
  }
  const next = new Map(reportedBy);
  next.set(me, new Set([...(reportedBy.get(me) ?? []), target.lookId]));
  publish({ reportedBy: next });
};

/** For tests: a clean module between runs. */
export const resetSceneReportRequest = () => {
  state = { reportedBy: new Map() };
  listeners.clear();
};
