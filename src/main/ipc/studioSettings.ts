import { ipcMain } from 'electron';
import type { ISceneResponse } from '../../common/sceneResponse';
import { readProject } from '../memberScenes/project';
import {
  writeProjectSettings,
  type IProjectSettings,
  type TSettingsWrite,
} from '../memberScenes/projectSettings';
import type { IMemberSceneStore } from '../memberScenes/store';

/**
 * The Studio's scene settings, as the renderer sees them: the values of the
 * open scene's controls and how it answers the music, written into its
 * `pack.json` (see `projectSettings.ts`).
 *
 * Seamless with the member's looks: when the scene is already one of them,
 * the look is saved again from the project the moment its settings are, so
 * the graph plays what the Studio was tuned to without another "Add to my
 * looks". Nothing else a save brings reaches the look this way — the scene's
 * code is taken into the looks only when the member adds it.
 */

export interface IStudioSettingsOutcome {
  written: TSettingsWrite;
  /** The member's look of this scene was saved again with the settings. */
  lookUpdated: boolean;
}

const CHANNELS = ['studio-write-settings'] as const;

export interface IStudioSettingsDeps {
  /** Asked fresh on every call, as everything in the Studio is. */
  entitled: () => boolean;
  activeFolder: () => string | undefined;
  accountId: () => string | undefined;
  store: IMemberSceneStore;
  announceScenes: () => void;
  logger?: { warn(message: string): void };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** What the page sent, as settings: numbers only, and nothing else. */
const readSettings = (raw: unknown): IProjectSettings => {
  if (!isRecord(raw)) {
    return {};
  }
  const params = isRecord(raw.params)
    ? Object.fromEntries(
        Object.entries(raw.params).filter(
          (entry): entry is [string, number] =>
            typeof entry[1] === 'number' && Number.isFinite(entry[1]),
        ),
      )
    : undefined;
  let response: ISceneResponse | null | undefined;
  if (raw.response === null) {
    response = null;
  } else if (isRecord(raw.response)) {
    response = raw.response as unknown as ISceneResponse;
  }
  return {
    ...(params ? { params } : {}),
    ...(response !== undefined ? { response } : {}),
  };
};

/** Registers the handler; the returned function takes it away. */
export const registerStudioSettingsIpc = ({
  entitled,
  activeFolder,
  accountId,
  store,
  announceScenes,
  logger,
}: IStudioSettingsDeps): (() => void) => {
  ipcMain.handle(
    'studio-write-settings',
    async (_event, raw: unknown): Promise<IStudioSettingsOutcome> => {
      const folder = activeFolder();
      if (!entitled() || !folder) {
        return { written: 'failed', lookUpdated: false };
      }
      const written = await writeProjectSettings(folder, readSettings(raw));
      const me = accountId();
      if (written !== 'written' || !me) {
        return { written, lookUpdated: false };
      }
      const build = await readProject(folder);
      const isLook =
        build.ok &&
        store
          .list()
          .some(
            (scene) =>
              scene.own &&
              scene.authorId === me &&
              scene.packId === build.pack.id,
          );
      if (!build.ok || !isLook) {
        return { written, lookUpdated: false };
      }
      try {
        store.save(me, build.pack);
        announceScenes();
        return { written, lookUpdated: true };
      } catch (error) {
        logger?.warn(`A look's settings were not updated: ${String(error)}`);
        return { written, lookUpdated: false };
      }
    },
  );

  return () => CHANNELS.forEach((channel) => ipcMain.removeHandler(channel));
};
