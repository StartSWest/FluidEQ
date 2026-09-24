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

import type { GraphStyle } from './graphStyles';

/**
 * The measuring views: what a mastering engineer has open beside the EQ.
 *
 * Every other form on this graph answers "what does the music look like".
 * These answer "what is the music DOING" — where its energy sits, how far it
 * moves, how wide it is, what it was doing four seconds ago — and each is a
 * reading somebody would act on rather than a picture of the same trace in a
 * different outline. They are drawn by their own renderer
 * (`renderer/graph/analysis`), not by the shape catalogue, because none of
 * them is one path: the spectrogram is a raster, the waterfall is fifty-six
 * figures in perspective, and the stereo view is three instruments in one box.
 */
export const ANALYSIS_STYLES = [
  'analyzer',
  'compare',
  'spectrogram',
  'rta',
  'average',
  'waterfall',
  'loudness',
  /**
   * The second batch, added on Ivan's word ("lets add more as promised and
   * some of them more fast and differnt"). Four of the five are QUICK where
   * the first seven are deliberately studio-slow, and every one of them
   * reads a different axis from the ones above: samples against time, the
   * shared sound against the difference, the spectrum folded onto the
   * twelve notes, five bands as meters, and the image drawn over time.
   */
  'scope',
  'midside',
  'notes',
  'energy',
  'phase',
] as const;

export type TAnalysisStyle = (typeof ANALYSIS_STYLES)[number];

const ANALYSIS_SET: ReadonlySet<string> = new Set(ANALYSIS_STYLES);

export const isAnalysisStyle = (style: GraphStyle): style is TAnalysisStyle =>
  ANALYSIS_SET.has(style);

/**
 * How far the spectrum is tipped up toward the treble, in decibels per octave.
 *
 * Music is not flat and nobody ever wanted it to be: the energy of almost
 * every record falls away above the bass, so an untilted analyser draws a ski
 * slope on every song and tells you nothing about the balance. Tipping the
 * display up by a fixed slope takes that out, and a well-balanced mix then
 * reads as roughly level — which is why every studio analyser has the
 * control, and why 4.5 dB/oct is the figure they open at.
 *
 * OFF is what THIS app opens at, though (Ivan, 2026-09-23: "let set default
 * off because this is not a prod app"). FluidEQ is not a mastering tool that
 * somebody has been taught to read: the untilted picture is the one that
 * matches what a listener expects to see, a spectrum that falls away toward
 * the treble, and the slope is there for the people who came looking for it.
 */
export const DEFAULT_ANALYSIS_TILT = 4.5;

/** The slope a form is drawn at when nobody has said otherwise. */
export const getGraphTilt = (): number => 0;

/** The slopes the editor offers, in dB per octave. */
export const GRAPH_TILTS = [0, 1.5, 3, 4.5, 6] as const;

export const MIN_GRAPH_TILT = 0;
export const MAX_GRAPH_TILT = 6;

/**
 * Whether the slope control says anything on this form.
 *
 * It tips a frequency display, so it belongs to the views that draw one. The
 * stereo meters have no frequency axis at all.
 */
const TILTLESS: ReadonlySet<string> = new Set([
  // No frequency axis to tip: meters, a scope of samples against time, and
  // the image drawn over time.
  'loudness',
  'scope',
  'phase',
]);

export const hasGraphTilt = (style: GraphStyle): boolean =>
  isAnalysisStyle(style) && !TILTLESS.has(style);

/**
 * The frequency the slope pivots about: the display is unchanged at 1 kHz and
 * tips either side of it, so turning the control up does not walk the whole
 * picture off the top of the plot.
 */
export const TILT_PIVOT_HZ = 1000;

/**
 * Whether the decibel scale down the right-hand side describes this drawing.
 *
 * Nearly every form on this graph grows upward out of a floor, so the scale
 * names where a figure's top is. Four do not: the spectrogram runs TIME up
 * the plot and says loudness in colour, the stereo view's box holds a phase
 * dial and meters of its own, the oscilloscope plots sample VALUES either
 * side of silence, and the phase history runs correlation up the plot.
 * Beside any of them the numbers describe nothing on screen — and a scale
 * that names the wrong axis is worse than no scale, because it will be
 * believed.
 */
const LEVEL_AXIS_WRONG: ReadonlySet<string> = new Set([
  'spectrogram',
  'loudness',
  'scope',
  'phase',
]);

export const levelAxisSuitsLook = (style: GraphStyle): boolean =>
  !LEVEL_AXIS_WRONG.has(style);

/**
 * What each measuring view needs measured beyond the shared reading.
 *
 * Asked as one question so the hook that builds the extra analysers has one
 * answer to read: two more graph bands and a splitter are real work, and a
 * look nobody has switched to must not pay for them.
 */
export interface IAnalysisNeeds {
  /** Each channel's own spectrum, for the Left & right split. */
  split: boolean;
  /** One block of samples per channel: the scope and the phase readings. */
  scope: boolean;
  /** The spectrum of what the channels share and of their difference. */
  midside: boolean;
}

export const analysisNeeds = (
  style: GraphStyle,
  splitChosen: boolean,
): IAnalysisNeeds => ({
  split: isAnalysisStyle(style) && splitChosen && style !== 'midside',
  // These three read the samples themselves whichever way Channels is set:
  // there is no joined version of a goniometer or a correlation.
  scope: style === 'loudness' || style === 'scope' || style === 'phase',
  midside: style === 'midside',
});

/**
 * What a measuring view's key can name.
 *
 * Every one of these views draws more than one reading, and until now only
 * the split ones said which was which (Ivan, 2026-09-23: "put leyends for
 * others like peac averaghe"). One list rather than a string per view, so a
 * word means the same thing on every drawing that uses it — "Peak" is the
 * held mark on the Analyzer, the RTA and the note spectrum alike.
 */
export const LEGEND_KEYS = [
  'live',
  'peak',
  'average',
  'max',
  'before',
  'after',
  'phase',
  'width',
] as const;

export type TLegendKey = (typeof LEGEND_KEYS)[number];

/**
 * The eight words, looked up once.
 *
 * Written out rather than folded from the list, so the record is typed
 * without an assertion: `Object.fromEntries` hands back a plain string map
 * and the only way to call that a `Record<TLegendKey, string>` is to say so,
 * which is exactly the kind of claim that survives a key being renamed.
 */
export const legendWords = (
  say: (key: TLegendKey) => string,
): Record<TLegendKey, string> => ({
  live: say('live'),
  peak: say('peak'),
  average: say('average'),
  max: say('max'),
  before: say('before'),
  after: say('after'),
  phase: say('phase'),
  width: say('width'),
});

/** Whether anything at all has to be measured beside the shared reading. */
export const wantsChannels = (needs: IAnalysisNeeds): boolean =>
  needs.split || needs.scope || needs.midside;
