/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useRef, useState } from 'react';
import log from 'electron-log/renderer';
import { IDspSettings } from '../../common/dsp/chain';
import {
  IAudioGraphContext,
  IAudioNodeLike,
  IDspGraph,
  IWorkletNodeLike,
  buildDspGraph,
} from './graph';
import { TDspEngineState, setDspEngineState } from './store';

/** Registered by `dspProcessor.worklet.ts`. */
const PROCESSOR_NAME = 'fluideq-dsp';

const workletUrl = (): URL =>
  new URL(
    process.env.NODE_ENV === 'production'
      ? './dsp-worklet.js'
      : '/dsp-worklet.dev.js',
    window.location.href,
  );

interface IEngineState {
  /** True only while the graph is built and audio is flowing through it. */
  active: boolean;
}

/**
 * Put the DSP chain between the library player and the speakers.
 *
 * Everything here exists to protect one property: **the player never goes
 * silent.** No DSP is a disappointment; no audio is a broken app, and the two
 * failure modes look identical to a user who pressed play.
 *
 * Two facts about Web Audio make that harder than it looks, and both fail
 * silently rather than throwing something legible:
 *
 *  1. **`createMediaElementSource` may be called once per element, for the
 *     life of that element, and it cannot be undone.** From the moment it is
 *     called, the element no longer reaches the speakers on its own — the
 *     graph is the only path out. So a later failure cannot be handled by
 *     disconnecting: that leaves the audio going nowhere. It has to be handled
 *     by wiring the source straight to the destination instead.
 *
 *  2. **A context starts suspended** until a user gesture, and `resume()` can
 *     reject.
 *
 * Hence the ordering below, which is the whole design: every step that can
 * fail runs BEFORE the element is captured. Load the worklet module, resume
 * the context, and only then take the element — so the common failures leave
 * playback completely untouched, and the one irreversible step is the last
 * one. Past that point, `fallBackToDirectOutput` is the safety net.
 */
export const useDspEngine = (
  element: HTMLAudioElement | undefined,
  settings: IDspSettings,
): IEngineState => {
  const [active, setActive] = useState(false);
  const contextRef = useRef<AudioContext | undefined>(undefined);
  const sourceRef = useRef<MediaElementAudioSourceNode | undefined>(undefined);
  const graphRef = useRef<IDspGraph | undefined>(undefined);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  useEffect(() => {
    if (!element || typeof window.AudioContext !== 'function') {
      return undefined;
    }
    let cancelled = false;

    /**
     * Route the captured element straight out, bypassing the chain.
     *
     * The only correct response to a failure once the element has been taken.
     * Doing nothing here is what makes a player mute.
     */
    const fallBackToDirectOutput = () => {
      const context = contextRef.current;
      const source = sourceRef.current;
      if (!context || !source) {
        return;
      }
      source.disconnect();
      source.connect(context.destination);
    };

    /**
     * Take the chain down and route the element straight out.
     *
     * `next` is the state to report, and the two callers want different ones:
     * a rejected `start` is a genuine failure the panel should warn about,
     * while unmounting is not — reporting `failed` there would leave a red
     * notice behind for a chain that was simply put away.
     */
    const teardown = (next: TDspEngineState) => {
      graphRef.current?.dispose();
      graphRef.current = undefined;
      fallBackToDirectOutput();
      setActive(false);
      setDspEngineState(next);
    };

    const start = async () => {
      const context = contextRef.current ?? new window.AudioContext();
      contextRef.current = context;
      // Both of these can fail, and neither has touched the element yet.
      await context.audioWorklet.addModule(workletUrl().href);
      await context.resume();
      if (cancelled) {
        return;
      }
      const worklet = new AudioWorkletNode(context, PROCESSOR_NAME, {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [2],
      });
      // The point of no return. Cached because a second call throws.
      const source =
        sourceRef.current ?? context.createMediaElementSource(element);
      sourceRef.current = source;
      graphRef.current = buildDspGraph(
        context as unknown as IAudioGraphContext,
        source as unknown as IAudioNodeLike,
        worklet as unknown as IWorkletNodeLike,
        context.destination as unknown as IAudioNodeLike,
        settingsRef.current,
      );
      setActive(true);
      setDspEngineState('running');
    };

    start().catch((error: unknown) => {
      // Context-rich before it is flattened: the message alone does not say
      // whether the module load, the resume or the graph failed, and the
      // user-visible symptom of all three is the same.
      // eslint-disable-next-line no-console -- the one exception the standards allow
      console.error('[dsp] engine failed to start', error);
      log.error('[dsp] engine failed to start', error);
      teardown('failed');
    });

    return () => {
      cancelled = true;
      teardown('idle');
    };
  }, [element]);

  useEffect(() => {
    graphRef.current?.update(settings);
  }, [settings]);

  return { active };
};
