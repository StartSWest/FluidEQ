import type { ISceneArtwork } from 'common/sceneArtwork';
import type { IScenePack } from 'common/scenePacks';

interface IBase64Decoder {
  fromBase64?: (text: string) => Uint8Array<ArrayBuffer>;
}

/** The artwork's file bytes. The main process already verified them. */
export const sceneArtworkBytes = ({
  data,
}: Pick<ISceneArtwork, 'data'>): Uint8Array<ArrayBuffer> => {
  // The engine's own decoder where the runtime has one: a few milliseconds
  // for a 6 MB picture, where the loop below is tens of them.
  const decoder = Uint8Array as unknown as IBase64Decoder;
  if (typeof decoder.fromBase64 === 'function') {
    return decoder.fromBase64(data);
  }
  // Indexed, never `Uint8Array.from(string, map)`: iterating the decoded
  // string one character at a time left 260 MB of garbage and 300 ms of work
  // behind a 6 MB picture, on whichever thread decoded it — the Studio's
  // colour measurement runs on the page's.
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
};

/** Decode once per scene load. The main process already verified these bytes. */
export const decodeSceneArtwork = async (
  pack: IScenePack,
): Promise<ImageBitmap | undefined> => {
  if (!pack.artwork) {
    return undefined;
  }
  const { mime, width, height } = pack.artwork;
  const bytes = sceneArtworkBytes(pack.artwork);
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
