/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { TAmbientShape } from 'common/sceneAmbient';

/**
 * Each ambient element's picture, drawn once and kept: a shape in one colour
 * at one size, with its soft glow, on a small canvas of its own that every
 * frame only copies. A glow drawn per element per frame is a blur per element
 * per frame; a copy of one is the cheapest thing a canvas does.
 *
 * Every outline lives in a box from -1 to 1 on each axis and is drawn into a
 * canvas sized from the element's own size, so no shape — a scene's own
 * outline included — can paint outside the few dozen pixels it was given.
 */

/** Built-in outlines, by shape. `blossom`, `snow` and the lights are composed below. */
const OUTLINES: Partial<Record<TAmbientShape, string>> = {
  // A gull with its wings out: the flap is this outline scaled on its height.
  bird: 'M-1 -0.3 C-0.7 -0.52 -0.36 -0.42 -0.08 0.02 C-0.04 0.1 0.04 0.1 0.08 0.02 C0.36 -0.42 0.7 -0.52 1 -0.3 C0.72 -0.16 0.4 0.02 0.12 0.3 C0.05 0.38 -0.05 0.38 -0.12 0.3 C-0.4 0.02 -0.72 -0.16 -1 -0.3 Z',
  petal: 'M0 -1 C0.58 -0.62 0.62 0.34 0 1 C-0.62 0.34 -0.58 -0.62 0 -1 Z',
  leaf: 'M0 -1 C0.62 -0.52 0.56 0.52 0 1 C-0.56 0.52 -0.62 -0.52 0 -1 Z',
  // A four-pointed glint, pinched at the middle as light through lashes is.
  star: 'M0 -1 C0.07 -0.22 0.22 -0.07 1 0 C0.22 0.07 0.07 0.22 0 1 C-0.07 0.22 -0.22 0.07 -1 0 C-0.22 -0.07 -0.07 -0.22 0 -1 Z',
};

export interface ISpriteRequest {
  shape: TAmbientShape;
  /** Only for `path`: an outline already checked by `readAmbientPath`. */
  path?: string;
  colour: string;
  /** CSS pixels across, before the device ratio. */
  size: number;
  ratio: number;
}

/** A sprite and the CSS size it stands for, centred on its middle. */
export interface ISprite {
  image: OffscreenCanvas;
  /** How wide the image is in CSS pixels, glow included. */
  extent: number;
}

/** Sizes are drawn in steps of this many CSS pixels, so near sizes share. */
const SIZE_STEP = 4;
const MAX_SPRITES = 96;
const sprites = new Map<string, ISprite | null>();
const outlines = new Map<string, Path2D | null>();

const outline = (text: string): Path2D | null => {
  const known = outlines.get(text);
  if (known !== undefined) {
    return known;
  }
  let made: Path2D | null = null;
  try {
    made = new Path2D(text);
  } catch {
    made = null;
  }
  outlines.set(text, made);
  return made;
};

const withAlpha = (hex: string, alpha: number) => {
  const channel = (at: number) => parseInt(hex.slice(at, at + 2), 16);
  return `rgba(${channel(1)}, ${channel(3)}, ${channel(5)}, ${alpha})`;
};

/** A soft round light: the whole of `bokeh`, `spark` and `firefly`. */
const light = (
  context: OffscreenCanvasRenderingContext2D,
  colour: string,
  core: number,
  halo: number,
) => {
  const gradient = context.createRadialGradient(0, 0, 0, 0, 0, 1);
  gradient.addColorStop(0, withAlpha(colour, 1));
  gradient.addColorStop(core, withAlpha(colour, halo));
  gradient.addColorStop(1, withAlpha(colour, 0));
  context.fillStyle = gradient;
  context.beginPath();
  context.arc(0, 0, 1, 0, Math.PI * 2);
  context.fill();
};

