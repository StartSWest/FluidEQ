/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  DSP_DEFAULTS,
  IDspSettings,
  clampDspSettings,
  EQ_MAX_BAND_COUNT,
  MASTER_LOUDNESS_GAIN_MAX_DB,
  MASTER_LOUDNESS_GAIN_MIN_DB,
} from '../../../common/dsp/chain';
import {
  ICrossoverState,
  createCrossoverState,
  splitBands,
} from '../crossover';
import {
  ICompressorState,
  createCompressorState,
  processBandLinked,
} from '../compressor';
import {
  ILinkedLimiterState,
  createLinkedLimiterState,
  processLinkedLimiter,
} from '../limiter';
import {
  IExciterChannelState,
  createExciterChannel,
  exciterChannelIsActive,
  runExciterChannel,
} from '../exciterStage';
import {
  IPhaseAlignState,
  alignChannel,
  createPhaseAlign,
} from '../phaseAlign';
import {
  IOrganicPathState,
  createOrganicPath,
  resetOrganicPathTransient,
  runOrganicPath,
} from '../organicStage';
import { organicExciterReturnGain } from '../exciterGuard';
import {
  IBiquadCoefficients,
  IBiquadState,
  biquadCoefficients,
  createBiquadState,
  processBiquad,
} from '../biquad';
import {
  processEqBands,
  processEqBandsLinked,
  processEqOversampled,
  processEqOversampledLinked,
} from '../eqEngine';
import {
  IBandDynamics,
  createBandDynamics,
  refreshBandDynamics,
} from '../dynamics';
import { LINEAR_PHASE_LATENCY } from '../linearPhase';
import {
  IDelayLineState,
  createDelayLine,
  processDelayLine,
} from '../delayLine';
import {
  CONVOLVER_WARMUP,
  IConvolverKernel,
  IConvolverState,
  convolve,
  convolveBlend,
  createConvolver,
} from '../convolver';
import {
  IOversamplerState,
  createOversampler,
  downsample,
  oversampleFactorForSampleRate,
  upsample,
} from '../oversample';
import {
  ISaturatorState,
  createSaturator,
  fuzzBlend,
  fuzzDrive,
  saturateBlock,
} from '../saturate';
import {
  IOutputSafetyState,
  OUTPUT_SAFETY_CEILING_DB,
  OUTPUT_SAFETY_EXTREME_DBTP,
  createOutputSafety,
  processOutputSafety,
  takeOutputSafetyTelemetry,
} from '../outputSafety';
import {
  IPostFilterNormalizerState,
  createPostFilterNormalizer,
  processPostFilterNormalizer,
  rebasePostFilterNormalizer,
  resetPostFilterNormalizer,
  takePostFilterNormalizerTelemetry,
} from '../postFilterNormalizer';
import { DSP_OUTPUT_INDEX } from '../monitorOutputs';
import { FilterTypeEnum } from '../../../common/constants';

/** Web Audio always renders 128 frames; the scratch buffers start there. */
const RENDER_QUANTUM = 128;
const EXCITER_SMOOTHING_MS = 18;
const EQ_ISOLATE_SMOOTHING_MS = 18;
/** Background analysis settles Normalizer and Master LUFS together over 2 s. */
const TRACK_LEVEL_ANALYSIS_TRANSITION_MS = 2_000;
const NORMALIZER_METER_RELEASE_MS = 350;
const MAXIMIZER_RELEASE_HOLD_MS = 10;
const MAXIMIZER_SOFT_KNEE_DB = 1.5;
/** Completes even the slowest 1 s release inside four seconds. */
const MAXIMIZER_RELEASE_SNAP_RATIO = 0.02;

/** Stereo. A third channel reuses the second one's filter state. */
const CHANNELS = 2;

/** MessagePort data can originate in a different JavaScript realm. */
const isMessageObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/**
 * Blocks between correlation reports.
 *
 * Sixteen at 128 frames is about every 43 ms, which is fast enough to watch and
 * slow enough that the meter is not posting a message 375 times a second.
 */
const METER_BLOCKS = 16;

/** Pairs kept per report. Enough to draw a shape, few enough to post. */
const SCATTER_PAIRS = 256;

/** One pair kept out of every this many. */
const SCATTER_STRIDE = 4;
const IS_DEV_BUILD = process.env.NODE_ENV !== 'production';

/**
 * The time-critical DSP chain, in one processor.
 *
 * One node rather than eleven, and that is a correctness decision before it is
 * a tidiness one: a crossover built from separate BiquadFilterNodes puts each
 * band on its own path through the graph, and any difference in node latency
 * between those paths misaligns the bands by samples when they are summed. A
 * single processor cannot have that class of bug, because there is only one
 * path.
 *
 * The exciter moved here when it became three independently filtered diode
 * sidechains plus Organic and Timing. Keeping them in this node makes their
 * state and smoothing sample-continuous and avoids separate native paths with
 * different latency.
 *
 * Settings arrive over the port rather than as AudioParams: they are a
 * structured object, and a change to any of them is a user turning a knob, not
 * something needing sample-accurate automation.
 */
class DspProcessor extends AudioWorkletProcessor {
  private settings: IDspSettings = DSP_DEFAULTS;

  private readonly crossovers: ICrossoverState[] = [];

  /** One gain envelope per band, shared by L/R to preserve stereo position. */
  private readonly compressors: ICompressorState[] = [
    createCompressorState(),
    createCompressorState(),
    createCompressorState(),
  ];

  /** One envelope for L/R, applied only after any Mid/Side path is decoded. */
  private maximizerLimiter: ILinkedLimiterState | undefined;

  /** Always last, after every stereo-domain decode and user processor. */
  private outputSafety: IOutputSafetyState;

  /** Stable true-peak headroom between all creative filters and Master gain. */
  private postFilterNormalizer: IPostFilterNormalizerState;

  /** Resets latched safety gain only when the programme itself changes. */
  private peakHoldTrackId = '';

  /** Production is always protected; development may bypass it for A/B. */
  private outputSafetyEnabled = true;

  /** Shared across channels so a trim gesture cannot pull the image sideways. */
  private masterGainNow = 1;

  /** Renderer-derived from one cached whole-track LUFS measurement. */
  private masterLoudnessGainTargetDb = 0;

  private masterLoudnessGainNowDb = 0;

  private masterLoudnessGainStartDb = 0;

  /** Constant per track, ramped only when a track or mode changes. */
  private inputGainNow = 1;

  private inputGainTargetDb = 0;

  private inputGainStartDb = 0;

  /** One progress clock keeps normalization and LUFS makeup phase-locked. */
  private trackLevelTransitionFrames = 0;

  private trackLevelTransitionElapsedFrames = 0;

  /** The first gain pair after a source boundary belongs to the new track. */
  private trackLevelGainsNeedSnap = false;

  /** One filter state per band per channel, so the two never share history. */
  private readonly eqStates: IBiquadState[][] = [];

  /** One per channel, for the subsonic high pass ahead of the bands. */
  private readonly subsonicStates: IBiquadState[] = [];

  /**
   * One per channel, and only while the phase mode is linear.
   *
   * Undefined rather than idle when the mode is minimum: a convolver holds a
   * ring of input spectra, and keeping one fed through material it is not
   * filtering would cost the whole partitioned transform per block for output
   * nobody reads.
   */
  /**
   * One follower per band per channel, outliving every settings message.
   *
   * The envelope is the last few milliseconds of audio. Rebuilding these when a
   * neighbouring band moved would drop that history and open the band from
   * silence mid-note, which is a click on every drag — so `refreshBandDynamics`
   * repoints them and the array is only regrown when the rack changes length.
   */
  private readonly bandDynamics: IBandDynamics[][] = [];

  /** Rack positions of the enabled bands, so a report can be indexed the way
   * the graph is rather than the way the coefficients are. */
  private liveBandIndex: number[] = [];

  /**
   * The reacting bands on their own, for the linear-phase path.
   *
   * The kernel carries the static curve and cannot carry these — a fixed
   * filter cannot change what it does from what it hears — so they run after
   * the convolution as biquads. Held separately rather than filtered per
   * block, because that would allocate on the audio thread every 128 samples.
   */
  private dynamicCoefficients: IBiquadCoefficients[] = [];

  /** Where each of those sits in the full band list, so its follower and its
   * coefficients stay together. */
  private dynamicSlots: number[] = [];

  /** What each band is applying, by rack position. 1 for a static band. */
  private bandAmounts: number[] = [];

