/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { useEffect, useSyncExternalStore } from 'react';
import { ISmartEqSettings } from 'common/constants';
import type { ISongEqEntry } from 'common/songEq';
import type { ISongIdentity } from 'common/songIdentity';
import {
  ISongEqRecorderState,
  TSongEqEffect,
  TSongEqEvent,
  getInitialRecorderState,
  reduceSongEq,
} from 'common/songEqRecorder';
import {
  checkpointSongEq,
  commitSongEq,
  forgetSongEq,
  lookupSongEq,
  setSmartEq as setSmartEqApi,
} from 'renderer/utils/equalizerApi';
import { useFluidEqContext } from 'renderer/utils/FluidEqContext';
import {
  getSmartEqMode,
  isContinuousMode,
  setSmartEqMode,
} from 'renderer/utils/smartEqMode';
import { useNowPlayingIdentity } from './nowPlayingIdentity';

/**
 * Drives Task 3's reducer from the real world, and decides nothing.
 *
 * Every rule about when a song is recorded, saved or restored already lives
 * in `reduceSongEq` (and `songEqTiming.ts` underneath it). This file's only
 * job is the three things a pure reducer cannot do for itself: notice that
 * the world changed (a song started, the output switched, somebody moved a
 * slider), keep a clock running while nothing else does, and perform the
 * effects the reducer hands back. Anywhere this file appears to be making a
 * feature decision, that decision belongs in the reducer instead.
 *
 * Plain module state rather than a component, for the same reason
 * `smartEqRun.ts` is one: a recording must not end because a tab holding the
 * hook happened to unmount. `useSongEqSessionHost` is mounted once, above the
 * workspace tabs, and everything else here is how the rest of the app reaches
 * what it is doing.
 *
 * TWO THINGS ONLY THIS FILE CAN KNOW, AND BOTH MATTER:
 *
 * 1. Which write was its own. Applying a matched layer calls
 *    `FluidEqContext`'s `setSmartEq`, and that value comes back around as the
 *    next `smartEq` this module reads out of context — indistinguishable, on
 *    the face of it, from somebody loading a different profile. `expectedEcho`
 *    below is how the shell recognises its own reflection before it ever
 *    reaches the reducer as a `layerChanged` event. (`reduceSongEq`'s own
 *    `isSameLayer` guard would in fact also catch this specific case today,
 *    because the value mirrored into context is the exact object this module
 *    just wrote — but that guard lives in the reducer for the reducer's own
 *    reasons, and this module should not depend on it to avoid dispatching
 *    an event it already knows is not news.)
 * 2. Which effect belongs to which lookup. A lookup answers after an
 *    `await`, by which time an entirely different song can be playing; the
 *    `matched` event this module dispatches always carries the identity the
 *    *lookup* was asked about, never whatever `useNowPlayingIdentity` returns
 *    at the moment the answer lands. The reducer rejects a mismatch, and
 *    passing the wrong identity would defeat that guard silently.
 */

/** How long the "we remembered this" notice stays up before it fades itself,
 * mirroring the status bubble's own linger window in `SmartEqEngine`. */
const SONG_EQ_NOTICE_LINGER_MS = 6000;

const SONG_EQ_SAVE_STORAGE_KEY = 'fluideq.songEq.save';

export interface ISongEqRecordingStatus {
  isSaveOn: boolean;
  /** Wall-clock ms accumulated on the song now open, including the run in
   * progress. Zero with nothing open. */
  listenedMs: number;
  title?: string;
  /** Whether continuing to listen, with saving on, ends in a saved entry. */
  willSave: boolean;
}

type TSongEqNotice = { identity: ISongIdentity; entry: ISongEqEntry };

/* --- subscriptions: one set feeds every hook below, exactly as
   smartEqRun.ts's single `listeners` set feeds its several published
   fields --- */

const listeners = new Set<() => void>();
const emit = (): void => listeners.forEach((listener) => listener());
const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/* --- the recorder itself --- */

let state: ISongEqRecorderState = getInitialRecorderState();
let notice: TSongEqNotice | undefined;
let noticeTimer: ReturnType<typeof setTimeout> | undefined;

/**
 * Distinguishes "nothing pending" from "expecting an echo of exactly
 * `undefined`" — clearing the layer is itself a value `applyLayer` can carry,
 * so `undefined` cannot double as the sentinel for "no echo expected".
 */
const NO_ECHO = Symbol('song-eq-no-echo');
let expectedEcho: ISmartEqSettings | undefined | typeof NO_ECHO = NO_ECHO;

/**
 * Registered by the host as it mounts, mirroring `registerSmartEqControl` in
 * `smartEqRun.ts`: this module performs effects outside any component, so it
 * needs a live handle onto the context setter rather than one frozen at
 * import time. Absent for the instant before the host is up, in which case an
 * `applyLayer` effect simply has nowhere to land on screen yet — the IPC
 * write below still reaches Equalizer APO regardless.
 */
