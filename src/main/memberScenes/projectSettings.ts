import fs from 'fs';
import path from 'path';
import {
  isNeutralResponse,
  readResponse,
  RESPONSE_KEYS,
  type ISceneResponse,
} from '../../common/sceneResponse';
import { MANIFEST_FILE, readManifest } from './project';

/**
 * A member's own tuning, written into their scene: the values of its
 * controls and how it answers the music, saved in `pack.json` so everything
 * made from the project — the stage, their looks, an export, the gallery —
 * carries what they settled on, and so their AI sees it next time.
 *
 * Only those two things change. Every other field of `pack.json` is the AI's
 * and is written back as it was read; a control this scene does not have is
 * ignored rather than added, and each value is kept inside its control's own
 * range. A neutral response is taken out rather than written, so a scene
 * that answers the music as the engine hears it says nothing about it.
 */

export interface IProjectSettings {
  params?: Readonly<Record<string, number>>;
  /** `null` takes the scene's response out: as the engine hears it. */
  response?: ISceneResponse | null;
}

export type TSettingsWrite = 'written' | 'unchanged' | 'failed';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Values as a slider shows them: three decimals, enough for any range here. */
const tidy = (value: number) => Math.round(value * 1000) / 1000;

export const writeProjectSettings = async (
  folder: string,
  settings: IProjectSettings,
): Promise<TSettingsWrite> => {
  let manifest: Record<string, unknown>;
  try {
    manifest = await readManifest(folder);
  } catch {
    return 'failed';
  }
  const before = JSON.stringify(manifest);

  if (settings.params && Array.isArray(manifest.params)) {
    const given = settings.params;
    manifest.params = manifest.params.map((entry: unknown) => {
      if (!isRecord(entry) || typeof entry.id !== 'string') {
        return entry;
      }
      const value = given[entry.id];
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        return entry;
      }
      const min = typeof entry.min === 'number' ? entry.min : 0;
      const max = typeof entry.max === 'number' ? entry.max : 1;
      return {
        ...entry,
        value: tidy(Math.min(Math.max(min, max), Math.max(min, value))),
      };
    });
  }

  if (settings.response !== undefined) {
    const response =
      settings.response === null ? null : readResponse(settings.response);
    if (!response || isNeutralResponse(response)) {
      delete manifest.response;
    } else {
      manifest.response = Object.fromEntries(
        RESPONSE_KEYS.map((key) => [key, tidy(response[key])]),
      );
    }
  }

  if (JSON.stringify(manifest) === before) {
    return 'unchanged';
  }
  try {
    // The same file the read took, checked the same way: directly in the
    // folder, never a link out of it.
    const real = await fs.promises.realpath(path.join(folder, MANIFEST_FILE));
    if (path.dirname(real) !== (await fs.promises.realpath(folder))) {
      return 'failed';
    }
    await fs.promises.writeFile(real, `${JSON.stringify(manifest, null, 2)}\n`);
    return 'written';
  } catch {
    return 'failed';
  }
};
