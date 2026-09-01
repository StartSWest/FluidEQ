/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The switch, bound to the store.
 *
 * Four lines of effect around `nativeBackend.ts`, which holds everything worth
 * testing. The split is deliberate: an ordering bug — the device opened before
 * the chain arrived — is a real defect with a real symptom, and it belongs
 * somewhere a test can reach without a renderer.
 */
import { useCallback, useEffect, useRef } from 'react';
import { IDspSettings } from '../../common/dsp/chain';
import {
  INativeBackendController,
  createNativeBackendController,
} from './nativeBackend';
import {
  INativeMirror,
  INativeMirrorState,
  createNativeMirror,
} from './nativeMirror';
import { INativeMetersBridge, createNativeMeters } from './nativeMeters';
import { ANALYSIS_BINS } from '../../common/dsp/analysisWire';
import {
  setDspNativeNoiseProfileSink,
  setDspNativeTrackGainSink,
} from './useDspEngine';
import { DECK_EMPTY, DECK_ENDED } from '../../common/dsp/deckState';
import {
  clearDspNativeTransport,
  setDspNativeDeviceGeneration,
  setDspNativeTransport,
  useDspNativeDeviceGeneration,
  setDspNativeState,
  useDspNativeState,
  useDspOutputSafetyEnabled,
} from './store';

/**
 * The preload bridge, read through a widening rather than declared present.
 *
 * This module is imported by tests that never load a preload, and asserting a
 * global that is genuinely absent there is a lie the type system would repeat.
 */
const bridgeOf = ():
  Parameters<typeof createNativeBackendController>[0] | undefined => {
  const found = (
    window as unknown as {
      electron?: {
        ipcRenderer?: Record<string, unknown>;
      };
    }
  ).electron?.ipcRenderer;
  return typeof found?.startDspHost === 'function'
    ? (found as unknown as Parameters<typeof createNativeBackendController>[0])
    : undefined;
};

/**
 * Returns the controller while the native backend is the selected one.
 *
 * `undefined` when it is not, which is what makes the caller's fallback a
 * branch rather than a flag it has to remember to check — there is nothing to
 * call, so nothing can be called by mistake.
 */
export const useNativeBackend = (
  settings: IDspSettings,
  hasLibraryAudioTrack = true,
): INativeBackendController | undefined => {
  const nativeState = useDspNativeState();
  const outputSafetyEnabled = useDspOutputSafetyEnabled();
  const controllerRef = useRef<INativeBackendController | undefined>(undefined);
  const settingsRef = useRef(settings);
  const safetyRef = useRef(outputSafetyEnabled);
  // Assigned at render rather than in an effect: an effect below may read them
  // in the same commit, and child effects run before a parent's.
  settingsRef.current = settings;
  safetyRef.current = outputSafetyEnabled;

  useEffect(() => {
    if (!hasLibraryAudioTrack) {
      /**
       * Having a track, not playing one. See `usePlayerEngine`.
       *
       * This was `isPlaying` and it made pause a lifecycle event: engine down,
       * mirror torn down, elements handed the audio back, engine up again on
       * the next press. Video library items and an empty deck still have
       * nothing for an audio-only engine to do, and those are the stable facts
       * this now turns on.
       */
      controllerRef.current = undefined;
      setDspNativeState('idle');
      return undefined;
    }
    const bridge = bridgeOf();
    if (!bridge) {
      /**
       * No preload, so no host and no way to get one. Browser playback has to
       * stay audible; saying so is what stops its media elements being muted.
       *
       * `idle` rather than `failed` because nothing was attempted and there is
       * nothing for a user to act on. A packaged app always has its preload —
       * this is the harness, a test renderer, or a window still coming up.
       */
      setDspNativeState('idle');
      return undefined;
    }
    const controller = createNativeBackendController(bridge);
    let isCurrent = true;
    controllerRef.current = controller;
    controller
      .engage(settingsRef.current, safetyRef.current)
      .then(async (ready) => {
        if (!isCurrent) {
          // The player paused or unmounted while the host was negotiating its
          // endpoint. The old continuation must not overwrite `idle` with a
          // stale failure or leave a late-ready process running unowned.
          if (ready) {
            await controller.disengage();
          }
          return ready;
        }
        if (!ready) {
          // The supervisor has already reported why. Dropping the controller
          // rather than retrying keeps a host that cannot start from being
          // asked again on every settings change.
          controllerRef.current = undefined;
        }
        // Both outcomes reported, and the failure is the one that matters: it
        // keeps browser playback audible instead of muting it for an engine
        // that never started.
        setDspNativeState(ready ? 'engaged' : 'failed');
        return ready;
      })
      .catch(() => {
        if (!isCurrent) {
          return;
        }
        controllerRef.current = undefined;
        // `failed`, not `idle`: a rejected start is a host that was asked for
        // and did not arrive, which is exactly what the notice is for. Idle
        // means nothing has been attempted.
        setDspNativeState('failed');
      });

    return () => {
      isCurrent = false;
      controllerRef.current = undefined;
      setDspNativeState('idle');
      controller.disengage().catch(() => undefined);
    };
  }, [hasLibraryAudioTrack]);

  useEffect(() => {
    controllerRef.current
      ?.update(settings, outputSafetyEnabled)
      .catch(() => undefined);
  }, [settings, outputSafetyEnabled]);

  /**
   * The track-level gains, routed to the host for as long as it is audible.
   *
   * `setDspTrackLevelGains` is the single funnel every one of them passes
   * through, and it reached the worklet and nothing else — so auto-normalize
   * and the LUFS makeup were both silently inert on the native engine. Loud
   * tracks stayed loud and quiet ones stayed quiet, with the panel showing the
   * gain it had calculated and no engine applying it.
   *
   * Registered against the controller so it lives exactly as long as the engine
   * does, and cleared on release rather than left pointing at a host that has
   * gone.
   */
  const controller = controllerRef.current;
  useEffect(() => {
    if (!controller) {
      return undefined;
    }
    setDspNativeTrackGainSink((inputGainDb, masterLoudnessGainDb) => {
      controller.transport
        .setTrackGains(inputGainDb, masterLoudnessGainDb)
        .catch(() => undefined);
    });
    // The measured floor travels the same way and for the same reason: it is
    // analysis rather than a control, so nothing else in the settings path
    // would ever carry it to the host.
    setDspNativeNoiseProfileSink((profile) => {
      controller.transport.setNoiseProfile(profile).catch(() => undefined);
    });
    return () => {
      setDspNativeTrackGainSink(undefined);
      setDspNativeNoiseProfileSink(undefined);
    };
  }, [controller]);

  /**
   * Handed over only once the host has FINISHED engaging, never before.
   *
   * `controllerRef` is assigned synchronously, the moment the effect runs, but
   * `engage` is asynchronous: it spawns the process, waits for the handshake,
   * pushes the chain and only then opens the device. Returning the controller
   * on the strength of the ref alone published it while all of that was still
   * in flight, and the mirror would immediately mute the elements and start
   * issuing load, select and play at a host with no open endpoint.
   *
   * The audible result was silence, and only on the FIRST switch — because
   * `disengage` leaves the process running, so every later engage resolves fast
   * enough to hide it. That is what made it look intermittent: it was a race,
   * and the second attempt always won.
   *
   * Gating on the state means the mirror cannot exist before the engine is
   * ready to be mirrored, which is the same rule as the chain going in before
   * the device.
   */
  return nativeState === 'engaged' ? controllerRef.current : undefined;
};