  /** Each band's detected level in dBFS, by rack position. Silent below the
   * floor, so a band with nothing in it does not report a finite number. */
  private bandLevels: number[] = [];

  /**
   * The same latency for the channel that is not being filtered.
   *
   * Mid/side filters the middle or the sides and passes the other through, so
   * with linear phase running one of them arrived 181 ms ahead of the other and
   * the two were then summed back into left and right. That is not a
   * colouration, it is the image coming apart. Built once because it is a fixed
   * 8704 samples and rebuilding it would drop the audio inside it.
   */
  private readonly bypassDelays: IDelayLineState[] = [];

  /** The dry reference for EQ isolate, delayed beside a linear-phase rack. */
  private readonly eqIsolateDelays: IDelayLineState[] = [];

  /**
   * Matching resamplers for the isolate reference.
   *
   * An oversampling round trip is not transparent in time: 2x delays by 31
   * base-rate samples and 4x by 46.5. Subtracting the current dry sample from
   * that delayed output produces a comb-filtered double that sounds like a
   * short reverb. The reference therefore takes the identical resampling path
   * before it is removed. Separate EQ and colour states mirror the two
   * sequential round trips the processed signal can take.
   */
  private readonly eqIsolateOversamplers: IOversamplerState[] = [];

  private readonly eqIsolateColourOversamplers: IOversamplerState[] = [];

  /** One per channel; one is ordinary wet output and zero is wet minus dry. */
  private readonly eqDryMix = [1, 1];

  private convolvers: IConvolverState[] | undefined;

  /**
   * The replacement, fed in parallel until it is worth listening to.
   *
   * A fresh convolver's ring is empty, so its first partition of output is
   * silence with nothing to do with the audio. Swapping to it outright is a
   * 10 ms hole on every kernel change — a drag's worth of them is exactly what
   * "the EQ micro-cuts when I move it" sounds like.
   */
  private convolversNext: IConvolverState[] | undefined;

  /** Samples of warm-up left before the handover may begin. */
  private convolverWarmup = 0;

  /**
   * Initial latency before a newly-created magnitude monitor contains audio.
   * Minimum Isolate is muted during this window; subtracting a live dry signal
   * from an empty convolver is the full-song leak this monitor exists to stop.
   */
  private convolverPriming = 0;

  /** How much of the replacement is being heard, 0 to 1. Per channel, because
   * the two run their own states and must arrive together. */
  private convolverBlend: number[] = [];

  /** Somewhere to run the second convolver without allocating per block. */
  private readonly convolverScratch = new Float32Array(RENDER_QUANTUM);

  private subsonicCoefficients: IBiquadCoefficients | undefined;

  /** The side channel's high pass, for the mono-below control. */
  private readonly sideHighpassState: IBiquadState = createBiquadState();

  private monoBelowCoefficients: IBiquadCoefficients | undefined;

  /** One per channel: the fuzz stage carries its own oversampler. */
  private readonly fuzz: ISaturatorState[] = [];

  /**
   * One per channel: the exciter's filters, shapers and smoothing all carry
   * channel-local history.
   */
  private readonly exciters: IExciterChannelState[] = [];

  /** Organic follows the same L, R, Mid and Side paths as the whole Exciter. */
  private readonly organic: IOrganicPathState[] = [];

  /** Body-return gain per path, smoothed like the three band Amount controls. */
  private readonly organicMix: number[] = [];

  /** One aligner per L, R, Mid and Side path; its delay lines carry history. */
  private readonly aligners: IPhaseAlignState[] = [];

  /** What the exciter last actually contributed, for the card to draw. */
  private exciterBands: number[] = [0, 0, 0];

  private exciterOrganic = 0;

  /** One per channel: the oversampler's filters keep history across blocks. */
  private readonly eqOversamplers: IOversamplerState[] = [];

  /** Preselected reacting-band states; rebuilt only when EQ settings change. */
  private dynamicEqStates: IBiquadState[][] = [[], []];

  private dynamicBandDynamics: IBandDynamics[][] = [[], []];

  /** Doubled-rate scratch, used only while oversampling is on. */
  private blockLength = RENDER_QUANTUM;

  private eqDoubled = new Float32Array(RENDER_QUANTUM * 4);

  private eqWork = new Float32Array(RENDER_QUANTUM);

  private eqDryWork = new Float32Array(RENDER_QUANTUM);

  private eqWetWork = new Float32Array(RENDER_QUANTUM);

  private eqDryDoubled = new Float32Array(RENDER_QUANTUM * 4);

  private eqWetDoubled = new Float32Array(RENDER_QUANTUM * 4);

  /** Pair scratch used only when Stereo dynamic bands share one detector. */
  private eqLinkedDoubled: Float32Array[] = Array.from(
    { length: CHANNELS },
    () => new Float32Array(RENDER_QUANTUM * 4),
  );

  private eqLinkedDryDoubled: Float32Array[] = Array.from(
    { length: CHANNELS },
    () => new Float32Array(RENDER_QUANTUM * 4),
  );

  private eqLinkedWetDoubled: Float32Array[] = Array.from(
    { length: CHANNELS },
    () => new Float32Array(RENDER_QUANTUM * 4),
  );

  private eqLinkedWork: Float32Array[] = this.eqLinkedDoubled.map((buffer) =>
    buffer.subarray(0, RENDER_QUANTUM),
  );

  private eqLinkedDryWork: Float32Array[] = this.eqLinkedDryDoubled.map(
    (buffer) => buffer.subarray(0, RENDER_QUANTUM),
  );

  private eqLinkedWetWork: Float32Array[] = this.eqLinkedWetDoubled.map(
    (buffer) => buffer.subarray(0, RENDER_QUANTUM),
  );

  private eqCoefficients: IBiquadCoefficients[] = [];

  /** What the coefficients were built from, so they rebuild only on a change. */
  private eqSignature = '';

  private lookAheadSamples = 0;

  /** Correlation accumulators, reset each time the meter reports. */
  private sumLeftRight = 0;

  private sumLeftSquared = 0;

  private sumRightSquared = 0;

  private blocksSinceReport = 0;

  /**
   * Whether anything is on screen to receive a meter frame.
   *
   * Audio keeps playing behind a minimised window, so this report kept firing
   * into a renderer nobody was looking at — and every frame of it woke ten
   * store writes and re-rendered every graph subscribed to them, to paint a
   * window that is not being composited. Switched off at the source rather
   * than dropped on arrival: the correlation, the per-band envelopes and the
   * scatter slice are all computed to build the message, and none of that is
   * worth doing for a message that will be discarded.
   *
   * The accumulators are still reset on schedule while this is off — see
   * `resetMeterAccumulators`. Letting them run would overflow the scatter
   * buffer and hand back one enormous stale window on the first frame after
   * the window is restored.
   */
  private metersEnabled = true;

  /**
   * Stand down: the native engine is the one being heard.
   *
   * While the A/B switch is on native, the element is muted and this chain's
   * output goes nowhere — but every filter in it still ran, once per quantum,
   * for audio no one could hear. Two complete DSP chains on one machine is
   * how an A/B ends up measuring the CPU rather than the code.
   *
   * A separate flag from `settings.enabled`, which is the user's own bypass
   * and belongs to the panel. Overloading it would make the switch fight the
   * control beside it.
   */
  private standingDown = false;

  /**
   * A thinned scatter of the pairs leaving the chain, for the goniometer.
   *
   * Every fourth pair rather than all of them: a report covers about two
   * thousand samples per channel and a display three centimetres across
   * cannot show two thousand dots, so the rest would be copied across a
   * thread and thrown away. Four still traces the shape of anything periodic
   * enough to have one.
   *
   * Taken here, after the mid/side decode, because that is where the samples
   * are left and right again — measured before it, the display would show
   * the middle against the difference, which is a different picture that
   * happens to look plausible.
   */
  private readonly scatter = new Float32Array(SCATTER_PAIRS * 2);

  private scatterAt = 0;

  private scatterSkip = 0;

  /** Largest sample seen since the last report, in linear full-scale units. */
  private peak = 0;

  /** Same measurement kept per channel so a rail cannot be assigned to both. */
  private readonly channelPeaks = [0, 0];

  /** Actual samples around the first stage, accumulated for its own meter. */
  private readonly normalizerInputPeaks = [0, 0];

  private readonly normalizerOutputPeaks = [0, 0];

  /** Scratch for the parallel engine, so the audio thread never allocates. */
  private eqDry = new Float32Array(RENDER_QUANTUM);

  private eqWet = new Float32Array(RENDER_QUANTUM);

