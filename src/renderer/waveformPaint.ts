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

import { WaveformStyle } from 'common/waveformStyles';

/**
 * How the titlebar waveform is drawn, and the numbers behind it.
 *
 * Two hundred and fifty lines of dimensions, easing rates, stroke colours and
 * per-style paint tables, sitting above a component that is otherwise about
 * subscribing to audio and running an animation frame. Neither half was easy to
 * read past the other.
 *
 * The per-style table is the reason this is worth its own file rather than a
 * section: adding a waveform style means adding one entry here and nothing
 * else, and that is much easier to see when the table is the file.
 */
/**
 * The box every shape is built in, and the one the pane is projected from.
 *
 * This was the SVG's `viewBox`, and it stays a fixed box for the same reason it
 * was one: the styles carry absolute sizes — a dot is at least 1.4 across, an
 * LED segment at least 2 tall — and those numbers were chosen against a
 * fifty-eight unit box. Building the shape at the pane's real size instead
 * would let them shrink into the floors and turn the ladder style into a row of
 * gaps on a short titlebar.
 */
export const WAVEFORM_WIDTH = 420;
export const WAVEFORM_HEIGHT = 58;

/** Where the trace tops out, leaving a little air under the pane edges. */
export const WAVEFORM_AMPLITUDE = 25;
/**
 * Euphoria mode, where the trace nearly fills its box.
 *
 * The pane also grows taller in CSS, but that alone only scales the same
 * drawing up — the wave keeps the same share of the box and looks no fuller.
 * Raising the amplitude is what actually makes it reach for the edges.
 */
export const WAVEFORM_AMPLITUDE_MAX = WAVEFORM_HEIGHT / 2 - 2;

/**
 * How far the drawing is allowed to spill past the box it is measured in.
 *
 * The SVG could paint outside itself. The pane sets `overflow: visible`, so the
 * bloom under the trace spread over the padding and past the pane's own border,
 * and in euphoria — where the wave is deliberately reaching for the edges —
 * that spill is most of what the mode looks like.
 *
 * A canvas cannot: everything is clipped to the backing store, and a glow
 * sliced off flat along the top and bottom edges reads as a mistake. So the
 * element is grown by this much on every side and the trace inset by the same
 * amount, which puts the spill back inside the bitmap. Ten covers the widest
 * halo below with a little to spare.
 */
export const WAVEFORM_BLEED = 10;

/**
 * Below this a frame is silence, and normalising it would stretch the noise
 * floor into a full-height trace of nothing.
 */
export const NORMALISE_FLOOR = 0.02;

/** Where the chosen meter style is remembered. */
export const WAVEFORM_STYLE_KEY = 'fluideq-waveform-style';

/**
 * Scale a frame by its own peak, so the shape fills the pane whatever the
 * volume is set to. Guarded by a floor, or a silent frame divides by almost
 * nothing and the noise floor arrives at full height.
 *
 * Written into a buffer the caller owns rather than returning a new array. This
 * runs only in euphoria, which is exactly the mode that draws at the display's
 * full rate rather than at thirty — so a `map` here was one array of a few
 * hundred numbers per frame, for as long as the mode is on, which is the same
 * per-frame garbage the rest of this pipeline goes out of its way to avoid.
 */
export const normalise = (samples: number[], into: number[]): number[] => {
  let peak = 0;
  for (let index = 0; index < samples.length; index += 1) {
    const magnitude = Math.abs(samples[index]);
    if (magnitude > peak) {
      peak = magnitude;
    }
  }
  if (peak <= NORMALISE_FLOOR) {
    return samples;
  }
  const gain = 1 / peak;
  if (into.length !== samples.length) {
    into.length = samples.length;
  }
  for (let index = 0; index < samples.length; index += 1) {
    into[index] = samples[index] * gain;
  }
  return into;
};

