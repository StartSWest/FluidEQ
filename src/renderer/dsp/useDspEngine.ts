/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useRef, useState } from 'react';
import {
  IDspSettings,
  MASTER_LOUDNESS_GAIN_MAX_DB,
  MASTER_LOUDNESS_GAIN_MIN_DB,
} from '../../common/dsp/chain';
import {
  DSP_DIAGNOSTIC_CODES,
  DSP_DIAGNOSTIC_SCHEMA_VERSION,
} from '../../common/dsp/diagnostics';
import {
  IAudioGraphContext,
  IAudioNodeLike,
  IDspGraph,
  IWorkletNodeLike,
  buildDspGraph,
} from './graph';
import {
  TDspEngineState,
  IDspOutputSafetyMeter,
  clearDspAnalysers,
  setDspAnalyser,
  setDspBandAmounts,
  setDspExciterActivity,
  setDspBandLevels,
  setDspChannelPeaks,
  setDspCorrelation,
  setDspScatter,
  setDspEngineState,
  setDspPeak,
  setDspSampleRate,
  setDspOutputSafetyMeter,
  setDspNormalizerMeter,
  useDspOutputSafetyEnabled,
  useDspInputAnalysis,
} from './store';
import { masterLoudnessGainDb, normalizerGainDb } from './inputNormalizer';
import { DSP_OUTPUT_COUNT } from './monitorOutputs';
import { registerDspDeckMixer } from './deckCrossfade';
import { dspErrorValues, reportDspDiagnostic } from './diagnostics';

/** Registered by `dspProcessor.worklet.ts`. */
const PROCESSOR_NAME = 'fluideq-dsp';

const workletUrl = (): URL =>
  new URL(
    process.env.NODE_ENV === 'production'
      ? './dsp-worklet.js'
      : '/dsp-worklet.dev.js',
    window.location.href,
  );

let inputGainPort: MessagePort | undefined;
let pendingInputGainDb = 0;
let pendingMasterLoudnessGainDb = 0;
let pendingInputTrackId = '';

/** Flush source-bound delay before a new track's gain can reach the worklet. */
export const setDspInputTrackId = (
  trackId: string,
  preserveTrackLevelGain = false,
): void => {
  pendingInputTrackId = trackId;
  inputGainPort?.postMessage({
    masterPeakHoldTrackId: pendingInputTrackId,
    preserveTrackLevelGain,
  });
};

/**
 * Update the source normalizer and its final LUFS compensation atomically.
 *
 * They describe one track-level decision. Sending them independently lets an
 * audio quantum observe only half of that decision and, more importantly,
 * gives two different-size dB ramps different finish times.
 */
