import type { IScenePack } from 'common/scenePacks';

/** Decode once per scene load. The main process already verified these bytes. */
export const decodeSceneArtwork = async (
  pack: IScenePack,
): Promise<ImageBitmap | undefined> => {
  if (!pack.artwork) {
    return undefined;
  }
  const { data, mime, width, height } = pack.artwork;
  const bytes = Uint8Array.from(atob(data), (character) =>
    character.charCodeAt(0),
  );
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
