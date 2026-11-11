import { useSyncExternalStore } from 'react';
import { isMemberLookId } from 'common/memberScenes';
import { packIdOfLook, type IScenePack } from 'common/scenePacks';
import { unblockMemberScene } from '../utils/memberScenes';
import { unblockScene } from '../utils/scenePacks';
import { setGraphLook } from '../utils/graphStyle';

/**
 * Why the graph could not play the look it was given: its code would not
 * build here, it held the graphics too long, there were no graphics to draw
 * it with, or the driver stopped under it.
 */
export type TLookRefusal = 'compile' | 'heavy' | 'unavailable' | 'driver';

export interface ILookRefusal {
  /** Never good news: it stays until it is closed or tried again. */
  ok: false;
  lookId: string;
  names: IScenePack['names'];
  reason: TLookRefusal;
  /** A new refusal of the same look is a new notice. */
  seq: number;
}

let current: ILookRefusal | undefined;
let seq = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

/**
 * A look the graph had to put aside, said where it was picked (Ivan,
 * 2026-11-11: three of his scenes "didn't take" on the graph, which quietly
 * drew a standard look in their place, and the reason — a shader that would
 * not compile — was only in the log; it cost him hours). The graph still
 * draws the scene's own fallback form, and the choice stays written down
 * (`graphStyle.ts`, `repointFromScene`): this only says what happened.
 */
export const refuseLook = (
  lookId: string,
  names: IScenePack['names'],
  reason: TLookRefusal,
) => {
  seq += 1;
  current = { ok: false, lookId, names, reason, seq };
  emit();
};

/** The look drew after all, or was tried again: nothing left to say. */
export const clearLookRefusal = (lookId: string) => {
  if (current?.lookId === lookId) {
    current = undefined;
    emit();
  }
};

/** Back on the graph: this session's verdict on it let go, and chosen again. */
export const retryLook = (lookId: string) => {
  clearLookRefusal(lookId);
  if (isMemberLookId(lookId)) {
    unblockMemberScene(lookId);
  } else {
    unblockScene(packIdOfLook(lookId));
  }
  setGraphLook(lookId);
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const useLookRefusal = () =>
  useSyncExternalStore(
    subscribe,
    () => current,
    () => undefined,
  );

/** For tests: nothing refused. */
export const resetLookRefusal = () => {
  current = undefined;
  seq = 0;
};
