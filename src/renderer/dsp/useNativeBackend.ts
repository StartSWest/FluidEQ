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
import { useEffect, useMemo, useRef } from 'react';
import { IDspSettings, TCrossfadeCurve } from '../../common/dsp/chain';
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
  setDspNativeState,
  useDspBackend,
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
): INativeBackendController | undefined => {
  const backend = useDspBackend();
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
    if (backend !== 'native') {
      const running = controllerRef.current;
      controllerRef.current = undefined;
      setDspNativeState('idle');
      running?.disengage().catch(() => undefined);
      return undefined;
    }
    const bridge = bridgeOf();
    if (!bridge) {
      /**
       * No preload, so no host and no way to get one. The TypeScript chain has
       * to keep processing; saying so is what stops it standing down.
       *
       * `idle` rather than `failed` because nothing was attempted and there is
       * nothing for a user to act on. A packaged app always has its preload —
       * this is the harness, a test renderer, or a window still coming up.
       */
      setDspNativeState('idle');
      return undefined;
    }
    const controller = createNativeBackendController(bridge);
    controllerRef.current = controller;
    controller
      .engage(settingsRef.current, safetyRef.current)
      .then((ready) => {
        if (!ready) {
          // The supervisor has already reported why. Dropping the controller
          // rather than retrying keeps a host that cannot start from being
          // asked again on every settings change.
          controllerRef.current = undefined;
        }
        // Both outcomes reported, and the failure is the one that matters: it
        // is what keeps the TypeScript chain processing instead of standing
        // down for an engine that never started.
        setDspNativeState(ready ? 'engaged' : 'failed');
        return ready;
      })
      .catch(() => {
        controllerRef.current = undefined;
        // `failed`, not `idle`: a rejected start is a host that was asked for
        // and did not arrive, which is exactly what the notice is for. Idle
        // means nothing has been attempted.
        setDspNativeState('failed');
      });

    return () => {
      controllerRef.current = undefined;
      setDspNativeState('idle');
      controller.disengage().catch(() => undefined);
    };
  }, [backend]);

  useEffect(() => {
    controllerRef.current
      ?.update(settings, outputSafetyEnabled)
      .catch(() => undefined);
  }, [settings, outputSafetyEnabled]);

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
  return backend === 'native' && nativeState === 'engaged'
    ? controllerRef.current
    : undefined;
};

/**
 * Point the panel's graphs at the native engine while it is the audible one.
 *
 * Keyed on the controller, so it lives exactly as long as the engine it
 * reports on: the analysers are registered when the host engages and cleared
 * when it lets go. Any other lifetime leaves the panel drawing a frozen frame
 * from an engine that has stopped, which is the same defect this fixes.
 */
export const useNativeMeters = (
  controller: INativeBackendController | undefined,
): void => {
  useEffect(() => {
    if (!controller) {
      return undefined;
    }
    const bridge = bridgeOf() as unknown as INativeMetersBridge | undefined;
    if (typeof bridge?.onDspHostAnalysis !== 'function') {
      return undefined;
    }
    const meters = createNativeMeters(bridge, ANALYSIS_BINS);
    return () => meters.release();
  }, [controller]);
};

/**
 * What the player may ask of the mirror, beyond it shadowing state on its own.
 *
 * One method rather than the whole mirror, because everything else the mirror
 * does is driven by the state it is handed. A crossfade is the exception: it is
 * an event with a duration and a curve, and there is no state for it to notice.
 */
export interface INativeMirrorHandle {
  crossfade: (
    incomingPath: string,
    durationMs: number,
    curve: TCrossfadeCurve,
  ) => Promise<boolean>;
}

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
): INativeMirrorHandle => {
  const mirrorRef = useRef<INativeMirror | undefined>(undefined);
  const stateRef = useRef(state);
  stateRef.current = state;

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
      mirror.release();
    };
  }, [controller, elements]);

  useEffect(() => {
    mirrorRef.current?.sync(state);
  }, [state.mediaPath, state.isPlaying, state.positionMs, state]);

  /**
   * Stable across renders, because the player holds it in a callback that its
   * own handoff depends on. A new identity every render would rebuild that
   * callback and, through it, the effect that owns the track transition.
   */
  return useMemo(
    () => ({
      crossfade: (incomingPath, durationMs, curve) =>
        mirrorRef.current?.crossfade(incomingPath, durationMs, curve) ??
        Promise.resolve(false),
    }),
    [],
  );
};
