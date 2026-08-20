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

import { getEaseFactor } from 'common/smoothing';
import { GraphPalette } from 'common/graphStyles';
import { WAVEFORM_STYLES, WaveformStyle } from 'common/waveformStyles';

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
) => {
  const rise = getEaseFactor(deltaMs, SPECTRUM_BAR_ATTACK_MS);
  const fall = getEaseFactor(deltaMs, SPECTRUM_BAR_RELEASE_MS);
  if (levels.length === 0) {
    for (let bar = 0; bar < bars.length; bar += 1) {
      bars[bar] += (0 - bars[bar]) * fall;
    }
    return;
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
    const target = Math.max(
      0,
      Math.min(1, (peakDb - floorDb) / SPECTRUM_BAR_RANGE_DB),
    );
    const gap = target - bars[bar];
    bars[bar] += gap * (gap > 0 ? rise : fall);
  }
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
  paint?: string | CanvasGradient,
) => {
  const topAlpha = isRainbow ? 0.5 : 0.42;
  forEachSpectrumBar(box, bars, gap, (x, y, width, height, across, energy) => {
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
 * The trace's colours by mode, applied globally to every style. Rainbow
 * mode uses the site signal-deck's exact five-stop palette; the default
 * "cyan tones" mode a three-stop cyan gradient — bright cyan at the ends
 * fading to a light cyan at the middle. Same offsets in both, so every
 * style lines up bar-for-bar and sample-for-sample regardless of mode.
 */
export const TRACE_RAINBOW_STOPS = [
  { offset: 0, colour: '#00e5ff' },
  { offset: 0.28, colour: '#b6ff4a' },
  { offset: 0.52, colour: '#ffe66d' },
  { offset: 0.76, colour: '#ff3cac' },
  { offset: 1, colour: '#8b5cff' },
];
export const TRACE_CYAN_STOPS = [
  { offset: 0, colour: '#0077a3' }, // deep teal
  { offset: 0.28, colour: '#00c5ff' }, // cyan
  { offset: 0.52, colour: '#c8fff8' }, // ice white
  { offset: 0.76, colour: '#00e5cf' }, // sea green
  { offset: 1, colour: '#005b7f' }, // deeper teal
];

/**
 * The styles that read the analyser's frequency bands rather than the
 * time-domain samples.
 *
 * The spectrum style was the first to do it and is the reason the rest
 * followed: a bar built from `Math.abs(sample)` is the envelope of the
 * waveform, which wobbles with the volume and says nothing about what is
 * actually in the sound. Given the FFT the same drawing becomes a real
 * spectrum, and the whole family — bars, blades, ladders, bead columns,
 * and the silhouette over them — reads as one instrument seen five ways.
 *
 * Every style here keeps a time-domain fallback for the case where no
 * analyser is running, so the pane still draws with nothing captured.
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
 * Every style is drawn in the spectrum's own light: a heavier stroke over
 * a soft `shadowBlur` rather than the multi-stroke neon halo they used to
 * wear. The halo was built for a single thin trace and, laid over a
 * figure made of dozens of separate pieces, it fringed every one of them
 * instead of lighting the shape.
 *
 * A set rather than a plain `true` because the halo is still what the
 * clipping and paused treatments use, and because a style added later
 * should have to opt in deliberately rather than inherit this by
 * accident.
 */
export const SOFT_GLOW_WAVEFORM_STYLES: ReadonlySet<WaveformStyle> = new Set(
  WAVEFORM_STYLES,
);

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
export const EUPHORIA_GLOW_WIDTH = 5;
export const EUPHORIA_GLOW_ALPHA = 0.14;

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
    // The spectrum family, all at the same weight so cycling between
    // them changes the shape and nothing else.
    bars: { fill: 'trace', fillAlpha: 0.9 },
    'mirror-bars': { fill: 'trace', fillAlpha: 0.9 },
    dots: { fill: 'trace', fillAlpha: 0.9 },
    blocks: { fill: 'trace', fillAlpha: 0.9 },
    // Blades overlap at their feet, so they carry a touch less ink than
    // the styles whose pieces stand apart.
    spikes: { fill: 'trace', fillAlpha: 0.72 },
    // The body without an edge, so it reads as a shape rather than a trace.
    ribbon: { fill: 'trace', fillAlpha: 0.5 },
    // A comb of verticals, drawn by the line path rather than filled.
    lattice: { strokeWidth: 1.4, strokeAlpha: 0.85, lineCap: 'round' },
    // The spectrum's silhouette: one line carrying the whole picture, so
    // it takes the family's own stroke weight rather than a lighter one.
    outline: { fill: 'trace', fillAlpha: 0, lineCap: 'round' },
    // Pale bars behind, one smooth wave on top — the site's nav-signal in
    // the titlebar. The bars are drawn imperatively (per-bar hue and
    // vertical gradient); this entry is only for the wave stroke and its
    // fill is unused. Stroke width, alpha and cap match the site's
    // `lineWidth: 1.65 / lineCap: 'round'` verbatim, and the renderer
    // swaps the multi-stroke halo out for the site's `shadowBlur: 8` glow.
    fluid: {
      fill: 'trace',
      fillAlpha: 0,
      strokeWidth: 1.65,
      strokeAlpha: 1,
      lineCap: 'round',
    },
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
