import { ipcMain } from 'electron';
import { readProject, type TProjectBuild } from '../memberScenes/project';
import { keptRevisionOf, type IMemberSceneStore } from '../memberScenes/store';
import type { IStudioLookCopy, TAddOutcome } from './studioProjectTypes';

interface IStudioLooksCopyDeps {
  store: IMemberSceneStore;
  accountId: () => string | undefined;
  activeFolder: () => string | undefined;
  activeIsInspection: () => boolean;
  /** The looks changed: every list of them is told. */
  announceScenes: () => void;
  /** The Studio is told again, so the bench shows the copy as it now is. */
  announceStudio: () => void;
  logger?: { warn(message: string): void };
}

/**
 * The open project's copy in the member's looks: putting the scene there,
 * and how the copy compares with the bench (Ivan, 2026-10-14: "show current
 * version / version on lib so they know if what they open in studio is ahead
 * of the library or not").
 *
 * Compared by content, not by number: a version keeps its number through
 * every save until it is published, so a look kept an hour ago and the bench
 * now can both say version 3 and play different scenes. The bench's pack is
 * put through what keeping it would do (`keptRevisionOf`), once per build.
 */
const createStudioLooksCopy = ({
  store,
  accountId,
  activeFolder,
  activeIsInspection,
  announceScenes,
  announceStudio,
  logger,
}: IStudioLooksCopyDeps) => {
  const revisions = new WeakMap<object, string | undefined>();

  const revisionOfBuild = (
    pack: Extract<TProjectBuild, { ok: true }>['pack'],
  ) => {
    if (!revisions.has(pack)) {
      revisions.set(pack, keptRevisionOf(pack));
    }
    return revisions.get(pack);
  };

  /** The copy in the looks of the scene the build is, if the member kept one. */
  const copyOf = (
    build: TProjectBuild | undefined,
  ): IStudioLookCopy | undefined => {
    const me = accountId();
    if (!me || !build?.ok || activeIsInspection()) {
      return undefined;
    }
    const kept = store
      .list()
      .find(
        (scene) =>
          scene.own && scene.authorId === me && scene.packId === build.pack.id,
      );
    if (!kept) {
      return undefined;
    }
    const revision = revisionOfBuild(build.pack);
    return {
      version: kept.version,
      current: revision !== undefined && revision === kept.revision,
    };
  };

  ipcMain.handle('studio-add-to-looks', async (): Promise<TAddOutcome> => {
    const me = accountId();
    if (!me) {
      return { ok: false, reason: 'signed-out' };
    }
    const folder = activeFolder();
    if (!folder) {
      return { ok: false, reason: 'no-build' };
    }
    if (activeIsInspection()) {
      return { ok: false, reason: 'inspect-only' };
    }
    // Read the folder again rather than trusting the last watched build: the
    // press may land between a save and the watcher's rebuild.
    const build = await readProject(folder);
    if (!build.ok) {
      return { ok: false, reason: 'no-build' };
    }
    // A maker's own scene goes into their looks, and onto the graph, whether
    // or not it is published: they try it there until it is done, and
    // publish it to earn from it (Ivan, 2026-10-21: "no need to publish to
    // run on grahp").
    try {
      // Whether the press added the look or brought one up to date, for
      // what the Studio says it did (Ivan, 2026-09-29: "add to my look need
      // to show notification look updated or added").
      const updated = store
        .list()
        .some((kept) => kept.authorId === me && kept.packId === build.pack.id);
      const scene = store.save(me, build.pack);
      announceScenes();
      announceStudio();
      return { ok: true, scene, updated };
    } catch (error) {
      logger?.warn(`Adding a member scene failed: ${String(error)}`);
      return { ok: false, reason: 'refused' };
    }
  });

  return { copyOf };
};

export default createStudioLooksCopy;
