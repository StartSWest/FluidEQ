import {
  isNeutralResponse,
  readResponse,
  RESPONSE_KEYS,
  type ISceneResponse,
} from '../../common/sceneResponse';
import {
  isDefaultSceneWave,
  readSceneWave,
  type ISceneWave,
} from '../../common/sceneWave';
import { choiceIndex, isChoiceEntry } from '../../common/sceneChoice';
import {
  isColourEntry,
  readColourValue,
} from '../../common/sceneColourControl';
import {
  isPaletteEntry,
  readPaletteValue,
  type IScenePaletteValue,
} from '../../common/scenePalette';
import {
  readSceneWindowColours,
  SCENE_WINDOW_COLOUR_STOPS,
  sceneWindowColourKeys,
  sceneWindowColourStopsOf,
  type ISceneWindowColours,
  type TSceneWindowColourStop,
} from '../../common/sceneWindowColours';
import { MANIFEST_FILE, readManifest, writeInside } from './projectFiles';
import { queueSettingsWrite } from './settingsWrites';

/**
 * A member's own tuning, written into their scene: the values of its
 * controls and how it answers the music, saved in `pack.json` so everything
 * made from the project — the stage, their looks, an export, the gallery —
 * carries what they settled on, and so their AI sees it next time.
 *
 * Only what a member tunes changes — the controls, the response, the
 * ambient elements, where the scene wants the wave and the colours it lends
 * the window. Every other field of
 * `pack.json` is the AI's
 * and is written back as it was read; a control this scene does not have is
 * ignored rather than added, and each value is kept inside its control's own
 * range. A neutral response is taken out rather than written, so a scene
 * that answers the music as the engine hears it says nothing about it.
 */

export interface IProjectSettings {
  params?: Readonly<Record<string, number>>;
  /**
   * The colours of the scene's palettes by id (contract 9): written into
   * the palette's own `params` entry as `stops`, and `positions` only
   * where they are not evenly spaced.
   */
  palettes?: Readonly<Record<string, IScenePaletteValue>>;
  /** The single colours by id, `#rrggbb`, written as each one's `value`. */
  colours?: Readonly<Record<string, string>>;
  /** Where the ambient layer's controls stand, 0..1, by id (`sceneAmbient.ts`). */
  ambient?: Readonly<Record<string, number>>;
  /** `null` takes the scene's response out: as the engine hears it. */
  response?: ISceneResponse | null;
  /**
   * Where the scene wants the wave (`sceneWave.ts`), which travels with it to
   * a look, an export and the gallery. `null` takes it out: the listener's
   * graph then stands wherever they left it, as it did before.
   */
  wave?: ISceneWave | null;
  /**
   * The colours the scene lends the window at the points named here, of
   * the five hours of its day (`windowColourStops`, `sceneWindowColours.ts`),
   * which its AI chose and the member tuned on the Tune tab. `null` takes a
   * point out: the window then works it out by itself. A point not named
   * here is left as the scene has it.
   */
  windowColourStops?: Partial<
    Record<TSceneWindowColourStop, ISceneWindowColours | null>
  >;
}

export type TSettingsWrite = 'written' | 'unchanged' | 'failed';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Values as a slider shows them: three decimals, enough for any range here. */
const tidy = (value: number) => Math.round(value * 1000) / 1000;

