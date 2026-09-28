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

import { easeTowards, getEaseFactor } from 'common/smoothing';
import { GraphPalette, IGraphBallistics } from 'common/graphStyles';
import type { WaveformStyle } from 'common/waveformStyles';
import { readSurface, type TSurfaceName } from './utils/theme';

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

/**
 * Where the trace tops out: as tall as the box allows, in both modes.
 *
 * There was a quieter figure beside this one that the pane used at rest,
 * with euphoria switching to this. The pair is gone because the drawing no
 * longer shrinks with the volume — a wave that reaches the edges in one mode
 * and hugs the middle in the other reads as two different instruments, and
 * the mode is carried by the palette instead.
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

/** Where the chosen meter style is remembered. */
export const WAVEFORM_STYLE_KEY = 'fluideq-waveform-style';

/**
 * How the spectrum bars breathe between FFT frames.
 *
 * The FFT publishes about thirty times a second, and drawing raw points
 * would leave a bar sitting perfectly still for two display frames and
 * then jumping — the classic meter fault. Snap up fast and fall back
 * quickly, so the bars track the audio's own motion rather than lagging
 * behind it: at 220ms the release read as a hold that never quite came
 * back to rest, and every kick left a stumps-tall row behind it. Ninety
 * lands closer to the audio's own decay while still riding out the
 * per-frame jitter.
 */
export const SPECTRUM_BAR_ATTACK_MS = 6;
export const SPECTRUM_BAR_RELEASE_MS = 90;

/**
 * How much dB the spectrum bars map across, from the level floor to the
 * top of the pane. Wider than the OutputLevelMeter's 60 dB on purpose:
 * running loudness peaks up at 0 dBFS filled the pane and made every
 * frame read as saturated. Eighty dB spreads the same audio over more
 * range, so a typical track sits in the lower half and the top of the
 * pane is reserved for genuine peaks.
 */
export const SPECTRUM_BAR_RANGE_DB = 80;

/**
 * The fluid visualiser's spectrum bars, painted the one way there is.
 *
 * Extracted so both panes draw them from the same code rather than each
 * keeping a version. The graph got a copy first and it was not the same
 * drawing at all: the bars were the shape module's forty-eight columns in
 * the look's own flat ramp, where these are a bar every eleven pixels —
 * far tighter on a wide plot — each with its own hue and its own vertical
 * gradient, which is the thing a single fillStyle on a shared path cannot
 * express and the reason this is imperative in the first place.
 *
 * Every number below is the FluidEQ site's signal-deck, kept as it was:
 * two-pixel gap, hue sweep 184°→296°, floor at 82% of the box, and a top
 * alpha dimmer in cyan than in rainbow. The resting stump is what leaves
 * bars showing through silence instead of an empty box.
 */
/** What a bar shows when there is nothing to show. */
const STUMP_HEIGHT = 6;

export const spectrumBarCount = (width: number) =>
  Math.max(48, Math.floor(width / 11));

/**
 * Move the bars toward the frame, snapping up and easing back.
 *
 * Per frame rather than per measurement: at a 60Hz display and a 30Hz
 * analyser, every other frame would sit on the same reading and the bars
 * would tick rather than breathe.
 *
 * `levels` are decibels — the same `.y` both panes' points carry. With no
 * frame at all they release toward zero, so a pane settles when the audio
 * stops instead of freezing on its last reading.
 */
export const advanceSpectrumBars = (
  bars: number[],
  levels: readonly { y: number }[],
  floorDb: number,
  deltaMs: number,
  ballistics: IGraphBallistics = {
    attackMs: SPECTRUM_BAR_ATTACK_MS,
    releaseMs: SPECTRUM_BAR_RELEASE_MS,
  },
  rangeDb = SPECTRUM_BAR_RANGE_DB,
) => {
  const rise = getEaseFactor(deltaMs, ballistics.attackMs);
  const fall = getEaseFactor(deltaMs, ballistics.releaseMs);
  let moving = false;
  if (levels.length === 0) {
    for (let bar = 0; bar < bars.length; bar += 1) {
      bars[bar] += (0 - bars[bar]) * fall;
    }
    return bars.some((bar) => bar > 0.002);
  }
  const stride = levels.length / bars.length;
  for (let bar = 0; bar < bars.length; bar += 1) {
    const start = Math.floor(bar * stride);
    const end = Math.min(levels.length, Math.floor((bar + 1) * stride));
    let peakDb = floorDb;
    for (let index = start; index < end; index += 1) {
      if (levels[index].y > peakDb) {
        peakDb = levels[index].y;
      }
    }
    const target = Math.max(0, Math.min(1, (peakDb - floorDb) / rangeDb));
    const gap = target - bars[bar];
    if (Math.abs(gap) > 0.002) {
      bars[bar] += gap * (gap > 0 ? rise : fall);
      moving = true;
    } else {
      bars[bar] = target;
    }
  }
  return moving;
};