  private eqLinkedDry: Float32Array[] = Array.from(
    { length: CHANNELS },
    () => new Float32Array(RENDER_QUANTUM),
  );

  private eqLinkedWet: Float32Array[] = Array.from(
    { length: CHANNELS },
    () => new Float32Array(RENDER_QUANTUM),
  );

  /** Original signal at the EQ boundary, before its filters. */
  private eqInput: Float32Array[] = Array.from(
    { length: CHANNELS },
    () => new Float32Array(RENDER_QUANTUM),
  );

  /** The same reference kept continuously ready for linear-phase subtraction. */
  private eqDelayedInput: Float32Array[] = Array.from(
    { length: CHANNELS },
    () => new Float32Array(RENDER_QUANTUM),
  );

  /** Four-times-rate work for the isolate reference's matching round trips. */
  private eqIsolateOversampled: Float32Array[] = Array.from(
    { length: CHANNELS },
    () => new Float32Array(RENDER_QUANTUM * 4),
  );

  /** Three crossover buffers per channel for the stereo-linked compressor. */
  private compressorBands: Float32Array[][] = Array.from(
    { length: CHANNELS },
    () => [
      new Float32Array(RENDER_QUANTUM),
      new Float32Array(RENDER_QUANTUM),
      new Float32Array(RENDER_QUANTUM),
    ],
  );

  /** The same buffers transposed by band; built off the render hot path. */
  private compressorBandChannels: Float32Array[][] = [0, 1, 2].map((band) =>
    this.compressorBands.map((channel) => channel[band]),
  );

  constructor() {
    super();
    this.outputSafety = createOutputSafety(CHANNELS, sampleRate);
    this.postFilterNormalizer = createPostFilterNormalizer(
      CHANNELS,
      sampleRate,
      oversampleFactorForSampleRate(sampleRate),
    );
    for (let channel = 0; channel < CHANNELS; channel += 1) {
      this.crossovers.push(createCrossoverState());
      // Allocated to the ceiling once, here, rather than grown when a rack
      // changes size: this runs on the audio thread, and allocating inside
      // `process` is what produces a dropout at the exact moment the user
      // touches the control. Sixty-four idle states per channel is a few
      // kilobytes of numbers.
      this.eqStates.push(
        Array.from({ length: EQ_MAX_BAND_COUNT }, () => createBiquadState()),
      );
      this.eqOversamplers.push(createOversampler());
      this.subsonicStates.push(createBiquadState());
      this.bypassDelays.push(createDelayLine(LINEAR_PHASE_LATENCY));
      this.eqIsolateDelays.push(createDelayLine(LINEAR_PHASE_LATENCY));
      this.eqIsolateOversamplers.push(createOversampler());
      this.eqIsolateColourOversamplers.push(createOversampler());
      this.fuzz.push(createSaturator(RENDER_QUANTUM));
    }
    this.rebuildLimiters();
    this.port.onmessage = (event: MessageEvent<unknown>) => {
      const { data } = event;
      // The linear-phase kernel arrives on its own message, not folded into the
      // settings. It is built in the renderer because it costs about two
      // milliseconds — fine inside a frame, fatal inside a 2.7 ms callback —
      // and it changes only when the curve does, while settings arrive on every
      // pixel of a drag.
      if (isMessageObject(data) && 'debugOutputSafetyEnabled' in data) {
        const requested = (data as { debugOutputSafetyEnabled?: unknown })
          .debugOutputSafetyEnabled;
        const enabled = IS_DEV_BUILD ? requested !== false : true;
        if (enabled !== this.outputSafetyEnabled) {
          this.outputSafetyEnabled = enabled;
          // Do not reuse a frozen look-ahead buffer after an A/B bypass.
          this.outputSafety = createOutputSafety(CHANNELS, sampleRate);
        }
        return;
      }
      if (isMessageObject(data) && 'standDown' in data) {
        this.standingDown =
          (data as { standDown?: unknown }).standDown === true;
        return;
      }
      if (isMessageObject(data) && 'metersEnabled' in data) {
        this.metersEnabled =
          (data as { metersEnabled?: unknown }).metersEnabled !== false;
        return;
      }
      if (isMessageObject(data) && 'masterPeakHoldTrackId' in data) {
        const message = data as {
          masterPeakHoldTrackId?: unknown;
          preserveTrackLevelGain?: unknown;
        };
        const requested = message.masterPeakHoldTrackId;
        const trackId = typeof requested === 'string' ? requested : '';
        if (trackId !== this.peakHoldTrackId) {
          this.peakHoldTrackId = trackId;
          // A direct load has no audible predecessor and starts at its cached
          // gain. A completed two-deck handoff is already audible, so retain
          // its current pair and let the shared two-second trajectory reach
          // the incoming track's Normalizer/LUFS values without a level step.
          this.trackLevelGainsNeedSnap =
            message.preserveTrackLevelGain !== true;
          resetPostFilterNormalizer(this.postFilterNormalizer);
          // A source boundary is not an A/B toggle. Empty every delayed sample
          // so the previous song cannot play under the next song's gain.
          this.outputSafety = createOutputSafety(CHANNELS, sampleRate);
          this.normalizerInputPeaks[0] = 0;
          this.normalizerInputPeaks[1] = 0;
          this.normalizerOutputPeaks[0] = 0;
          this.normalizerOutputPeaks[1] = 0;
        }
        return;
      }
      if (isMessageObject(data) && 'trackLevelGains' in data) {
        const requested = (
          data as {
            trackLevelGains?: {
              inputGainDb?: unknown;
              masterLoudnessGainDb?: unknown;
            };
          }
        ).trackLevelGains;
        const inputGainDb =
          typeof requested?.inputGainDb === 'number' &&
          Number.isFinite(requested.inputGainDb)
            ? Math.min(12, Math.max(-48, requested.inputGainDb))
            : 0;
        const masterLoudnessGainDb =
          typeof requested?.masterLoudnessGainDb === 'number' &&
          Number.isFinite(requested.masterLoudnessGainDb)
            ? Math.min(
                MASTER_LOUDNESS_GAIN_MAX_DB,
                Math.max(
                  MASTER_LOUDNESS_GAIN_MIN_DB,
                  requested.masterLoudnessGainDb,
                ),
              )
            : 0;
        // The player publishes immediately and the React store confirms the
        // same pair afterwards. Treat that confirmation as idempotent instead
        // of restarting an in-flight transition and stretching its duration.
        if (
          !this.trackLevelGainsNeedSnap &&
          inputGainDb === this.inputGainTargetDb &&
          masterLoudnessGainDb === this.masterLoudnessGainTargetDb
        ) {
          return;
        }
        if (
          !this.trackLevelGainsNeedSnap &&
          inputGainDb !== this.inputGainTargetDb
        ) {
          // Any attenuation learned while an uncached song was still at raw
          // unity describes the wrong input level. Keep the delay continuous,
          // but discard that obsolete held decision so first play and replay
          // converge on the same analysed result.
          rebasePostFilterNormalizer(this.postFilterNormalizer);
        }
        if (this.trackLevelGainsNeedSnap) {
          this.inputGainNow = 10 ** (inputGainDb / 20);
          this.masterLoudnessGainNowDb = masterLoudnessGainDb;
          this.trackLevelGainsNeedSnap = false;
          this.trackLevelTransitionFrames = 0;
          this.trackLevelTransitionElapsedFrames = 0;
        } else {
          this.inputGainStartDb =
            20 * Math.log10(Math.max(1e-12, this.inputGainNow));
          this.masterLoudnessGainStartDb = this.masterLoudnessGainNowDb;
          const hasMove =
            inputGainDb !== this.inputGainStartDb ||
            masterLoudnessGainDb !== this.masterLoudnessGainStartDb;
          this.trackLevelTransitionFrames = hasMove
            ? Math.ceil(
                (TRACK_LEVEL_ANALYSIS_TRANSITION_MS / 1_000) * sampleRate,
              )
            : 0;
          this.trackLevelTransitionElapsedFrames = 0;
        }
        this.inputGainTargetDb = inputGainDb;
        this.masterLoudnessGainTargetDb = masterLoudnessGainDb;
        return;
      }
      if (isMessageObject(data) && 'eqKernel' in data) {
        const { eqKernel } = data as { eqKernel: IConvolverKernel | undefined };
        if (!eqKernel) {
          this.convolvers = undefined;
          this.convolversNext = undefined;
          this.convolverPriming = 0;
          return;
        }
        const built = Array.from({ length: CHANNELS }, () =>
          createConvolver(eqKernel),
        );
        if (!this.convolvers) {
          // Nothing playing through one yet, so there is nothing to fade from.
          this.convolvers = built;
          this.convolverPriming = LINEAR_PHASE_LATENCY;
          return;
        }
        this.convolversNext = built;
        this.convolverWarmup = CONVOLVER_WARMUP;
        this.convolverBlend = new Array(CHANNELS).fill(0);
        return;
      }
      this.settings = clampDspSettings(data);
      this.rebuildLimiters();
      this.refreshEq();
    };
  }

