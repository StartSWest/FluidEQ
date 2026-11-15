/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The pictures the Cover Flow scene puts on its covers, and the colour each
 * one lights the stage with.
 *
 * A cover near the centre is drawn up to 400 CSS pixels and takes the cached
 * 320 picture; the rest of the row is turned 64 degrees away and pushed back,
 * and takes the medium one (`librarySizedArtUrl`, 224) — about half the
 * pixels on the graphics card for the sixteen covers nobody looks at
 * straight. Every picture is asked for with CORS: the media scheme is another
 * origin than the window, and WebGL refuses a tainted picture on every frame
 * (the trap the Surprise me draw fell into first).
 *
 * Decoded straight into an upright `ImageBitmap` (`imageOrientation:
 * 'flipY'`), because WebGL never flips a bitmap on upload. A shelf of
 * folders draws the folder around the picture, as the list and grid do
 * (`LibraryFolderArt`); a cover with no picture is the Library's generated
 * tile; and a record whose songs are all still unread wears the quiet
 * pending badge.
 */
import {
  libraryMediaUrl,
  librarySizedArtUrl,
} from '../../../common/library/mediaUrl';
import { drawTile } from '../surpriseDraw/drawCovers';

/** The picture sizes the row uses. */
export type TCoverFlowArtSize = 'near' | 'far';

/** The edge each size is painted at, where the art is painted here. */
const EDGE: Record<TCoverFlowArtSize, number> = { near: 320, far: 224 };

/** What the scene needs to know about a cover to draw it. */
export interface ICoverFlowArtRequest {
  artId: string | undefined;
  label: string;
  isFolder: boolean;
  isPending: boolean;
}

/** The theme's colours the art is painted with, read off the stage. */
export interface ICoverFlowArtColours {
  folderTop: string;
  folderBottom: string;
}

export interface ICoverFlowArt {
  source: ImageBitmap | HTMLCanvasElement;
  /** The light this cover throws on the stage, in sRGB 0-1. */
  glow: [number, number, number];
}

/** The folder silhouette `LibraryFolderArt.scss` masks with, on a 0-100
 * grid: the tab from y=6 to the body at y=16, the bottom edge at y=94. */
const FOLDER_PATH =
  'M6 6H40c2.4 0 4.7 1.2 6 3.2l2.6 3.9c1.3 2 3.6 3.2 6 3.2H94c3.3 0 6 2.7 6 6V88c0 3.3-2.7 6-6 6H6c-3.3 0-6-2.7-6-6V12c0-3.3 2.7-6 6-6z';

/** A cover's picture, square from its middle, upright, at `edge`. */
const decodeCover = async (
  artId: string,
  size: TCoverFlowArtSize,
): Promise<ImageBitmap> => {
  const image = new Image();
  image.decoding = 'async';
  image.crossOrigin = 'anonymous';
  image.src =
    size === 'near'
      ? libraryMediaUrl('art', artId)
      : librarySizedArtUrl(artId, 'medium');
  await image.decode();
  const side = Math.min(image.naturalWidth, image.naturalHeight);
  const edge = Math.min(EDGE[size], side);
  return createImageBitmap(
    image,
    (image.naturalWidth - side) / 2,
    (image.naturalHeight - side) / 2,
    side,
    side,
    {
      resizeWidth: edge,
      resizeHeight: edge,
      resizeQuality: 'high',
      imageOrientation: 'flipY',
    },
  );
};

const canvasOf = (
  edge: number,
): [HTMLCanvasElement, CanvasRenderingContext2D] => {
  const canvas = document.createElement('canvas');
  canvas.width = edge;
  canvas.height = edge;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('A 2D canvas could not be made for a cover');
  }
  return [canvas, context];
};

/** A rounded rectangle path, for the sheet inside a folder. */
const roundedRect = (
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) => {
  context.beginPath();
  context.roundRect(x, y, w, h, r);
};

/**
 * The folder around a picture, at the insets `LibraryFolderArt.scss` gives
 * its sheet (26% top, 8% sides, 9% bottom), on a transparent ground. Painted
 * upright and flipped as a whole at the end, so the bitmap and the canvas
 * agree with what WebGL expects of each.
 */
const paintFolder = (
  picture: CanvasImageSource,
  edge: number,
  colours: ICoverFlowArtColours,
): HTMLCanvasElement => {
  const [canvas, context] = canvasOf(edge);
  const scale = edge / 100;
  context.save();
  context.scale(scale, scale);
  const body = new Path2D(FOLDER_PATH);
  // 158 degrees, as the sleeve's CSS gradient runs.
  const gradient = context.createLinearGradient(32, 0, 68, 100);
  gradient.addColorStop(0, colours.folderTop);
  gradient.addColorStop(1, colours.folderBottom);
  context.fillStyle = gradient;
  context.fill(body);
  context.restore();
  const x = edge * 0.08;
  const y = edge * 0.26;
  const w = edge * 0.84;
  const h = edge * 0.65;
  context.save();
  roundedRect(context, x, y, w, h, edge * 0.02);
  context.clip();
  // The picture is square and the sheet is not: cropped from its middle,
  // as `object-fit: cover` crops it in the list.
  const crop = (edge - (edge * h) / w) / 2;
  context.drawImage(picture, 0, crop, edge, edge - crop * 2, x, y, w, h);
  context.restore();
  context.strokeStyle = 'rgba(0, 0, 0, 0.35)';
  context.lineWidth = Math.max(1, edge / 160);
  roundedRect(context, x, y, w, h, edge * 0.02);
  context.stroke();
  return canvas;
};

