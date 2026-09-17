import { useEffect, useRef } from 'react';
import type { IScenePack } from 'common/scenePacks';
import { renderScenePreview } from '../graph/sceneStill';

/**
 * A picture of the scene, written into the project's folder after each build.
 *
 * The assistant that writes a member's shader never sees what it made: it has
 * the files and the member has the eyes, so a scene can go several rounds with
 * its subject a grey smudge in a corner nobody described. It cannot be given a
 * way into the running app to look for itself — the scene is drawn on the
 * member's GPU inside FluidEQ, and a packaged app has no door into that and
 * should not grow one.
 *
 * So the picture goes the other way, and this is that half: FluidEQ draws the
 * scene it is already playing and puts the picture in the folder the assistant
 * is already editing (`ipc/studioPreview.ts`). The assistant opens a file.
 *
 * Once per build, never on a timer: a build is exactly the moment the picture
 * became wrong. It is drawn in the still worker like the gallery's cover, so
 * the window's own thread does not stop for it, and a build that lands while
 * one is being drawn abandons it rather than racing it onto the disk.
 */
export default function useStudioPreviewFile(
  pack: IScenePack | undefined,
  /** The open project: its folder is the one main will write into. */
  project: string | undefined,
  /** Changes with every version that became a pack. */
  serial: number,
  /** False while something else owns the GPU, such as the Publish dialog. */
  ready: boolean,
) {
  const generation = useRef(0);
  useEffect(() => {
    generation.current += 1;
    const mine = generation.current;
    const write = window.electron?.ipcRenderer?.writeStudioPreview;
    if (!pack || !project || !ready || !write) {
      return undefined;
    }
    renderScenePreview(pack)
      .then(async (blob) => {
        if (!blob || generation.current !== mine) {
          return undefined;
        }
        const bytes = new Uint8Array(await blob.arrayBuffer());
        if (generation.current !== mine) {
          return undefined;
        }
        return write(project, bytes);
      })
      // A picture nobody can draw, or a folder that will not take it, changes
      // nothing about the scene: the next save tries again.
      .catch(() => undefined);
    return () => {
      generation.current += 1;
    };
  }, [pack, project, serial, ready]);
}
