/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Which engine is processing the audio, for a component that has to say so.
 *
 * One answer for the whole window, not one per component. Each caller used to
 * hold its own copy, starting from nothing on every mount — so the DSP page,
 * which mounts each time its tab is opened, spent the whole of main's reply
 * (a helper run and a hash of the engine files) believing no engine was
 * chosen, and said "Library only" in amber under its title before correcting
 * itself, although the shell beside it had known the answer since launch.
 * Now a component that mounts reads what the window already knows, and still
 * asks again so a change nobody announced is picked up.
 *
 * No polling and no timer: the answer changes exactly when the user changes
 * it, and whatever changed it is in a position to call `refresh` or
 * `notifyAudioEngineChanged`.
 *
 * `undefined` until the first answer lands, and that is a third state rather
 * than a default: a pill that guessed "Library only" for the frames before
 * main replied would show the wrong scope, on the one line of this app whose
 * whole job is to say what is being processed.
 */

import { useEffect, useSyncExternalStore } from 'react';
import type { IAudioEngineStatus } from 'common/audioEngine';
import { getAudioEngineStatus } from './audioEngineApi';
import { reportError } from './logger';
import { subscribeAudioEngineChanged } from './audioEngineEvents';
import { resetSystemDspChain } from '../dsp/systemChain';

export interface IAudioEngineStatusHook {
  status: IAudioEngineStatus | undefined;
  refresh: () => Promise<void>;
}

let known: IAudioEngineStatus | undefined;
let asking: Promise<void> | undefined;
/**
 * Whether a question arrived while an answer was already on its way.
 *
 * That answer can predate whatever prompted the question — an engine switched
 * after main began reading — so it is asked once more when the first lands.
 * Any number of questions in that window are one more round trip, not many.
 */
let askAgain = false;
/**
 * Bumped by `resetAudioEngineStatus`, so a reply to a question asked before
 * the reset cannot land afterwards and hand the next test the last one's
 * engine.
 */
let generation = 0;
const listeners = new Set<() => void>();
let stopListeningForChanges: (() => void) | undefined;

const askOnce = async (askedIn: number): Promise<void> => {
  try {
    const next = await getAudioEngineStatus();
    if (askedIn !== generation) {
      return;
    }
    // A rack this window already believes it delivered is only true of the
    // engine it was delivered to. `main` can switch engines while the DSP tab
    // sits open, and the freshly chosen one has never seen a byte from here.
    // Forgetting the cache on the first answer that notices is what makes the
    // next publish (see `DspPanel`'s effect on `isSystemWide`) actually send,
    // instead of skipping because the array happens to match last time.
    if (known !== undefined && known.engine !== next.engine) {
      resetSystemDspChain();
    }
    // The same answer keeps the same object. Every question re-renders every
    // holder otherwise — the whole shell among them, each time the DSP tab
    // opens — for a reply that changed nothing.
    if (known !== undefined && JSON.stringify(known) === JSON.stringify(next)) {
      return;
    }
    known = next;
    listeners.forEach((listener) => listener());
  } catch (error) {
    // The page still renders; it simply cannot say which engine is running,
    // and it then says nothing rather than something wrong.
    reportError('the audio engine status could not be read', error);
  }
};

const askUntilCurrent = async (askedIn: number): Promise<void> => {
  try {
    do {
      askAgain = false;
      // eslint-disable-next-line no-await-in-loop -- one question at a time is the point: each repeat exists because the previous answer may be stale.
      await askOnce(askedIn);
    } while (askAgain && askedIn === generation);
  } finally {
    // Cleared in the same continuation that last checked `askAgain`, with no
    // await between them, so a question can never land in a gap where it is
    // neither repeated nor starts a round trip of its own.
    if (askedIn === generation) {
      asking = undefined;
    }
  }
};

/** Ask main again, and bring every holder of the answer up to date. */
export const refreshAudioEngineStatus = (): Promise<void> => {
  if (asking) {
    askAgain = true;
    return asking;
  }
  asking = askUntilCurrent(generation);
  return asking;
};

/** Asked on mount: joins a question already on its way rather than repeating it. */
const ensureAudioEngineStatus = (): void => {
  if (!asking) {
    refreshAudioEngineStatus();
  }
};

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  // One engine-changed listener for the window, held while anything shows the
  // answer. One per holder turned each notification into a round trip per
  // holder.
  stopListeningForChanges ??= subscribeAudioEngineChanged(
    refreshAudioEngineStatus,
  );
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && stopListeningForChanges) {
      stopListeningForChanges();
      stopListeningForChanges = undefined;
    }
  };
};

const readAudioEngineStatus = (): IAudioEngineStatus | undefined => known;

export const useAudioEngineStatus = (): IAudioEngineStatusHook => {
  const status = useSyncExternalStore(
    subscribe,
    readAudioEngineStatus,
    readAudioEngineStatus,
  );

  useEffect(() => {
    ensureAudioEngineStatus();
  }, []);

  return { status, refresh: refreshAudioEngineStatus };
};

/** For a test that wants a window that has not been told anything yet. */
export const resetAudioEngineStatus = (): void => {
  generation += 1;
  known = undefined;
  asking = undefined;
  askAgain = false;
};

export default useAudioEngineStatus;