  /**
   * Replace the Maximizer limiter only when the look-ahead actually changed.
   *
   * Rebuilding them on every settings message would drop the delay line's
   * contents mid-stream, which is an audible click on every knob turn.
   */
  private rebuildLimiters(): void {
    const samples = Math.max(
      1,
      Math.round((this.settings.maximizer.lookAheadMs / 1_000) * sampleRate),
    );
    if (samples === this.lookAheadSamples && this.maximizerLimiter) {
      return;
    }
    this.lookAheadSamples = samples;
    this.maximizerLimiter = createLinkedLimiterState(
      CHANNELS,
      samples,
      oversampleFactorForSampleRate(sampleRate),
    );
  }

  /**
   * Views of the oversampling scratch at exactly the current factor's length.
   *
   * `subarray` is a view rather than a copy, but it still allocates the view
   * object — so it happens here, when the factor or the block length changes,
   * and never inside `process`. Handing the engine a buffer longer than the
   * work would make it filter the unused tail as though it were audio.
   */
  private rebuildOversampleViews(): void {
    const length = this.blockLength * Math.max(1, this.settings.eq.oversample);
    this.eqWork = this.eqDoubled.subarray(0, length);
    this.eqDryWork = this.eqDryDoubled.subarray(0, length);
    this.eqWetWork = this.eqWetDoubled.subarray(0, length);
    this.eqLinkedWork = this.eqLinkedDoubled.map((buffer) =>
      buffer.subarray(0, length),
    );
    this.eqLinkedDryWork = this.eqLinkedDryDoubled.map((buffer) =>
      buffer.subarray(0, length),
    );
    this.eqLinkedWetWork = this.eqLinkedWetDoubled.map((buffer) =>
      buffer.subarray(0, length),
    );
  }

  private ensureScratch(length: number): void {
    if (this.compressorBands[0]?.[0]?.length === length) {
      return;
    }
    this.blockLength = length;
    this.eqDry = new Float32Array(length);
    this.eqInput = Array.from(
      { length: CHANNELS },
      () => new Float32Array(length),
    );
    this.eqDelayedInput = Array.from(
      { length: CHANNELS },
      () => new Float32Array(length),
    );
    this.eqIsolateOversampled = Array.from(
      { length: CHANNELS },
      () => new Float32Array(length * 4),
    );
    // Allocated for the largest factor once, so changing it never allocates.
    this.eqDoubled = new Float32Array(length * 4);
    this.eqDryDoubled = new Float32Array(length * 4);
    this.eqWetDoubled = new Float32Array(length * 4);
    this.eqLinkedDoubled = Array.from(
      { length: CHANNELS },
      () => new Float32Array(length * 4),
    );
    this.eqLinkedDryDoubled = Array.from(
      { length: CHANNELS },
      () => new Float32Array(length * 4),
    );
    this.eqLinkedWetDoubled = Array.from(
      { length: CHANNELS },
      () => new Float32Array(length * 4),
    );
    this.rebuildOversampleViews();
    this.eqWet = new Float32Array(length);
    this.eqLinkedDry = Array.from(
      { length: CHANNELS },
      () => new Float32Array(length),
    );
    this.eqLinkedWet = Array.from(
      { length: CHANNELS },
      () => new Float32Array(length),
    );
    this.compressorBands = Array.from({ length: CHANNELS }, () => [
      new Float32Array(length),
      new Float32Array(length),
      new Float32Array(length),
    ]);
    this.compressorBandChannels = [0, 1, 2].map((band) =>
      this.compressorBands.map((channel) => channel[band]),
    );
  }

  /**
   * Rebuild the EQ's coefficients, only when something they depend on moved.
   *
   * Recomputing six sets of biquad coefficients per render quantum would be
   * 2,800 times a second for values that change when a user turns a knob. The
   * signature is what a change looks like, cheaply.
   */
  private refreshEq(): void {
    const { eq } = this.settings;
    const signature = JSON.stringify(eq);
    if (signature === this.eqSignature) {
      return;
    }
    this.eqSignature = signature;
    this.rebuildOversampleViews();
    // Oversampling runs the cascade at twice the rate, so its filters have to
    // be DESIGNED for that rate. Handing it the ordinary set would place every
    // band an octave low — a bug rather than a mode.
    const designRate = sampleRate * eq.oversample;
    // Built at the base rate, because it runs BEFORE the oversampler: a high
    // pass whose job is to keep energy out has nothing to gain from being
    // inside, and doing it first means the oversampler carries less.
    this.monoBelowCoefficients =
      eq.monoBelowHz > 0
        ? biquadCoefficients(
            {
              type: FilterTypeEnum.HPQ,
              frequency: eq.monoBelowHz,
              gainDb: 0,
              quality: 0.707,
            },
            sampleRate,
          )
        : undefined;
    this.subsonicCoefficients =
      eq.subsonicHz > 0
        ? biquadCoefficients(
            {
              type: FilterTypeEnum.HPQ,
              frequency: eq.subsonicHz,
              gainDb: 0,
              quality: 0.707,
            },
            sampleRate,
          )
        : undefined;
    // Kept in step with `eqCoefficients` below, which is why it filters on the
    // same predicate: a dynamics array indexed differently from the coefficient
    // array would apply one band's threshold to another band's audio.
    const live = eq.bands.filter((band) => band.enabled);
    // Where each live band sits in the rack the user is looking at. The
    // coefficient array is the enabled bands only, and the graph draws all of
    // them, so a report indexed the first way would light up the wrong bands.
    this.liveBandIndex = eq.bands
      .map((band, index) => (band.enabled ? index : -1))
      .filter((index) => index >= 0);
    this.bandAmounts = new Array(eq.bands.length).fill(1);
    this.bandLevels = new Array(eq.bands.length).fill(-120);
    for (let slot = 0; slot < CHANNELS; slot += 1) {
      const followers = this.bandDynamics[slot] ?? [];
      while (followers.length < live.length) {
        followers.push(createBandDynamics());
      }
      followers.length = live.length;
      live.forEach((band, index) =>
        refreshBandDynamics(followers[index], band, sampleRate, eq.enabled),
      );
      this.bandDynamics[slot] = followers;
    }
    this.dynamicSlots = live
      .map((band, index) => (band.dynamic ? index : -1))
      .filter((index) => index >= 0);
    this.eqCoefficients = eq.bands
      .filter((band) => band.enabled)
      .map((band) =>
        biquadCoefficients(
          {
            type: band.type as FilterTypeEnum,
            frequency: band.frequency,
            gainDb: band.gainDb,
            quality: band.quality,
          },
          designRate,
          eq.model,
          eq.modelAmount,
        ),
      );
    // Built at the base rate, not the design rate: these run after the
    // convolution, which is base rate, and never inside the oversampler.
    this.dynamicCoefficients = this.dynamicSlots.map((slot) =>
      biquadCoefficients(
        {
          type: live[slot].type as FilterTypeEnum,
          frequency: live[slot].frequency,
          gainDb: live[slot].gainDb,
          quality: live[slot].quality,
        },
        sampleRate,
        eq.model,
        eq.modelAmount,
      ),
    );
    for (let slot = 0; slot < CHANNELS; slot += 1) {
      this.dynamicEqStates[slot] = this.dynamicSlots.map(
        (at) => this.eqStates[slot][at],
      );
      this.dynamicBandDynamics[slot] = this.dynamicSlots.map(
        (at) => this.bandDynamics[slot][at],
      );
    }
  }

  /** Whether a convolver is actually in the signal path right now, which is
   * the only condition under which anything needs delaying to match it. */
  private isLinearRunning(): boolean {
    const { eq } = this.settings;
    return (
      eq.enabled &&
      (eq.phase === 'linear' || eq.isolate) &&
      this.convolvers !== undefined
    );
  }

