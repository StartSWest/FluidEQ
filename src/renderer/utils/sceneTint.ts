/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import { hueDistance, rgbToLab, smoothstep, type ILab } from './oklab';

/**
 * The colour a Plus visualizer lends the rest of the window, as arithmetic.
 *
 * Two questions, both answered in OKLab because it is the space where equal
 * steps look equal: what colour is this scene's sky, and what does the theme
 * look like standing in that colour.
 *
 * THE SKY IS THE COLOUR THAT COVERS THE MOST OF THE FRAME, not the brightest
 * or the most saturated one. A neon skyline's buildings are far more vivid than
 * the violet behind them, and a window tinted from the signs would be a pink
 * app for a purple picture. Pixels are weighed by the area they cover, and the
 * greys, the near-blacks and the highlights are weighed out, because none of
 * them says what colour the scene is.
 *
 * THE ACCENT IS THE SCENE'S SECOND COLOUR. The buttons, the kickers and the
 * switches take the hue that covers the most of the frame once the sky's own
 * is set aside — the signs in front of the night rather than the night again —
 * so the window stands in the scene's first colour and points with its second,
 * the way the picture itself does.
 *
 * THE THEME KEEPS ITS LIGHTNESS. Every surface keeps the exact lightness its
 * theme gave it and takes only its hue and chroma from the sky, so the ladder
 * the whole design stands on — floor, pane, block, field, menu — is the same
 * ladder in a new colour, and text contrast is exactly what it was. The accent
 * keeps its chroma and takes only the hue, giving up just enough lightness to
 * hold that chroma where the screen cannot show it — never so much that the
 * dark label on a filled button stops reading.
 */

/** One colour a scene shows, and how much of the frame it covers. */
export interface ISceneColour {
  /** OKLab lightness, 0 to 1. */
  lightness: number;
  /** OKLCH chroma. */
  chroma: number;
  /** OKLCH hue, in degrees. */
  hue: number;
  /** How much of the frame the colour covers, 0 to 1. */
  share: number;
}

/** The colour covering the most of a scene, and the one after it. */
export interface ISceneSky extends ISceneColour {
  /**
   * The busiest colour of a clearly different hue. Null for a scene in one
   * colour, whose accent is then its sky's own hue.
   */
  accent: ISceneColour | null;
  /**
   * The busiest colour fit to say "on": clearly apart from the buttons' hue,
   * and from the red and amber that say off and wait — the blue-grey heart of
   * a magenta flower. Null for a scene with no such colour, a fire or a desert.
   */
  active: ISceneColour | null;
}

export { parseCssColour } from './oklab';
export {
  SCENE_TINT_ACCENTS,
  SCENE_TINT_EDGES,
  SCENE_TINT_STATES,
  SCENE_TINT_SURFACES,
  SCENE_TINT_TOKENS,
  sceneAccentHue,
  sceneSkyColour,
  sceneTintStrength,
  sceneTintSwatch,
  tintThemePalette,
  type TSceneTintPalette,
  type TSceneTintToken,
} from './sceneTintPalette';

// *** Finding the sky *********************************************************

/**
 * Which way of measuring a sky the answers below come from. Raise it with any
 * change to what `findSceneSky` returns for the same frames: remembered skies
 * from another measurement are thrown away and the scenes measured again.
 * 2 added the accent, 3 the colour for "on".
 */
export const SCENE_SKY_MEASUREMENT = 3;

/** Ten degrees a bin. */
const HUE_BINS = 36;
/**
 * Below this chroma a colour reads as grey and its hue says nothing; by the
 * second value the hue is unmistakable.
 */
const GREY_CHROMA = 0.02;
const CLEAR_CHROMA = 0.05;
/**
 * An 8-bit near-black has a hue made of rounding: #020103 and #010203 are one
 * black to the eye and opposite hues to the arithmetic.
 */
const NOISE_LIGHTNESS = 0.03;
const SURE_LIGHTNESS = 0.08;
/**
 * The glow, the sparks and the lit windows in front of a sky are its brightest
 * pixels, and they are the ones that are not the sky.
 */
