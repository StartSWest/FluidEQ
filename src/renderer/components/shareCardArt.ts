/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { PRODUCT_NAME } from 'common/branding';
import backdropUrl from '../../../assets/brand/share-card-backdrop.jpg';
import { EYE_WAVE_AMPLITUDE, EYE_WAVE_PERIOD } from '../SupportPet';
import { parseCssColour } from '../utils/oklab';
import { getRainbowStops } from '../utils/rainbowPalette';
import { readAccent, readAccentLight } from '../utils/theme';

/**
 * THE SHARE CARD, DRAWN (Ivan, 2026-10-25: "no rainbow colors make more
 * modern like the app is now", "change it to score or something").
 *
 * Dark glass over a picture of sound: the wordmark, the creature on a light
 * of the accent, the score on a pane of glass under a SCORE pill, and where
 * to get the app along the foot. Every colour is the window's — its accent,
 * and with Colourful mode on the palette that mode is in — and the artwork
 * behind is turned round the colour wheel to the accent, so a gold window
 * shares a gold card.
 *
 * Canvas rather than rendering the DOM to an image: turning a live element
 * into a PNG means a third-party rasteriser or an SVG foreignObject round
 * trip, and both inherit whatever the stylesheet happens to be doing that
 * day. A card that is drawn on purpose looks the same in every build.
 *
 * The card is always dark, whatever the window's Brightness: it is a picture
 * for somebody else's feed, so its inks are fixed light ones rather than the
 * theme's, which on a light window are dark and vanished on this ground.
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

const INK = '#e6f2f9';
const INK_MUTED = '#9fb8c8';
const PET_INK = '#06131d';

/**
 * The accent the artwork was painted for (`share-card-backdrop.jpg`, made
 * with GPT image generation for this card): the theme's own cyan. The
 * artwork is turned by however far the window's accent stands from it.
 */
const ARTWORK_ACCENT = '#32e1eb';

/** Under this saturation the window is monochrome and so is the artwork. */
const GREY_SATURATION = 0.15;

interface IHueSaturation {
  hue: number;
  saturation: number;
}

/** HSL's hue and saturation — the space CSS's `hue-rotate` turns in. */
const hueSaturationOf = (colour: string): IHueSaturation | undefined => {
  const parsed = parseCssColour(colour);
  if (!parsed) {
    return undefined;
  }
  const [red, green, blue] = parsed.rgb;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const chroma = max - min;
  const lightness = (max + min) / 2;
  if (chroma === 0) {
    return { hue: 0, saturation: 0 };
  }
  let hue: number;
  if (max === red) {
    hue = ((green - blue) / chroma) % 6;
  } else if (max === green) {
    hue = (blue - red) / chroma + 2;
  } else {
    hue = (red - green) / chroma + 4;
  }
  return {
    hue: (hue * 60 + 360) % 360,
    saturation: chroma / (1 - Math.abs(2 * lightness - 1)),
  };
};

/** The filter that puts the artwork in the window's colour. */
export const artworkFilter = (accent: string): string => {
  const own = hueSaturationOf(accent);
  const painted = hueSaturationOf(ARTWORK_ACCENT);
  if (!own || !painted) {
    return 'none';
  }
  if (own.saturation < GREY_SATURATION) {
    return 'grayscale(1)';
  }
  const turn = Math.round(own.hue - painted.hue);
  return turn === 0 ? 'none' : `hue-rotate(${turn}deg)`;
};

let backdrop: Promise<HTMLImageElement> | undefined;

/**
 * The artwork, decoded once for every card after it. Rejects where it
 * cannot be decoded — a test DOM loads no images — and the card is then
 * drawn on its own gradient, which is also what it shows until this lands.
 */
export const loadCardBackdrop = (): Promise<HTMLImageElement> => {
  if (!backdrop) {
    const image = new Image();
    if (typeof image.decode !== 'function') {
      return Promise.reject(new Error('Images cannot be decoded here'));
    }
    image.src = backdropUrl;
    const decoding = image.decode().then(() => image);
    // A failed decode is forgotten, so the next card tries again.
    decoding.catch(() => {
      backdrop = undefined;
    });
    backdrop = decoding;
  }
  return backdrop;
};

