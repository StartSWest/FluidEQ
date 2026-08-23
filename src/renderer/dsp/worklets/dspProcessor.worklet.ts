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
} from '../../../common/dsp/chain';
import {
  ICrossoverState,
  createCrossoverState,
  splitBands,
} from '../crossover';
import {
  ICompressorState,
  createCompressorState,
  processBand,
} from '../compressor';
import { ILimiterState, createLimiterState, processLimiter } from '../limiter';
import {
  IExciterChannelState,
  createExciterChannel,
  runExciterChannel,
} from '../exciterStage';
import {
  IBiquadCoefficients,
  IBiquadState,
  biquadCoefficients,
  createBiquadState,
  processBiquad,
} from '../biquad';
import { processEqBands, processEqOversampled } from '../eqEngine';
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
import { IOversamplerState, createOversampler } from '../oversample';
import {
  ISaturatorState,
  createSaturator,
  fuzzDrive,
  saturateBlock,
} from '../saturate';
import { FilterTypeEnum } from '../../../common/constants';

/** Web Audio always renders 128 frames; the scratch buffers start there. */
const RENDER_QUANTUM = 128;

/** Stereo. A third channel reuses the second one's filter state. */
const CHANNELS = 2;

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

/**
 * The compressor and the maximizer, in one processor.
 *
 * One node rather than eleven, and that is a correctness decision before it is
 * a tidiness one: a crossover built from separate BiquadFilterNodes puts each
 * band on its own path through the graph, and any difference in node latency
 * between those paths misaligns the bands by samples when they are summed. A
 * single processor cannot have that class of bug, because there is only one
 * path.
 *
 * The exciter is NOT here. It stays a WaveShaperNode in the graph, because a
 * shaper is exactly what a WaveShaperNode is and reimplementing its curve
 * interpolation in script would be slower and no more correct.
 *
 * Settings arrive over the port rather than as AudioParams: they are a
 * structured object, and a change to any of them is a user turning a knob, not
 * something needing sample-accurate automation.
 */
class DspProcessor extends AudioWorkletProcessor {
  private settings: IDspSettings = DSP_DEFAULTS;

  private readonly crossovers: ICrossoverState[] = [];

  private readonly compressors: ICompressorState[][] = [];

  private limiters: ILimiterState[] = [];

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
   * Where the input gain actually is, as opposed to where it is being asked to
   * be.
   *
   * The regulator moves the trim on every change to the curve, so dragging a
   * band walks this in tenths of a decibel — and a gain applied as a step is a
   * discontinuity in the waveform, which is a click per step and a drag's worth
   * of them in a row. Ramped across the block instead, so the level slides
   * where it used to jump.
   */
  private eqGainNow = 1;

  /** Handed back by the adaptive stage, in dB. Zero until it says otherwise,
   * which is the pessimistic reserve and the safe answer. */
  private headroomGiveBack = 0;

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
   * One per channel: the exciter's crossover, shapers and followers.
   *
   * Per channel rather than shared, and that matters for more than filter
   * history — the organic stage's wander is deliberately independent on each
   * side, and the independence is what is heard as space rather than as width.
   */
  private readonly exciters: IExciterChannelState[] = [];

  /** What the exciter last actually contributed, for the card to draw. */
  private exciterBands: number[] = [0, 0, 0];

  private exciterOrganic = 0;

  /** One per channel: the oversampler's filters keep history across blocks. */
  private readonly eqOversamplers: IOversamplerState[] = [];

  /** Doubled-rate scratch, used only while oversampling is on. */
  private blockLength = RENDER_QUANTUM;

  private eqDoubled = new Float32Array(RENDER_QUANTUM * 4);

  private eqWork = new Float32Array(RENDER_QUANTUM);

  private eqDryWork = new Float32Array(RENDER_QUANTUM);

  private eqWetWork = new Float32Array(RENDER_QUANTUM);

  private eqDryDoubled = new Float32Array(RENDER_QUANTUM * 4);

