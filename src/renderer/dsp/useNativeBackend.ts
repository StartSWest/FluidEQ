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
import { useEffect, useRef } from 'react';
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
import { useDspBackend, useDspOutputSafetyEnabled } from './store';

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
      running?.disengage().catch(() => undefined);
      return undefined;
    }
    const bridge = bridgeOf();
    if (!bridge) {
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
        return ready;
      })
      .catch(() => undefined);

    return () => {
      controllerRef.current = undefined;
      controller.disengage().catch(() => undefined);
    };
  }, [backend]);

  useEffect(() => {
    controllerRef.current
      ?.update(settings, outputSafetyEnabled)
      .catch(() => undefined);
  }, [settings, outputSafetyEnabled]);

  return backend === 'native' ? controllerRef.current : undefined;
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
): void => {
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
};