  /**
   * Pass a dry reference through one identity oversampling round trip.
   *
   * A plain integer delay is insufficient for 4x: its two half-band stages
   * have a half-sample group delay and their skirts are part of the result.
   * Running the same filters is the only sample-for-sample reference for what
   * reaches the processed path.
   */
  private static matchOversampling(
    target: Float32Array,
    state: IOversamplerState,
    factor: number,
    scratch: Float32Array,
  ): void {
    const work = scratch.subarray(0, target.length * factor);
    upsample(state, target, work, factor);
    downsample(state, work, target, factor);
  }

  /**
   * Advance the replacement convolver's warm-up, and retire the old one.
   *
   * Kept out of `processChannel` because it is a decision about the pair: a
   * handover that completed for the left channel and not the right would put
   * the two on different filters, which is a collapsed image rather than a
   * click.
   */
  private settleConvolvers(samples: number): void {
    this.convolverPriming = Math.max(0, this.convolverPriming - samples);
    if (!this.convolversNext) {
      return;
    }
    if (this.convolverWarmup > 0) {
      this.convolverWarmup -= samples;
      return;
    }
    if (this.convolverBlend.every((blend) => blend >= 1)) {
      this.convolvers = this.convolversNext;
      this.convolversNext = undefined;
    }
  }

  /** Capture this EQ domain's isolate references at exact unity input. */
  private prepareEqChannel(target: Float32Array, slot: number): boolean {
    const { eq } = this.settings;
    if (!eq.enabled) {
      return false;
    }
    this.eqInput[slot].set(target);
    this.eqDelayedInput[slot].set(target);
    processDelayLine(this.eqIsolateDelays[slot], this.eqDelayedInput[slot]);
    if (eq.phase === 'minimum' && eq.isolate && !this.convolvers) {
      target.fill(0);
      this.eqDryMix[slot] = 0;
      return false;
    }
    return true;
  }

  /** Run one already-prepared channel through the current linear convolver. */
  private processEqConvolverChannel(
    target: Float32Array,
    slot: number,
    runningConvolvers: IConvolverState[],
  ): void {
    if (this.convolversNext && this.convolverWarmup <= 0) {
      this.convolverBlend[slot] = convolveBlend(
        runningConvolvers[slot],
        this.convolversNext[slot],
        target,
        this.convolverScratch,
        this.convolverBlend[slot],
        1 / 1_024,
      );
    } else if (this.convolversNext) {
      this.convolverScratch.set(target);
      convolve(runningConvolvers[slot], target);
      convolve(this.convolversNext[slot], this.convolverScratch);
    } else {
      convolve(runningConvolvers[slot], target);
    }
  }

  /** Fuzz and the latency-matched isolate subtraction after all EQ bands. */
  private finishEqChannel(target: Float32Array, slot: number): void {
    const { eq } = this.settings;
    if (eq.fuzzAmount > 0) {
      saturateBlock(
        this.fuzz[slot],
        target,
        fuzzDrive(eq.fuzzAmount),
        fuzzBlend(eq.fuzzAmount),
        sampleRate,
      );
    }

    const primingMagnitudeMonitor =
      eq.phase === 'minimum' && eq.isolate && this.convolverPriming > 0;
    if (primingMagnitudeMonitor) {
      target.fill(0);
      this.eqDryMix[slot] = 0;
      return;
    }
    const dryTarget = eq.isolate ? 0 : 1;
    let dryMix = this.eqDryMix[slot];
    const smooth =
      1 - Math.exp(-1 / ((EQ_ISOLATE_SMOOTHING_MS / 1_000) * sampleRate));
    const dryReference = this.isLinearRunning()
      ? this.eqDelayedInput[slot]
      : this.eqInput[slot];
    if (!this.isLinearRunning() && eq.oversample > 1) {
      DspProcessor.matchOversampling(
        dryReference,
        this.eqIsolateOversamplers[slot],
        eq.oversample,
        this.eqIsolateOversampled[slot],
      );
    }
    if (eq.fuzzAmount > 0) {
      DspProcessor.matchOversampling(
        dryReference,
        this.eqIsolateColourOversamplers[slot],
        4,
        this.eqIsolateOversampled[slot],
      );
    }
    for (let frame = 0; frame < target.length; frame += 1) {
      dryMix += (dryTarget - dryMix) * smooth;
      target[frame] -= dryReference[frame] * (1 - dryMix);
    }
    if (Math.abs(dryTarget - dryMix) < 0.0001) {
      dryMix = dryTarget;
    }
    this.eqDryMix[slot] = dryMix;
  }

  /** One selected L/R/M/S EQ domain. */
  private processEqChannel(target: Float32Array, slot: number): void {
    const { eq } = this.settings;
    if (!this.prepareEqChannel(target, slot)) {
      return;
    }
    const runningConvolvers = this.isLinearRunning()
      ? this.convolvers
      : undefined;
    if (runningConvolvers) {
      this.processEqConvolverChannel(target, slot, runningConvolvers);
      if (this.dynamicCoefficients.length > 0) {
        processEqBands(
          this.dynamicEqStates[slot],
          this.dynamicCoefficients,
          target,
          eq.engine,
          this.eqDry,
          this.eqWet,
          this.dynamicBandDynamics[slot],
        );
      }
    } else {
      if (this.subsonicCoefficients) {
        processBiquad(
          this.subsonicStates[slot],
          target,
          this.subsonicCoefficients,
        );
      }
      if (eq.oversample > 1) {
        processEqOversampled(
          this.eqStates[slot],
          this.eqCoefficients,
          target,
          eq.engine,
          this.eqOversamplers[slot],
          eq.oversample,
          this.eqWork,
          this.eqDryWork,
          this.eqWetWork,
          this.bandDynamics[slot],
        );
      } else {
        processEqBands(
          this.eqStates[slot],
          this.eqCoefficients,
          target,
          eq.engine,
          this.eqDry,
          this.eqWet,
          this.bandDynamics[slot],
        );
      }
    }
    this.finishEqChannel(target, slot);
  }

  /** Stereo mode: one dynamic amount per band, applied to both domains. */
  private processEqStereoChannels(output: Float32Array[]): void {
    const { eq } = this.settings;
    const channels = Math.min(CHANNELS, output.length);
    if (!eq.enabled || channels < 2) {
      return;
    }
    let ready = true;
    for (let channel = 0; channel < channels; channel += 1) {
      ready = this.prepareEqChannel(output[channel], channel) && ready;
    }
    if (!ready) {
      return;
    }

    const runningConvolvers = this.isLinearRunning()
      ? this.convolvers
      : undefined;
    if (runningConvolvers) {
      for (let channel = 0; channel < channels; channel += 1) {
        this.processEqConvolverChannel(
          output[channel],
          channel,
          runningConvolvers,
        );
      }
      if (this.dynamicCoefficients.length > 0) {
        processEqBandsLinked(
          this.dynamicEqStates,
          this.dynamicCoefficients,
          output,
          eq.engine,
          this.eqLinkedDry,
          this.eqLinkedWet,
          this.dynamicBandDynamics[0],
          channels,
        );
      }
    } else {
      if (this.subsonicCoefficients) {
        for (let channel = 0; channel < channels; channel += 1) {
          processBiquad(
            this.subsonicStates[channel],
            output[channel],
            this.subsonicCoefficients,
          );
        }
      }
      if (eq.oversample > 1) {
        processEqOversampledLinked(
          this.eqStates,
          this.eqCoefficients,
          output,
          eq.engine,
          this.eqOversamplers,
          eq.oversample,
          this.eqLinkedWork,
          this.eqLinkedDryWork,
          this.eqLinkedWetWork,
          this.bandDynamics[0],
        );
      } else {
        processEqBandsLinked(
          this.eqStates,
          this.eqCoefficients,
          output,
          eq.engine,
          this.eqLinkedDry,
          this.eqLinkedWet,
          this.bandDynamics[0],
          channels,
        );
      }
    }

    for (let index = 0; index < this.bandDynamics[0].length; index += 1) {
      const source = this.bandDynamics[0][index];
      const mirror = this.bandDynamics[1][index];
      mirror.envelope = source.envelope;
      mirror.amount = source.amount;
    }
    for (let channel = 0; channel < channels; channel += 1) {
      this.finishEqChannel(output[channel], channel);
    }
  }