let liveSmartEqSetter:
  ((settings: ISmartEqSettings | undefined) => void) | undefined;

const DEFAULT_RECORDING_STATUS: ISongEqRecordingStatus = {
  isSaveOn: false,
  listenedMs: 0,
  willSave: false,
};

const computeRecording = (
  recorderState: ISongEqRecorderState,
  at: number,
): ISongEqRecordingStatus => {
  const { session } = recorderState;
  return {
    isSaveOn: recorderState.isSaveOn,
    listenedMs: session
      ? session.listenedMs +
        (session.playingSince === undefined ? 0 : at - session.playingSince)
      : 0,
    title: session?.identity.title,
    willSave: recorderState.isSaveOn && session !== undefined,
  };
};

let recordingSnapshot: ISongEqRecordingStatus = computeRecording(
  state,
  Date.now(),
);

const clearNoticeTimer = (): void => {
  if (noticeTimer !== undefined) {
    clearTimeout(noticeTimer);
    noticeTimer = undefined;
  }
};

const showNotice = (identity: ISongIdentity, entry: ISongEqEntry): void => {
  clearNoticeTimer();
  notice = { identity, entry };
  noticeTimer = setTimeout(() => {
    notice = undefined;
    noticeTimer = undefined;
    emit();
  }, SONG_EQ_NOTICE_LINGER_MS);
  emit();
};

/** Every effect the reducer can hand back, and nothing it did not ask for. */
const performEffects = (effects: TSongEqEffect[]): void => {
  effects.forEach((effect) => {
    switch (effect.kind) {
      case 'lookup': {
        const { identity, deviceId } = effect;
        lookupSongEq(deviceId, identity)
          .then((entry) =>
            // The identity the LOOKUP was asked about, never whatever is
            // playing when the answer lands: a track change in between must
            // not let a stale answer apply the wrong song's curve, and the
            // reducer's own mismatch guard depends on being handed the same
            // identity it was asked to look up.
            dispatchSongEq({ kind: 'matched', identity, entry }, Date.now()),
          )
          .catch(() => {
            // No answer is the same as no memory of this song for our
            // purposes: a 'matched' with no entry is already a no-op in the
            // reducer, so there is nothing worth dispatching here.
          });
        break;
      }
      case 'applyLayer': {
        const { settings } = effect;
        // `smartEq` in context will read back exactly this object once the
        // setter below lands — remembered so the very next `layerChanged`
        // this write itself produces is recognised as this module's own
        // rather than as somebody moving a slider. See the module comment.
        expectedEcho = settings;
        liveSmartEqSetter?.(settings);
        setSmartEqApi(settings).catch(() => {
          // Reported nowhere on purpose, matching every other Smart EQ write
          // in this app (see SmartEqEngine): a background write failing here
          // has no banner to raise it to, and the next checkpoint or match
          // tries again.
        });
        break;
      }
      case 'checkpoint':
        checkpointSongEq(effect.deviceId, effect.identity, effect.layer).catch(
          () => {
            // Best-effort: the commit that follows when the song ends makes
            // the same write again, with the same or better information.
          },
        );
        break;
      case 'commit':
        commitSongEq(effect.deviceId, effect.identity, effect.layer).catch(
          () => {
            // Best-effort, matching every background Smart EQ write here:
            // there is no banner to raise a background failure to.
          },
        );
        break;
      case 'notice':
        showNotice(effect.identity, effect.entry);
        break;
      default: {
        // TSongEqEffect is a fully-covered discriminated union; see the
        // matching guard in songEqRecorder.ts for why this still has to
        // exist for the compiler and for eslint's exhaustiveness rules.
        const exhaustive: never = effect;
        throw new Error(
          `Unhandled songEq effect: ${JSON.stringify(exhaustive)}`,
        );
      }
    }
  });
};

const dispatchSongEq = (event: TSongEqEvent, at: number): void => {
  const [nextState, effects] = reduceSongEq(state, event, at);
  state = nextState;
  recordingSnapshot = computeRecording(state, at);
  performEffects(effects);
  emit();
};

/* --- the notice toast --- */

export const useSongEqNotice = (): TSongEqNotice | undefined =>
  useSyncExternalStore(
    subscribe,
    () => notice,
    () => undefined,
  );

export const dismissSongEqNotice = (): void => {
  if (notice === undefined && noticeTimer === undefined) {
    return;
  }
  clearNoticeTimer();
  notice = undefined;
  emit();
};

export const undoSongEqLoan = (): void => {
  dispatchSongEq({ kind: 'undo' }, Date.now());
  // The toast that offered Undo has nothing left to say once it has been
  // pressed.
  dismissSongEqNotice();
};