const writeSettings = async (
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
      if (
        !isRecord(entry) ||
        typeof entry.id !== 'string' ||
        isPaletteEntry(entry) ||
        isColourEntry(entry)
      ) {
        return entry;
      }
      const value = given[entry.id];
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        return entry;
      }
      // A choice's range is its options, whatever min and max say, and its
      // value the nearest option (`sceneChoice.ts`).
      if (isChoiceEntry(entry)) {
        const count = Array.isArray(entry.options) ? entry.options.length : 0;
        return { ...entry, value: choiceIndex(value, count) };
      }
      const min = typeof entry.min === 'number' ? entry.min : 0;
      const max = typeof entry.max === 'number' ? entry.max : 1;
      return {
        ...entry,
        value: tidy(Math.min(Math.max(min, max), Math.max(min, value))),
      };
    });
  }

  if (settings.palettes && Array.isArray(manifest.params)) {
    const given = settings.palettes;
    manifest.params = manifest.params.map((entry: unknown) => {
      if (
        !isRecord(entry) ||
        typeof entry.id !== 'string' ||
        !isPaletteEntry(entry)
      ) {
        return entry;
      }
      const wanted = given[entry.id];
      const read = wanted
        ? readPaletteValue(wanted.stops, wanted.positions)
        : null;
      if (!read) {
        return entry;
      }
      // Evenly spaced is said by saying nothing, so a palette moved back
      // to even loses the positions it had.
      const next: Record<string, unknown> = {
        ...entry,
        stops: [...read.stops],
      };
      delete next.positions;
      return read.positions
        ? { ...next, positions: [...read.positions] }
        : next;
    });
  }

  if (settings.colours && Array.isArray(manifest.params)) {
    const given = settings.colours;
    manifest.params = manifest.params.map((entry: unknown) => {
      if (
        !isRecord(entry) ||
        typeof entry.id !== 'string' ||
        !isColourEntry(entry)
      ) {
        return entry;
      }
      const colour = readColourValue(given[entry.id]);
      return colour ? { ...entry, value: colour } : entry;
    });
  }

  const { ambient } = manifest;
  if (settings.ambient && isRecord(ambient) && Array.isArray(ambient.params)) {
    const given = settings.ambient;
    manifest.ambient = {
      ...ambient,
      params: ambient.params.map((entry: unknown) => {
        if (!isRecord(entry) || typeof entry.id !== 'string') {
          return entry;
        }
        const value = given[entry.id];
        return typeof value === 'number' && Number.isFinite(value)
          ? { ...entry, value: tidy(Math.min(1, Math.max(0, value))) }
          : entry;
      }),
    };
  }

  if (settings.wave !== undefined) {
    // The wave the scene is built around, published with it. `null` — the
    // graph's own full height on the bottom — takes it out again, so a scene
    // that asks for nothing in particular is a scene with no `wave` in its
    // pack rather than one that pins the listener to the default.
    const wave =
      settings.wave === null ? undefined : readSceneWave(settings.wave);
    if (!wave || isDefaultSceneWave(wave)) {
      delete manifest.wave;
    } else {
      manifest.wave = {
        height: tidy(wave.height),
        position: tidy(wave.position),
      };
    }
  }

  const stopEdits = settings.windowColourStops;
  if (stopEdits !== undefined) {
    // The points as the scene has them now, the two-point keys of a scene
    // written before the points folded in, each edit laid over them.
    const stops: Partial<Record<TSceneWindowColourStop, ISceneWindowColours>> =
      { ...sceneWindowColourStopsOf(manifest) };
    SCENE_WINDOW_COLOUR_STOPS.forEach((stop) => {
      const value = stopEdits[stop];
      if (value === null) {
        delete stops[stop];
      } else if (value !== undefined) {
        // A set that is not three colours is written as nothing at all: the
        // point keeps what it had rather than losing its colours to a slip.
        const colours = readSceneWindowColours(value);
        if (colours) {
          stops[stop] = colours;
        }
      }
    });
    // In place, so an unchanged key keeps its spot in the file and a write
    // that changes nothing is seen as one.
    const keys = sceneWindowColourKeys(stops);
    (
      ['windowColours', 'windowColoursDay', 'windowColourStops'] as const
    ).forEach((key) => {
      const value = keys[key];
      if (value === undefined) {
        delete manifest[key];
      } else {
        manifest[key] = value;
      }
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
    await writeInside(
      folder,
      MANIFEST_FILE,
      'pack.json',
      `${JSON.stringify(manifest, null, 2)}\n`,
    );
    return 'written';
  } catch {
    return 'failed';
  }
};

export const writeProjectSettings = (
  folder: string,
  settings: IProjectSettings,
): Promise<TSettingsWrite> =>
  queueSettingsWrite(folder, () => writeSettings(folder, settings));