  /** The hidden compressor remains a linked downstream stage in the chain. */
  private processCompressor(output: Float32Array[]): void {
    const { compressor } = this.settings;
    if (!compressor.enabled) {
      this.compressors.forEach((state) => {
        state.gain = 1;
      });
      return;
    }
    const channels = Math.min(CHANNELS, output.length);
    for (let channel = 0; channel < channels; channel += 1) {
      const bands = this.compressorBands[channel];
      splitBands(
        this.crossovers[channel],
        output[channel],
        bands[0],
        bands[1],
        bands[2],
        compressor.crossoverHz,
        sampleRate,
      );
    }
    for (let band = 0; band < 3; band += 1) {
      processBandLinked(
        this.compressors[band],
        this.compressorBandChannels[band],
        compressor.bands[band],
        sampleRate,
        channels,
      );
    }
    for (let channel = 0; channel < channels; channel += 1) {
      const target = output[channel];
      const bands = this.compressorBands[channel];
      for (let frame = 0; frame < target.length; frame += 1) {
        target[frame] = bands[0][frame] + bands[1][frame] + bands[2][frame];
      }
    }
  }

  /**
   * Transparent post-EQ peak control in the final left/right domain.
   *
   * This must not run inside `processChannel`: in Mid/Side mode those buffers
   * are M and S, so separate gain decisions become moving stereo width after
   * decode. Feeding the linked detector continuously also keeps its look-ahead
   * current while bypassed; switching it on cannot replay a stale block.
   */
  private processMaximizer(output: Float32Array[]): void {
    const limiter = this.maximizerLimiter;
    if (!limiter) {
      return;
    }
    const { maximizer } = this.settings;
    if (!maximizer.enabled) {
      limiter.detectorGain = 1;
      limiter.gain = 1;
      limiter.releaseHoldRemaining = 0;
      limiter.gainReductionDb.fill(0);
    }
    /**
     * Drive, which is the half of a maximizer this stage did not have.
     *
     * Gain goes IN and the ceiling holds the top, so everything under the peaks
     * comes up while the peaks stay put. Without it there was no gain term
     * anywhere here or in the limiter below, and the stage could only ever
     * attenuate — while the always-on output safety already guaranteed nothing
     * clipped, which left it doing nothing that was not already done.
     */
    const drive = maximizer.enabled ? 10 ** (maximizer.driveDb / 20) : 1;
    if (drive !== 1) {
      for (let index = 0; index < output.length; index += 1) {
        const channel = output[index];
        for (let at = 0; at < channel.length; at += 1) {
          channel[at] *= drive;
        }
      }
    }
    processLinkedLimiter(limiter, output, {
      ceiling: maximizer.enabled
        ? 10 ** (maximizer.ceilingDb / 20)
        : Number.POSITIVE_INFINITY,
      releaseCoefficient: maximizer.enabled
        ? Math.exp(-1 / ((maximizer.releaseMs / 1_000) * sampleRate))
        : 0,
      kneeDb: maximizer.enabled ? MAXIMIZER_SOFT_KNEE_DB : 0,
      releaseSnapRatio: maximizer.enabled ? MAXIMIZER_RELEASE_SNAP_RATIO : 0,
      releaseHoldSamples: maximizer.enabled
        ? Math.round((MAXIMIZER_RELEASE_HOLD_MS / 1_000) * sampleRate)
        : 0,
    });
  }

  private exciterPathIsActive(path: number): boolean {
    const exciter = this.exciters[path];
    const aligner = this.aligners[path];
    return (
      (exciter ? exciterChannelIsActive(exciter) : false) ||
      (this.organicMix[path] ?? 0) > 0.0001 ||
      (aligner ? aligner.lowDelay > 0.0001 || aligner.midDelay > 0.0001 : false)
    );
  }

  /** Timing, three bands and Organic for one L/R/M/S signal path. */
  private processExciterPath(
    target: Float32Array,
    path: number,
    report: boolean,
  ): void {
    const settings = this.settings.exciter;
    const wantsAlignment =
      settings.enabled && settings.align.enabled && settings.align.amount > 0;
    if (!this.aligners[path] && wantsAlignment) {
      this.aligners[path] = createPhaseAlign(target.length, sampleRate);
    }
    const aligner = this.aligners[path];
    if (aligner) {
      alignChannel(
        aligner,
        target,
        wantsAlignment ? settings.align.amount : 0,
        sampleRate,
      );
    }

    if (!this.exciters[path] && settings.enabled) {
      this.exciters[path] = createExciterChannel(target.length);
    }
    const exciter = this.exciters[path];
    if (!exciter) {
      if (report) {
        this.exciterBands = [0, 0, 0];
        this.exciterOrganic = 0;
      }
      return;
    }

    const bandReport = runExciterChannel(exciter, target, settings, sampleRate);
    if (report) {
      this.exciterBands = bandReport.bands;
    }

    const organicTarget =
      settings.enabled && settings.organic.enabled
        ? organicExciterReturnGain(settings.organic.amount)
        : 0;
    let organicMix = this.organicMix[path] ?? 0;
    if (organicTarget > 0 || organicMix > 0.0001) {
      if (!this.organic[path]) {
        this.organic[path] = createOrganicPath(target.length);
      }
      const wet = runOrganicPath(
        this.organic[path],
        exciter.dry,
        settings.organic,
        settings.organic.amount,
        sampleRate,
      );
      const smooth =
        1 - Math.exp(-1 / ((EXCITER_SMOOTHING_MS / 1_000) * sampleRate));
      let meanMix = 0;
      for (let i = 0; i < target.length; i += 1) {
        organicMix += (organicTarget - organicMix) * smooth;
        target[i] += wet[i] * organicMix;
        meanMix += organicMix;
      }
      if (organicTarget === 0 && organicMix < 0.0001) {
        organicMix = 0;
        resetOrganicPathTransient(this.organic[path]);
      }
      this.organicMix[path] = organicMix;
      if (report) {
        this.exciterOrganic = target.length > 0 ? meanMix / target.length : 0;
      }
    } else {
      const organic = this.organic[path];
      if (organic) {
        resetOrganicPathTransient(organic);
      }
      if (report) {
        this.exciterOrganic = 0;
      }
    }
  }

  /**
   * The chain's final user gain, after every creative and level-dependent stage.
   *
   * A gain here can stop the completed result overloading without changing how
   * hard the Exciter or Fuzz was driven. The ramp is identical in every channel
   * and committed only after all channels have used the same starting value.
   */
  private processMasterOutput(output: Float32Array[]): void {
    const { master } = this.settings;
    const frames = output[0]?.length ?? 0;
    const totalGainDb = master.outputTrimDb + this.masterLoudnessGainNowDb;
    const targetGain = master.enabled ? 10 ** (totalGainDb / 20) : 1;
    const from = this.masterGainNow;
    const step = (targetGain - from) / Math.max(1, frames);
    if (from !== 1 || targetGain !== 1) {
      output.forEach((channel) => {
        for (let i = 0; i < channel.length; i += 1) {
          channel[i] *= from + step * (i + 1);
        }
      });
    }
    this.masterGainNow = targetGain;
  }

  /**
   * The prevention stage before anything nonlinear can see the source.
   *
   * One gain trajectory is calculated for the pair and committed after both
   * channels have used it. That keeps stereo balance exact while avoiding a
   * discontinuity when a new track's cached value replaces the previous one.
   */
  private processInputGain(output: Float32Array[]): void {
    const frames = output[0]?.length ?? 0;
    if (frames === 0) {
      return;
    }
    let hasProgramme = false;
    for (
      let channel = 0;
      channel < output.length && !hasProgramme;
      channel += 1
    ) {
      const samples = output[channel];
      for (let frame = 0; frame < samples.length; frame += 1) {
        if (Math.abs(samples[frame]) > 1e-8) {
          hasProgramme = true;
          break;
        }
      }
    }
    if (!hasProgramme) {
      // There is no waveform to click and no musical time to ride. Advancing a
      // track-level ramp through digital silence made every Master readout
      // creep while playback was stopped, then resumed the song from an
      // arbitrary point in that invisible transition. Land on the analysed
      // level now so the next non-zero sample starts from the correct value.
      this.inputGainNow = 10 ** (this.inputGainTargetDb / 20);
      this.masterLoudnessGainNowDb = this.masterLoudnessGainTargetDb;
      this.trackLevelTransitionElapsedFrames = this.trackLevelTransitionFrames;
      return;
    }
    const fromDb = 20 * Math.log10(Math.max(1e-12, this.inputGainNow));
    this.trackLevelTransitionElapsedFrames = Math.min(
      this.trackLevelTransitionFrames,
      this.trackLevelTransitionElapsedFrames + frames,
    );
    const progress =
      this.trackLevelTransitionFrames > 0
        ? this.trackLevelTransitionElapsedFrames /
          this.trackLevelTransitionFrames
        : 1;
    const nextDb =
      this.inputGainStartDb +
      (this.inputGainTargetDb - this.inputGainStartDb) * progress;
    this.masterLoudnessGainNowDb =
      this.masterLoudnessGainStartDb +
      (this.masterLoudnessGainTargetDb - this.masterLoudnessGainStartDb) *
        progress;
    const stepGain = 10 ** ((nextDb - fromDb) / Math.max(1, frames) / 20);
    output.forEach((channel) => {
      let gain = this.inputGainNow;
      for (let frame = 0; frame < channel.length; frame += 1) {
        gain *= stepGain;
        channel[frame] *= gain;
      }
    });
    this.inputGainNow = 10 ** (nextDb / 20);
  }

