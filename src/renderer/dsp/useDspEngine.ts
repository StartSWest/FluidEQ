/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useRef, useState } from 'react';
import log from 'electron-log/renderer';
import { IDspSettings } from '../../common/dsp/chain';
import {
  advanceHeadroom,
  createAdaptiveHeadroom,
  excessDb,
} from './adaptiveHeadroom';
import { TRIM_MARGIN_DB, curveResponseDb } from './rack';
import {
  IAudioGraphContext,
  IAudioNodeLike,
  IDspGraph,
  IWorkletNodeLike,
  buildDspGraph,
} from './graph';
import {
  TDspEngineState,
  setDspAnalyser,
  setDspBandAmounts,
  setDspExciterActivity,
  setDspBandLevels,
  setDspCorrelation,
  setDspHeadroomGiveBack,
  setDspScatter,
  setDspEngineState,
  setDspPeak,
  setDspSampleRate,
} from './store';

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
  /**
   * The adaptive trim's working set, kept across reports.
   *
   * Driven by the worklet's own meter messages rather than by a timer: those
   * arrive every sixteen blocks because audio was processed, so the measurement
   * cadence is the audio's and there is nothing to keep in step by hand.
   */
  const headroom = useRef(createAdaptiveHeadroom());
  /** The chain's response at each analyser bin, and what it was built from.
   * Rebuilt only when the curve moves — recomputing fifteen filters across a
   * thousand bins twenty times a second is most of a core for no new answer. */
  const chainDb = useRef<{ key: string; response: Float32Array }>({
    key: '',
    response: new Float32Array(0),
  });
  /** Reused, because a fresh array twenty times a second is garbage twenty
   * times a second. */
  const programme = useRef(new Float32Array(0));

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
      /**
       * Restoring the audio comes FIRST, and everything after it is guarded.
       *
       * This shipped in the wrong order and cost a silent player: a typo made
       * `setDspAnalyser` undefined, teardown threw on its very first line, and
       * `fallBackToDirectOutput` — the one call that puts sound back after
       * `createMediaElementSource` has captured the element — was never
       * reached. Playback stopped dead and the transport froze with it.
       *
       * The lesson is the ordering, not the typo: teardown runs precisely when
       * something has already gone wrong, so the step that rescues the audio
       * cannot sit behind any step that might fail.
       */
      try {
        graphRef.current?.dispose();
      } catch {
        // A half-built graph may refuse to come apart. The element still has
        // to reach the speakers, so this is not allowed to stop that.
      }
      graphRef.current = undefined;
      fallBackToDirectOutput();
      setDspAnalyser(undefined);
      setActive(false);
      setDspEngineState(next);
    };

    const start = async () => {
      const context = contextRef.current ?? new window.AudioContext();
      contextRef.current = context;
      // Told early: the EQ curve is drawn from coefficients built at this
      // rate, so the panel is wrong until it knows.
      setDspSampleRate(context.sampleRate);
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
      // The worklet reports its correlation measurement back the same way it
      // receives settings. Assigned before the graph is built so the very
      // first block's reading is not dropped on the floor.
      worklet.port.onmessage = (message: MessageEvent<unknown>) => {
        const data = message.data as {
          correlation?: unknown;
          peak?: unknown;
          bandAmounts?: unknown;
          bandLevels?: unknown;
          exciterBands?: unknown;
          exciterOrganic?: unknown;
          scatter?: unknown;
        } | null;
        if (data && typeof data.correlation === 'number') {
          setDspCorrelation(data.correlation);
        }
        if (data && typeof data.peak === 'number') {
          setDspPeak(data.peak);
        }
        if (data && Array.isArray(data.bandAmounts)) {
          setDspBandAmounts(data.bandAmounts as number[]);
        }
        if (data && Array.isArray(data.bandLevels)) {
          setDspBandLevels(data.bandLevels as number[]);
        }
        if (
          data &&
          Array.isArray(data.exciterBands) &&
          typeof data.exciterOrganic === 'number'
        ) {
          setDspExciterActivity(
            data.exciterBands as number[],
            data.exciterOrganic,
          );
        }
        if (data?.scatter instanceof Float32Array) {
          setDspScatter(data.scatter);
        }
        const input = graphRef.current?.inputAnalyser;
        const { eq } = settingsRef.current;
        // Only the part of the reserve that answers the magnitude response
        // may be handed back. The margin above it is there for transients
        // and for reconstruction, neither of which this measurement can see
        // — a spectrum has no transients in it by construction — so giving
        // it away on spectral evidence would be spending it on a promise the
        // evidence cannot make.
        const reserve = Math.max(0, -eq.trimDb - TRIM_MARGIN_DB);
        if (
          !input ||
          !eq.enabled ||
          eq.trimMode !== 'adaptive' ||
          reserve <= 0
        ) {
          // Nothing reserved is nothing to hand back, a disabled rack has no
          // curve to measure against, and a pinned one is being asked to hold
          // exactly the reserve it started with.
          headroom.current.giveBack = 0;
          setDspHeadroomGiveBack(0);
          worklet.port.postMessage({ headroomGiveBack: 0 });
          return;
        }
        const bins = input.frequencyBinCount;
        if (programme.current.length !== bins) {
          programme.current = new Float32Array(bins);
        }
        const key = [
          bins,
          context.sampleRate,
          eq.model,
          eq.modelAmount,
          JSON.stringify(eq.bands),
        ].join('|');
        if (chainDb.current.key !== key) {
          // Bin n is centred at n * rate / fftSize, and the bin count is half
          // the transform, so the spacing is rate / 2 / bins. Bin zero is DC,
          // where no filter response is defined; nudged up rather than
          // skipped so the two arrays stay index-aligned.
          const step = context.sampleRate / 2 / bins;
          const frequencies = Array.from({ length: bins }, (_, index) =>
            Math.max(1, index * step),
          );
          chainDb.current = {
            key,
            response: Float32Array.from(
              curveResponseDb(
                eq.bands,
                frequencies,
                context.sampleRate,
                eq.model,
              ),
            ),
          };
        }
        input.getFloatFrequencyData(programme.current);
        const giveBack = advanceHeadroom(
          headroom.current,
          reserve,
          excessDb(programme.current, chainDb.current.response),
          typeof data?.peak === 'number' && data.peak > 1,
        );
        setDspHeadroomGiveBack(giveBack);
        worklet.port.postMessage({ headroomGiveBack: giveBack });
      };
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
      setDspAnalyser(graphRef.current.analyser);
      setActive(true);
      setDspEngineState('running');
    };

    /**
     * Resume on every play, not once at startup.
     *
     * The bug this fixes: after a restart, pressing play on the track that was
     * already loaded produced no sound AND a transport that did not move —
     * while picking a different track worked, and coming back to the first one
     * then worked too.
     *
     * The context is built during mount, which is before any user gesture
     * exists, so Chrome leaves it `suspended` and the `resume()` in `start`
     * has nothing to act on. That alone would be harmless — except
     * `createMediaElementSource` has by then captured the element, and a
     * captured element's ONLY route to the speakers is the graph. A suspended
     * graph therefore stalls the element itself, which is why the seek froze
     * rather than running silently. Choosing another track remounted the
     * player, and by then a gesture had happened.
     *
     * `play` is the right event because it is raised inside the gesture that
     * started playback, which is exactly when a resume is permitted.
     */
    const resumeForPlayback = () => {
      const context = contextRef.current;
      if (!context || context.state !== 'suspended') {
        return;
      }
      context.resume().catch((error: unknown) => {
        log.error('[dsp] could not resume the context on play', error);
      });
    };
    element.addEventListener('play', resumeForPlayback);

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
      element.removeEventListener('play', resumeForPlayback);
      teardown('idle');
    };
  }, [element]);

  useEffect(() => {
    graphRef.current?.update(settings);
  }, [settings]);

  return { active };
};
