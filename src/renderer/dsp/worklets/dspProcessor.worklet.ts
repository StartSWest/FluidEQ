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
  IBiquadCoefficients,
  IBiquadState,
  biquadCoefficients,
  createBiquadState,
  processBiquad,
} from '../biquad';
import { processEqBands, processEqOversampled } from '../eqEngine';
import { IOversamplerState, createOversampler } from '../oversample';
import { ISaturatorState, createSaturator, saturateBlock } from '../saturate';
import { FilterTypeEnum } from '../../../common/constants';

/** Web Audio always renders 128 frames; the scratch buffers start there. */
const RENDER_QUANTUM = 128;

/** Stereo. A third channel reuses the second one's filter state. */
const CHANNELS = 2;

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

  private subsonicCoefficients: IBiquadCoefficients | undefined;

  /** One per channel: the fuzz stage carries its own oversampler. */
  private readonly fuzz: ISaturatorState[] = [];

  /** One per channel: the oversampler's filters keep history across blocks. */
  private readonly eqOversamplers: IOversamplerState[] = [];

  /** Doubled-rate scratch, used only while oversampling is on. */
  private eqDoubled = new Float32Array(RENDER_QUANTUM * 2);

  private eqDryDoubled = new Float32Array(RENDER_QUANTUM * 2);

  private eqWetDoubled = new Float32Array(RENDER_QUANTUM * 2);

  private eqCoefficients: IBiquadCoefficients[] = [];

  /** What the coefficients were built from, so they rebuild only on a change. */
  private eqSignature = '';

  /** Linear, not dB: this is multiplied per sample. */
  private eqPreampGain = 1;

  private lookAheadSamples = 0;

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
      this.fuzz.push(createSaturator(RENDER_QUANTUM));
    }
    this.rebuildLimiters();
    this.port.onmessage = (event: MessageEvent<unknown>) => {
      this.settings = clampDspSettings(event.data);
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

  private ensureScratch(length: number): void {
    if (this.low.length === length) {
      return;
    }
    this.eqDry = new Float32Array(length);
    this.eqDoubled = new Float32Array(length * 2);
    this.eqDryDoubled = new Float32Array(length * 2);
    this.eqWetDoubled = new Float32Array(length * 2);
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
    // Held as a linear multiplier so the sample loop is one multiply rather
    // than a pow per sample.
    this.eqPreampGain = 10 ** (eq.preampDb / 20);
    // Oversampling runs the cascade at twice the rate, so its filters have to
    // be DESIGNED for that rate. Handing it the ordinary set would place every
    // band an octave low — a bug rather than a mode.
    const designRate = eq.oversample ? sampleRate * 2 : sampleRate;
    // Built at the base rate, because it runs BEFORE the oversampler: a high
    // pass whose job is to keep energy out has nothing to gain from being
    // inside, and doing it first means the oversampler carries less.
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
  }

  /** One channel, in place in `target`, which already holds the input. */
  private processChannel(target: Float32Array, slot: number): void {
    const { eq, compressor, maximizer } = this.settings;

    if (eq.enabled) {
      // Ahead of the bands, which is where the format puts it and the only
      // place it works: the preamp exists to make room for the boosts that
      // follow, and applying it after them is applying it too late.
      if (this.eqPreampGain !== 1) {
        for (let i = 0; i < target.length; i += 1) {
          target[i] *= this.eqPreampGain;
        }
      }
      // Ahead of everything else: it exists to keep energy out of the chain,
      // so anything after it would be shaping content this removes.
      if (this.subsonicCoefficients) {
        processBiquad(
          this.subsonicStates[slot],
          target,
          this.subsonicCoefficients,
        );
      }
      if (eq.oversample) {
        processEqOversampled(
          this.eqStates[slot],
          this.eqCoefficients,
          target,
          eq.engine,
          this.eqOversamplers[slot],
          this.eqDoubled,
          this.eqDryDoubled,
          this.eqWetDoubled,
        );
      } else {
        processEqBands(
          this.eqStates[slot],
          this.eqCoefficients,
          target,
          eq.engine,
          this.eqDry,
          this.eqWet,
        );
      }
      // After the bands, where an analogue unit's output amplifier sits: it
      // colours what the curve produced rather than what went into it.
      //
      // `saturateBlock` carries its own 2x oversampler whatever the EQ is set
      // to, because a non-linearity at the session rate folds its harmonics
      // back down as inharmonic content — the very sound this is meant to be
      // an alternative to.
      if (eq.fuzzAmount > 0) {
        // Low drive is nearly linear and the curve is normalised by it, so the
        // dial reaches "barely there" rather than starting at obvious.
        saturateBlock(this.fuzz[slot], target, 0.5 + eq.fuzzAmount * 3.5);
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
        this.processChannel(target, Math.min(channel, CHANNELS - 1));
      }
    }
    return true;
  }
}

registerProcessor('fluideq-dsp', DspProcessor);