const HIGHLIGHT_LIGHTNESS = 0.8;
/** A colour covering less than this much of the frame is a detail, not a sky. */
const MIN_SKY_SHARE = 0.1;
/**
 * How far round the wheel the accent has to sit from the sky to be a second
 * colour rather than the sky's own horizon. A sky's busiest window spans
 * thirty degrees, so its neighbours reach fifteen past its centre either
 * side; the accent's window has to clear that with room to spare.
 */
const MIN_ACCENT_SEPARATION = 50;
/**
 * The least of the frame the accent has to cover. The lit windows of a
 * skyline or the signs over a road are a few percent of the picture and are
 * exactly the second colour somebody would name; a single ember is not.
 */
const MIN_ACCENT_SHARE = 0.015;
/**
 * The accent is counted only from colour somebody would name, which is a
 * stricter test than the sky's. A sky's shadows drift in hue as they darken —
 * a copper dune goes maroon, the space round a red star goes violet — and at
 * the sky's own threshold those dim, greyish drifts covered more of the frame
 * than the real second colour, so dunes got pink buttons and a red supernova
 * lilac ones. Measured over the 36 FluidEQ scenes, the drifts sit around
 * chroma 0.04 and every colour worth naming well above it.
 */
const ACCENT_GREY_CHROMA = 0.04;
const ACCENT_CLEAR_CHROMA = 0.1;
/**
 * The colour for "on" may be a quieter one than the buttons' — a flower's
 * blue-grey heart is a colour anybody names, at a chroma the accent's test
 * would weigh out — and may cover less of the frame: a heart, a moon.
 */
const ACTIVE_GREY_CHROMA = 0.03;
const ACTIVE_CLEAR_CHROMA = 0.08;
const MIN_ACTIVE_SHARE = 0.006;
/**
 * The OKLCH hues of `$red` (#ff647c) and `$amber` (#ffb059), which say off and
 * wait everywhere in the app. "On" keeps clear of both by this much, or an
 * attached profile's pill in a fire scene reads as an error beside the red
 * "off" one.
 */
const WARNING_HUES = [14, 66] as const;
const MIN_WARNING_SEPARATION = 35;

/** Area-weighted OKLCH sums per ten degrees of hue. */
interface IHueHistogram {
  weight: Float64Array;
  cosine: Float64Array;
  sine: Float64Array;
  chroma: Float64Array;
  lightness: Float64Array;
}

const createHistogram = (): IHueHistogram => ({
  weight: new Float64Array(HUE_BINS),
  cosine: new Float64Array(HUE_BINS),
  sine: new Float64Array(HUE_BINS),
  chroma: new Float64Array(HUE_BINS),
  lightness: new Float64Array(HUE_BINS),
});

const addToHistogram = (
  histogram: IHueHistogram,
  weight: number,
  lab: ILab,
  chroma: number,
) => {
  const angle = Math.atan2(lab.b, lab.a);
  const degrees = ((angle * 180) / Math.PI + 360) % 360;
  const bin = Math.floor((degrees / 360) * HUE_BINS) % HUE_BINS;
  histogram.weight[bin] += weight;
  histogram.cosine[bin] += weight * Math.cos(angle);
  histogram.sine[bin] += weight * Math.sin(angle);
  histogram.chroma[bin] += weight * chroma;
  histogram.lightness[bin] += weight * lab.l;
};

const around = (bin: number) => [
  (bin + HUE_BINS - 1) % HUE_BINS,
  bin,
  (bin + 1) % HUE_BINS,
];

const windowSum = (values: Float64Array, bin: number) =>
  around(bin).reduce((sum, index) => sum + values[index], 0);

/**
 * The colour of the busiest thirty-degree window whose centre `allowed`
 * accepts, or undefined when that window covers less than `minShare` of
 * `area`.
 */
