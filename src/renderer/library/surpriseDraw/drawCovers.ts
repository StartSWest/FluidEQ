/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The pictures Surprise me's draw spins: a couple of dozen covers, each
 * decoded once at the size a card is drawn and nothing larger.
 *
 * A card never stands taller than about a third of the shelf, so 256 pixels
 * covers a 2x display; the cached covers are 320 tall (`libraryArtwork.ts`),
 * and uploading them as they come would put a quarter more pixels on the
 * graphics card for nothing anyone could see. Each one is cropped square
 * from its middle on the way, the way the Library's own tiles show a cover
 * that is not square.
 */
import {
  libraryTileHue,
  libraryTileInitials,
} from '../../../common/library/artwork';
import { libraryMediaUrl } from '../../../common/library/mediaUrl';

/** The edge every card's picture is decoded at. */
export const DRAW_COVER_EDGE = 256;

export type TDrawCover = ImageBitmap | HTMLCanvasElement;

/**
 * The Library's generated tile (`LibraryCoverArt`), painted: the same hue
 * from the same name and the same initials, for a song with no cover.
 */
export const drawTile = (label: string): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  canvas.width = DRAW_COVER_EDGE;
  canvas.height = DRAW_COVER_EDGE;
  const context = canvas.getContext('2d');
  if (!context) {
    return canvas;
  }
  const hue = libraryTileHue(label);
  // 155 degrees, as the tile's CSS gradient runs.
  const angle = (155 - 90) * (Math.PI / 180);
  const half = DRAW_COVER_EDGE / 2;
  const dx = Math.cos(angle) * half;
  const dy = Math.sin(angle) * half;
  const gradient = context.createLinearGradient(
    half - dx,
    half - dy,
    half + dx,
    half + dy,
  );
  gradient.addColorStop(0, `hsl(${hue}deg 58% 34%)`);
  gradient.addColorStop(1, `hsl(${hue}deg 66% 20%)`);
  context.fillStyle = gradient;
  context.fillRect(0, 0, DRAW_COVER_EDGE, DRAW_COVER_EDGE);
  context.fillStyle = 'rgba(255, 255, 255, 0.92)';
  context.font = `700 ${DRAW_COVER_EDGE * 0.3}px -apple-system, "Segoe UI", Ubuntu, Cantarell, "Noto Sans", "DejaVu Sans", sans-serif`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(libraryTileInitials(label), half, half);
  return canvas;
};

/**
 * One card's picture: the cover, square and at `DRAW_COVER_EDGE`, or the
 * generated tile when there is no cover or it will not decode.
 */
export const loadDrawCover = async (
  artId: string | undefined,
  label: string,
): Promise<TDrawCover> => {
  if (!artId) {
    return drawTile(label);
  }
  try {
    const image = new Image();
    image.decoding = 'async';
    // Asked for with CORS, which the media scheme answers (`CORS_HEADERS` in
    // `libraryProtocol.ts`): it is another origin than the window, and a
    // picture loaded without it is tainted. WebGL refuses a tainted texture
    // ("The ImageBitmap contains cross-origin data") on every frame, and the
    // draw spun nothing but the dimmed shelf.
    image.crossOrigin = 'anonymous';
    image.src = libraryMediaUrl('art', artId);
    await image.decode();
    const side = Math.min(image.naturalWidth, image.naturalHeight);
    return await createImageBitmap(
      image,
      (image.naturalWidth - side) / 2,
      (image.naturalHeight - side) / 2,
      side,
      side,
      {
        resizeWidth: DRAW_COVER_EDGE,
        resizeHeight: DRAW_COVER_EDGE,
        resizeQuality: 'high',
      },
    );
  } catch {
    // A cover the cache no longer has, or one that will not decode, is drawn
    // as the tile the Library itself would show for it.
    return drawTile(label);
  }
};

/** Gives back what `loadDrawCover` holds: a bitmap's pixels, a canvas's buffer. */
export const releaseDrawCover = (cover: TDrawCover): void => {
  if (cover instanceof HTMLCanvasElement) {
    cover.width = 0;
    cover.height = 0;
    return;
  }
  cover.close();
};
