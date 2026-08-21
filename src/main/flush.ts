/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import fs from 'fs';
import path from 'path';
import log from 'electron-log';
import { serializePreset, serializeState } from './apoRender';
import {
  AutoEqFormat,
  FilterTypeEnum,
  APO_LAYERS,
  TApoLayer,
  clampGain,
  clampQuality,
  IFilter,
  getDefaultState,
  IConvolutionProfile,
  IFiltersMap,
  IGraphicEqPoint,
  IApoLayerOverride,
  IPresetV1,
  IPresetV2,
  IState,
  AUTOMATIC_PRESET_PREFIX,
} from '../common/constants';
import { PRODUCT_NAME } from '../common/branding';
import { sanitizeSmartEqSettings } from '../common/smartEq';
import {
  validatePresetV1,
  validatePresetV2,
  validateState,
} from '../common/validator';

const CONFIG_CONTENT = 'Include: fluideq.txt';
// A value on disk, not a name in code: this is what upstream AQUA wrote into
// Equalizer APO's config.txt, and it has to keep matching so an install being
// upgraded from that project is recognised rather than duplicated.
const LEGACY_CONFIG_CONTENT = /^\s*Include:\s*aqua\.txt\s*$/i;
const LOCAL_STATE_FILENAME = 'state.txt';
export const FLUIDEQ_CONFIG_FILENAME = 'fluideq.txt';
const CONFIG_FILENAME = 'config.txt';
export const PRESETS_DIR = 'presets';

export const addFileToPath = (pathPrefix: string, fileName: string) => {
  return path.join(pathPrefix, fileName);
};

/**
 * A profile name is a filename, and it comes from the user.
 *
 * It arrives as `arg[0]` on four IPC channels and is joined straight onto a
 * directory, so without this every one of those channels is an invitation to
 * write, read, rename or delete somewhere else entirely. Refused rather than
 * sanitised: a name that has to be rewritten to be safe is not the name anybody
 * asked for, and quietly saving to a different file than the one requested is
 * its own kind of wrong.
 *
 * The separator tests are spelled out rather than left to `basename`, which is
 * platform-specific — a backslash is a legal filename character on POSIX, so a
 * test run anywhere but Windows would otherwise be checking a weaker rule than
 * the one that ships. `.` and `..` are named because they are the two values
 * that need no separator to escape.
 *
 * This lived here already, guarding the baselines directory alone under the
 * name `safeBaselineName`. The presets half — the one reachable from IPC — was
 * the half it never covered.
 */
export const safePresetFileName = (presetName: string): string | undefined =>
  presetName &&
  !presetName.includes('/') &&
  !presetName.includes('\\') &&
  presetName === path.basename(presetName) &&
  presetName !== '.' &&
  presetName !== '..'
    ? presetName
    : undefined;

/**
 * The path a profile is allowed to occupy, or an exception.
 *
 * Throwing is the point. Every caller already sits inside a `try` that reports
 * a preset file error, so a refused name surfaces to the user as a save that
 * did not happen — which is the truth — instead of a save that landed somewhere
 * they will never find it.
 */
