/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  DSP_DEFAULTS,
  IDspSettings,
  clampDspSettings,
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

  private lookAheadSamples = 0;

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
    }
    this.rebuildLimiters();
    this.port.onmessage = (event: MessageEvent<unknown>) => {
      this.settings = clampDspSettings(event.data);
      this.rebuildLimiters();
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
    this.low = new Float32Array(length);
    this.mid = new Float32Array(length);
    this.high = new Float32Array(length);
  }

  /** One channel, in place in `target`, which already holds the input. */
  private processChannel(target: Float32Array, slot: number): void {
    const { compressor, maximizer } = this.settings;

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