/**
 * Keep long scores inside their pane without making ordinary runs look
 * timid. The card is drawn from real scores, so a layout tuned only against
 * "100" eventually turns a strong run into clipped digits.
 */
const setFittedFont = (
  context: CanvasRenderingContext2D,
  text: string,
  weight: number,
  preferredSize: number,
  minimumSize: number,
  maximumWidth: number,
) => {
  context.font = `${weight} ${preferredSize}px ${FONT_STACK}`;
  const measuredWidth = context.measureText(text).width;
  const size = Math.max(
    minimumSize,
    Math.min(preferredSize, (preferredSize * maximumWidth) / measuredWidth),
  );
  context.font = `${weight} ${size}px ${FONT_STACK}`;
};

/**
 * The creature, drawn from the same coordinates her SVG uses: a 40×40
 * viewBox of plain circles and arcs, transcribed rather than redesigned, so
 * she cannot look like a different animal on the card than in the app.
 * Rasterising the live element was the alternative and it is a trap: her
 * look leans on the stylesheet for the glow, the hop and the eye waves.
 */
const drawPet = (
  context: CanvasRenderingContext2D,
  centreX: number,
  centreY: number,
  size: number,
  euphoric: boolean,
  eyeInk: string,
) => {
  const scale = size / 40;
  context.save();
  context.translate(centreX - size / 2, centreY - size / 2);
  context.scale(scale, scale);

  const body = context.createLinearGradient(0, 11, 0, 37);
  body.addColorStop(0, '#7ef7e6');
  body.addColorStop(1, '#17a5c4');

  // The ears are a little EQ curve — she is made of the thing the app does.
  context.strokeStyle = body;
  context.lineWidth = 3;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.beginPath();
  context.moveTo(11, 12);
  context.lineTo(14, 6);
  context.lineTo(17, 12);
  context.moveTo(23, 12);
  context.lineTo(26, 8);
  context.lineTo(29, 12);
  context.stroke();

  context.fillStyle = body;
  context.beginPath();
  context.arc(20, 24, 12.5, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = PET_INK;
  [15.4, 24.6].forEach((x) => {
    context.beginPath();
    context.arc(x, 22, 3.4, 0, Math.PI * 2);
    context.fill();
  });

  // Sound reflected in the eye with Colourful mode on, as the live creature
  // runs it at the ceiling: clipped to the pupil, from the SVG's own period
  // and amplitude, frozen mid-scroll.
  if (euphoric) {
    [15.4, 24.6].forEach((eyeX) => {
      context.save();
      context.beginPath();
      context.arc(eyeX, 22, 3.4, 0, Math.PI * 2);
      context.clip();
      const quarter = EYE_WAVE_PERIOD / 4;
      const start = eyeX - EYE_WAVE_PERIOD * 1.5;
      context.beginPath();
      context.moveTo(start, 22);
      for (let cycle = 0; cycle < 3; cycle += 1) {
        const x = start + cycle * EYE_WAVE_PERIOD;
        context.quadraticCurveTo(
          x + quarter,
          22 - EYE_WAVE_AMPLITUDE,
          x + quarter * 2,
          22,
        );
        context.quadraticCurveTo(
          x + quarter * 3,
          22 + EYE_WAVE_AMPLITUDE,
          x + quarter * 4,
          22,
        );
      }
      context.strokeStyle = eyeInk;
      context.lineWidth = 0.9;
      context.lineCap = 'round';
      context.globalAlpha = 0.95;
      context.stroke();
      context.restore();
    });
  }

  context.fillStyle = '#ffffff';
  [16.4, 25.6].forEach((x) => {
    context.beginPath();
    context.arc(x, 21, 1.15, 0, Math.PI * 2);
    context.fill();
  });

  context.strokeStyle = PET_INK;
  context.lineWidth = 1.8;
  context.beginPath();
  context.moveTo(16.6, 28.4);
  context.quadraticCurveTo(20, euphoric ? 32.6 : 32.2, 23.4, 28.4);
  context.stroke();

  context.restore();
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

interface ICardInks {
  accent: string;
  light: string;
  /** The wordmark's and the pill's run: the accent, or the mode's palette. */
  run: readonly string[];
}

const inksOf = (euphoric: boolean): ICardInks => {
  const accent = readAccent(1, ARTWORK_ACCENT);
  const light = readAccentLight(1, '#a9faff');
  if (euphoric) {
    const stops = getRainbowStops();
    return { accent, light, run: [stops[0], stops[2], stops[4], stops[6]] };
  }
  return { accent, light, run: [light, accent] };
};

const drawBackground = (
  context: CanvasRenderingContext2D,
  artwork: HTMLImageElement | undefined,
  accent: string,
) => {
  const ground = context.createLinearGradient(0, 0, CARD_WIDTH, CARD_HEIGHT);
  ground.addColorStop(0, '#04090f');
  ground.addColorStop(0.55, '#07111b');
  ground.addColorStop(1, '#0b1928');
  context.fillStyle = ground;
  context.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
  if (artwork) {
    context.save();
    context.filter = artworkFilter(accent);
    context.drawImage(artwork, 0, 0, CARD_WIDTH, CARD_HEIGHT);
    context.restore();
  }
  // A shade on the right, so the score stands on calm ground.
  const shade = context.createLinearGradient(560, 0, CARD_WIDTH, 0);
  shade.addColorStop(0, 'rgba(3, 9, 15, 0)');
  shade.addColorStop(1, 'rgba(3, 9, 15, 0.55)');
  context.fillStyle = shade;
  context.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
};

/** The wordmark as the titlebar draws it: the wave and the name in one sweep. */
const drawWordmark = (context: CanvasRenderingContext2D, inks: ICardInks) => {
  context.save();
  context.strokeStyle = gradientAcross(context, 64, 142, inks.run);
  context.lineWidth = 5;
  context.lineCap = 'round';
  context.beginPath();
  context.moveTo(64, 74);
  context.bezierCurveTo(76, 48, 89, 48, 102, 74);
  context.bezierCurveTo(115, 100, 128, 100, 142, 74);
  context.stroke();

  context.font = `700 40px ${FONT_STACK}`;
  context.textAlign = 'left';
  const nameWidth = context.measureText(PRODUCT_NAME).width;
  context.fillStyle = gradientAcross(context, 160, 160 + nameWidth, [
    '#ffffff',
    '#e6fbff',
    ...inks.run,
  ]);
  context.fillText(PRODUCT_NAME, 160, 88);
  context.fillStyle = INK_MUTED;
  context.font = `700 16px ${FONT_STACK}`;
  context.letterSpacing = '4px';
  context.fillText('BEAT GAME', 162, 114);
  context.restore();
};

const PANE = { x: 640, y: 96, width: 470, height: 380 };

/** The score on a pane of glass, under its pill. */
const drawScore = (
  context: CanvasRenderingContext2D,
  inks: ICardInks,
  score: number,
  multiplier: number,
  euphoric: boolean,
) => {
  const { x, y, width, height } = PANE;
  context.save();
  context.fillStyle = 'rgba(10, 24, 36, 0.62)';
  context.beginPath();
  context.roundRect(x, y, width, height, 28);
  context.fill();
  const rim = context.createLinearGradient(x, y, x, y + height);
  rim.addColorStop(0, readAccentLight(0.32, 'rgba(169, 250, 255, 0.32)'));
  rim.addColorStop(1, readAccentLight(0.06, 'rgba(169, 250, 255, 0.06)'));
  context.strokeStyle = rim;
  context.lineWidth = 1.5;
  context.stroke();
  context.restore();

  const centre = x + width / 2;
  context.save();
  context.textAlign = 'center';

  // The pill names what the card is about: the score. With Colourful mode on
  // it is filled with the mode's palette, as the mode's own badge is.
  context.font = `700 18px ${FONT_STACK}`;
  context.letterSpacing = '4px';
  const label = 'SCORE';
  const pillWidth = context.measureText(label).width + 48;
  const pillLeft = centre - pillWidth / 2;
  context.beginPath();
  context.roundRect(pillLeft, y + 40, pillWidth, 40, 20);
  if (euphoric) {
    context.fillStyle = gradientAcross(
      context,
      pillLeft,
      pillLeft + pillWidth,
      inks.run,
    );
    context.fill();
    context.fillStyle = PET_INK;
  } else {
    context.fillStyle = readAccent(0.14, 'rgba(50, 225, 235, 0.14)');
    context.fill();
    context.strokeStyle = readAccentLight(0.45, 'rgba(169, 250, 255, 0.45)');
    context.lineWidth = 1;
    context.stroke();
    context.fillStyle = inks.light;
  }
  // The letter spacing trails the last letter too; half of it back centres
  // the word in its pill.
  context.fillText(label, centre + 2, y + 67);
  context.letterSpacing = '0px';

  const scoreText = String(Math.max(0, Math.floor(score)));
  context.save();
  context.shadowColor = readAccent(0.45, 'rgba(50, 225, 235, 0.45)');
  context.shadowBlur = 28;
  context.fillStyle = '#ffffff';
  setFittedFont(context, scoreText, 900, 150, 84, width - 70);
  context.fillText(scoreText, centre, y + 240);
  context.restore();

  // "×2 STREAK", centred as one line.
  const times = `×${Math.max(1, Math.floor(multiplier))}`;
  context.font = `700 44px ${FONT_STACK}`;
  const timesWidth = context.measureText(times).width;
  context.font = `700 18px ${FONT_STACK}`;
  context.letterSpacing = '3px';
  const streakWidth = context.measureText('STREAK').width;
  const left = centre - (timesWidth + 14 + streakWidth) / 2;
  context.textAlign = 'left';
  context.letterSpacing = '0px';
  context.font = `700 44px ${FONT_STACK}`;
  context.fillStyle = euphoric ? inks.run[1] : inks.accent;
  context.fillText(times, left, y + 316);
  context.font = `700 18px ${FONT_STACK}`;
  context.letterSpacing = '3px';
  context.fillStyle = INK_MUTED;
  context.fillText('STREAK', left + timesWidth + 14, y + 310);
  context.restore();
};

/**
 * Where to get it, on a strip of the same glass. Somebody who has never
 * heard of FluidEQ sees the picture and can act on it; drawn on the image
 * rather than left to the link preview, because the image is what gets
 * reposted and screenshotted.
 */
const drawFooter = (
  context: CanvasRenderingContext2D,
  inks: ICardInks,
  siteUrl: string,
) => {
  context.save();
  context.fillStyle = 'rgba(3, 9, 15, 0.7)';
  context.beginPath();
  context.roundRect(52, 548, CARD_WIDTH - 104, 58, 18);
  context.fill();
  context.strokeStyle = readAccentLight(0.14, 'rgba(169, 250, 255, 0.14)');
  context.lineWidth = 1;
  context.stroke();
  context.textAlign = 'left';
  context.fillStyle = INK;
  context.font = `600 24px ${FONT_STACK}`;
  context.fillText('Free system-wide EQ for Windows', 82, 586);
  const displayUrl = siteUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
  context.textAlign = 'right';
  context.fillStyle = inks.light;
  context.font = `700 28px ${FONT_STACK}`;
  context.fillText(displayUrl, CARD_WIDTH - 82, 587);
  context.restore();
};

/** Paint the card; `artwork` undefined draws it on its own gradient. */
export const drawShareCard = (
  canvas: HTMLCanvasElement,
  score: number,
  multiplier: number,
  siteUrl: string,
  euphoric: boolean,
  artwork: HTMLImageElement | undefined,
) => {
  const context = canvas.getContext('2d');
  if (!context) {
    return;
  }
  canvas.width = CARD_WIDTH * CARD_SCALE;
  canvas.height = CARD_HEIGHT * CARD_SCALE;
  context.scale(CARD_SCALE, CARD_SCALE);
  const inks = inksOf(euphoric);

  drawBackground(context, artwork, inks.accent);
  drawWordmark(context, inks);

  // The creature on a soft light of the accent, half the frame: she is the
  // most recognisable thing the app has.
  const glow = context.createRadialGradient(270, 300, 10, 270, 300, 210);
  glow.addColorStop(0, readAccent(0.22, 'rgba(50, 225, 235, 0.22)'));
  glow.addColorStop(1, readAccent(0, 'rgba(50, 225, 235, 0)'));
  context.fillStyle = glow;
  context.fillRect(40, 80, 460, 440);
  drawPet(context, 270, 300, 230, euphoric, inks.light);

  drawScore(context, inks, score, multiplier, euphoric);
  drawFooter(context, inks, siteUrl);
};