/** The pending badge in the corner: a quiet clock, information rather than
 * a fault, as the list draws it. */
const paintPendingBadge = (context: CanvasRenderingContext2D, edge: number) => {
  const r = edge * 0.075;
  const cx = edge - r * 1.7;
  const cy = r * 1.7;
  context.fillStyle = 'rgba(8, 14, 22, 0.72)';
  context.beginPath();
  context.arc(cx, cy, r, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = 'rgba(255, 255, 255, 0.85)';
  context.lineWidth = Math.max(1.5, edge / 140);
  context.lineCap = 'round';
  context.beginPath();
  context.arc(cx, cy, r * 0.55, 0, Math.PI * 2);
  context.moveTo(cx, cy - r * 0.32);
  context.lineTo(cx, cy);
  context.lineTo(cx + r * 0.24, cy + r * 0.14);
  context.stroke();
};

/**
 * The light a cover throws: its average colour, lifted so a dark sleeve
 * still glows and a pale one does not wash the stage out.
 */
const glowOf = (source: CanvasImageSource): [number, number, number] => {
  const [, context] = canvasOf(8);
  context.drawImage(source, 0, 0, 8, 8);
  const pixels = context.getImageData(0, 0, 8, 8).data;
  let red = 0;
  let green = 0;
  let blue = 0;
  let weight = 0;
  for (let p = 0; p < pixels.length; p += 4) {
    const alpha = pixels[p + 3] / 255;
    red += pixels[p] * alpha;
    green += pixels[p + 1] * alpha;
    blue += pixels[p + 2] * alpha;
    weight += alpha;
  }
  const scale = 1 / (Math.max(weight, 1) * 255);
  return liftGlow([red * scale, green * scale, blue * scale]);
};

/** Saturation up a little, lightness held between 0.45 and 0.62 (HSL). */
export const liftGlow = ([r, g, b]: [number, number, number]): [
  number,
  number,
  number,
] => {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const light = (max + min) / 2;
  const delta = max - min;
  let hue = 0;
  if (delta > 0) {
    if (max === r) {
      hue = ((g - b) / delta) % 6;
    } else if (max === g) {
      hue = (b - r) / delta + 2;
    } else {
      hue = (r - g) / delta + 4;
    }
  }
  const sat = delta === 0 ? 0 : delta / (1 - Math.abs(2 * light - 1));
  const s = Math.min(1, sat * 1.25 + 0.15);
  const l = Math.max(0.45, Math.min(0.62, light + 0.15));
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((hue % 2) - 1));
  const m = l - c / 2;
  const sector = Math.floor((hue + 6) % 6);
  const [r1, g1, b1] = [
    [c, x, 0],
    [x, c, 0],
    [0, c, x],
    [0, x, c],
    [x, 0, c],
    [c, 0, x],
  ][sector];
  return [r1 + m, g1 + m, b1 + m];
};

/** A canvas painted upright, turned upside down as WebGL wants it. */
const flipped = (canvas: HTMLCanvasElement): HTMLCanvasElement => {
  const [out, context] = canvasOf(canvas.width);
  context.translate(0, canvas.height);
  context.scale(1, -1);
  context.drawImage(canvas, 0, 0);
  canvas.width = 0;
  return out;
};

/**
 * One cover's picture at `size`, or the generated tile where there is none
 * or it will not decode.
 */
export const loadCoverFlowArt = async (
  request: ICoverFlowArtRequest,
  size: TCoverFlowArtSize,
  colours: ICoverFlowArtColours,
): Promise<ICoverFlowArt> => {
  const edge = EDGE[size];
  let picture: ImageBitmap | HTMLCanvasElement | undefined;
  if (request.artId) {
    try {
      picture = await decodeCover(request.artId, size);
    } catch {
      // A cover the cache no longer has is the tile the Library shows.
      picture = undefined;
    }
  }
  const isBitmap = picture instanceof ImageBitmap;
  const plain = !request.isFolder && !request.isPending;
  if (picture && isBitmap && plain) {
    return { source: picture, glow: glowOf(picture) };
  }
  // Painted upright from here on: a bitmap already flipped is turned back.
  const [upright, context] = canvasOf(edge);
  if (picture) {
    context.save();
    context.translate(0, edge);
    context.scale(1, -1);
    context.drawImage(picture, 0, 0, edge, edge);
    context.restore();
    if (picture instanceof ImageBitmap) {
      picture.close();
    }
  } else {
    const tile = drawTile(request.label, edge);
    context.drawImage(tile, 0, 0);
    tile.width = 0;
  }
  const glow = glowOf(upright);
  let art = upright;
  if (request.isFolder) {
    art = paintFolder(upright, edge, colours);
    upright.width = 0;
  }
  if (request.isPending) {
    const badgeContext = art.getContext('2d');
    if (badgeContext) {
      paintPendingBadge(badgeContext, edge);
    }
  }
  return { source: flipped(art), glow };
};

/** Gives back what `loadCoverFlowArt` holds. */
export const releaseCoverFlowArt = (art: ICoverFlowArt): void => {
  if (art.source instanceof ImageBitmap) {
    art.source.close();
  } else {
    art.source.width = 0;
    art.source.height = 0;
  }
};
