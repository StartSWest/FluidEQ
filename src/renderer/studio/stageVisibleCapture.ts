import type { IStageView } from './useStageZoom';

/** As the sketch sends its picture: a JPEG, near-lossless. */
const JPEG_QUALITY = 0.9;

/** The widest picture sent: as wide as the 4K budget draws a stage. */
const MOST_WIDTH = 2560;

/**
 * A picture of what the stage shows right now, for the chat (Ivan,
 * 2026-11-08: "zoom and pan the scene so I can take pictures of visible
 * area"): the part of the scene's canvas the screen shows, at the canvas's
 * own pixels, so a closer look comes through with the detail it was drawn
 * with, and whatever the camera was turned to.
 *
 * The scene's canvas is read the way the publish clip reads it
 * (`previewVideo.ts`): drawn onto a canvas of our own, its last frame as it
 * stands. Undefined while the scene has drawn nothing.
 */
export default async function captureVisibleStage(
  host: HTMLElement | null,
  view: IStageView,
  width: number,
  height: number,
): Promise<Uint8Array | undefined> {
  const source = host?.querySelector('canvas');
  if (!source || source.width < 2 || source.height < 2 || width < 1) {
    return undefined;
  }
  // The canvas's pixels per CSS pixel of the zoomed picture, each way.
  const across = source.width / (width * view.scale);
  const down = source.height / (height * view.scale);
  const sw = width * across;
  const sh = height * down;
  const shrink = Math.min(1, MOST_WIDTH / sw);
  const out = document.createElement('canvas');
  out.width = Math.max(1, Math.round(sw * shrink));
  out.height = Math.max(1, Math.round(sh * shrink));
  const context = out.getContext('2d', { alpha: false });
  if (!context) {
    return undefined;
  }
  context.drawImage(
    source,
    -view.x * across,
    -view.y * down,
    sw,
    sh,
    0,
    0,
    out.width,
    out.height,
  );
  const blob = await new Promise<Blob | null>((resolve) => {
    out.toBlob(resolve, 'image/jpeg', JPEG_QUALITY);
  });
  return blob ? new Uint8Array(await blob.arrayBuffer()) : undefined;
}
