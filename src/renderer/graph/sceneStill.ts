import type { IScenePack } from 'common/scenePacks';
import type { ISceneFrame } from './sceneGl';
import { drawStillInWorker } from './sceneStillClient';

/**
 * A scene's picture: a real frame of it, drawn off screen from its own pack,
 * so the gallery shows the scene doing what it does, never a drawing standing
 * in for it. Either the first big moment of the showcase signal — a loud, busy
 * chorus over moving noise — or a moment the member caught while it played.
 *
 * It is the picture people decide on, so it is made for quality rather than
 * copied off whatever canvas the scene happens to be playing on: a stage may
 * be drawing at a quarter of its size on a slow machine, and a card cropped
 * from that looked like the scene run through a sieve. The scene's clock runs
 * on a postage stamp up to the moment worth keeping, and that one frame is
 * drawn half as large again as the picture and brought down with a smooth
 * filter, so the thin things scenes are made of — rings, stars, grain — come
 * out clean instead of stepped.
 *
 * All of that happens in the scene still worker (`sceneStill.worker.ts`), never
 * on the page's thread: compiling a scene and reading its frame back stalled
 * the whole window for as long as they took.
 */

export const blobAsDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

/**
 * `pack`'s picture under the showcase signal, its clock run from the start
 * as it would be on the graph: the gallery's picture for a scene nobody has
 * chosen a moment of, and the cover a Publish starts with.
 */
export const renderSceneStill = (pack: IScenePack) => drawStillInWorker(pack);

/**
 * `pack`'s picture at the moment a member caught on screen: `frames` are what
 * the scene heard over the last few seconds before it, oldest first, replayed
 * so everything the scene eases is where it was, and the last one is the
 * moment. At full presence whatever the stage's own entrance was doing — its
 * fade is how a stage appears, not part of the scene.
 */
export const renderCapturedStill = (
  pack: IScenePack,
  frames: readonly ISceneFrame[],
) => drawStillInWorker(pack, frames);