/**
 * Notice when the host has moved to a different endpoint.
 *
 * A reopen — following the default output to new headphones, or recovering a
 * device that went away — rebuilds the chain and the player, and a rebuilt
 * player has no decks. The endpoint is then correct and every deck is empty, so
 * changing the output was handled and the music still stopped.
 *
 * Only this side knows what was playing and where, so the generation counter in
 * telemetry is the host asking for it back.
 */
export const useNativeDeviceGeneration = (
  controller: INativeBackendController | undefined,
): void => {
  useEffect(() => {
    if (!controller) {
      return undefined;
    }
    const bridge = bridgeOf() as unknown as
      | {
          onDspHostTelemetry?: (
            listener: (frame: { deviceGeneration: number }) => void,
          ) => () => void;
        }
      | undefined;
    if (typeof bridge?.onDspHostTelemetry !== 'function') {
      return undefined;
    }
    return bridge.onDspHostTelemetry((frame) =>
      setDspNativeDeviceGeneration(frame.deviceGeneration),
    );
  }, [controller]);
};

/**
 * The seek bar and end-of-track, from the engine that is making the sound.
 *
 * Every consumer of this used to read a muted `<audio>` element that decoded
 * the same file a second time purely to be a clock. Two clocks that could
 * disagree — and did, for an evening: a deck cued at the position the previous
 * track had reached played from the middle while the bar read zero, each side
 * telling the truth about a different player.
 *
 * Cleared when the engine lets go, for the reason `useNativeMeters` gives
 * about the analysers: anything else leaves the bar frozen on the last frame
 * of a transport that has stopped.
 */
/**
 * The playhead, at the rate the interface can actually use it.
 *
 * Telemetry arrives about forty times a second, and this position is read by
 * `LibraryPlayerContext` — the provider the whole library tab hangs off. Passed
 * through raw it re-rendered that entire subtree forty times a second, for a
 * clock that displays whole seconds and a scrubber whose own step is 100 ms.
 *
 * That was a tenfold increase introduced by moving the clock to the host: the
 * element reported `timeupdate` four times a second and the player was built
 * around that cadence. Nothing on screen needs more, and the renderer cannot
 * afford it — at forty a second the allocation rate alone drove the heap to its
 * ceiling, and a garbage collector running flat out is a frozen window.
 *
 * A quarter of a second is that original cadence, restored. It is a rounding of
 * the VALUE rather than a rate limit on the frames: the store already drops an
 * update where every field matches, so quantising here is what makes it drop
 * them. Nothing waits, nothing is scheduled, and a position that genuinely
 * moves still arrives on the very next frame.
 */