  private static measureNormalizer(
    output: Float32Array[],
    peaks: number[],
  ): void {
    for (
      let channel = 0;
      channel < Math.min(CHANNELS, output.length);
      channel += 1
    ) {
      const samples = output[channel];
      for (let frame = 0; frame < samples.length; frame += 1) {
        peaks[channel] = Math.max(peaks[channel], Math.abs(samples[frame]));
      }
    }
  }

  /** Copy one exact chain boundary to its analyser-only worklet output. */
  private static copyMonitorOutput(
    outputs: Float32Array[][],
    outputIndex: number,
    source: Float32Array[],
  ): void {
    const monitor = outputs[outputIndex];
    if (!monitor) {
      return;
    }
    for (
      let channel = 0;
      channel < Math.min(monitor.length, source.length);
      channel += 1
    ) {
      monitor[channel].set(source[channel]);
    }
  }

  process(inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    const input = inputs[0];
    const output = outputs[DSP_OUTPUT_INDEX.master];
    if (!output || output.length === 0) {
      return true;
    }

    for (let channel = 0; channel < output.length; channel += 1) {
      const target = output[channel];
      const source = input?.[Math.min(channel, (input?.length ?? 1) - 1)];
      if (!source || source.length === 0) {
        // A disconnected or silent input arrives as an empty array, not as a
        // block of zeros. Leaving `target` alone would replay whatever the
        // previous block left in it, which is a stutter rather than silence.
        target.fill(0);
      } else {
        target.set(source);
        this.ensureScratch(target.length);
      }
    }

    if (!this.settings.enabled || this.standingDown) {
      // The copy above already happened, so the graph downstream still sees a
      // block. Everything expensive below is skipped.
      return true;
    }

    DspProcessor.measureNormalizer(output, this.normalizerInputPeaks);
    this.processInputGain(output);
    DspProcessor.measureNormalizer(output, this.normalizerOutputPeaks);
    DspProcessor.copyMonitorOutput(
      outputs,
      DSP_OUTPUT_INDEX.normalizer,
      output,
    );

    /**
     * The complete Exciter runs before EQ, in its own stereo domain.
     *
     * Mid/Sides wraps Timing, Low/Mid/High and Organic together. Encoding only
     * Organic here was the bug in the earlier implementation: the selector
     * claimed a whole-stage mode while three quarters of the stage remained
     * ordinary left/right. Four independent histories keep L, R, Mid and Side
     * from handing filter or delay memory to one another.
     */
    const exciterMode = this.settings.exciter.stereo;
    const exciterIsMidSide = exciterMode !== 'stereo' && output.length >= 2;
    if (exciterIsMidSide) {
      const [left, right] = output;
      for (let i = 0; i < left.length; i += 1) {
        const mid = (left[i] + right[i]) * 0.5;
        const sideValue = (left[i] - right[i]) * 0.5;
        left[i] = mid;
        right[i] = sideValue;
      }
    }
    let exciterReported = false;
    for (let channel = 0; channel < output.length; channel += 1) {
      const selected =
        !exciterIsMidSide ||
        (exciterMode === 'mid' ? channel === 0 : channel === 1);
      const path = exciterIsMidSide ? channel + 2 : channel;
      if (
        selected &&
        (this.settings.exciter.enabled || this.exciterPathIsActive(path))
      ) {
        this.processExciterPath(output[channel], path, !exciterReported);
        exciterReported = true;
      } else if (
        !selected &&
        this.settings.exciter.enabled &&
        this.settings.exciter.isolate
      ) {
        // Isolate means only what the selected Exciter domain contributes.
        output[channel].fill(0);
      }
    }

    if (!exciterReported) {
      this.exciterBands = [0, 0, 0];
      this.exciterOrganic = 0;
    }

    if (exciterIsMidSide) {
      const [left, right] = output;
      for (let i = 0; i < left.length; i += 1) {
        const mid = left[i];
        const sideValue = right[i];
        left[i] = mid + sideValue;
        right[i] = mid - sideValue;
      }
    }
    DspProcessor.copyMonitorOutput(outputs, DSP_OUTPUT_INDEX.exciter, output);

    /**
     * Mid/side, and why it wraps the whole loop rather than sitting inside it.
     *
     * Mid is what both speakers share and side is what they differ by, so
     * neither exists in one channel: the sum and the difference have to be
     * taken across the pair before anything is filtered, and undone after.
     * That is the entire reason this cannot live in `processChannel`.
     *
     * What it buys is the thing stereo EQ cannot do at all — brightening a
     * centred vocal without touching the reverb around it, or clearing the
     * bass out of the sides while leaving the middle whole.
     */
    const { stereo, monoBelowHz } = this.settings.eq;
    const isMidSide =
      (stereo !== 'stereo' || monoBelowHz > 0) && output.length >= 2;
    if (isMidSide) {
      const [left, right] = output;
      for (let i = 0; i < left.length; i += 1) {
        const mid = (left[i] + right[i]) * 0.5;
        const sideValue = (left[i] - right[i]) * 0.5;
        left[i] = mid;
        right[i] = sideValue;
      }
    }

    if (stereo === 'stereo' && output.length >= 2) {
      this.processEqStereoChannels(output);
    } else {
      for (let channel = 0; channel < output.length; channel += 1) {
        const target = output[channel];
        // In mid/side the two slots are no longer left and right: slot 0 carries
        // the middle and slot 1 the difference, and only the chosen one is
        // filtered. The other passes untouched, which is what makes this a tool
        // rather than a different way of spelling stereo.
        const skip =
          isMidSide &&
          ((stereo === 'mid' && channel === 1) ||
            (stereo === 'side' && channel === 0));
        const slot = Math.min(channel, CHANNELS - 1);
        if (target.length === 0) {
          // Nothing to do either way.
        } else if (!skip) {
          this.processEqChannel(target, slot);
        } else {
          // Keep this domain's isolate reference current even while it is the
          // half that the selected mid/side mode passes through untouched.
          this.eqDelayedInput[slot].set(target);
          processDelayLine(
            this.eqIsolateDelays[slot],
            this.eqDelayedInput[slot],
          );
          if (this.isLinearRunning()) {
            // Untouched, but exactly as late as the half that went through the
            // convolver. Without this the mid/side decode below recombines two
            // signals 181 ms apart.
            processDelayLine(this.bypassDelays[slot], target);
          }
        }

        // The unselected half of a mid/side EQ contributes nothing. Fade that
        // dry-only domain out under isolate rather than leaving it audible beside
        // the selected domain's difference signal.
        if (skip && this.settings.eq.enabled) {
          const minimumMonitorIsPriming =
            this.settings.eq.phase === 'minimum' &&
            this.settings.eq.isolate &&
            (this.convolvers === undefined || this.convolverPriming > 0);
          if (minimumMonitorIsPriming) {
            target.fill(0);
            this.eqDryMix[slot] = 0;
          } else {
            const dryTarget = this.settings.eq.isolate ? 0 : 1;
            let dryMix = this.eqDryMix[slot];
            const smooth =
              1 -
              Math.exp(-1 / ((EQ_ISOLATE_SMOOTHING_MS / 1_000) * sampleRate));
            for (let i = 0; i < target.length; i += 1) {
              dryMix += (dryTarget - dryMix) * smooth;
              target[i] *= dryMix;
            }
            if (Math.abs(dryTarget - dryMix) < 0.0001) {
              dryMix = dryTarget;
            }
            this.eqDryMix[slot] = dryMix;
          }
        }
      }
    }

    this.settleConvolvers(output[0]?.length ?? 0);

    /**
     * The phase-cancellation fix, applied to the side channel only.
     *
     * Bass that is out of phase between the two channels vanishes the moment
     * they are summed — which is what a phone speaker, a mono PA and most
     * Bluetooth speakers do — so a mix can sound enormous on headphones and
     * gutless everywhere else. High-passing the SIDE removes the part that can
     * cancel and leaves the middle whole, so the low end stops depending on the
     * two channels agreeing.
     *
     * Above the corner the image is untouched: width is worth keeping wherever
     * it cannot cancel.
     */
    if (isMidSide && this.monoBelowCoefficients) {
      processBiquad(
        this.sideHighpassState,
        output[1],
        this.monoBelowCoefficients,
      );
    }

    if (isMidSide) {
      const [left, right] = output;
      for (let i = 0; i < left.length; i += 1) {
        const mid = left[i];
        const sideValue = right[i];
        left[i] = mid + sideValue;
        right[i] = mid - sideValue;
      }
    }

    DspProcessor.copyMonitorOutput(outputs, DSP_OUTPUT_INDEX.eq, output);
    this.processCompressor(output);
    DspProcessor.copyMonitorOutput(
      outputs,
      DSP_OUTPUT_INDEX.compressor,
      output,
    );
    this.processMaximizer(output);
    DspProcessor.copyMonitorOutput(outputs, DSP_OUTPUT_INDEX.maximizer, output);

    const { master } = this.settings;
    const usesSelectedHeadroom = master.enabled && master.loudnessMaximize;
    processPostFilterNormalizer(this.postFilterNormalizer, output, {
      enabled: usesSelectedHeadroom,
      outputCeilingDb: master.ceilingDb,
      // Reserve only gain that is actually present in this quantum. Reserving
      // the future target made Auto Headroom latch attenuation while the LUFS
      // makeup was still ramping, so uncached and cached playback disagreed.
      followingGainDb: master.outputTrimDb + this.masterLoudnessGainNowDb,
      releaseMs: master.releaseMs,
      sampleRate,
    });
    this.processMasterOutput(output);

    // Safety is separate from Auto Headroom. It sanitizes invalid results and
    // removes DC after final gain, but its limiter stays at unity for ordinary
    // audio and arms only at the pathological +10 dBTP threshold.
    if (this.outputSafetyEnabled) {
      processOutputSafety(this.outputSafety, output, {
        limiterEnabled: true,
        ceiling: 10 ** (OUTPUT_SAFETY_CEILING_DB / 20),
        activationThreshold: 10 ** (OUTPUT_SAFETY_EXTREME_DBTP / 20),
        // Safety is not a loudness processor. A coefficient of one latches
        // attenuation instead of following the programme back toward unity.
        releaseCoefficient: 1,
        kneeDb: 0,
        releaseHoldSamples: 0,
      });
    }

    this.measure(output);
    return true;
  }