  private eqWetDoubled = new Float32Array(RENDER_QUANTUM * 4);

  private eqCoefficients: IBiquadCoefficients[] = [];

  /** What the coefficients were built from, so they rebuild only on a change. */
  private eqSignature = '';

  /** Linear, not dB: this is multiplied per sample. */
  private eqPreampGain = 1;

  private lookAheadSamples = 0;

  /** Correlation accumulators, reset each time the meter reports. */
  private sumLeftRight = 0;

  private sumLeftSquared = 0;

  private sumRightSquared = 0;

  private blocksSinceReport = 0;

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

  /** Scratch for the parallel engine, so the audio thread never allocates. */
  private eqDry = new Float32Array(RENDER_QUANTUM);

  private eqWet = new Float32Array(RENDER_QUANTUM);

  private low = new Float32Array(RENDER_QUANTUM);

  private mid = new Float32Array(RENDER_QUANTUM);

  private high = new Float32Array(RENDER_QUANTUM);

  constructor() {
    super();
    for (let channel = 0; channel < CHANNELS; channel += 1) {
      this.crossovers.push(createCrossoverState());
      this.compressors.push([
        createCompressorState(),
        createCompressorState(),
        createCompressorState(),
      ]);
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
      if (data instanceof Object && 'headroomGiveBack' in data) {
        // What the adaptive stage decided this material does not need.
        // Added to the reserve rather than replacing it, so a message that
        // never arrives leaves the pessimistic figure in place.
        const { headroomGiveBack } = data as { headroomGiveBack: number };
        this.headroomGiveBack = Number.isFinite(headroomGiveBack)
          ? Math.max(0, headroomGiveBack)
          : 0;
        this.refreshEqGain();
        return;
      }
      if (data instanceof Object && 'eqKernel' in data) {
        const { eqKernel } = data as { eqKernel: IConvolverKernel | undefined };
        if (!eqKernel) {
          this.convolvers = undefined;
          this.convolversNext = undefined;
          return;
        }
        const built = Array.from({ length: CHANNELS }, () =>
          createConvolver(eqKernel),
        );
        if (!this.convolvers) {
          // Nothing playing through one yet, so there is nothing to fade from.
          this.convolvers = built;
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
   * Replace the limiters only when the look-ahead actually changed.
   *
   * Rebuilding them on every settings message would drop the delay line's
   * contents mid-stream, which is an audible click on every knob turn.
   */
  private rebuildLimiters(): void {
    const samples = Math.max(
      1,
      Math.round((this.settings.maximizer.lookAheadMs / 1_000) * sampleRate),
    );
    if (samples === this.lookAheadSamples && this.limiters.length > 0) {
      return;
    }
    this.lookAheadSamples = samples;
    this.limiters = [];
    for (let channel = 0; channel < CHANNELS; channel += 1) {
      this.limiters.push(createLimiterState(samples));
    }
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
  }

  private ensureScratch(length: number): void {
    if (this.low.length === length) {
      return;
    }
    this.blockLength = length;
    this.eqDry = new Float32Array(length);
    // Allocated for the largest factor once, so changing it never allocates.
    this.eqDoubled = new Float32Array(length * 4);
    this.eqDryDoubled = new Float32Array(length * 4);
    this.eqWetDoubled = new Float32Array(length * 4);
    this.rebuildOversampleViews();
    this.eqWet = new Float32Array(length);
    this.low = new Float32Array(length);
    this.mid = new Float32Array(length);
    this.high = new Float32Array(length);
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
    // Held as a linear multiplier so the sample loop is one multiply rather
    // than a pow per sample.
    this.refreshEqGain();
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
  }

  /**
   * The one gain in front of everything, from its three contributions.
   *
   * The regulator's reserve, what the adaptive stage handed back of it, and
   * the user's own offset. Its own method because two different messages can
   * move it and both have to arrive at the same arithmetic.
   */
  private refreshEqGain(): void {
    const { eq } = this.settings;
    this.eqPreampGain =
      10 ** ((eq.preampDb + eq.trimDb + this.headroomGiveBack) / 20);
  }

  /** Whether a convolver is actually in the signal path right now, which is
   * the only condition under which anything needs delaying to match it. */
  private isLinearRunning(): boolean {
    const { eq } = this.settings;
    return eq.enabled && eq.phase === 'linear' && this.convolvers !== undefined;
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

  /** One channel, in place in `target`, which already holds the input. */
  private processChannel(target: Float32Array, slot: number): void {
    const { eq, compressor, maximizer } = this.settings;

    if (eq.enabled) {
      // Ahead of the bands, which is where the format puts it and the only
      // place it works: the preamp exists to make room for the boosts that
      // follow, and applying it after them is applying it too late.
      if (this.eqPreampGain !== 1 || this.eqGainNow !== this.eqPreampGain) {
        // The same ramp for every channel: `eqGainNow` is only committed once
        // all of them have run, so slot 1 starts where slot 0 started rather
        // than where it finished. Sliding the two channels differently is a
        // moving image, which is worse than the click this replaces.
        const from = this.eqGainNow;
        const step = (this.eqPreampGain - from) / Math.max(1, target.length);
        for (let i = 0; i < target.length; i += 1) {
          target[i] *= from + step * (i + 1);
        }
      }
      // Linear phase replaces the whole filter section rather than sitting
      // beside it. The kernel already contains the bands AND the subsonic high
      // pass, so running either of them here would apply both twice — and the
      // second application would be the minimum-phase one, which is the thing
      // this mode exists to avoid.
      //
      // Falls through to the cascade when no kernel has arrived yet. That
      // window is real: the mode can be chosen before the first kernel is
      // posted, and a block of silence there would be an audible gap where a
      // dropdown was used.
      if (eq.phase === 'linear' && this.convolvers) {
        if (this.convolversNext && this.convolverWarmup <= 0) {
          // Over about 21 ms: long enough that no step in the response is a
          // click, short enough that letting go of a band and hearing the
          // change still feels immediate.
          this.convolverBlend[slot] = convolveBlend(
            this.convolvers[slot],
            this.convolversNext[slot],
            target,
            this.convolverScratch,
            this.convolverBlend[slot],
            1 / 1_024,
          );
        } else if (this.convolversNext) {
          // Warming: both are fed, only the old one is heard.
          this.convolverScratch.set(target);
          convolve(this.convolvers[slot], target);
          convolve(this.convolversNext[slot], this.convolverScratch);
        } else {
          convolve(this.convolvers[slot], target);
        }
        // The reacting bands, after the kernel that could not hold them.
        // Serial, because they are being applied to what the convolution
        // produced rather than summed alongside it.
        if (this.dynamicCoefficients.length > 0) {
          processEqBands(
            this.dynamicSlots.map((at) => this.eqStates[slot][at]),
            this.dynamicCoefficients,
            target,
            // The chosen topology, like every other band: these are not a
            // special case, they are the ones the kernel could not carry.
            eq.engine,
            this.eqDry,
            this.eqWet,
            this.dynamicSlots.map((at) => this.bandDynamics[slot][at]),
          );
        }
      } else {
        // Ahead of everything else: it exists to keep energy out of the chain,
        // so anything after it would be shaping content this removes.
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
      // After the bands, where an analogue unit's output amplifier sits: it
      // colours what the curve produced rather than what went into it.
      //
      // `saturateBlock` carries its own 2x oversampler whatever the EQ is set
      // to, because a non-linearity at the session rate folds its harmonics
      // back down as inharmonic content — the very sound this is meant to be
      // an alternative to.
      if (eq.fuzzAmount > 0) {
        saturateBlock(this.fuzz[slot], target, fuzzDrive(eq.fuzzAmount));
      }
    }

    if (compressor.enabled) {
      splitBands(
        this.crossovers[slot],
        target,
        this.low,
        this.mid,
        this.high,
        compressor.crossoverHz,
        sampleRate,
      );
      const bands = [this.low, this.mid, this.high];
      for (let band = 0; band < bands.length; band += 1) {
        processBand(
          this.compressors[slot][band],
          bands[band],
          compressor.bands[band],
          sampleRate,
        );
      }
      for (let i = 0; i < target.length; i += 1) {
        target[i] = this.low[i] + this.mid[i] + this.high[i];
      }
    }

    if (maximizer.enabled) {
      processLimiter(this.limiters[slot], target, target, {
        ceiling: 10 ** (maximizer.ceilingDb / 20),
        releaseCoefficient: Math.exp(
          -1 / ((maximizer.releaseMs / 1_000) * sampleRate),
        ),
      });
    }
  }

  process(inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    const input = inputs[0];
    const output = outputs[0];
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

    /**
     * The exciter, first, because that is where it has always been.
     *
     * It used to be a parallel subgraph of native nodes ahead of this
     * processor — `source -> [dry + highpass -> shaper -> mix] -> worklet` —
     * and moving it inside changed its home, not its position: it still runs
     * before the equaliser, so the EQ shapes the harmonics this makes rather
     * than the other way round, and the input regulator downstream still
     * measures a signal this has already added to.
     *
     * Ahead of the mid/side transform as well, which is the same ordering the
     * graph gave it for free by being outside. Exciting mid and side
     * separately would put different harmonics in the sum and the difference,
     * and the sides of a mix are mostly reverb — harmonics generated from
     * reverb are the one place this kind of stage reliably sounds artificial.
     */
    if (this.settings.exciter.enabled) {
      for (let channel = 0; channel < output.length; channel += 1) {
        if (!this.exciters[channel]) {
          this.exciters[channel] = createExciterChannel(output[channel].length);
        }
        const report = runExciterChannel(
          this.exciters[channel],
          output[channel],
          this.settings.exciter,
          sampleRate,
        );
        // The first channel's reading is the one reported. They differ only by
        // the organic wander, which is per channel on purpose, and a display
        // averaging two independent wanders would show a steadier number than
        // either side actually has.
        if (channel === 0) {
          this.exciterBands = report.bands;
          this.exciterOrganic = report.organic;
        }
      }
    } else if (this.exciterOrganic !== 0 || this.exciterBands[2] !== 0) {
      this.exciterBands = [0, 0, 0];
      this.exciterOrganic = 0;
    }

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
        this.processChannel(target, slot);
      } else if (this.isLinearRunning()) {
        // Untouched, but exactly as late as the half that went through the
        // convolver. Without this the mid/side decode below recombines two
        // signals 181 ms apart.
        processDelayLine(this.bypassDelays[slot], target);
      }
    }

    // Committed once the channels agree, never inside the loop.
    this.eqGainNow = this.eqPreampGain;
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
      const loudest = Math.max(Math.abs(left[i]), Math.abs(right[i]));
      if (loudest > this.peak) {
        this.peak = loudest;
      }
    }
    this.blocksSinceReport += 1;
    if (this.blocksSinceReport < METER_BLOCKS) {
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
      bandAmounts: this.bandAmounts,
      bandLevels: this.bandLevels,
      exciterBands: this.exciterBands,
      exciterOrganic: this.exciterOrganic,
      // Sliced rather than sent whole: a partly filled buffer would draw its
      // unused tail as a cluster of pairs at the origin, which reads as a
      // mono signal that is not there.
      scatter: this.scatter.slice(0, this.scatterAt * 2),
    });
    this.blocksSinceReport = 0;
    this.peak = 0;
    this.scatterAt = 0;
    this.sumLeftRight = 0;
    this.sumLeftSquared = 0;
    this.sumRightSquared = 0;
  }
}

registerProcessor('fluideq-dsp', DspProcessor);
