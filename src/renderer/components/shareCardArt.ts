/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { drawBrand, tailStartFor } from './shareCardBrand';
import {
  alphaOf,
  hexOf,
  type IShareCardInks,
  readShareCardInks,
} from './shareCardInks';
import { drawCheeringPet } from './shareCardPet';
import drawSoundField from './shareCardWaves';

/**
 * THE SHARE CARD, DRAWN: "Signature" (Ivan picked it on 2026-11-27 from three,
 * "B with a music wave bg", after "make the share card amazing with the new
 * FluidEQ typography and the pet").
 *
 * The header's brand across the top — the logo as the app icon and "FluidEQ"
 * in the broad pen — with the Q's tail running on across the whole card as
 * the sound. Under it the score, as large as the card allows, on the left;
 * the pet mid-jump on the right; where to get the app along the foot. Behind
 * everything a music wave drawn in light (`shareCardWaves.ts`). Every colour is the window's: the
 * header's run from the accent's greener end to the second colour, the
 * accent's light, the pet's fur, and Colourful mode's palette in the light
 * round her while that mode is on.
 *
 * Canvas rather than rendering the DOM to an image: turning a live element
 * into a PNG means a third-party rasteriser or an SVG foreignObject round
 * trip, and both inherit whatever the stylesheet happens to be doing that
 * day. A card that is drawn on purpose looks the same in every build.
 *
 * The card is always dark, whatever the window's Brightness: it is a picture
 * for somebody else's feed, so its inks are fixed light ones rather than the
 * theme's, which on a light window are dark and vanished on this ground. No
 * shadow anywhere (Ivan, 2026-11-19): depth is light and layering.
 */

/**
 * 1200×630 is the preview box every one of the three networks crops to. Any
 * other ratio gets cut somewhere, and it is never cut the same way twice.
 */
export const CARD_WIDTH = 1200;
export const CARD_HEIGHT = 630;

/** Drawn at 2x and scaled down, so the text is not soft on a HiDPI screen. */
const CARD_SCALE = 2;

const FONT_STACK =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Ubuntu, Cantarell, "Noto Sans", "DejaVu Sans", sans-serif';

const INK = '#eef7fc';
const INK_MUTED = 'rgba(214, 233, 247, 0.66)';

/** The card's margin, left and right. */
const EDGE = 64;

/** The words the card carries, in the reader's language. */
export interface IShareCardWords {
  /** Over the number: what it is a score of. */
  scoreLabel: string;
  /** After "×3" in the pill. */
  streak: string;
  /** Along the foot, before the site: what FluidEQ is and where it runs. */
  tagline: string;
}

/**
 * `text` at `weight`, as large as `preferred` px or as small as `minimum` px,
 * whichever keeps it inside `maximumWidth`. The card is drawn from real
 * scores and in twelve languages, so nothing on it is tuned against one
 * string alone.
 */
const setFittedFont = (
  context: CanvasRenderingContext2D,
  text: string,
  weight: number,
  preferred: number,
  minimum: number,
  maximumWidth: number,
): number => {
  context.font = `${weight} ${preferred}px ${FONT_STACK}`;
  const measured = context.measureText(text).width;
  const size = Math.max(
    minimum,
    Math.min(preferred, (preferred * maximumWidth) / Math.max(1, measured)),
  );
  context.font = `${weight} ${size}px ${FONT_STACK}`;
  return size;
};

/** A run of colours as a left-to-right gradient across `from`..`to`. */
const gradientAcross = (
  context: CanvasRenderingContext2D,
  from: number,
  to: number,
  colours: readonly string[],
) => {
  const gradient = context.createLinearGradient(from, 0, to, 0);
  colours.forEach((colour, index) => {
    gradient.addColorStop(index / (colours.length - 1), colour);
  });
  return gradient;
};

/** Night, the window's light where she jumps, and the music wave. */
const drawBackground = (
  context: CanvasRenderingContext2D,
  inks: IShareCardInks,
  seed: number,
) => {
  const ground = context.createLinearGradient(0, 0, CARD_WIDTH, CARD_HEIGHT);
  ground.addColorStop(0, '#040a12');
  ground.addColorStop(0.6, '#061321');
  ground.addColorStop(1, '#0a1c2c');
  context.fillStyle = ground;
  context.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
  // The window's light, gathered where she jumps and fading to the corner.
  context.save();
  context.globalCompositeOperation = 'lighter';
  [
    { x: 900, y: 360, radius: 420, colour: inks.accent, alpha: 0.14 },
    { x: 1150, y: 600, radius: 360, colour: inks.active, alpha: 0.08 },
    { x: 120, y: 80, radius: 360, colour: inks.start, alpha: 0.06 },
  ].forEach(({ x, y, radius, colour, alpha }) => {
    const light = context.createRadialGradient(x, y, 0, x, y, radius);
    light.addColorStop(0, alphaOf(colour, alpha));
    light.addColorStop(1, alphaOf(colour, 0));
    context.fillStyle = light;
    context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  });
  context.restore();
  drawSoundField(context, inks, seed);
};

/** The score's left edge, and how wide it may grow before it shrinks. */
const SCORE = { x: 70, baseline: 450, maxWidth: 600 };

/** How far a figure's top stands over its baseline, as a share of the size. */
const FIGURE_HEIGHT = 0.72;

/**
 * What it is, the number lit from above — white at its top into the
 * accent's light at its foot — and the streak in its pill under it.
 */
