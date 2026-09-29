/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import {
  FFT_SIZE,
  LEVEL_FFT_SIZE,
  METER_CHANNELS,
  SPECTRUM_SMOOTHING,
} from './liveSpectrumFrames';

/** The nodes a live capture reads from, as `connectCaptureGraph` wires them. */
export interface ICaptureNodes {
  /** The spectrum's analyser, on the whole signal. */
  analyser: AnalyserNode;
  /** The capture's source, kept so it can be disconnected. */
  source: MediaStreamAudioSourceNode;
  /** The meter's fan-out, on a stereo capture only. */
  splitter: ChannelSplitterNode | undefined;
  /** One analyser per channel the meter draws. */
  meterAnalysers: AnalyserNode[];
}

/**
 * The capture's source, the spectrum's analyser and the meter's analysers,
 * wired in `context` from `stream`.
 */
const connectCaptureGraph = (
  context: AudioContext,
  stream: MediaStream,
  audioTrack: MediaStreamTrack,
): ICaptureNodes => {
  const analyser = context.createAnalyser();
  analyser.fftSize = FFT_SIZE;
  analyser.minDecibels = -100;
  analyser.maxDecibels = 0;
  // The analyser's own averaging, and the last place lag was hiding.
  //
  // This blends each FFT with the one before it, so at 0.62 a transient
  // reached only 38% of its real height on the frame it happened, 62% on
  // the next and 76% on the third — around 135ms to mostly arrive. That is
  // ahead of everything the display does, so no amount of attack further
  // down could recover it: the peak had already been averaged away before
  // anything drew it.
  //
  // At 0.4 the same transient is 60% there immediately and 94% by the
  // third frame. That was measured against a forty-five millisecond tick,
  // where three frames is 135ms of lag on its own — and it was the largest
  // single term in a delay somebody could hear as the bass arriving before
  // the graph did.
  //
  // 0.2 is 80% there immediately and 99% by the third, and the tick above
  // is shorter too, so the two compound the other way: the same steadying
  // costs about a fifth of the delay it used to. Still not zero, because a
  // raw FFT bin jitters frame to frame and a curve made of pure noise is
  // worse than a slow one.
  analyser.smoothingTimeConstant = SPECTRUM_SMOOTHING;
  // Kept, so it can be disconnected rather than left for `close()`.
  const source = context.createMediaStreamSource(stream);
  source.connect(analyser);

  /*
   * THE METER'S OWN ANALYSERS, AND WHY THE ONE ABOVE COULD NOT DO IT.
   *
   * An AnalyserNode reports one signal, not one per channel: whatever
   * arrives is folded down before the FFT, so the spectrum above already
   * describes left and right added together. That is right for a shape and
   * useless for a stereo meter — there is no way to ask it what the right
   * channel alone is doing, and a "right" meter driven from it would be the
   * left one with a different letter over it.
   *
   * A ChannelSplitterNode is how the channels are told apart. It fans the
   * source out into one output per channel, each carrying that channel and
   * nothing else, and an analyser on each gives two genuinely independent
   * readings. Hard-panned material moves one meter and not the other, which
   * is the test that says this is real.
   *
   * The source keeps its existing connection to the spectrum analyser as
   * well — a node may drive several destinations, and both see the same
   * samples.
   */
  const meterAnalysers: AnalyserNode[] = [];
  const createMeterAnalyser = () => {
    const meterAnalyser = context.createAnalyser();
    meterAnalyser.fftSize = LEVEL_FFT_SIZE;
    meterAnalyser.smoothingTimeConstant = 0;
    meterAnalysers.push(meterAnalyser);
    return meterAnalyser;
  };
  /*
   * How many channels there actually are, asked of the track rather than
   * assumed.
   *
   * A splitter always produces the number of outputs it was built with, so
   * splitting a mono endpoint into two would give a silent second output
   * and a right-hand meter that never moved — a fabricated channel, which is
   * the one outcome worth going out of the way to avoid. Windows loopback is
   * stereo on every ordinary endpoint; where it is not, one meter is drawn
   * and it says so.
   *
   * `channelCount` is optional in the settings dictionary, so an
   * implementation that does not report it is taken at the ordinary case
   * rather than demoted to mono.
   */
  /*
   * TWO OPINIONS ABOUT THE CHANNEL COUNT, AND ONLY ONE OF THEM IS EVIDENCE.
   *
   * `getSettings().channelCount` reports what the track was NEGOTIATED for,
   * and Chromium frequently answers with the constraint that was asked for
   * rather than with what the endpoint is delivering — so a perfectly
   * ordinary stereo loopback can describe itself as mono and get drawn as
   * one bar. Which is what happened.
   *
   * The source node's own `channelCount` is the graph's view of the same
   * stream and does not go through that negotiation, so it is the better
   * witness. Mono is believed only when BOTH say so; either one claiming
   * two is enough, and an implementation that reports nothing is taken at
   * the ordinary case.
   *
   * Guessing stereo wrongly costs a second bar that mirrors the first.
   * Guessing mono wrongly throws away half the meter on every machine
   * where the negotiation lies, which is the worse of the two by far.
   */
  const trackChannels = audioTrack.getSettings?.().channelCount;
  const nodeChannels = source.channelCount;
  const isStereoCapture =
    trackChannels === undefined ||
    trackChannels >= METER_CHANNELS ||
    (Number.isFinite(nodeChannels) && nodeChannels >= METER_CHANNELS);
  let splitter: ChannelSplitterNode | undefined;
  if (isStereoCapture) {
    splitter = context.createChannelSplitter(METER_CHANNELS);
    source.connect(splitter);
    for (let channel = 0; channel < METER_CHANNELS; channel += 1) {
      splitter.connect(createMeterAnalyser(), channel);
    }
  } else {
    source.connect(createMeterAnalyser());
  }
  return { analyser, source, splitter, meterAnalysers };
};

export default connectCaptureGraph;