/**
 * How long the distance to the newest measurement takes to halve.
 *
 * A duration rather than a per-frame fraction, so the motion takes the same
 * wall-clock time whether the display runs at thirty, sixty or a hundred and
 * forty-four.
 *
 * Well under the 45ms between measurements — at 55ms it was longer than the
 * gap, so the trace never arrived before the next target replaced it and
 * lagged the audio permanently. Eighteen covers about four fifths of the
 * distance within one measurement: enough frames in between to read as motion
 * rather than steps, without the shape trailing what is playing.
 *
 * Symmetric, unlike the spectrum curve. This draws a waveform oscillating
 * about zero rather than a level, so easing the two directions differently
 * would not add punch, it would bend the wave out of shape.
 */
export const WAVEFORM_HALF_LIFE_MS = 18;
/** Vertical rules behind the trace, so the pane reads as a meter. */
export const GRID_DIVISIONS = 12;
/** How far short of the pane's edges those rules stop. */
export const GRID_INSET = 4;
/** dB below which there is nothing worth showing a number for. */
export const SILENCE_DB = -70;
/**
 * Peak falls this many dB per frame. Instant decay makes the readout
 * unreadable; holding it forever makes it a lie.
 */
export const PEAK_RELEASE_DB = 1.1;

/**
 * The paints the stylesheet used to hold.
 *
 * `$primary-lighter` at the three weights its rules carried, and the translucent
 * body ramp that was the `#waveform-fill` gradient in the old `<defs>`. Written
 * out in the colour space a canvas speaks because there is nothing left to ask:
 * whatever this file decides is what gets painted.
 */
export const GRID_STROKE = 'rgba(216, 210, 255, 0.07)';
export const BASELINE_STROKE = 'rgba(216, 210, 255, 0.15)';
export const BASELINE_DASH = [2, 5];
export const NO_DASH: number[] = [];
/** Paused: one flat colour, and none of the light. */
export const PAUSED_STROKE = 'rgba(216, 210, 255, 0.68)';

export const BODY_STOPS = [
  { offset: 0, colour: 'rgba(139, 246, 255, 0.18)' },
  { offset: 0.5, colour: 'rgba(79, 247, 216, 0.42)' },
  { offset: 1, colour: 'rgba(79, 110, 247, 0.18)' },
];

/**
 * The cyan-tones fallback the spectrum style uses when rainbow mode is off.
 *
 * Five stops across the axis, matching `BAND_SPECTRUM_STOPS` position-for-
 * position so the same bar lines up with the same offset whichever ramp is
 * in force. The colours are cyan tones — brightest at the middle, softer at
 * the edges — so the visualiser still reads as a spectrum without borrowing
 * a mode the rest of the app gates on.
 *
 * Comma-separated rgba: a canvas gradient stop is parsed by whatever is
 * running the code (Chromium and jsdom alike), and the older comma form is
 * the one nothing argues about.
 */
export const SPECTRUM_CYAN_STOPS = [
  { offset: 0, colour: 'rgba(139, 246, 255, 0.5)' },
  { offset: 0.28, colour: 'rgba(105, 246, 233, 0.85)' },
  { offset: 0.52, colour: 'rgba(0, 229, 255, 1)' },
  { offset: 0.76, colour: 'rgba(79, 200, 247, 0.85)' },
  { offset: 1, colour: 'rgba(139, 200, 255, 0.5)' },
];

/** One pass of the bloom: how much wider than the figure, and how faint. */
export interface IGlowLayer {
  colour: string;
  widen: number;
  alpha: number;
}

/**
 * The trace's bloom, as strokes rather than as a filter.
 *
 * This was `drop-shadow(0 0 3px cyan) drop-shadow(0 0 7px pink)` on the line. A
 * filter over geometry that is rewritten every frame has to be re-rasterised on
 * every one of them, and an animated filter over live audio is precisely what
 * put this app's memory into the gigabytes once already — which is why the
 * euphoria stylesheet forbids them in as many words.
 *
 * Two strokes instead, widest and faintest underneath, which is what turns a
 * hard edge into a falloff. The colours are `$neon-pink` and `$neon-cyan`, the
 * same two the filter blurred, at the same order of weight.
 */
export const NEON_LAYERS: readonly IGlowLayer[] = [
  { colour: '#ff3cac', widen: 14, alpha: 0.12 },
  { colour: '#00e5ff', widen: 6, alpha: 0.3 },
];

