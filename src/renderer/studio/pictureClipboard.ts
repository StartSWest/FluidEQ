import type { IArtworkRegion } from 'main/memberScenes/artworkRegions';

/**
 * A picture as the window shows it: an image it can load — a chat picture,
 * the scene's whole image — and, for a piece of that image, the region cut
 * out of it.
 */
export interface IPictureSource {
  src: string;
  region?: IArtworkRegion;
}

/**
 * Draws a piece of a packed image the right way up: a piece the packer turned
 * is turned back. The one transform both a saved piece (`copyRegion`) and a
 * copied one use, so what is pasted is what is saved.
 */
export const drawUpright = (
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  source: CanvasImageSource,
  region: IArtworkRegion,
) => {
  if (region.rotated) {
    context.translate(0, region.width);
    context.rotate(-Math.PI / 2);
  }
  context.drawImage(
    source,
    region.x,
    region.y,
    region.width,
    region.height,
    0,
    0,
    region.width,
    region.height,
  );
};

/**
 * The picture as a PNG at its own full size. Chromium's clipboard takes
 * `image/png` and nothing else, so a JPEG or WebP is drawn and encoded again,
 * and so is a piece, which only exists cut out of its image.
 *
 * Loaded through an image element, as the picture on screen was: the chat's
 * pictures are `data:` URLs and the scene's image a `blob:` one, both of which
 * the page may show, and neither of which taints the canvas.
 */
export const pictureAsPng = async ({
  src,
  region,
}: IPictureSource): Promise<Blob> => {
  const image = new Image();
  image.src = src;
  await image.decode();
  const area: IArtworkRegion = region ?? {
    id: '',
    x: 0,
    y: 0,
    width: image.naturalWidth,
    height: image.naturalHeight,
    rotated: false,
  };
  const canvas = new OffscreenCanvas(
    area.rotated ? area.height : area.width,
    area.rotated ? area.width : area.height,
  );
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('No 2D context to draw the picture on.');
  }
  drawUpright(context, image, area);
  return canvas.convertToBlob({ type: 'image/png' });
};

/**
 * Puts the picture on the clipboard, once its PNG is made. The clipboard can
 * be handed the PNG still to come, and was: measured on a 1024 px piece of a
 * scene's image it took 5.8 s that way against 0.8 s for the finished one,
 * the same encoding either way. The share card writes its finished PNG too
 * (`ShareScoreCard.tsx`), so waiting for it costs the write nothing here.
 */
export const copyPicture = async (source: IPictureSource): Promise<void> => {
  const png = await pictureAsPng(source);
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
};