const drawScore = (
  context: CanvasRenderingContext2D,
  inks: IShareCardInks,
  words: IShareCardWords,
  score: number,
  multiplier: number,
) => {
  context.save();
  context.textAlign = 'left';
  context.textBaseline = 'alphabetic';
  // Display weight, which this size carries (`$weight-display`, above
  // ~20px only), set a little tight: at 240px the figures' own spacing reads
  // as gaps.
  const scoreText = String(Math.max(0, Math.floor(score)));
  context.letterSpacing = '-4px';
  const size = setFittedFont(context, scoreText, 900, 240, 96, SCORE.maxWidth);
  const light = context.createLinearGradient(
    0,
    SCORE.baseline - size * FIGURE_HEIGHT,
    0,
    SCORE.baseline,
  );
  light.addColorStop(0, '#ffffff');
  light.addColorStop(0.55, '#ffffff');
  light.addColorStop(1, hexOf(inks.light));
  context.fillStyle = light;
  context.fillText(scoreText, SCORE.x - 10, SCORE.baseline);
  context.letterSpacing = '0px';

  // What it is, a fixed step over the figures' tops, so a long score that
  // had to shrink keeps its name beside it.
  context.fillStyle = INK_MUTED;
  setFittedFont(context, words.scoreLabel, 600, 26, 18, SCORE.maxWidth);
  context.fillText(
    words.scoreLabel,
    SCORE.x,
    SCORE.baseline - size * FIGURE_HEIGHT - 28,
  );

  // "×3 streak" in a pill of the header's run.
  const times = `×${Math.max(1, Math.floor(multiplier))}`;
  const pill = { x: SCORE.x, y: 478, height: 48, padding: 18, gap: 9 };
  context.font = `700 30px ${FONT_STACK}`;
  const timesWidth = context.measureText(times).width;
  setFittedFont(context, words.streak, 600, 22, 14, 260);
  const streakWidth = context.measureText(words.streak).width;
  const width = pill.padding * 2 + timesWidth + pill.gap + streakWidth;
  context.beginPath();
  context.roundRect(pill.x, pill.y, width, pill.height, pill.height / 2);
  context.fillStyle = gradientAcross(context, pill.x, pill.x + width, [
    alphaOf(inks.start, 0.22),
    alphaOf(inks.accent, 0.16),
    alphaOf(inks.active, 0.2),
  ]);
  context.fill();
  context.strokeStyle = gradientAcross(context, pill.x, pill.x + width, [
    alphaOf(inks.start, 0.6),
    alphaOf(inks.active, 0.5),
  ]);
  context.lineWidth = 1.5;
  context.stroke();
  const middle = pill.y + pill.height / 2;
  context.font = `700 30px ${FONT_STACK}`;
  context.fillStyle = hexOf(inks.light);
  context.fillText(times, pill.x + pill.padding, middle + 11);
  setFittedFont(context, words.streak, 600, 22, 14, 260);
  context.fillStyle = INK;
  context.fillText(
    words.streak,
    pill.x + pill.padding + timesWidth + pill.gap,
    middle + 8,
  );
  context.restore();
};

/**
 * What FluidEQ is and where to get it. Somebody who has never heard of it
 * sees the picture and can act on it; drawn on the image rather than left to
 * the link preview, because the image is what gets reposted and
 * screenshotted. The site is the larger of the two: at the 300px a chat
 * shows the card at, it is the one thing on the foot still read.
 */
const drawFoot = (
  context: CanvasRenderingContext2D,
  inks: IShareCardInks,
  words: IShareCardWords,
  siteUrl: string,
) => {
  const baseline = 596;
  context.save();
  const displayUrl = siteUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
  context.font = `700 34px ${FONT_STACK}`;
  context.textAlign = 'right';
  context.fillStyle = hexOf(inks.light);
  context.fillText(displayUrl, CARD_WIDTH - EDGE, baseline);
  const urlWidth = context.measureText(displayUrl).width;
  context.textAlign = 'left';
  context.fillStyle = INK_MUTED;
  setFittedFont(
    context,
    words.tagline,
    600,
    24,
    16,
    CARD_WIDTH - EDGE - SCORE.x - urlWidth - 48,
  );
  context.fillText(words.tagline, SCORE.x, baseline - 1);
  context.restore();
};

/** The brand's place: its logo's top left, the word's height. */
const BRAND = { x: EDGE, y: 50, wordHeight: 74 };

/** Paint the card. */
export const drawShareCard = (
  canvas: HTMLCanvasElement,
  score: number,
  multiplier: number,
  siteUrl: string,
  euphoric: boolean,
  words: IShareCardWords,
) => {
  const context = canvas.getContext('2d');
  if (!context) {
    return;
  }
  canvas.width = CARD_WIDTH * CARD_SCALE;
  canvas.height = CARD_HEIGHT * CARD_SCALE;
  context.scale(CARD_SCALE, CARD_SCALE);
  // Read on the card's first pixel, which the background then paints over.
  const inks = readShareCardInks(context, euphoric);

  // The music on the card — the wave behind and the Q's tail — is picked by
  // the score, so two runs never post the same picture.
  const seed = (Math.max(0, Math.floor(score)) % 97) + 1;
  drawBackground(context, inks, seed);
  drawBrand(context, inks, {
    ...BRAND,
    tailLength: CARD_WIDTH - 40 - tailStartFor(BRAND.x, BRAND.wordHeight),
    sway: 22,
    seed,
  });
  drawScore(context, inks, words, score, multiplier);
  drawCheeringPet(context, inks, 900, 548, 420, CARD_SCALE);
  drawFoot(context, inks, words, siteUrl);
};
