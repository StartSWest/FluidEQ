import { ipcMain } from 'electron';
import type { ISceneResponse } from '../../common/sceneResponse';
import { readSceneWave, type ISceneWave } from '../../common/sceneWave';
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
  /**
   * Whether the open project may be worked on: Plus, or the one project the
   * Studio keeps without it. Asked fresh on every call, as everything in the
   * Studio is.
   */
  mayEdit: () => boolean;
  /**
   * Whether the member's look of the open project may be saved again with
   * the settings. The save writes the whole pack, code included, which is
   * "Add to my looks" done again — so it is Plus's, and never done for a
   * FluidEQ scene opened to look inside. A member whose Plus has lapsed
   * keeps editing the project; the look they added stays as it was.
   */
  mayUpdateLook: () => boolean;
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
  const numbers = (value: unknown) =>
    isRecord(value)
      ? Object.fromEntries(
          Object.entries(value).filter(
            (entry): entry is [string, number] =>
              typeof entry[1] === 'number' && Number.isFinite(entry[1]),
          ),
        )
      : undefined;
  const params = numbers(raw.params);
  const ambient = numbers(raw.ambient);
  let response: ISceneResponse | null | undefined;
  if (raw.response === null) {
    response = null;
  } else if (isRecord(raw.response)) {
    response = raw.response as unknown as ISceneResponse;
  }
  // `null` says the scene wants no wave of its own; anything else is read
  // for its two numbers and kept in range (`sceneWave.ts`).
  let wave: ISceneWave | null | undefined;
  if (raw.wave === null) {
    wave = null;
  } else if (raw.wave !== undefined) {
    wave = readSceneWave(raw.wave) ?? null;
  }
  return {
    ...(params ? { params } : {}),
    ...(ambient ? { ambient } : {}),
    ...(response !== undefined ? { response } : {}),
    ...(wave !== undefined ? { wave } : {}),
  };
};

/** Registers the handler; the returned function takes it away. */
export const registerStudioSettingsIpc = ({
  mayEdit,
  mayUpdateLook,
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
      // The account as it is now, held for the whole save: a sign-out or a
      // switch landing between the two writes must not put one account's
      // project among another's looks.
      const me = accountId();
      if (!mayEdit() || !folder) {
        return { written: 'failed', lookUpdated: false };
      }
      const written = await writeProjectSettings(folder, readSettings(raw));
      if (written !== 'written' || !me || !mayUpdateLook()) {
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
      // Asked again after the reads: Plus, the project on the bench and the
      // account can all have changed while they ran.
      if (
        !build.ok ||
        !isLook ||
        !mayUpdateLook() ||
        activeFolder() !== folder ||
        accountId() !== me
      ) {
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