  /**
   * The phase correlation of what actually leaves the chain.
   *
   * Measured here rather than in the renderer because this is the only place
   * both channels exist as samples after every filter has run — an
   * `AnalyserNode` downstream sums them to mono, which destroys the very thing
   * being measured.
   *
   * +1 means the two channels are identical and sum with no loss. 0 means they
   * are unrelated. NEGATIVE means content that will partly cancel the moment
   * anything sums them to mono, which is a phone speaker, a mono PA and most
   * Bluetooth speakers — so it is the number that predicts a mix falling apart
   * somewhere the listener is not.
   *
   * The standard normalised form, so it answers with a ratio rather than
   * something that also moves with the volume.
   */
  private measure(output: Float32Array[]): void {
    if (output.length < 2 || output[0].length === 0) {
      return;
    }
    const [left, right] = output;
    for (let i = 0; i < left.length; i += 1) {
      this.scatterSkip += 1;
      if (
        this.scatterSkip >= SCATTER_STRIDE &&
        this.scatterAt < SCATTER_PAIRS
      ) {
        this.scatterSkip = 0;
        this.scatter[this.scatterAt * 2] = left[i];
        this.scatter[this.scatterAt * 2 + 1] = right[i];
        this.scatterAt += 1;
      }
      this.sumLeftRight += left[i] * right[i];
      this.sumLeftSquared += left[i] * left[i];
      this.sumRightSquared += right[i] * right[i];
      // The peak of what LEAVES the chain, which is the only number that can
      // say whether the curve is driving the output past full scale. A boost
      // the graph draws happily is still distortion once the sum clips.
      const leftPeak = Math.abs(left[i]);
      const rightPeak = Math.abs(right[i]);
      if (leftPeak > this.channelPeaks[0]) {
        this.channelPeaks[0] = leftPeak;
      }
      if (rightPeak > this.channelPeaks[1]) {
        this.channelPeaks[1] = rightPeak;
      }
      const loudest = Math.max(leftPeak, rightPeak);
      if (loudest > this.peak) {
        this.peak = loudest;
      }
    }
    this.blocksSinceReport += 1;
    if (this.blocksSinceReport < METER_BLOCKS) {
      return;
    }
    if (!this.metersEnabled) {
      this.resetMeterAccumulators();
      return;
    }
    const denominator = Math.sqrt(this.sumLeftSquared * this.sumRightSquared);
    // Silence has no correlation to report. Answering 0 would read as "these
    // channels disagree" when nothing is playing at all.
    const correlation =
      denominator > 1e-12 ? this.sumLeftRight / denominator : 1;
    // The louder of the two channels: a dynamic band that engaged on one side
    // is engaged, and reporting the average would draw it half-open when it is
    // fully open on the side that mattered.
    this.liveBandIndex.forEach((at, index) => {
      const left = this.bandDynamics[0]?.[index];
      const right = this.bandDynamics[1]?.[index];
      this.bandAmounts[at] = left?.active
        ? Math.max(left.amount, right?.amount ?? 0)
        : 1;
      const envelope = Math.max(left?.envelope ?? 0, right?.envelope ?? 0);
      // -120 rather than -Infinity: the graph does arithmetic with this and
      // an infinity propagates through every position it is used in.
      this.bandLevels[at] = envelope > 1e-6 ? 20 * Math.log10(envelope) : -120;
    });
    this.port.postMessage({
      correlation,
      peak: this.peak,
      channelPeaks: [this.channelPeaks[0], this.channelPeaks[1]],
      normalizerMeter: {
        inputPeaks: [
          this.normalizerInputPeaks[0],
          this.normalizerInputPeaks[1],
        ],
        outputPeaks: [
          this.normalizerOutputPeaks[0],
          this.normalizerOutputPeaks[1],
        ],
        appliedGainDb:
          this.inputGainNow > 0 ? 20 * Math.log10(this.inputGainNow) : -120,
      },
      bandAmounts: this.bandAmounts,
      bandLevels: this.bandLevels,
      exciterBands: this.exciterBands,
      exciterOrganic: this.exciterOrganic,
      // Master exposes the same final true-peak measurement in production;
      // development adds the ability to bypass its safety boundary, not a
      // different meter implementation.
      outputSafety: {
        enabled: this.outputSafetyEnabled,
        postFilterNormalizer: takePostFilterNormalizerTelemetry(
          this.postFilterNormalizer,
        ),
        ...takeOutputSafetyTelemetry(this.outputSafety),
      },
      // Sliced rather than sent whole: a partly filled buffer would draw its
      // unused tail as a cluster of pairs at the origin, which reads as a
      // mono signal that is not there.
      scatter: this.scatter.slice(0, this.scatterAt * 2),
    });
    this.resetMeterAccumulators();
  }

  /**
   * Close one meter window, whether or not anybody was told about it.
   *
   * Runs on the reporting path and on the muted path alike. The scatter cursor
   * is the reason it cannot simply be skipped while meters are off: it indexes
   * a fixed buffer, and a window that never ends walks off the end of it.
   */
  private resetMeterAccumulators() {
    this.blocksSinceReport = 0;
    this.peak = 0;
    this.channelPeaks[0] = 0;
    this.channelPeaks[1] = 0;
    const normalizerMeterDecay = Math.exp(
      -(METER_BLOCKS * RENDER_QUANTUM) /
        ((NORMALIZER_METER_RELEASE_MS / 1_000) * sampleRate),
    );
    this.normalizerInputPeaks[0] *= normalizerMeterDecay;
    this.normalizerInputPeaks[1] *= normalizerMeterDecay;
    this.normalizerOutputPeaks[0] *= normalizerMeterDecay;
    this.normalizerOutputPeaks[1] *= normalizerMeterDecay;
    this.scatterAt = 0;
    this.sumLeftRight = 0;
    this.sumLeftSquared = 0;
    this.sumRightSquared = 0;
  }
}

registerProcessor('fluideq-dsp', DspProcessor);