const POSITION_STEP_SECONDS = 0.25;

const quantizePosition = (seconds: number): number =>
  Math.round(seconds / POSITION_STEP_SECONDS) * POSITION_STEP_SECONDS;

export const useNativeTransport = (
  controller: INativeBackendController | undefined,
): void => {
  useEffect(() => {
    if (!controller) {
      clearDspNativeTransport();
      return undefined;
    }
    const bridge = bridgeOf() as unknown as
      | {
          onDspHostTelemetry?: (
            listener: (frame: {
              deckState: number;
              deckPositionSeconds: number;
              deckDurationSeconds: number;
            }) => void,
          ) => () => void;
        }
      | undefined;
    if (typeof bridge?.onDspHostTelemetry !== 'function') {
      return undefined;
    }
    const stop = bridge.onDspHostTelemetry((frame) => {
      setDspNativeTransport({
        hasSource: frame.deckState !== DECK_EMPTY,
        positionSeconds: quantizePosition(frame.deckPositionSeconds),
        durationSeconds: frame.deckDurationSeconds,
        ended: frame.deckState === DECK_ENDED,
      });
    });
    return () => {
      stop();
      clearDspNativeTransport();
    };
  }, [controller]);
};

/**
 * Point the panel's graphs at the native engine while it is the audible one.
 *
 * Keyed on the controller, so it lives exactly as long as the engine it
 * reports on: the analysers are registered when the host engages and cleared
 * when it lets go. Any other lifetime leaves the panel drawing a frozen frame
 * from an engine that has stopped, which is the same defect this fixes.
 */
export const useNativeMeters = (): void => {
  const nativeState = useDspNativeState();
  useEffect(() => {
    if (nativeState !== 'engaged') {
      return undefined;
    }
    const bridge = bridgeOf() as unknown as INativeMetersBridge | undefined;
    if (typeof bridge?.onDspHostAnalysis !== 'function') {
      return undefined;
    }
    const meters = createNativeMeters(bridge, ANALYSIS_BINS);
    return () => meters.release();
  }, [nativeState]);
};

/**
 * Keep the native engine in step with the player, and mute the elements.
 *
 * The element keeps every job it has — position, events, the queue's advance,
 * the crossfade's cue — and only the sound moves. That is what makes this an
 * A/B rather than two players: everything except the audio path is identical,
 * so the difference being listened for is not buried under a dozen others.
 */
export const useNativeMirror = (
  controller: INativeBackendController | undefined,
  elements: readonly HTMLMediaElement[],
  state: INativeMirrorState,
): ((positionMs: number) => void) => {
  const mirrorRef = useRef<INativeMirror | undefined>(undefined);
  const stateRef = useRef(state);
  stateRef.current = state;
  /**
   * Rebuilt when the host moves to a different endpoint.
   *
   * A reopen leaves every deck empty, and building a mirror is exactly the work
   * of putting a track back: it mutes the elements, loads the current file,
   * seeks to where the element already is and plays if the element is playing.
   * Depending on the generation therefore re-cues without a second code path
   * that would have to be kept in step with .
   */
  const deviceGeneration = useDspNativeDeviceGeneration();

  useEffect(() => {
    if (!controller) {
      return undefined;
    }
    const mirror = createNativeMirror(controller, elements);
    mirrorRef.current = mirror;
    // Immediately, not on the next tick: the switch can be flipped mid-track
    // and the host should pick up where the element already is.
    mirror.sync(stateRef.current);
    return () => {
      mirrorRef.current = undefined;
      /**
       * Whether the listener still wants sound, read at the moment of teardown.
       *
       * `stateRef` and not a captured value: this cleanup closes over the
       * render that created the mirror, and the thing that usually tears it
       * down is precisely a change to `isPlaying`. A captured `true` would hand
       * the elements back running every time somebody pressed Pause.
       *
       * Two opposite reasons reach this line. The DSP switch going off
       * mid-track has to leave the music playing on the elements; the listener
       * pressing Stop or Pause disengages the engine too — see the effect above,
       * keyed on whether library audio is playing — and must leave them alone.
       * Only the player knows which, so it is asked.
       */
      mirror.release(stateRef.current.isPlaying);
    };
  }, [controller, elements, deviceGeneration]);

  useEffect(() => {
    mirrorRef.current?.sync(state);
  }, [state.mediaPath, state.isPlaying, state.positionMs, state]);

  /**
   * The scrubber's way through to the deck that is audible.
   *
   * Stable for the life of the player and reads the mirror through the ref, so
   * it does not change identity when the engine is rebuilt around a new
   * endpoint — every callback that takes it downstream would otherwise be
   * rebuilt with it, on a path where the seek and the rebuild race.
   *
   * A no-op while there is no mirror rather than an optional: the caller
   * already knows whether the host owns the transport, from telemetry, and
   * that is a different question from whether the mirror exists.
   */
  return useCallback((positionMs: number) => {
    mirrorRef.current?.seek(positionMs);
  }, []);
};
