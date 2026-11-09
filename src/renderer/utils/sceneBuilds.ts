import type { IScenePack } from 'common/scenePacks';

/**
 * The window's side of the last version of each look that built here
 * (`main/sceneBuilds.ts`), by look id: a premium look's or a member's.
 */

const bridge = () => window.electron?.ipcRenderer;

// The looks' listings name a version by its SHA-256; an older listing that
// names it only by number has nothing main could match, and keeps nothing.
const REVISION = /^[0-9a-f]{64}$/;

/** This revision of the look built and is drawn here. */
export const reportSceneBuilt = (lookId: string, revision: string) => {
  if (REVISION.test(revision)) {
    bridge()
      ?.reportSceneBuilt?.(lookId, revision)
      .catch(() => {
        // No bridge to keep it: the scene draws all the same, and the next
        // build that works is kept instead.
      });
  }
};

/** The last version of the look that built here, if one is kept. */
export const lastSceneBuild = async (
  lookId: string,
): Promise<IScenePack | undefined> => bridge()?.lastSceneBuild?.(lookId);
