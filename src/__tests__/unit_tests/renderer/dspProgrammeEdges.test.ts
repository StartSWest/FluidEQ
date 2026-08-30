/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { createProgrammeEdgeAnalyzer } from '../../../renderer/dsp/programmeEdges';

const SAMPLE_RATE = 48_000;

/**
 * One channel of `seconds` seconds, filled by `level(second)`. A returned
 * amplitude of 0 is digital silence, which is what the padding these edges
 * exist to find actually contains.
 */
const tone = (
  seconds: number,
  level: (atSecond: number) => number,
): Float32Array => {
  const samples = new Float32Array(Math.round(seconds * SAMPLE_RATE));
  for (let frame = 0; frame < samples.length; frame += 1) {
    const amplitude = level(frame / SAMPLE_RATE);
    samples[frame] =
      amplitude * Math.sin((2 * Math.PI * 440 * frame) / SAMPLE_RATE);
  }
  return samples;
};

const measure = (samples: Float32Array, chunkSeconds = 1) => {
  const analyzer = createProgrammeEdgeAnalyzer(SAMPLE_RATE, 1);
  const stride = Math.round(chunkSeconds * SAMPLE_RATE);
  for (let from = 0; from < samples.length; from += stride) {
    analyzer.feed([samples], from, Math.min(samples.length, from + stride));
  }
  return analyzer.finish();
};

describe('programme edges', () => {
  /**
   * The measurement the whole feature rests on.
   *
   * A crossfade scheduled against the container's duration starts inside the
   * padding, so a file with five seconds of silence after the music never
   * overlaps anything audible.
   */
  it('finds the music inside a padded file', () => {
    const padded = tone(10, (second) => (second >= 2 && second < 5 ? 0.5 : 0));

    const edges = measure(padded);

    expect(edges.leadInMs).toBeGreaterThanOrEqual(1_940);
    expect(edges.leadInMs).toBeLessThanOrEqual(2_000);
    expect(edges.endMs).toBeGreaterThanOrEqual(5_000);
    expect(edges.endMs).toBeLessThanOrEqual(5_060);
  });

  /**
   * The yield boundary must not be able to change the answer. The player
   * feeds one second per animation frame, and a file measured in one call has
   * to agree with the same file measured in chunks.
   */
  it('reads the same edges however the samples are chunked', () => {
    const padded = tone(6, (second) => (second >= 1 && second < 4 ? 0.3 : 0));

    expect(measure(padded, 6)).toEqual(measure(padded, 0.137));
  });

  /**
   * The reason the detector counts a run of windows rather than one.
   *
   * Files do end with a single-sample click, and one window over the
   * threshold used to be enough to put the programme end back where the
   * padding ends -- which is the bug this whole change removes.
   */
  it('ignores a lone click in the trailing silence', () => {
    const clicked = tone(8, (second) => (second < 3 ? 0.5 : 0));
    clicked[Math.round(7.5 * SAMPLE_RATE)] = 1;

    expect(measure(clicked).endMs).toBeLessThanOrEqual(3_060);
  });

  /**
   * A track that fades out is still playing while it fades. The cut belongs
   * where it drops below audibility, not where the fade began.
   */
  it('keeps a fade-out until it crosses the threshold', () => {
    const faded = tone(6, (second) =>
      second < 2 ? 0.5 : Math.max(0, 0.5 * (1 - (second - 2) / 2)),
    );

    const { endMs } = measure(faded);

    expect(endMs).toBeGreaterThan(3_500);
    expect(endMs).toBeLessThanOrEqual(4_060);
  });

  /**
   * An empty or near-empty file has no programme to point at. Reporting one
   * would make every transition into it instant; it is played as it is.
   */
  it('falls back to the whole file when nothing is audible', () => {
    expect(measure(tone(3, () => 0))).toEqual({ leadInMs: 0, endMs: 3_000 });
  });
});
