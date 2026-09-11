import { MAX_SCENE_ARTWORK_BYTES } from 'common/sceneArtwork';
import {
  placePicture,
  type IPictureFraming,
  type ISize,
} from 'common/pictureFraming';
import type { IPictureSlot } from 'main/ipc/studioPictures';

/**
 * The scene's pictures, from any photos the member has.
 *
 * A scene that uses pictures names one image in `pack.json` at an exact size,
 * and the build refuses anything but a WebP of that size; the pictures are
 * named places in it (see `projectPictures.ts`). Nobody has such an image: a
 * photo of a pet is a JPG off a phone, at whatever size the phone took it,
 * and the AI that writes the scene cannot draw it — which is how the pet
 * example ended on "a file the scene needs is missing" with nothing the
 * member could do about it.
 *
 * So the member picks any photo for a place in the system dialog (the main
 * process reads it; no path comes from here), frames it in the Studio, and it
 * is laid in here — over the image as it is, so the other pictures stay —
 * and encoded as the WebP, which only a page can do. The main process saves
 * it as the file `pack.json` names, keeps the photo beside it for framing
 * again, and the folder's watcher plays the scene with it.
 */

export interface IPictureImage {
  width: number;
  height: number;
  /** The scene's image as it is now, when it is one the scene can use. */
  image?: Uint8Array;
}

const QUALITIES = [0.92, 0.85, 0.75, 0.6] as const;

/**
 * A kept photo's longer side. Enough to zoom four times into a place the
 * size of the largest a scene may have along its short side, and a photo
 * straight off a phone comes down to a few megabytes.
 */
const KEPT_PHOTO_EDGE = 4096;
const MAX_KEPT_PHOTO_BYTES = 16 * 1024 * 1024;

const encode = (canvas: HTMLCanvasElement, quality: number) =>
  new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/webp', quality);
  });

/** The first quality whose WebP is within `limit`, each tried only if the last was too big. */
const encodeWithin = async (
  canvas: HTMLCanvasElement,
  limit: number,
  qualities: readonly number[] = QUALITIES,
): Promise<Uint8Array | undefined> => {
  const [quality, ...rest] = qualities;
  if (quality === undefined) {
    return undefined;
  }
  const blob = await encode(canvas, quality);
  return blob && blob.type === 'image/webp' && blob.size <= limit
    ? new Uint8Array(await blob.arrayBuffer())
    : encodeWithin(canvas, limit, rest);
};

/** Bytes as a bitmap, or nothing when they are not a picture this browser reads. */
export const decodePicture = async (
  bytes: Uint8Array,
): Promise<ImageBitmap | undefined> => {
  try {
    // A copy, so the Blob holds a plain ArrayBuffer whatever backed the bytes.
    return await createImageBitmap(new Blob([new Uint8Array(bytes)]));
  } catch {
    return undefined;
  }
};

const sizeOf = (bitmap: ImageBitmap): ISize => ({
  width: bitmap.width,
  height: bitmap.height,
});

/**
 * Draws `photo` into a place `place` big at the canvas position `x`, `y`, as
 * `framing` has it and cut to the place, so nothing beyond it is touched.
 * The framing editor's preview and the saved image are both drawn by this.
 */
export const drawFramed = (
  context: CanvasRenderingContext2D,
  photo: ImageBitmap,
  place: ISize & { x: number; y: number },
  framing: IPictureFraming,
) => {
  const drawn = placePicture(sizeOf(photo), place, framing);
  context.save();
  context.beginPath();
  context.rect(place.x, place.y, place.width, place.height);
  context.clip();
  context.clearRect(place.x, place.y, place.width, place.height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(
    photo,
    place.x + drawn.x,
    place.y + drawn.y,
    drawn.width,
    drawn.height,
  );
  context.restore();
};

/**
 * The scene's image with `photo` laid into `slot` as `framing` has it. The
 * rest of the image is what it was; a place never filled stays clear.
 */
export const layPicture = async (
  image: IPictureImage,
  slot: IPictureSlot,
  photo: ImageBitmap,
  framing: IPictureFraming,
): Promise<Uint8Array | undefined> => {
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext('2d');
  if (!context) {
    return undefined;
  }
  const current = image.image ? await decodePicture(image.image) : undefined;
  if (current) {
    context.drawImage(current, 0, 0);
    current.close();
  }
  drawFramed(context, photo, slot, framing);
  return encodeWithin(canvas, MAX_SCENE_ARTWORK_BYTES);
};

/** The photo as it is kept beside the scene: WebP, no larger than it needs. */
export const keptPhoto = async (
  photo: ImageBitmap,
): Promise<Uint8Array | undefined> => {
  const scale = Math.min(
    1,
    KEPT_PHOTO_EDGE / Math.max(photo.width, photo.height),
  );
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(photo.width * scale));
  canvas.height = Math.max(1, Math.round(photo.height * scale));
  const context = canvas.getContext('2d');
  if (!context) {
    return undefined;
  }
  context.imageSmoothingQuality = 'high';
  context.drawImage(photo, 0, 0, canvas.width, canvas.height);
  return encodeWithin(canvas, MAX_KEPT_PHOTO_BYTES);
};
