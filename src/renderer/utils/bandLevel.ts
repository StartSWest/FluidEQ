/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { MAX_GAIN, MIN_GAIN } from 'common/constants';
import { GRAPH_ANALYZER_RANGE_DB } from '../graph/liveGraphBand';

/** The dB each unit of the graph's analyser stands for (`writeGraphPoints`). */
const DB_PER_UNIT = GRAPH_ANALYZER_RANGE_DB / (MAX_GAIN - MIN_GAIN);

/**
 * How far under the programme's peak a band still shows any light, in dB.
 *
 * Measured in the running window on 2026-09-26, over film and music: the
 * graph's slices stand ten to seventy dB under the peak, the busy ones
 * swinging fifteen to twenty from one frame to the next. Across forty dB
 * that swing is a third to a half of a slider's light arriving and leaving,
 * which is the blink Ivan asked for ("just blink the freq inside the
 * slider"), and a band with nothing in it stays dark.
 */
const LEVEL_RANGE_DB = 40;

/** A band reads a third of an octave round its own frequency. */
const HALF_SPAN_OCTAVES = 1 / 6;

/**
 * How many values a band's level is allowed to take.
 *
 * Quantising it is the whole performance trick. Every element reading
 * `--band-level` has its style recalculated when that property changes, and a
 * continuous value changes on literally every frame — thirty-one bands,
 * invalidated twenty-two times a second, for differences of a thousandth that
 * nobody can see.
 *
 * Rounded to twelve steps it only changes when the music moves enough to be
 * visible, which in practice is a few times a second rather than twenty-two.
 * The motion is very slightly stepped, and that reads as a meter responding
 * rather than as something smoothed — it is not a compromise so much as the
 * more honest look.
 */
export const LEVEL_STEPS = 12;

/**
 * The music at one band's frequency, as a stepped level from 0 to 1.
 *
 * The single thing that decides what the music is doing at a band, and shared
 * by both readers of it: the slider row lights each band's track with one of
 * these (`BandLevels`), and euphoria asks for one for whichever handle is
 * selected on the graph (`EuphoriaGlow`). Two copies of this arithmetic would
 * be two answers to "how loud is this band", and the two would be sitting one
 * above the other on screen where the disagreement is visible.
 *
 * Read from the graph's own slices (`graphPoints`), the ones its analyser is
 * drawn from, and by frequency. It used to take the shared `points` and give
 * each band its index's share of them, and in the window those read nothing
 * above 120 Hz: each is the mean power of the transform's bins under it, so
 * the octaves above the bass sat twenty and more dB under it and were held at
 * the plot's floor, and every slider but the lowest few stayed dark through a
 * whole film. The graph's slices are each a twelfth of an octave's power, so
 * music balanced octave by octave reads level across them, as it is heard. It
 * also read `(peak + 20) / 20`, as though the programme's peak stood at 0,
 * where it stands at the top of the plot.
 *
 * `graphPoints` run low to high, as `writeGraphPoints` lays them out.
 */
export const getBandLevel = (
  graphPoints: readonly { x: number; y: number }[],
  frequency: number,
) => {
  const low = frequency * 2 ** -HALF_SPAN_OCTAVES;
  const high = frequency * 2 ** HALF_SPAN_OCTAVES;
  let peak = MIN_GAIN;
  for (let index = 0; index < graphPoints.length; index += 1) {
    const { x, y } = graphPoints[index];
    if (x > high) {
      break;
    }
    if (x >= low && y > peak) {
      peak = y;
    }
  }
  const below = (MAX_GAIN - peak) * DB_PER_UNIT;
  const level = Math.max(0, Math.min(1, 1 - below / LEVEL_RANGE_DB));
  return Math.round(level * LEVEL_STEPS) / LEVEL_STEPS;
};