const drawShape = (
  context: OffscreenCanvasRenderingContext2D,
  request: ISpriteRequest,
  radius: number,
) => {
  const { shape, colour } = request;
  context.fillStyle = colour;
  context.strokeStyle = colour;
  if (shape === 'bokeh') {
    light(context, colour, 0.72, 0.5);
    return;
  }
  if (shape === 'spark') {
    light(context, colour, 0.18, 0.35);
    return;
  }
  if (shape === 'firefly') {
    light(context, colour, 0.08, 0.28);
    return;
  }
  if (shape === 'bubble') {
    context.lineWidth = Math.max(1.2 / radius, 0.09);
    context.beginPath();
    context.arc(0, 0, 0.86, 0, Math.PI * 2);
    context.stroke();
    context.globalAlpha = 0.7;
    context.beginPath();
    context.arc(0, 0, 0.6, Math.PI * 1.1, Math.PI * 1.45);
    context.stroke();
    return;
  }
  if (shape === 'snow') {
    context.lineWidth = Math.max(1.4 / radius, 0.1);
    context.lineCap = 'round';
    for (let arm = 0; arm < 6; arm += 1) {
      context.save();
      context.rotate((arm * Math.PI) / 3);
      context.beginPath();
      context.moveTo(0, 0);
      context.lineTo(0, -0.95);
      context.moveTo(0, -0.55);
      context.lineTo(0.24, -0.76);
      context.moveTo(0, -0.55);
      context.lineTo(-0.24, -0.76);
      context.stroke();
      context.restore();
    }
    return;
  }
  if (shape === 'gem') {
    // A cut stone from above: an eight-sided girdle, a table in the middle
    // and the kite facets between them, each a shade apart so the thing reads
    // as cut and not as a coin. The light is taken as coming from the upper
    // left, the same corner the window's own light comes from.
    // From the side, leaning: the table across the top, the crown down to the
    // girdle, and the pavilion to its point - the outline anybody draws when
    // they draw a diamond. From above it was an octagon, which reads as a nut
    // or a stop sign at this size.
    context.save();
    context.rotate(-0.17);
    const outline = () => {
      context.beginPath();
      context.moveTo(-0.5, -0.5);
      context.lineTo(0.5, -0.5);
      context.lineTo(0.95, -0.06);
      context.lineTo(0.0, 0.9);
      context.lineTo(-0.95, -0.06);
      context.closePath();
    };
    // Drawn rather than filled: the outline, the girdle and the facet edges
    // over the faintest wash inside. Filled solid, these sat on the window's
    // own panels as blobs; as lines they read as glass.
    context.globalAlpha = 0.14;
    outline();
    context.fill();
    context.lineWidth = Math.max(1.1 / radius, 0.045);
    context.lineJoin = 'round';
    context.globalAlpha = 0.9;
    outline();
    context.stroke();
    context.globalAlpha = 0.55;
    context.beginPath();
    // The girdle, the two crown facets and the three the pavilion shows.
    context.moveTo(-0.95, -0.06);
    context.lineTo(0.95, -0.06);
    context.moveTo(-0.5, -0.5);
    context.lineTo(-0.42, -0.06);
    context.moveTo(0.5, -0.5);
    context.lineTo(0.42, -0.06);
    context.moveTo(-0.42, -0.06);
    context.lineTo(0.0, 0.9);
    context.moveTo(0.42, -0.06);
    context.lineTo(0.0, 0.9);
    context.moveTo(0.0, -0.06);
    context.lineTo(0.0, 0.9);
    context.stroke();
    context.restore();
    // The glint off the table, and the cross of light a cut stone throws.
    // At the sizes these drift at - ten pixels and up - the cross is what
    // says diamond; the facets only tell at the larger end.
    context.globalAlpha = 0.75;
    context.fillStyle = '#ffffff';
    context.save();
    context.translate(-0.16, -0.18);
    context.scale(0.3, 0.3);
    light(context, '#ffffff', 0.3, 0.5);
    context.restore();
    context.globalAlpha = 0.5;
    context.fillRect(-1.45, -0.03, 2.9, 0.06);
    context.fillRect(-0.03, -1.45, 0.06, 2.9);
    return;
  }
  if (shape === 'blossom') {
    const petal = outline(OUTLINES.petal ?? '');
    for (let leaf = 0; leaf < 5; leaf += 1) {
      context.save();
      context.rotate((leaf * Math.PI * 2) / 5);
      context.translate(0, -0.5);
      context.scale(0.46, 0.52);
      if (petal) {
        context.fill(petal);
      }
      context.restore();
    }
    context.globalAlpha = 0.85;
    context.fillStyle = '#fff4c2';
    context.beginPath();
    context.arc(0, 0, 0.2, 0, Math.PI * 2);
    context.fill();
    return;
  }
  const text = shape === 'path' ? request.path : OUTLINES[shape];
  const drawn = text ? outline(text) : null;
  if (!drawn) {
    return;
  }
  context.fill(drawn);
  if (shape === 'star') {
    // A soft core, so a glint this small still reads as a light.
    context.save();
    context.shadowBlur = 0;
    context.scale(0.42, 0.42);
    light(context, colour, 0.25, 0.45);
    context.restore();
  }
  if (shape === 'leaf') {
    // The midrib, a shade darker, so a leaf is not a petal.
    context.globalAlpha = 0.35;
    context.lineWidth = Math.max(1 / radius, 0.05);
    context.strokeStyle = '#000000';
    context.beginPath();
    context.moveTo(0, -0.8);
    context.lineTo(0, 0.85);
    context.stroke();
  }
};

/**
 * The sprite for `request`, made the first time it is asked for. Undefined
 * where there is no canvas to make one on, or the outline would not parse.
 */
export const ambientSprite = (request: ISpriteRequest): ISprite | undefined => {
  if (typeof OffscreenCanvas === 'undefined') {
    return undefined;
  }
  const size = Math.max(
    SIZE_STEP,
    Math.round(request.size / SIZE_STEP) * SIZE_STEP,
  );
  const ratio = Math.min(2, Math.max(1, request.ratio));
  const key = `${request.shape}|${request.path ?? ''}|${request.colour}|${size}|${ratio}`;
  const known = sprites.get(key);
  if (known !== undefined) {
    return known ?? undefined;
  }
  if (sprites.size >= MAX_SPRITES) {
    sprites.clear();
  }
  // The glow needs room around the shape; the lights are their own glow.
  const isLight =
    request.shape === 'bokeh' ||
    request.shape === 'spark' ||
    request.shape === 'firefly';
  const extent = size * (isLight ? 1 : 1.6);
  const pixels = Math.ceil(extent * ratio);
  const image = new OffscreenCanvas(pixels, pixels);
  const context = image.getContext('2d');
  if (!context) {
    sprites.set(key, null);
    return undefined;
  }
  const radius = (size / 2) * ratio;
  context.translate(pixels / 2, pixels / 2);
  if (!isLight) {
    context.shadowColor = withAlpha(request.colour, 0.85);
    context.shadowBlur = radius * 0.6;
  }
  context.scale(radius, radius);
  drawShape(context, request, radius);
  const sprite = { image, extent };
  sprites.set(key, sprite);
  return sprite;
};