export const advanceWaveform = (
  current: number[],
  target: readonly number[],
  deltaMs: number,
  ballistics: IGraphBallistics,
): boolean => {
  // Easing an empty buffer visits no samples; Fluid consequently drew its
  // spectrum fallback forever instead of the captured waveform.
  if (current.length !== target.length) {
    current.length = target.length;
    current.fill(0);
  }
  return easeTowards(
    current,
    target,
    getEaseFactor(deltaMs, ballistics.attackMs),
    getEaseFactor(deltaMs, ballistics.releaseMs),
  );
};

interface ISpectrumBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Where each bar goes, worked out in one place.
 *
 * The painter and the path builder below both need these rectangles, and a
 * border that is traced from a second set of numbers is a border that does
 * not sit on the bars — which is exactly what happened when the outline was
 * taken from the shape module's own bar form instead: a different count at a
 * different width, drawn around bars it had never seen.
 */
const forEachSpectrumBar = (
  box: ISpectrumBox,
  bars: readonly number[],
  /** Extra column left empty, on top of the two pixels always there. */
  gap: number,
  visit: (
    x: number,
    y: number,
    width: number,
    height: number,
    across: number,
    energy: number,
  ) => void,
) => {
  const count = bars.length;
  if (count === 0) {
    return;
  }
  const step = box.width / count;
  const width = Math.max(
    1,
    (step - 2) * (1 - Math.max(0, Math.min(0.85, gap))),
  );
  const floor = box.y + box.height;
  for (let index = 0; index < count; index += 1) {
    // Flat rather than arched — no sine envelope — so every bar measures
    // the same share of the box and it reads as a spectrum rather than as
    // a curved decoration.
    const energy = bars[index];
    /**
     * The resting stump, in PIXELS rather than as a share of the box.
     *
     * It was twelve per cent of the height, which is six pixels in the
     * titlebar's fifty-eight and reads as bars at rest. On the graph's plot
     * it was nearly forty — a permanent band of bars along the floor that
     * had nothing to do with the audio, and the first thing anybody asked
     * about. A fixed few pixels is the same thing the titlebar always drew
     * and stays that thing whatever the pane is.
     */
    const height = Math.max(STUMP_HEIGHT, energy * box.height * 0.82);
    visit(
      // Centred in its column, so widening the gap eats in from both
      // sides rather than sliding every bar to the left.
      box.x + index * step + (step - width) / 2,
      floor - height,
      width,
      height,
      index / Math.max(1, count - 1),
      energy,
    );
  }
};

/**
 * What decides a bar's hue.
 *
 * ONE TREATMENT, THREE ANSWERS. The form is a bar with its own hue and its
 * own vertical fade, light at the top and almost clear at the foot, and that
 * is what makes it read as a spectrum rather than as a bar chart. A palette
 * that threw the treatment away and filled flat stopped being this drawing
 * at all — so the palettes change what the hue is FROM and leave the rest.
 *
 * `across` is the bar's place in the box, `energy` how tall it is.
 */
export type SpectrumHue = (across: number, energy: number) => number;
export type SpectrumBarPaint = (
  across: number,
  energy: number,
  y: number,
  height: number,
  topAlpha: number,
) => string | CanvasGradient;

/** The titlebar's own: cyan through violet, coloured by position. */
export const SPECTRUM_HUE_FLAT: SpectrumHue = (across) => 184 + across * 112;

/** The same idea said louder — position, most of the way round the wheel. */
export const SPECTRUM_HUE_RAINBOW: SpectrumHue = (across) =>
  (200 + across * 320) % 360;

/**
 * Coloured by how loud the bar is, not by where it sits.
 *
 * Which is what `level` means everywhere else on the graph: a bar reddens as
 * it grows. Cyan at rest down through green and amber to red at full height —
 * the meter ramp, run per bar rather than as one gradient up the plot, so it
 * keeps the fade that the other two have.
 */
export const SPECTRUM_HUE_LEVEL: SpectrumHue = (_across, energy) =>
  190 - Math.max(0, Math.min(1, energy)) * 190;

/**
 * Which of the three a palette gets.
 *
 * A table rather than a chain of conditionals: they are three answers to one
 * question, and written as nested ternaries at the call site that reads as a
 * puzzle instead of as a lookup.
 */