/**
 * Clipping replaces the pair with one red one, exactly as the stylesheet's
 * `.is-clipping` rule replaced the whole filter rather than adding to it.
 */
export const CLIP_LAYERS: readonly IGlowLayer[] = [
  { colour: '#ff647c', widen: 8, alpha: 0.38 },
];

/** Paused, where the trace is a flat line with nothing lighting it. */
export const NO_LAYERS: readonly IGlowLayer[] = [];

/**
 * The euphoria halo: a fat translucent copy of the figure under itself.
 *
 * It used to be a path element mounted with the mode and unmounted with it,
 * because `display: none` stops a path being painted and does not stop the
 * renderer holding a place for it — and what the mode is accused of is not what
 * it costs while it runs, it is that none of it comes back afterwards. On a
 * canvas there is no element either way: the mode is one more stroke while it
 * is on and nothing at all when it is off, which is what the mounting was
 * trying to buy.
 */
export const EUPHORIA_GLOW_WIDTH = 7;
export const EUPHORIA_GLOW_ALPHA = 0.3;

/** Everything the ten styles used to say about themselves in CSS. */
export interface IStylePaint {
  /** Which ramp the closed figure takes. */
  fill: 'body' | 'trace';
  fillAlpha: number;
  strokeWidth: number;
  strokeAlpha: number;
  lineCap: CanvasLineCap;
}

export const BASE_PAINT: IStylePaint = {
  fill: 'body',
  fillAlpha: 1,
  strokeWidth: 1.8,
  strokeAlpha: 1,
  lineCap: 'butt',
};

/**
 * What each style changes, and nothing else.
 *
 * The styles made of separate pieces — bars, dots, spikes, blocks — take the
 * trace's own spectrum rather than the translucent body ramp, because a ramp
 * stretched across the whole figure washes the quiet pieces out entirely. Their
 * opacities differ because a solid bar and a lattice of triangles do not carry
 * the same amount of ink for the same loudness.
 */
export const STYLE_PAINT: Partial<Record<WaveformStyle, Partial<IStylePaint>>> =
  {
    bars: { fill: 'trace', fillAlpha: 0.85 },
    'mirror-bars': { fill: 'trace', fillAlpha: 0.85 },
    dots: { fill: 'trace', fillAlpha: 0.85 },
    blocks: { fill: 'trace', fillAlpha: 0.85 },
    spikes: { fill: 'trace', fillAlpha: 0.62 },
    // The body without an edge, so it reads as a shape rather than a trace.
    ribbon: { fill: 'trace', fillAlpha: 0.5 },
    // A comb of verticals, drawn by the line path rather than filled.
    lattice: { strokeWidth: 1.4, strokeAlpha: 0.85, lineCap: 'round' },
    // One edge, thicker, because it is carrying the whole picture alone.
    outline: { strokeWidth: 2.4 },
    // Bars from the floor with a light curve tracing their tips — the graph
    // panel's LIVE OUTPUT figure in the titlebar. Thin curve, so it reads as
    // a highlight over the bars rather than as a second competing wave.
    spectrum: { fill: 'trace', fillAlpha: 0.9, strokeWidth: 1.2 },
  };

export const resolveStylePaint = (style: WaveformStyle): IStylePaint => ({
  ...BASE_PAINT,
  ...STYLE_PAINT[style],
});

/**
 * Canvas ignores an alpha outside 0..1 and keeps the last one, which is worse
 * than clamping would be: one bad value would silently leave every later stroke
 * at the previous frame's opacity.
 */
export const setAlpha = (context: CanvasRenderingContext2D, alpha: number) => {
  context.globalAlpha = Math.max(0, Math.min(1, alpha));
};

/** Loudest sample in the frame, as dBFS. Undefined when there is silence. */
export const peakDbOf = (samples: number[]) => {
  const peak = samples.reduce(
    (loudest, sample) => Math.max(loudest, Math.abs(sample)),
    0,
  );
  if (peak <= 0) {
    return undefined;
  }
  const db = 20 * Math.log10(peak);
  return db > SILENCE_DB ? db : undefined;
};