/** Forgets whatever this output remembers about the song currently open, or
 * about the one the notice is still naming if none is. Storage only: the
 * reducer has no `forget` event, because forgetting does not change whether
 * the song in progress keeps being timed — only what gets written when it
 * eventually is. */
export const forgetCurrentSongEq = (): void => {
  const identity = state.session?.identity ?? notice?.identity;
  if (!identity) {
    return;
  }
  forgetSongEq(state.deviceId, identity.key).catch(() => {
    // Best-effort: a failed forget leaves the old entry standing, which is
    // the safe direction to fail in — the alternative is claiming it is gone
    // when it is not.
  });
  dismissSongEqNotice();
};

/* --- the recording status the tick and the badge draw --- */

export const useSongEqRecording = (): ISongEqRecordingStatus =>
  useSyncExternalStore(
    subscribe,
    () => recordingSnapshot,
    () => DEFAULT_RECORDING_STATUS,
  );

/* --- whether saving is on, persisted exactly like smartEqMode.ts --- */

const readSongEqSaveOn = (): boolean => {
  try {
    return window.localStorage.getItem(SONG_EQ_SAVE_STORAGE_KEY) === 'true';
  } catch {
    // Storage can be unavailable. Off is the safe default for a switch that
    // writes music history to disk.
    return false;
  }
};

let saveOn: boolean = readSongEqSaveOn();

export const getSongEqSaveOn = (): boolean => saveOn;

export const setSongEqSaveOn = (isSaveOn: boolean): void => {
  if (isSaveOn === saveOn) {
    return;
  }
  saveOn = isSaveOn;
  try {
    window.localStorage.setItem(SONG_EQ_SAVE_STORAGE_KEY, String(isSaveOn));
  } catch {
    // Not worth failing the toggle over; the choice still applies this
    // session, and will simply not be remembered into the next one.
  }
  // Ticking this on with nothing continuous running would leave the badge
  // promising a save with no ongoing measurement behind it to save one from.
  // 'detail' is the same mode `smartEqMode.ts` already migrates the old
  // single continuous setting to. Ticking off leaves whatever mode is running
  // running — this switch is about saving, not about Smart EQ itself.
  if (isSaveOn && !isContinuousMode(getSmartEqMode())) {
    setSmartEqMode('detail');
  }
  dispatchSongEq({ kind: 'saveToggled', isSaveOn }, Date.now());
};

export const useSongEqSaveOn = (): boolean =>
  useSyncExternalStore(subscribe, getSongEqSaveOn, () => false);

/* --- the host --- */

export const useSongEqSessionHost = (): void => {
  const {
    smartEq,
    activeDeviceId,
    setSmartEq: setLiveSmartEq,
  } = useFluidEqContext();
  const identity = useNowPlayingIdentity();

  // Registered once: `setSmartEq` from context is a plain useState setter and
  // is stable for the life of the provider, so there is nothing to re-run
  // this effect over.
  useEffect(() => {
    liveSmartEqSetter = setLiveSmartEq;
    return () => {
      if (liveSmartEqSetter === setLiveSmartEq) {
        liveSmartEqSetter = undefined;
      }
    };
  }, [setLiveSmartEq]);

  useEffect(() => {
    dispatchSongEq(
      { kind: 'deviceChanged', deviceId: activeDeviceId },
      Date.now(),
    );
  }, [activeDeviceId]);

  useEffect(() => {
    // `useNowPlayingIdentity` collapses to `undefined` the instant playback
    // is not actually happening — see that hook's own comment — so its
    // presence already means "this is what is actually playing right now".
    dispatchSongEq(
      { kind: 'nowPlaying', identity, isPlaying: identity !== undefined },
      Date.now(),
    );
  }, [identity]);

  useEffect(() => {
    if (expectedEcho !== NO_ECHO && smartEq === expectedEcho) {
      // Our own write reflected back through context — see the module
      // comment on `expectedEcho`. Not news to the reducer.
      expectedEcho = NO_ECHO;
      return;
    }
    expectedEcho = NO_ECHO;
    dispatchSongEq({ kind: 'layerChanged', layer: smartEq }, Date.now());
  }, [smartEq]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      dispatchSongEq({ kind: 'tick' }, Date.now());
    }, 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    // This fires as the window is already on its way out. Nothing here waits
    // for the dispatch to finish, and nothing downstream may assume it does:
    // the promises a 'closing' checkpoint or hand-back kicks off have no time
    // left to settle before the process is gone. The two-minute checkpoint
    // already on disk is the actual guarantee that a song is not lost — this
    // is a best-effort top-up for whatever was learned since, not a save this
    // shell can be relied on to complete.
    const onBeforeUnload = () => {
      dispatchSongEq({ kind: 'closing' }, Date.now());
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);
};