const presetFilePath = (presetsDir: string, presetName: string) => {
  const safeName = safePresetFileName(presetName);
  if (!safeName) {
    throw new Error(
      `Refused a profile name that is not a plain file name: ${presetName}`,
    );
  }
  return path.join(presetsDir, safeName);
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const toFiniteNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

const normalizeFilter = (
  filter: unknown,
  fallbackId: string,
): IFilter | undefined => {
  if (!isObject(filter)) {
    return undefined;
  }
  const rawId = filter.id;
  const id = typeof rawId === 'string' && rawId.trim() ? rawId : fallbackId;
  const frequency = toFiniteNumber(filter.frequency);
  const gain = toFiniteNumber(filter.gain);
  const quality = toFiniteNumber(filter.quality);
  const { type } = filter;
  if (
    typeof id !== 'string' ||
    id.trim() === '' ||
    typeof frequency !== 'number' ||
    typeof gain !== 'number' ||
    typeof quality !== 'number' ||
    !Object.values(FilterTypeEnum).includes(type as FilterTypeEnum)
  ) {
    return undefined;
  }
  return {
    id,
    frequency,
    gain: clampGain(gain),
    quality: clampQuality(quality),
    type: type as FilterTypeEnum,
  };
};

const normalizeFilters = (filters: IFiltersMap | unknown): IFiltersMap =>
  isObject(filters)
    ? Object.fromEntries(
        Object.entries(filters)
          .map(([id, filter]) => {
            const normalized = normalizeFilter(filter, id);
            return normalized ? [normalized.id, normalized] : undefined;
          })
          .filter((entry): entry is [string, IFilter] => Boolean(entry)),
      )
    : {};

// The persisted convolution profile comes from disk, so validate its required
// fields instead of asserting the shape. A malformed entry is dropped rather
// than handed to the APO writer as a half-built profile.
const normalizeConvolution = (
  value: unknown,
): IConvolutionProfile | undefined => {
  if (!isObject(value) || typeof value.name !== 'string' || !value.name) {
    return undefined;
  }
  const filters = normalizeFilters(value.filters);
  const optionalString = (input: unknown) =>
    typeof input === 'string' && input ? input : undefined;
  const response = Array.isArray(value.response)
    ? value.response
        .map((point) => {
          if (!isObject(point)) {
            return undefined;
          }
          const frequency = toFiniteNumber(point.frequency);
          const gain = toFiniteNumber(point.gain);
          return frequency !== undefined && frequency > 0 && gain !== undefined
            ? { frequency, gain }
            : undefined;
        })
        .filter((point): point is IGraphicEqPoint => point !== undefined)
    : undefined;
  const peakGainDb = toFiniteNumber(value.peakGainDb);

  return {
    name: value.name,
    filters,
    fileName: optionalString(value.fileName),
    ...(response?.length ? { response } : {}),
    ...(peakGainDb !== undefined ? { peakGainDb } : {}),
    sourceUrl: optionalString(value.sourceUrl),
    sourceId: optionalString(value.sourceId),
  };
};

/**
 * A voicing or driver selection off disk.
 *
 * Both are `{profileId, intensity}` and both are validated the same way: an
 * unknown profile id is harmless because the layer lookup returns nothing for
 * it, but an intensity that is not a number would be scaled into every gain.
 */
const normalizeApoOverride = (
  value: unknown,
): IApoLayerOverride | undefined => {
  if (!isObject(value)) {
    return undefined;
  }
  const filters = normalizeFilters(value.filters);
  const graphicEq = Array.isArray(value.graphicEq)
    ? value.graphicEq
        .map((point) => {
          if (!isObject(point)) {
            return undefined;
          }
          const frequency = toFiniteNumber(point.frequency);
          const gain = toFiniteNumber(point.gain);
          return frequency !== undefined && gain !== undefined
            ? { frequency, gain }
            : undefined;
        })
        .filter((point): point is IGraphicEqPoint => point !== undefined)
    : undefined;
  return Object.keys(filters).length || graphicEq?.length
    ? { filters, ...(graphicEq?.length ? { graphicEq } : {}) }
    : undefined;
};

const normalizeLayerSelection = (value: unknown) => {
  if (!isObject(value) || typeof value.profileId !== 'string') {
    return undefined;
  }
  const intensity = toFiniteNumber(value.intensity);
  const apoOverride = normalizeApoOverride(value.apoOverride);
  return {
    profileId: value.profileId,
    intensity:
      intensity === undefined ? 1 : Math.min(1, Math.max(0, intensity)),
    ...(apoOverride ? { apoOverride } : {}),
  };
};

/**
 * The list of switched-off layers, off disk.
 *
 * Anything that is not a feature name is dropped rather than carried through.
 * An unrecognised entry can only come from a hand edit or a newer FluidEQ, and
 * a layer that is off for a reason nothing in this build understands is one
 * nobody can switch back on. Filtering through APO_FEATURES also settles order
 * and duplicates, so two equivalent lists compare equal.
 */
const normalizeBypassed = (value: unknown): TApoLayer[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const layers = APO_LAYERS.filter((layer) => value.includes(layer));
  return layers.length ? [...layers] : undefined;
};

const normalizeGraphicEq = (points: IGraphicEqPoint[] | undefined) =>
  Array.isArray(points)
    ? points.filter(
        ({ frequency, gain }) =>
          Number.isFinite(frequency) && Number.isFinite(gain),
      )
    : undefined;

export const fetchSettings = (settingsDir: string) => {
  const settingsPath = path.join(settingsDir, LOCAL_STATE_FILENAME);
  const fallbackState = getDefaultState();

  const isValidEqFormat = (input: unknown): input is AutoEqFormat =>
    input === AutoEqFormat.PARAMETRIC ||
    input === AutoEqFormat.FIXED_BAND ||
    input === AutoEqFormat.GRAPHIC;

  const normalizeState = (input: unknown): IState | undefined => {
    if (!isObject(input)) {
      return undefined;
    }
    const filters = normalizeFilters(input.filters);
    if (!Object.keys(filters).length) {
      return undefined;
    }

    const bypassed = normalizeBypassed(input.bypassed);
    const convolution = normalizeConvolution(input.convolution);
    // The recovery path rebuilds the state field by field, so a layer it does
    // not mention is silently thrown away — which is what used to happen to the
    // voicing and the driver every time a state file failed validation. Losing
    // a measured Smart EQ correction the same way would be worse: unlike the
    // other two it cannot be picked again from a list, only re-measured.
    const voicing = normalizeLayerSelection(input.voicing);
    const driver = normalizeLayerSelection(input.driver);
    const smartEq = sanitizeSmartEqSettings(input.smartEq);

    return {
      ...fallbackState,
      isEnabled:
        typeof input.isEnabled === 'boolean'
          ? input.isEnabled
          : fallbackState.isEnabled,
      isAutoPreAmpOn:
        typeof input.isAutoPreAmpOn === 'boolean'
          ? input.isAutoPreAmpOn
          : fallbackState.isAutoPreAmpOn,
      isSmartHeadroomOn:
        typeof input.isSmartHeadroomOn === 'boolean'
          ? input.isSmartHeadroomOn
          : fallbackState.isSmartHeadroomOn,
      isGraphViewOn:
        typeof input.isGraphViewOn === 'boolean'
          ? input.isGraphViewOn
          : fallbackState.isGraphViewOn,
      isCaseSensitiveFs: false,
      preAmp: (() => {
        const preAmp = toFiniteNumber(input.preAmp);
        return preAmp === undefined ? fallbackState.preAmp : clampGain(preAmp);
      })(),
      filters,
      ...(isValidEqFormat(input.eqFormat) ? { eqFormat: input.eqFormat } : {}),
      ...(Array.isArray(input.graphicEq)
        ? { graphicEq: normalizeGraphicEq(input.graphicEq) }
        : {}),
      ...(typeof input.isFlat === 'boolean' ? { isFlat: input.isFlat } : {}),
      ...(convolution ? { convolution } : {}),
      ...(voicing ? { voicing } : {}),
      ...(driver ? { driver } : {}),
      ...(smartEq ? { smartEq } : {}),
      ...(bypassed ? { bypassed } : {}),
    } as IState;
  };

  try {
    const content = fs.readFileSync(settingsPath, {
      encoding: 'utf8',
    });
    const input = JSON.parse(content);
    if (!validateState(input)) {
      const recovered = normalizeState(input);
      if (recovered && validateState(recovered)) {
        try {
          fs.writeFileSync(settingsPath, serializeState(recovered), {
            encoding: 'utf8',
          });
        } catch {
          // Ignore write failure and continue with recovered state in memory.
        }
        return recovered;
      }
      throw new Error('Invalid state file loaded. Using default state.');
    }
    const bypassed = normalizeBypassed(input.bypassed);
    // Manually set case sensitivity as false until it is confirmed in app that it can be enabled
    return {
      ...input,
      preAmp: clampGain(input.preAmp),
      filters: normalizeFilters(input.filters),
      ...(Array.isArray(input.graphicEq)
        ? { graphicEq: normalizeGraphicEq(input.graphicEq) }
        : {}),
      // Sanitised where the file had one and left absent where it did not, so
      // a state that never switched anything off is the object it always was.
      ...(isObject(input) && 'bypassed' in input ? { bypassed } : {}),
      isCaseSensitiveFs: false,
    } as IState;
  } catch (ex) {
    if ((ex as NodeJS.ErrnoException).code !== 'ENOENT') {
      log.error(
        `Unable to load saved ${PRODUCT_NAME} state; using defaults.`,
        ex,
      );
    }
    // if unable to fetch the state, use a default one
    return getDefaultState();
  }
};

export const save = (state: IState, settingsDir: string) => {
  const settingsPath = path.join(settingsDir, LOCAL_STATE_FILENAME);
  try {
    fs.writeFileSync(settingsPath, serializeState(state), {
      encoding: 'utf8',
    });
  } catch (ex) {
    log.error(`Failed to save to ${settingsPath}`);
    throw ex;
  }
};

export const fetchPreset = (presetName: string, presetsDir: string) => {
  try {
    const presetPath = presetFilePath(presetsDir, presetName);
    const content = fs.readFileSync(presetPath, {
      encoding: 'utf8',
    });
    const json = JSON.parse(content);
    if (validatePresetV1(json)) {
      const oldFormat = json as IPresetV1;
      const newFormat: IPresetV2 = {
        preAmp: clampGain(oldFormat.preAmp),
        filters: {},
      };
      oldFormat.filters.forEach((filter) => {
        // Its okay to shallow copy the filter because we won't give oldFormat to anyone else.
        newFormat.filters[filter.id] = {
          ...filter,
          gain: clampGain(filter.gain),
          quality: clampQuality(filter.quality),
        };
      });
      try {
        // Try to update our file.
        savePreset(presetName, newFormat, presetsDir);
      } catch {
        // Ignore failed updates.
      }
      return newFormat;
    }
    if (!validatePresetV2(json)) {
      throw new Error('Invalid preset file');
    }
    const preset = json as IPresetV2;
    const graphicEq = normalizeGraphicEq(preset.graphicEq);
    const bypassed = normalizeBypassed(preset.bypassed);
    return {
      ...preset,
      preAmp: clampGain(preset.preAmp),
      filters: normalizeFilters(preset.filters),
      ...(graphicEq ? { graphicEq } : {}),
      ...('bypassed' in preset ? { bypassed } : {}),
    };
  } catch (ex) {
    log.error('Failed to get presets!!');
    log.error(ex);
    throw ex;
  }
};

/**
 * Throttled preset-write logging.
 *
 * Auto-save writes the attached profile on every edit, so logging each one
 * turned a single slider drag into hundreds of identical lines — noise that
 * buries anything useful and costs main-process time in the middle of an
 * interaction. One line per profile per second is enough to see it working.
 */
const lastPresetLogAt = new Map<string, number>();
const PRESET_LOG_INTERVAL_MS = 1000;

const logPresetWrite = (presetName: string) => {
  const now = Date.now();
  const previous = lastPresetLogAt.get(presetName) ?? 0;
  if (now - previous < PRESET_LOG_INTERVAL_MS) {
    return;
  }
  lastPresetLogAt.set(presetName, now);
  log.info(`Wrote preset for: ${presetName}`);
};

export const savePreset = (
  presetName: string,
  presetInfo: IPresetV2,
  presetsDir: string,
) => {
  try {
    const presetPath = presetFilePath(presetsDir, presetName);
    fs.writeFileSync(presetPath, serializePreset(presetInfo), {
      encoding: 'utf8',
    });
  } catch (ex) {
    log.error('Failed to save to preset %s', presetName);
    throw ex;
  }
  logPresetWrite(presetName);
};

/**
 * Directory holding the last *manually* saved copy of each profile.
 *
 * It sits outside the presets directory on purpose: every edit auto-saves over
 * the live profile, so without a second copy there is nothing to go back to.
 * Keeping it out of `presets/` also means these never show up in the profile
 * catalogue, which lists that directory verbatim.
 */
export const PRESET_BASELINES_DIR = 'preset-baselines';

export const savePresetBaseline = (
  presetName: string,
  presetInfo: IPresetV2,
  baselineDir: string,
) => {
  const safeName = safePresetFileName(presetName);
  if (!safeName) {
    return;
  }
  try {
    fs.mkdirSync(baselineDir, { recursive: true });
    fs.writeFileSync(
      path.join(baselineDir, safeName),
      serializePreset(presetInfo),
      { encoding: 'utf8' },
    );
  } catch (ex) {
    // A missing baseline costs the user an undo, not their tuning. Never let
    // it fail the save that triggered it.
    log.error(`Failed to write the baseline for ${presetName}`);
  }
};

/** The last manually saved copy, or undefined when there is nothing to go back to. */
export const fetchPresetBaseline = (
  presetName: string,
  baselineDir: string,
): IPresetV2 | undefined => {
  const safeName = safePresetFileName(presetName);
  if (!safeName) {
    return undefined;
  }
  try {
    const json = JSON.parse(
      fs.readFileSync(path.join(baselineDir, safeName), { encoding: 'utf8' }),
    );
    if (!validatePresetV2(json)) {
      return undefined;
    }
    const preset = json as IPresetV2;
    const graphicEq = normalizeGraphicEq(preset.graphicEq);
    return {
      ...preset,
      preAmp: clampGain(preset.preAmp),
      filters: normalizeFilters(preset.filters),
      ...(graphicEq ? { graphicEq } : {}),
    };
  } catch {
    return undefined;
  }
};

export const hasPresetBaseline = (presetName: string, baselineDir: string) => {
  const safeName = safePresetFileName(presetName);
  return safeName ? fs.existsSync(path.join(baselineDir, safeName)) : false;
};

export const deletePresetBaseline = (
  presetName: string,
  baselineDir: string,
) => {
  const safeName = safePresetFileName(presetName);
  if (!safeName) {
    return;
  }
  try {
    fs.unlinkSync(path.join(baselineDir, safeName));
  } catch {
    // Nothing to remove is the normal case for a profile never saved by hand.
  }
};

export const renamePresetBaseline = (
  oldName: string,
  newName: string,
  baselineDir: string,
) => {
  const safeOld = safePresetFileName(oldName);
  const safeNew = safePresetFileName(newName);
  if (!safeOld || !safeNew) {
    return;
  }
  try {
    fs.renameSync(
      path.join(baselineDir, safeOld),
      path.join(baselineDir, safeNew),
    );
  } catch {
    // The profile may never have been saved by hand; that is not an error.
  }
};

/**
 * Undo makeup gain that a device never asked for.
 *
 * Preamp exists to reserve headroom for boosts. A profile whose EQ is cleared
 * has no boosts, so a non-zero preamp on it is not a setting — it is a leftover
 * from when switching outputs carried the previous device's state across and
 * auto-save then wrote it down. The audible result is an output that is quietly
 * several dB down for no reason.
 *
 * Deliberately limited to automatic profiles. Those are created and maintained
 * by FluidEQ, so correcting them cannot throw away a decision anybody made; a
 * profile the user named and saved is left exactly as they left it, even if it
 * looks odd.
 *
 * Returns the names it repaired, so startup can say what it did.
 */
export const repairUnusedPreamps = (presetsDir: string): string[] => {
  const repaired: string[] = [];

  let fileNames: string[];
  try {
    fileNames = fs.readdirSync(presetsDir);
  } catch {
    return repaired;
  }

  fileNames
    .filter((fileName) => fileName.startsWith(AUTOMATIC_PRESET_PREFIX))
    .forEach((fileName) => {
      const presetPath = path.join(presetsDir, fileName);
      try {
        const preset = JSON.parse(fs.readFileSync(presetPath, 'utf8'));
        // Only the unambiguous case: nothing is being boosted, yet the profile
        // still carries gain.
        //
        // isAutoPreAmpOn === false is exactly the flag that says "this number
        // is the user's", so a profile carrying it is off limits however odd
        // the value looks. A cleared EQ can still boost, too — the voicing,
        // driver and Smart EQ layers are all written outside the isFlat check —
        // so a manual preamp on a flat profile is not necessarily leftover at
        // all.
        if (
          preset?.isFlat !== true ||
          !preset.preAmp ||
          preset.isAutoPreAmpOn === false
        ) {
          return;
        }
        fs.writeFileSync(
          presetPath,
          JSON.stringify({ ...preset, preAmp: 0 }),
          'utf8',
        );
        repaired.push(fileName);
      } catch {
        // A profile we cannot read is one we must not rewrite.
      }
    });

  return repaired;
};

export const deletePreset = (presetName: string, presetsDir: string) => {
  try {
    const presetPath = presetFilePath(presetsDir, presetName);
    fs.unlinkSync(presetPath);
  } catch (ex) {
    log.error('Failed to delete preset');
    throw ex;
  }
  log.info(`Deleted preset: ${presetName}`);
};

export const doesPresetExist = (presetName: string, presetsDir: string) => {
  // The one that answers rather than throws. A name that cannot name a profile
  // is a name no profile is stored under, and the callers are asking whether it
  // is taken — "no" is both true and the answer that keeps them working.
  const safeName = safePresetFileName(presetName);
  if (!safeName) {
    return false;
  }
  const testPath = addFileToPath(presetsDir, safeName);
  try {
    return fs.existsSync(testPath);
  } catch (ex) {
    log.error('Failed to check whether preset %s exists', presetName);
    throw ex;
  }
};

export const renamePreset = (
  oldName: string,
  newName: string,
  presetsDir: string,
) => {
  // Both ends checked. A rename is a read and a write, and the destination is
  // the one an attacker would choose.
  const oldPath = presetFilePath(presetsDir, oldName);
  const newPath = presetFilePath(presetsDir, newName);
  try {
    fs.renameSync(oldPath, newPath);
  } catch (ex) {
    log.error('Failed to rename preset %s to preset %s', oldName, newName);
    throw ex;
  }
};

export const checkConfigFile = (configDirPath: string) => {
  const configPath = addFileToPath(configDirPath, CONFIG_FILENAME);
  try {
    const content = fs.readFileSync(configPath, {
      encoding: 'utf8',
    });
    return content
      .split(/\r?\n/)
      .some((line) => line.trim() === CONFIG_CONTENT);
  } catch (ex) {
    throw new Error(`Unable to locate config file at ${configPath}`);
  }
};

export const updateConfig = (configDirPath: string) => {
  const configPath = addFileToPath(configDirPath, CONFIG_FILENAME);
  try {
    const existing = fs.existsSync(configPath)
      ? fs.readFileSync(configPath, 'utf8')
      : '';
    const normalized = existing
      .split(/\r?\n/)
      .filter(
        (line) =>
          !LEGACY_CONFIG_CONTENT.test(line) &&
          !/^\s*Include:\s*fluideq\.txt\s*$/i.test(line),
      )
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trimEnd();
    fs.writeFileSync(configPath, `${normalized}\n${CONFIG_CONTENT}\n`, {
      encoding: 'utf8',
    });
  } catch (ex) {
    throw new Error(`Unable to locate config file at ${configPath}`);
  }
};

export * from './apoRender';
