/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { type TTextureFit, isTextureImage } from '../../common/graphTextures';
import { recallRecent, rememberRecent } from '../utils/recentMap';

/**
 * A look's picture, made ready to be printed in a figure at the size it is
 * printed at — for the page's canvas (`fillTextures.ts`) and for the engine
 * (`engineLooks/lookTexture.ts`) alike.
 *
 * What it replaced did all of it every frame: the picture was an `<img>`
 * decoded on the page's thread, and each frame made a new pattern from it at
 * its natural size, for the canvas to resample. Here a picture is decoded
 * once, off the page's thread (`createImageBitmap`), and redrawn once at the
 * exact device pixels it covers — a tile at its height, a cover at the
 * plot's — so painting it is a copy, one to one. Nothing is redone while the
 * fit, the size, the display's ratio and the plot stay as they are.
 *
 * Both steps are asynchronous and a frame cannot wait for them, so the frame
 * that first asks starts them and paints the figure flat; whoever draws
 * hears `onTextureReady` when one lands and draws again. No timer: the
 * decode's own promise is the signal.
 */

export interface ITextureArea {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * Where one copy of a texture lies, in CSS pixels of the canvas it is
 * printed on, and the device pixels to print there.
 *
 * `key` names the pixels: two placements with the same key carry the same
 * bitmap, which is how the engine knows it already holds them.
 */
export interface ITexturePlacement {
  key: string;
  bitmap: ImageBitmap;
  x: number;
  y: number;
  width: number;
  height: number;
  repeat: boolean;
}

export interface IPicturePaint {
  /** The stored picture, a data URI this app wrote. */
  image: string;
  fit: TTextureFit;
  /** A tile's height in CSS pixels. */
  size: number;
  /** The display's device ratio. */
  scale: number;
  /** The plot, which a cover lies over. */
  area: ITextureArea;
}

interface IGeometry {
  /** Where the copy lies, CSS pixels. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** The part of the picture it shows, in the picture's own pixels. */
  crop: { x: number; y: number; width: number; height: number };
  /** The device pixels it is redrawn at. */
  pixelsWide: number;
  pixelsHigh: number;
  repeat: boolean;
}

/**
 * Where a picture of `wide` by `high` lies for a fit, and what of it shows.
 *
 * A tile is the whole picture, `size` CSS pixels tall at its own shape, from
 * the canvas's origin — the same origin the patterns use, so a tile does not
 * slide when the figure moves. A cover is the plot exactly: the picture
 * scaled until it fills the plot both ways and cut evenly at the sides that
 * overhang, which is what keeping its shape costs.
 */
export const pictureGeometry = (
  wide: number,
  high: number,
  { fit, size, scale, area }: Omit<IPicturePaint, 'image'>,
): IGeometry | undefined => {
  if (wide <= 0 || high <= 0) {
    return undefined;
  }
  const ratio = Math.max(0.5, Math.min(4, scale));
  if (fit === 'tile') {
    const height = Math.max(1, size);
    const width = (height * wide) / high;
    return {
      x: 0,
      y: 0,
      width,
      height,
      crop: { x: 0, y: 0, width: wide, height: high },
      pixelsWide: Math.max(1, Math.round(width * ratio)),
      pixelsHigh: Math.max(1, Math.round(height * ratio)),
      repeat: true,
    };
  }
  const width = area.right - area.left;
  const height = area.bottom - area.top;
  if (width <= 0 || height <= 0) {
    return undefined;
  }
  const fill = Math.max(width / wide, height / high);
  const shownWide = Math.min(wide, width / fill);
  const shownHigh = Math.min(high, height / fill);
  return {
    x: area.left,
    y: area.top,
    width,
    height,
    crop: {
      x: (wide - shownWide) / 2,
      y: (high - shownHigh) / 2,
      width: shownWide,
      height: shownHigh,
    },
    pixelsWide: Math.max(1, Math.round(width * ratio)),
    pixelsHigh: Math.max(1, Math.round(height * ratio)),
    repeat: false,
  };
};

type TDecoded = ImageBitmap | 'loading' | 'failed';

interface IPictureEntry {
  /** A short name for the picture, for keys: never the data URI itself. */
  id: number;
  decoded: TDecoded;
}

/**
 * Decoded pictures by their data URI, the most recently drawn kept. A few:
 * a picture is a megapixel and the window rarely shows more than the graph's
 * own look and the gallery's handful beside it.
 */
const pictures = new Map<string, IPictureEntry>();
const KEPT_PICTURES = 8;

/**
 * Redrawn pictures by placement key. Each is a cover of a plot or a tile, and
 * several are on screen at once — the graph, the look editor's preview, the
 * gallery's tiles — so a dozen, the most recently drawn.
 */
const scaled = new Map<string, ImageBitmap | 'loading'>();
const KEPT_SCALED = 12;

/** The newest ready redraw of each picture in each fit, for a resize. */
const lastReady = new Map<string, { key: string; bitmap: ImageBitmap }>();

let nextId = 1;

const listeners = new Set<() => void>();

/** Hears every texture that becomes ready to print; returns the unsubscribe. */
export const onTextureReady = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** Tells everyone drawing that a texture is ready (here and `fillTextures`). */
export const announceTextureReady = (): void => {
  listeners.forEach((listener) => listener());
};

/**
 * The stored picture's bytes. Read by hand rather than fetched: the window's
 * policy lets the page fetch from itself alone (`connect-src 'self'`), and a
 * data URI is not itself. A hundred kilobytes of base64 is well under a
 * millisecond; the decode that follows is the part kept off the page.
 */
export const blobOfDataUri = (image: string): Blob => {
  const comma = image.indexOf(',');
  const type = image.slice(5, image.indexOf(';'));
  const text = atob(image.slice(comma + 1));
  const bytes = new Uint8Array(text.length);
  for (let index = 0; index < text.length; index += 1) {
    bytes[index] = text.charCodeAt(index);
  }
  return new Blob([bytes], { type });
};

const decode = (image: string, entry: IPictureEntry): void => {
  createImageBitmap(blobOfDataUri(image))
    .then((bitmap) => {
      entry.decoded = bitmap;
      announceTextureReady();
      return undefined;
    })
    .catch(() => {
      entry.decoded = 'failed';
    });
};

/** The picture decoded, starting the decode if nobody has asked before. */
const decodedPicture = (image: string): IPictureEntry | undefined => {
  const held = recallRecent(pictures, image);
  if (held) {
    return held;
  }
  if (!isTextureImage(image)) {
    return undefined;
  }
  const entry: IPictureEntry = { id: nextId, decoded: 'loading' };
  nextId += 1;
  // The picture about to be let go is closed, and its stand-ins with it, so
  // its megapixel goes when it does rather than whenever the heap is swept.
  const evicted =
    pictures.size >= KEPT_PICTURES ? pictures.keys().next() : undefined;
  const gone =
    evicted && !evicted.done ? pictures.get(evicted.value) : undefined;
  if (gone) {
    if (typeof gone.decoded === 'object') {
      gone.decoded.close();
    }
    lastReady.delete(`pic${gone.id}|tile`);
    lastReady.delete(`pic${gone.id}|cover`);
  }
  rememberRecent(pictures, image, entry, KEPT_PICTURES);
  decode(image, entry);
  return entry;
};

const geometryKey = (id: number, geometry: IGeometry): string =>
  [
    `pic${id}`,
    geometry.repeat ? 'tile' : 'cover',
    geometry.pixelsWide,
    geometry.pixelsHigh,
    geometry.crop.x.toFixed(2),
    geometry.crop.y.toFixed(2),
  ].join('|');

const redraw = (
  source: ImageBitmap,
  key: string,
  family: string,
  geometry: IGeometry,
): void => {
  rememberRecent(scaled, key, 'loading', KEPT_SCALED);
  const { crop } = geometry;
  createImageBitmap(source, crop.x, crop.y, crop.width, crop.height, {
    resizeWidth: geometry.pixelsWide,
    resizeHeight: geometry.pixelsHigh,
    resizeQuality: 'high',
    premultiplyAlpha: 'premultiply',
  })
    .then((bitmap) => {
      // Only kept if it is still wanted: a size passed through on a drag
      // is not worth the memory once the drag has moved on.
      if (scaled.get(key) === 'loading') {
        rememberRecent(scaled, key, bitmap, KEPT_SCALED);
        lastReady.set(family, { key, bitmap });
        announceTextureReady();
      }
      return undefined;
    })
    .catch(() => {
      scaled.delete(key);
    });
};

/**
 * The picture placed for this frame, or nothing until it is ready.
 *
 * While a new size is being redrawn — a resize, the tile slider dragged — the
 * picture's last redraw in the same fit stands in, stretched to the new
 * place, so the figure does not flash flat at every step.
 */
export const placePicture = (
  paint: IPicturePaint,
): ITexturePlacement | undefined => {
  const entry = decodedPicture(paint.image);
  if (!entry || typeof entry.decoded !== 'object') {
    return undefined;
  }
  const source = entry.decoded;
  const geometry = pictureGeometry(source.width, source.height, paint);
  if (!geometry) {
    return undefined;
  }
  const key = geometryKey(entry.id, geometry);
  const family = `pic${entry.id}|${paint.fit}`;
  const held = recallRecent(scaled, key);
  let bitmap: ImageBitmap | undefined;
  let shownKey = key;
  if (held === undefined) {
    redraw(source, key, family, geometry);
  } else if (held !== 'loading') {
    bitmap = held;
  }
  if (!bitmap) {
    const standIn = lastReady.get(family);
    if (!standIn) {
      return undefined;
    }
    bitmap = standIn.bitmap;
    shownKey = standIn.key;
  }
  return {
    key: shownKey,
    bitmap,
    x: geometry.x,
    y: geometry.y,
    width: geometry.width,
    height: geometry.height,
    repeat: geometry.repeat,
  };
};

/** Lets every picture go. For tests, which build fresh canvases each run. */
export const resetTexturePictures = (): void => {
  pictures.clear();
  scaled.clear();
  lastReady.clear();
  listeners.clear();
  nextId = 1;
};
