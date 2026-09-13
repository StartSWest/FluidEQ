import type { IScenePack } from 'common/scenePacks';

/** Decode once per scene load. The main process already verified these bytes. */
export const decodeSceneArtwork = async (
  pack: IScenePack,
): Promise<ImageBitmap | undefined> => {
  if (!pack.artwork) {
    return undefined;
  }
  const { data, mime, width, height } = pack.artwork;
  // Indexed, never `Uint8Array.from(string, map)`: iterating the decoded
  // string one character at a time left 260 MB of garbage and 300 ms of work
  // behind a 6 MB picture, on whichever thread decoded it — the Studio's
  // colour measurement runs on the page's.
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  const bitmap = await createImageBitmap(new Blob([bytes], { type: mime }), {
    imageOrientation: 'flipY',
    premultiplyAlpha: 'premultiply',
    colorSpaceConversion: 'none',
  });
  if (bitmap.width !== width || bitmap.height !== height) {
    bitmap.close();
    throw new Error('Scene artwork dimensions differ from its signed header.');
  }
  return bitmap;
};
