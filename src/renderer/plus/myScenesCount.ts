/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { useEffect, useSyncExternalStore } from 'react';
import { loadMyScenes, sentOnly, type TMine } from './myScenes';

/**
 * HOW MANY SCENES "YOUR SCENES" HOLDS, ON THE BUTTON THAT OPENS IT (Ivan,
 * 2026-11-25: "In the gallery, on 'Your scenes', I want to see the total of
 * my scenes there too").
 *
 * The number is the rows that page lists (`YourScenes`): every scene this
 * account has published, and what it sent that is not in the gallery yet.
 * For the account that publishes FluidEQ's own scenes those are its own as
 * well - the look picker's Yours tab says the same (`fromsOfScene`) - and
 * the server already answers them in its half of the same list, so the page
 * and the button count them without a second rule here.
 *
 * Kept for the session per account, so going back to the gallery shows the
 * last number at once while it is asked again, and the page itself hands
 * over what it holds after a scene is taken down (`rememberMyScenes`).
 */

type TReadyMine = Extract<TMine, { state: 'ready' }>;

/** The rows Your scenes shows for what the server answered. */
export const myScenesShown = (mine: TReadyMine) =>
  mine.scenes.length + sentOnly(mine.scenes, mine.sent).length;

interface IKnownCount {
  me: string;
  count: number;
}

let known: IKnownCount | undefined;
// Every change of the number moves this, so an answer to an older question
// never writes over a newer one about the same account (the page's own,
// after an unpublish).
let generation = 0;
let askingFor: string | undefined;
const listeners = new Set<() => void>();

const publish = (next: IKnownCount) => {
  generation += 1;
  known = next;
  listeners.forEach((listener) => listener());
};

/** What the Your scenes page holds now, whenever it changes. */
export const rememberMyScenes = (me: string, mine: TMine) => {
  if (mine.state === 'ready') {
    publish({ me, count: myScenesShown(mine) });
  }
};

const ask = (me: string) => {
  if (askingFor === me) {
    return;
  }
  askingFor = me;
  const asked = generation;
  loadMyScenes()
    .then((mine) => {
      // Something newer about this same account came in while it was asked.
      const overtaken = generation !== asked && known?.me === me;
      if (!overtaken) {
        rememberMyScenes(me, mine);
      }
      return undefined;
    })
    .catch(() => undefined)
    .finally(() => {
      if (askingFor === me) {
        askingFor = undefined;
      }
    });
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const snapshot = () => known;

/**
 * The count for this account, asked of the server each time the gallery's
 * front page shows it. `undefined` until a first answer for this account
 * (another account's number is never shown), and kept as it was when an ask
 * fails.
 */
export const useMyScenesCount = (
  me: string | undefined,
): number | undefined => {
  const current = useSyncExternalStore(subscribe, snapshot, snapshot);
  useEffect(() => {
    if (me) {
      ask(me);
    }
  }, [me]);
  return me !== undefined && current?.me === me ? current.count : undefined;
};

/** For tests: nothing known between runs. */
export const resetMyScenesCount = () => {
  known = undefined;
  generation = 0;
  askingFor = undefined;
  listeners.clear();
};