export const setDspTrackLevelGains = (
  inputGainDb: number,
  masterLoudnessGainDb: number,
): void => {
  pendingInputGainDb = Number.isFinite(inputGainDb)
    ? Math.min(12, Math.max(-48, inputGainDb))
    : 0;
  pendingMasterLoudnessGainDb = Number.isFinite(masterLoudnessGainDb)
    ? Math.min(
        MASTER_LOUDNESS_GAIN_MAX_DB,
        Math.max(MASTER_LOUDNESS_GAIN_MIN_DB, masterLoudnessGainDb),
      )
    : 0;
  inputGainPort?.postMessage({
    trackLevelGains: {
      inputGainDb: pendingInputGainDb,
      masterLoudnessGainDb: pendingMasterLoudnessGainDb,
    },
  });
};

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
  elements: readonly HTMLAudioElement[],
  settings: IDspSettings,
): IEngineState => {
  const [active, setActive] = useState(false);
  const outputSafetyEnabled = useDspOutputSafetyEnabled();
  const inputAnalysis = useDspInputAnalysis();
  const inputGainDb = normalizerGainDb(
    settings.normalizer,
    inputAnalysis.analysis,
  );
  const loudnessGainDb = masterLoudnessGainDb(
    settings.master,
    settings.normalizer,
    inputAnalysis.analysis,
  );
  const contextRef = useRef<AudioContext | undefined>(undefined);
  const sourcesRef = useRef<MediaElementAudioSourceNode[]>([]);
  const deckGainsRef = useRef<GainNode[]>([]);
  const mixerRef = useRef<GainNode | undefined>(undefined);
  const graphRef = useRef<IDspGraph | undefined>(undefined);
  const workletRef = useRef<AudioWorkletNode | undefined>(undefined);
  const settingsRef = useRef(settings);
  const outputSafetyEnabledRef = useRef(outputSafetyEnabled);
  const inputGainDbRef = useRef(inputGainDb);
  const loudnessGainDbRef = useRef(loudnessGainDb);
  const inputTrackIdRef = useRef(inputAnalysis.trackId ?? '');
  settingsRef.current = settings;
  outputSafetyEnabledRef.current = outputSafetyEnabled;
  inputGainDbRef.current = inputGainDb;
  loudnessGainDbRef.current = loudnessGainDb;
  inputTrackIdRef.current = inputAnalysis.trackId ?? '';
  useEffect(() => {
    if (elements.length === 0 || typeof window.AudioContext !== 'function') {
      return undefined;
    }
    let cancelled = false;
    let unregisterDeckMixer: (() => void) | undefined;

    /**
     * Route the captured element straight out, bypassing the chain.
     *
     * The only correct response to a failure once the element has been taken.
     * Doing nothing here is what makes a player mute.
     */
    const fallBackToDirectOutput = () => {
      const context = contextRef.current;
      const sources = sourcesRef.current;
      if (!context || sources.length === 0) {
        return;
      }
      deckGainsRef.current.forEach((gain) => gain.disconnect());
      mixerRef.current?.disconnect();
      sources.forEach((source) => {
        source.disconnect();
        source.connect(context.destination);
      });
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
      const currentWorklet = workletRef.current;
      // Once the graph falls back to direct element output, its deck gains are
      // disconnected. Remove the crossfade registration first so transport can
      // never schedule a fade against those silent, detached nodes and leave
      // both directly connected elements audible.
      unregisterDeckMixer?.();
      unregisterDeckMixer = undefined;
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
      if (inputGainPort === currentWorklet?.port) {
        inputGainPort = undefined;
      }
      workletRef.current = undefined;
      fallBackToDirectOutput();
      clearDspAnalysers();
      setActive(false);
      setDspEngineState(next);
    };

    const start = async () => {
      const context =
        contextRef.current ??
        new window.AudioContext({ latencyHint: 'playback' });
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
        numberOfOutputs: DSP_OUTPUT_COUNT,
        outputChannelCount: Array.from({ length: DSP_OUTPUT_COUNT }, () => 2),
      });
      workletRef.current = worklet;
      inputGainPort = worklet.port;
      worklet.port.postMessage({
        debugOutputSafetyEnabled: outputSafetyEnabledRef.current,
      });
      setDspInputTrackId(inputTrackIdRef.current);
      setDspTrackLevelGains(inputGainDbRef.current, loudnessGainDbRef.current);
      // The worklet reports its correlation measurement back the same way it
      // receives settings. Assigned before the graph is built so the very
      // first block's reading is not dropped on the floor.
      worklet.port.onmessage = (message: MessageEvent<unknown>) => {
        const data = message.data as {
          correlation?: unknown;
          peak?: unknown;
          channelPeaks?: unknown;
          bandAmounts?: unknown;
          bandLevels?: unknown;
          exciterBands?: unknown;
          exciterOrganic?: unknown;
          outputSafety?: unknown;
          scatter?: unknown;
          normalizerMeter?: unknown;
          diagnostic?: unknown;
        } | null;
        if (data?.diagnostic !== undefined) {
          reportDspDiagnostic(data.diagnostic);
        }
        if (data && typeof data.correlation === 'number') {
          setDspCorrelation(data.correlation);
        }
        if (data && typeof data.peak === 'number') {
          setDspPeak(data.peak);
        }
        if (
          data &&
          Array.isArray(data.channelPeaks) &&
          data.channelPeaks.every(
            (value) => typeof value === 'number' && Number.isFinite(value),
          )
        ) {
          setDspChannelPeaks(data.channelPeaks as number[]);
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
        if (
          data?.outputSafety instanceof Object &&
          typeof (data.outputSafety as { enabled?: unknown }).enabled ===
            'boolean'
        ) {
          const safety = data.outputSafety as IDspOutputSafetyMeter;
          if (
            safety.postFilterNormalizer instanceof Object &&
            Number.isFinite(safety.postFilterNormalizer.gainReductionDb) &&
            Number.isFinite(safety.postFilterNormalizer.inputTruePeakDb) &&
            Number.isFinite(safety.gainReductionDb) &&
            Number.isFinite(safety.inputTruePeakDb) &&
            Number.isFinite(safety.dcCorrectionDb) &&
            Number.isFinite(safety.repairedSamples) &&
            (safety.truePeakFactor === 1 ||
              safety.truePeakFactor === 2 ||
              safety.truePeakFactor === 4)
          ) {
            setDspOutputSafetyMeter(safety);
          }
        }
        if (data?.scatter instanceof Float32Array) {
          setDspScatter(data.scatter);
        }
        if (
          data?.normalizerMeter instanceof Object &&
          Array.isArray(
            (data.normalizerMeter as { inputPeaks?: unknown }).inputPeaks,
          ) &&
          Array.isArray(
            (data.normalizerMeter as { outputPeaks?: unknown }).outputPeaks,
          )
        ) {
          const meter = data.normalizerMeter as {
            inputPeaks: unknown[];
            outputPeaks: unknown[];
            appliedGainDb?: unknown;
          };
          if (
            meter.inputPeaks.length === 2 &&
            meter.outputPeaks.length === 2 &&
            meter.inputPeaks.every(
              (value) => typeof value === 'number' && Number.isFinite(value),
            ) &&
            meter.outputPeaks.every(
              (value) => typeof value === 'number' && Number.isFinite(value),
            ) &&
            typeof meter.appliedGainDb === 'number' &&
            Number.isFinite(meter.appliedGainDb)
          ) {
            setDspNormalizerMeter({
              inputPeaks: meter.inputPeaks as [number, number],
              outputPeaks: meter.outputPeaks as [number, number],
              appliedGainDb: meter.appliedGainDb,
            });
          }
        }
      };
      // The point of no return. Both stable decks are captured once and mixed
      // before the worklet, so a transition is two real decoders overlapping
      // through the same DSP chain rather than a fade to silence and back.
      const sources =
        sourcesRef.current.length === elements.length
          ? sourcesRef.current
          : elements.map((element) =>
              context.createMediaElementSource(element),
            );
      sourcesRef.current = sources;
      const mixer = mixerRef.current ?? context.createGain();
      mixerRef.current = mixer;
      const deckGains =
        deckGainsRef.current.length === sources.length
          ? deckGainsRef.current
          : sources.map(() => context.createGain());
      deckGainsRef.current = deckGains;
      sources.forEach((source, index) => {
        const deckGain = deckGains[index];
        if (!deckGain) {
          return;
        }
        source.disconnect();
        deckGain.disconnect();
        source.connect(deckGain);
        deckGain.connect(mixer);
        deckGain.gain.value = index === 0 ? 1 : 0;
      });
      unregisterDeckMixer = registerDspDeckMixer(context, elements, deckGains);
      if (settingsRef.current.enabled) {
        graphRef.current = buildDspGraph(
          context as unknown as IAudioGraphContext,
          mixer as unknown as IAudioNodeLike,
          worklet as unknown as IWorkletNodeLike,
          context.destination as unknown as IAudioNodeLike,
          settingsRef.current,
        );
        setDspAnalyser('normalizer', graphRef.current.analysers.normalizer);
        setDspAnalyser('exciter', graphRef.current.analysers.exciter);
        setDspAnalyser('eq', graphRef.current.analysers.eq);
        setDspAnalyser('compressor', graphRef.current.analysers.compressor);
        setDspAnalyser('maximizer', graphRef.current.analysers.maximizer);
        setDspAnalyser('master', graphRef.current.analysers.master);
      } else {
        mixer.connect(context.destination);
      }
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
        reportDspDiagnostic({
          schemaVersion: DSP_DIAGNOSTIC_SCHEMA_VERSION,
          code: DSP_DIAGNOSTIC_CODES.engineResumeFailed,
          severity: 'error',
          origin: 'renderer',
          values: dspErrorValues(error),
        });
      });
    };
    elements.forEach((element) =>
      element.addEventListener('play', resumeForPlayback),
    );

    start().catch((error: unknown) => {
      reportDspDiagnostic({
        schemaVersion: DSP_DIAGNOSTIC_SCHEMA_VERSION,
        code: DSP_DIAGNOSTIC_CODES.engineStartFailed,
        severity: 'error',
        origin: 'renderer',
        values: dspErrorValues(error),
      });
      teardown('failed');
    });

    return () => {
      cancelled = true;
      elements.forEach((element) =>
        element.removeEventListener('play', resumeForPlayback),
      );
      teardown('idle');
    };
  }, [elements]);

  useEffect(() => {
    const context = contextRef.current;
    const mixer = mixerRef.current;
    const worklet = workletRef.current;
    if (!context || !mixer || !worklet) {
      return;
    }
    if (!settings.enabled) {
      if (graphRef.current) {
        graphRef.current.dispose();
        graphRef.current = undefined;
        mixer.connect(context.destination);
        clearDspAnalysers();
      }
      return;
    }
    if (!graphRef.current) {
      mixer.disconnect();
      graphRef.current = buildDspGraph(
        context as unknown as IAudioGraphContext,
        mixer as unknown as IAudioNodeLike,
        worklet as unknown as IWorkletNodeLike,
        context.destination as unknown as IAudioNodeLike,
        settings,
      );
      setDspAnalyser('normalizer', graphRef.current.analysers.normalizer);
      setDspAnalyser('exciter', graphRef.current.analysers.exciter);
      setDspAnalyser('eq', graphRef.current.analysers.eq);
      setDspAnalyser('compressor', graphRef.current.analysers.compressor);
      setDspAnalyser('maximizer', graphRef.current.analysers.maximizer);
      setDspAnalyser('master', graphRef.current.analysers.master);
      return;
    }
    graphRef.current.update(settings);
  }, [settings]);

  useEffect(() => {
    workletRef.current?.port.postMessage({
      debugOutputSafetyEnabled: outputSafetyEnabled,
    });
  }, [outputSafetyEnabled]);

  useEffect(() => {
    setDspInputTrackId(inputAnalysis.trackId ?? '');
  }, [inputAnalysis.trackId]);

  useEffect(() => {
    setDspTrackLevelGains(inputGainDb, loudnessGainDb);
  }, [inputGainDb, loudnessGainDb]);

  return { active };
};