export const SPECTRUM_HUE_BY_PALETTE: Record<GraphPalette, SpectrumHue> = {
  signal: SPECTRUM_HUE_FLAT,
  rainbow: SPECTRUM_HUE_RAINBOW,
  // Level is a ramp UP the plot, which no per-bar hue can be — the caller
  // hands the paint over instead and this entry is never reached. Named
  // rather than left out because the table is exhaustive on purpose.
  level: SPECTRUM_HUE_FLAT,
  heat: SPECTRUM_HUE_LEVEL,
  // Never reached: auto is resolved to a form's own palette before paint.
  auto: SPECTRUM_HUE_FLAT,
};

/** Draw them into the given box. */
export const paintSpectrumBars = (
  context: CanvasRenderingContext2D,
  box: ISpectrumBox,
  bars: readonly number[],
  isRainbow: boolean,
  hueAt: SpectrumHue,
  gap: number,
  /**
   * Replaces the sweep, for the palette that is a meter rather than a map.
   *
   * `level` runs its ramp UP the plot and is pinned to the plot, so a colour
   * is a decibel: a short bar is green all the way, a tall one climbs into
   * amber and red, and the same height is the same colour whatever else is
   * on screen. Each bar shows its own slice of that one ramp, which is what
   * a meter is — and a per-bar hue would say something else entirely.
   */
  paint?: string | CanvasGradient | SpectrumBarPaint,
) => {
  /**
   * The lit top of a bar, fading to an almost-clear foot — that fade is the
   * effect, and it is what makes these read as a spectrum rather than as a
   * bar chart.
   *
   * One set of numbers for both places it is drawn. The graph used to lift
   * this by 1.7 on the argument that its plot is deeper and the same alphas
   * over more area read as a ghost; with the two side by side on screen,
   * what it actually did was bring the bars forward until they fought the
   * wave over them. The titlebar's fluid is the reference for this form.
   */
  const topAlpha = isRainbow ? 0.5 : 0.42;
  forEachSpectrumBar(box, bars, gap, (x, y, width, height, across, energy) => {
    if (typeof paint === 'function') {
      context.fillStyle = paint(across, energy, y, height, topAlpha);
      context.fillRect(x, y, width, height);
      return;
    }
    if (paint === undefined) {
      const gradient = context.createLinearGradient(0, y, 0, y + height);
      const hue = hueAt(across, energy);
      gradient.addColorStop(0, `hsla(${hue}, 92%, 65%, ${topAlpha})`);
      gradient.addColorStop(1, `hsla(${hue}, 92%, 58%, 0.06)`);
      context.fillStyle = gradient;
      context.fillRect(x, y, width, height);
      return;
    }

    /**
     * The same bar, in a ramp that belongs to the plot rather than to it.
     *
     * A palette that runs UP THE AXIS cannot be a colour per bar — that is
     * what makes it a meter, and a colour has to mean a decibel. But the
     * fade down each bar is the form, and filling flat with the ramp took
     * it away: the bars melted into one wall of gradient with notches cut
     * out of the top.
     *
     * So the ramp is painted and the fade is then ERASED into it, which is
     * the only way to take an alpha ramp off an arbitrary gradient without
     * knowing what colours are in it. Safe here because nothing else on
     * this canvas is under the bars — the trace is the first thing drawn
     * after the clear, and bars do not overlap each other.
     */
    context.save();
    context.fillStyle = paint;
    context.fillRect(x, y, width, height);
    /**
     * Erased to exactly the profile the other three paint.
     *
     * They run their bar from `topAlpha` down to six per cent, so the erase
     * takes away what is left over that: `1 - topAlpha` at the top and 0.94
     * at the foot. Filling at `topAlpha` first and then erasing looked like
     * a different drawing, because the two alphas multiplied and the tail
     * came out at half the weight the others' does.
     */
    context.globalAlpha = 1;
    context.globalCompositeOperation = 'destination-out';
    const fade = context.createLinearGradient(0, y, 0, y + height);
    fade.addColorStop(0, `rgba(0, 0, 0, ${1 - topAlpha})`);
    fade.addColorStop(1, 'rgba(0, 0, 0, 0.94)');
    context.fillStyle = fade;
    /**
     * Erased a pixel wider than it was filled, on every side.
     *
     * Both rectangles are anti-aliased, and at the same bounds the erase
     * leaves the partially-covered edge pixels partially un-erased — which
     * came out as a bright hairline down each side of every bar, the full
     * height of the plot, on the one palette drawn this way. Overshooting
     * covers them, and stays inside the two-pixel gap so it cannot reach
     * the bar next door.
     */
    context.fillRect(x - 1, y - 1, width + 2, height + 2);
    context.restore();
  });
};

/**
 * The same bars as path data, for anything that has to trace them.
 *
 * The border, the halo and the mask that keeps a border outside its own fill
 * all work on a `Path2D`, and none of them can be handed a painted figure.
 * Built from the same geometry so they land on the bars rather than near
 * them.
 */