const busiestColour = (
  histogram: IHueHistogram,
  area: number,
  minShare: number,
  allowed: (centre: number) => boolean,
): ISceneColour | undefined => {
  let peak: number | undefined;
  for (let bin = 0; bin < HUE_BINS; bin += 1) {
    if (
      allowed(((bin + 0.5) * 360) / HUE_BINS) &&
      (peak === undefined ||
        windowSum(histogram.weight, bin) > windowSum(histogram.weight, peak))
    ) {
      peak = bin;
    }
  }
  if (peak === undefined) {
    return undefined;
  }
  const total = windowSum(histogram.weight, peak);
  const share = total / area;
  if (total === 0 || share < minShare) {
    return undefined;
  }
  const hue =
    ((Math.atan2(
      windowSum(histogram.sine, peak),
      windowSum(histogram.cosine, peak),
    ) *
      180) /
      Math.PI +
      360) %
    360;
  return {
    lightness: windowSum(histogram.lightness, peak) / total,
    chroma: windowSum(histogram.chroma, peak) / total,
    hue,
    share: Math.min(1, share),
  };
};

/**
 * The sky in a run of RGBA frames read back from a scene: its colour, how
 * much of the picture that colour covers, and the scene's second colour.
 * Undefined when no colour covers enough of it — a black starfield, a grey
 * rain — which is a scene with nothing to lend the window.
 *
 * `pixels` are premultiplied, which is how a scene's canvas stores them: a
 * half-transparent pixel counts for half the area it covers, and its colour is
 * divided back out before it is judged.
 *
 * The winner is the busiest thirty degrees of hue rather than the busiest ten:
 * a sky drifts through twenty or thirty degrees between its horizon and its
 * top, and split across three bins it would lose to a smaller patch that
 * happens to sit inside one.
 *
 * The accent is counted apart from the sky, with the highlights left in: the
 * brightest pixels are the ones a sky must ignore — the glow, the sparks, the
 * lit windows — and they are precisely where a scene keeps its second colour.
 * Near-white stays out all the same, by its chroma, and so do the dim drifts
 * of the sky's own shadows.
 */
export const findSceneSky = (
  pixels: ArrayLike<number>,
): ISceneSky | undefined => {
  const skies = createHistogram();
  const accents = createHistogram();
  const details = createHistogram();
  let area = 0;
  for (let index = 0; index + 3 < pixels.length; index += 4) {
    const alpha = pixels[index + 3] / 255;
    if (alpha > 0) {
      area += alpha;
      const lab = rgbToLab([
        Math.min(1, pixels[index] / 255 / alpha),
        Math.min(1, pixels[index + 1] / 255 / alpha),
        Math.min(1, pixels[index + 2] / 255 / alpha),
      ]);
      const pixelChroma = Math.hypot(lab.a, lab.b);
      const visible =
        alpha * smoothstep(NOISE_LIGHTNESS, SURE_LIGHTNESS, lab.l);
      const skyWeight =
        visible *
        smoothstep(GREY_CHROMA, CLEAR_CHROMA, pixelChroma) *
        (1 - smoothstep(HIGHLIGHT_LIGHTNESS, 1, lab.l));
      if (skyWeight > 0) {
        addToHistogram(skies, skyWeight, lab, pixelChroma);
      }
      const accentWeight =
        visible *
        smoothstep(ACCENT_GREY_CHROMA, ACCENT_CLEAR_CHROMA, pixelChroma);
      if (accentWeight > 0) {
        addToHistogram(accents, accentWeight, lab, pixelChroma);
      }
      const detailWeight =
        visible *
        smoothstep(ACTIVE_GREY_CHROMA, ACTIVE_CLEAR_CHROMA, pixelChroma);
      if (detailWeight > 0) {
        addToHistogram(details, detailWeight, lab, pixelChroma);
      }
    }
  }
  if (area === 0) {
    return undefined;
  }
  const sky = busiestColour(skies, area, MIN_SKY_SHARE, () => true);
  if (!sky) {
    return undefined;
  }
  const accent = busiestColour(
    accents,
    area,
    MIN_ACCENT_SHARE,
    (centre) => hueDistance(centre, sky.hue) >= MIN_ACCENT_SEPARATION,
  );
  const buttonHue = accent?.hue ?? sky.hue;
  const active = busiestColour(
    details,
    area,
    MIN_ACTIVE_SHARE,
    (centre) =>
      hueDistance(centre, buttonHue) >= MIN_ACCENT_SEPARATION &&
      WARNING_HUES.every(
        (warning) => hueDistance(centre, warning) >= MIN_WARNING_SEPARATION,
      ),
  );
  return { ...sky, accent: accent ?? null, active: active ?? null };
};