export const spectrumBarsPath = (
  box: ISpectrumBox,
  bars: readonly number[],
  gap: number,
): string => {
  let path = '';
  forEachSpectrumBar(box, bars, gap, (x, y, width, height) => {
    path +=
      `M ${x.toFixed(1)},${y.toFixed(1)} h ${width.toFixed(1)} ` +
      `v ${height.toFixed(1)} h ${(-width).toFixed(1)} Z`;
  });
  return path;
};
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
 * The pane's own furniture: faint vertical rules and a dashed centre, so it
 * reads as an instrument rather than a stray line on a dark rectangle.
 */
export const GRID_STROKE = 'rgba(216, 210, 255, 0.06)';
export const BASELINE_STROKE = 'rgba(216, 210, 255, 0.13)';
export const BASELINE_DASH = [2, 5];
export const NO_DASH: number[] = [];
/** Paused: one flat colour, and none of the light. */
export const PAUSED_STROKE = 'rgba(216, 210, 255, 0.68)';
/** Clipping: the trace itself turns the warning's red, flat. */
export const CLIP_STROKE = '#ff5a6e';

/**
 * The trace's colours in Normal mode, left to right across the pane: the
 * primary's dark at the ends through the primary to its light in the
 * middle — the walk it always made, now in the window's own colours. It
 * wore fixed cyans, which on another theme or under a Plus visualizer's
 * colours were the one cyan left in the window. In Rainbow mode the trace is
 * the mode's own palette (`rainbowGradientStops`).
 */
const TRACE_WALK: readonly (readonly [number, TSurfaceName, string])[] = [
  [0, '--accent-dark', '#0077a3'],
  [0.28, '--accent', '#00c5ff'],
  [0.52, '--accent-light', '#c8fff8'],
  [0.76, '--accent', '#00e5cf'],
  [1, '--accent-dark', '#005b7f'],
];

export const traceWalkStops = (): { offset: number; colour: string }[] =>
  TRACE_WALK.map(([offset, token, fallback]) => ({
    offset,
    colour: readSurface(token, fallback),
  }));

/**
 * The styles that read the analyser's frequency bands rather than the
 * time-domain samples.
 *
 * A bar built from `Math.abs(sample)` is the envelope of the waveform, which
 * wobbles with the volume and says nothing about what is in the sound. Given
 * the FFT the same drawing becomes a real spectrum, and the whole family —
 * bars, blades, ladders, bead columns, and the silhouette over them — reads
 * as one instrument seen several ways. Every style here keeps a time-domain
 * fallback for the case where no analyser is running.
 */
export const FFT_WAVEFORM_STYLES: ReadonlySet<WaveformStyle> = new Set([
  'bars',
  'mirror-bars',
  'blocks',
  'dots',
  'spikes',
  'outline',
  'lattice',
]);

/**
 * Everything the eleven styles say about how they are painted: flat, in
 * the trace's colours, with no light round them. They wore a pink-and-cyan
 * neon halo, a soft coloured shadow and in Rainbow mode a fat translucent
 * copy of the figure under itself; every one of those blurred the edges the
 * strip is read by (Ivan, 2026-09-26: "fix them all ... clean", "no glow").
 */
export interface IStylePaint {
  fillAlpha: number;
  strokeWidth: number;
  strokeAlpha: number;
  lineCap: CanvasLineCap;
}

export const BASE_PAINT: IStylePaint = {
  fillAlpha: 1,
  strokeWidth: 1.6,
  strokeAlpha: 1,
  lineCap: 'round',
};

/**
 * What each style changes, and nothing else. The styles made of separate
 * pieces carry nearly full ink; a body behind an edge carries a third, so
 * the edge is what is read.
 */
export const STYLE_PAINT: Partial<Record<WaveformStyle, Partial<IStylePaint>>> =
  {
    filled: { fillAlpha: 0.3, strokeWidth: 1.4 },
    bars: { fillAlpha: 0.95 },
    'mirror-bars': { fillAlpha: 0.95 },
    dots: { fillAlpha: 0.95 },
    blocks: { fillAlpha: 0.95 },
    // Blades overlap at their feet, so a touch less ink.
    spikes: { fillAlpha: 0.82 },
    // The body without an edge: a shape rather than a trace.
    ribbon: { fillAlpha: 0.62 },
    lattice: { strokeWidth: 1.4 },
    // The spectrum's silhouette: one line carrying the whole picture.
    outline: { strokeWidth: 1.8 },
    // One smooth wave over the spectrum's bars.
    fluid: { strokeWidth: 1.8 },
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
