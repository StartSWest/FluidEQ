/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>

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
import {
  AutoEqFormat,
  FilterTypeEnum,
  clampFrequency,
  clampGain,
  clampQuality,
  IFilter,
  getDefaultState,
  IConvolutionProfile,
  IFiltersMap,
  IGraphicEqPoint,
  IPresetV1,
  IPresetV2,
  IState,
  NO_GAIN_FILTER_TYPES,
  AUTOMATIC_PRESET_PREFIX,
} from '../common/constants';
import { getVoicingFilters } from '../common/voicing';
import { getDriverFilters } from '../common/driver';
import { getChainPeakGain } from '../common/response';
import {
  validatePresetV1,
  validatePresetV2,
  validateState,
} from '../common/validator';

/**
 * Whether a band can be written as a filter Equalizer APO can actually build.
 *
 * A NaN or Infinity anywhere in a band survives every numeric clamp and lands
 * in the config as text APO cannot parse into biquad coefficients. Dropping
 * the band costs one filter; writing it can take out the whole chain.
 */
const isRenderableFilter = ({
  frequency,
  gain,
  quality,
}: {
  frequency: number;
  gain: number;
  quality: number;
}) =>
  Number.isFinite(frequency) &&
  Number.isFinite(gain) &&
  Number.isFinite(quality);

/**
 * The single preamp value for a chain, in dB.
 *
 * Auto normalize reserves exactly the headroom the written filters need and
 * no more. Deriving it from the filters themselves — rather than trusting a
 * number computed elsewhere and saved — is what makes it self-correcting: the
 * response graph only recalculates while it is mounted, so a voicing or driver
 * change made on another tab used to leave the preamp describing a chain that
 * was no longer there.
 */
const resolvePreAmp = (
  state: IState,
  writtenFilters: Array<
    Pick<IFilter, 'type' | 'frequency' | 'gain' | 'quality'>
  >,
  hasConvolution: boolean,
) => {
  if (!state.isAutoPreAmpOn) {
    return state.preAmp;
  }

  // Everything that boosts has to be counted, not just the parametric bands.
  //
  // A GraphicEQ profile writes no Filter lines at all, and a convolution is a
  // single Convolution line rather than a filter list — so a chain built from
  // either contributes nothing to `writtenFilters` and would reserve no
  // headroom whatsoever. A +9 dB graphic curve would then be handed to APO
  // with Preamp: 0 dB and clip.
  const graphicPeak =
    state.eqFormat === AutoEqFormat.GRAPHIC && state.graphicEq?.length
      ? state.graphicEq.reduce(
          (highest, { gain }) =>
            Number.isFinite(gain) ? Math.max(highest, gain) : highest,
          0,
        )
      : 0;

  // The convolution's own response, which is described by its filter set.
  const convolutionPeak =
    hasConvolution && state.convolution
      ? getChainPeakGain(Object.values(state.convolution.filters || {}))
      : 0;

  const filterPeak = getChainPeakGain(writtenFilters);

  // Cuts need no headroom, so a chain that only cuts reserves nothing. The
  // stages are in series, so their boosts genuinely add.
  return -Math.max(0, filterPeak + graphicPeak + convolutionPeak);
};

export const stateToString = (
  state: IState,
  convolutionFileName?: string,
  devicePattern = 'all',
) => {
  if (!state.isEnabled) {
    return '';
  }

  let output: string[] = [];

  output.push(`Device: ${devicePattern}`);
  output.push('Channel: all');

  if (state.convolution && convolutionFileName) {
    output.push(`Convolution: ${convolutionFileName}`);
  }

  // APO numbers filters globally, so the EQ bands and the voicing layer share
  // one counter.
  let filterIndex = 0;
  // Everything actually emitted, so the preamp below can be sized from the real
  // chain rather than from whatever the UI last happened to compute.
  const writtenFilters: Array<
    Pick<IFilter, 'type' | 'frequency' | 'gain' | 'quality'>
  > = [];

  if (!state.isFlat) {
    if (state.eqFormat === AutoEqFormat.GRAPHIC && state.graphicEq?.length) {
      const points = state.graphicEq
        .filter(
          ({ frequency, gain }) =>
            Number.isFinite(frequency) && Number.isFinite(gain),
        )
        .map(({ frequency, gain }) => `${frequency} ${clampGain(gain)}`)
        .join('; ');
      if (points) {
        output.push(`GraphicEQ: ${points}`);
      }
    } else {
      // A zero-gain PK/shelf is neutral. Do not leave inert EQ commands in APO
      // after the user presses Reset gains.
      output = output.concat(
        Object.values(state.filters)
          // Last line of defence before Equalizer APO. A band whose numbers are
          // not finite — a malformed import, a corrupt preset — cannot be
          // rendered as a filter APO can build, so it is dropped rather than
          // written out as `Fc NaN Hz` and left for APO to choke on.
          .filter(isRenderableFilter)
          .filter(
            ({ gain, type }) =>
              ![
                FilterTypeEnum.PK,
                FilterTypeEnum.LSC,
                FilterTypeEnum.HSC,
              ].includes(type) || clampGain(gain) !== 0,
          )
          .map(({ frequency, gain, type, quality }) => {
            filterIndex += 1;
            writtenFilters.push({ type, frequency, gain, quality });
            const head = `Filter ${filterIndex}: ON ${type} Fc ${clampFrequency(
              frequency,
            )} Hz`;
            // Band pass, notch, low pass and high pass have no Gain parameter
            // in Equalizer APO's ParametricEQ grammar — the token only belongs
            // to the peaking and shelf forms. Emitting it for the others makes
            // APO reject the line, so the band silently did nothing.
            return NO_GAIN_FILTER_TYPES.includes(type)
              ? `${head} Q ${clampQuality(quality)}`
              : `${head} Gain ${clampGain(gain)} dB Q ${clampQuality(quality)}`;
          }),
      );
    }
  }

  // The voicing is its own layer, written after the user's bands and numbered
  // straight on from them (APO requires unique, ordered filter indices). It is
  // deliberately outside the isFlat check: clearing the EQ resets the bands the
  // user tuned, not the target curve they chose, and switching the voicing off
  // restores their tuning untouched.
  output = output.concat(
    getVoicingFilters(state.voicing)
      .filter(isRenderableFilter)
      .map(({ frequency, gain, type, quality }) => {
        filterIndex += 1;
        writtenFilters.push({ type, frequency, gain, quality });
        const head = `Filter ${filterIndex}: ON ${type} Fc ${clampFrequency(
          frequency,
        )} Hz`;
        return NO_GAIN_FILTER_TYPES.includes(type)
          ? `${head} Q ${clampQuality(quality)}`
          : `${head} Gain ${clampGain(gain)} dB Q ${clampQuality(quality)}`;
      }),
  );

  // Driver compensation is its own layer after the voicing, numbered straight
  // on from it. Same reasoning as the voicing layer: it corrects what the user
  // is listening ON, not what they tuned, so clearing the EQ leaves it alone.
  output = output.concat(
    getDriverFilters(state.driver)
      .filter(isRenderableFilter)
      .map(({ frequency, gain, type, quality }) => {
        filterIndex += 1;
        writtenFilters.push({ type, frequency, gain, quality });
        const head = `Filter ${filterIndex}: ON ${type} Fc ${clampFrequency(
          frequency,
        )} Hz`;
        return NO_GAIN_FILTER_TYPES.includes(type)
          ? `${head} Q ${clampQuality(quality)}`
          : `${head} Gain ${clampGain(gain)} dB Q ${clampQuality(quality)}`;
      }),
  );

  // Equalizer APO applies rules in order: convolution, EQ bands, then gain.
  // This line MUST be "Preamp" without a capitalized P for APO to work.
  //
  // One preamp for the whole chain, and its value is derived here rather than
  // stored. Every layer above shares it, so it has to cancel the peak of all of
  // them combined — and because it is recomputed from what was just written,
  // removing a layer gives its headroom straight back instead of leaving the
  // output quietly attenuated for a boost that no longer exists.
  //
  // Only when Auto normalize is on. With it off the preamp is the user's own
  // setting and nothing may touch it.
  output.push(
    `Preamp: ${clampGain(
      resolvePreAmp(
        state,
        writtenFilters,
        Boolean(state.convolution && convolutionFileName),
      ),
    )} dB`,
  );

  return output.join('\n\r');
};

export const serializeState = (state: IState) => {
  return JSON.stringify(state);
};

export const serializePreset = (preset: IPresetV2) => {
  return JSON.stringify(preset);
};

const CONFIG_CONTENT = 'Include: fluideq.txt';
const LEGACY_CONFIG_CONTENT = /^\s*Include:\s*aqua\.txt\s*$/i;
const AQUA_LOCAL_CONFIG_FILENAME = 'state.txt';
export const FLUIDEQ_CONFIG_FILENAME = 'fluideq.txt';
// Kept as an API alias for older tests and integrations; the generated file is FluidEQ-owned.
export const AQUA_CONFIG_FILENAME = FLUIDEQ_CONFIG_FILENAME;
const CONFIG_FILENAME = 'config.txt';
export const PRESETS_DIR = 'presets';

export const addFileToPath = (pathPrefix: string, fileName: string) => {
  return path.join(pathPrefix, fileName);
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

  return {
    name: value.name,
    filters,
    fileName: optionalString(value.fileName),
    sourceUrl: optionalString(value.sourceUrl),
    sourceId: optionalString(value.sourceId),
  };
};

const normalizeGraphicEq = (points: IGraphicEqPoint[] | undefined) =>
  Array.isArray(points)
    ? points.filter(
        ({ frequency, gain }) =>
          Number.isFinite(frequency) && Number.isFinite(gain),
      )
    : undefined;

export const fetchSettings = (settingsDir: string) => {
  const settingsPath = path.join(settingsDir, AQUA_LOCAL_CONFIG_FILENAME);
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

    const convolution = normalizeConvolution(input.convolution);

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
    // Manually set case sensitivity as false until it is confirmed in app that it can be enabled
    return {
      ...input,
      preAmp: clampGain(input.preAmp),
      filters: normalizeFilters(input.filters),
      ...(Array.isArray(input.graphicEq)
        ? { graphicEq: normalizeGraphicEq(input.graphicEq) }
        : {}),
      isCaseSensitiveFs: false,
    } as IState;
  } catch (ex) {
    if ((ex as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.error('Unable to load saved FluidEQ state; using defaults.', ex);
    }
    // if unable to fetch the state, use a default one
    return getDefaultState();
  }
};

export const save = (state: IState, settingsDir: string) => {
  const settingsPath = path.join(settingsDir, AQUA_LOCAL_CONFIG_FILENAME);
  try {
    fs.writeFileSync(settingsPath, serializeState(state), {
      encoding: 'utf8',
    });
  } catch (ex) {
    console.log(`Failed to save to ${settingsPath}`);
    throw ex;
  }
};

export const fetchPreset = (presetName: string, presetsDir: string) => {
  try {
    const presetPath = path.join(presetsDir, presetName);
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
    return {
      ...preset,
      preAmp: clampGain(preset.preAmp),
      filters: normalizeFilters(preset.filters),
      ...(graphicEq ? { graphicEq } : {}),
    };
  } catch (ex) {
    console.log('Failed to get presets!!');
    console.log(ex);
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
  console.log(`Wrote preset for: ${presetName}`);
};

export const savePreset = (
  presetName: string,
  presetInfo: IPresetV2,
  presetsDir: string,
) => {
  try {
    const presetPath = path.join(presetsDir, presetName);
    fs.writeFileSync(presetPath, serializePreset(presetInfo), {
      encoding: 'utf8',
    });
  } catch (ex) {
    console.log('Failed to save to preset %d', presetName);
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

/**
 * Profile names come from user input and are used as filenames. A name that
 * escapes its directory is refused rather than sanitised, so a rejected write
 * can never land somewhere unexpected.
 */
const safeBaselineName = (presetName: string) =>
  presetName &&
  presetName === path.basename(presetName) &&
  !presetName.includes('..')
    ? presetName
    : undefined;

export const savePresetBaseline = (
  presetName: string,
  presetInfo: IPresetV2,
  baselineDir: string,
) => {
  const safeName = safeBaselineName(presetName);
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
    console.log(`Failed to write the baseline for ${presetName}`);
  }
};

/** The last manually saved copy, or undefined when there is nothing to go back to. */
export const fetchPresetBaseline = (
  presetName: string,
  baselineDir: string,
): IPresetV2 | undefined => {
  const safeName = safeBaselineName(presetName);
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
  const safeName = safeBaselineName(presetName);
  return safeName ? fs.existsSync(path.join(baselineDir, safeName)) : false;
};

export const deletePresetBaseline = (
  presetName: string,
  baselineDir: string,
) => {
  const safeName = safeBaselineName(presetName);
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
  const safeOld = safeBaselineName(oldName);
  const safeNew = safeBaselineName(newName);
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
        if (preset?.isFlat !== true || !preset.preAmp) {
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
    const presetPath = path.join(presetsDir, presetName);
    fs.unlinkSync(presetPath);
  } catch (ex) {
    console.log('Failed to delete preset');
    throw ex;
  }
  console.log(`Deleted preset: ${presetName}`);
};

export const doesPresetExist = (presetName: string, presetsDir: string) => {
  const testPath = addFileToPath(presetsDir, presetName);
  try {
    return fs.existsSync(testPath);
  } catch (ex) {
    console.log('Failed to check whether preset %d exists', presetName);
    throw ex;
  }
};

export const renamePreset = (
  oldName: string,
  newName: string,
  presetsDir: string,
) => {
  const oldPath = addFileToPath(presetsDir, oldName);
  const newPath = addFileToPath(presetsDir, newName);
  try {
    fs.renameSync(oldPath, newPath);
  } catch (ex) {
    console.log('Failed to rename preset %d to preset %d', oldName, newName);
    throw ex;
  }
};

export const flush = (state: IState, configDirPath: string) => {
  const configPath = addFileToPath(configDirPath, FLUIDEQ_CONFIG_FILENAME);
  try {
    fs.writeFileSync(configPath, stateToString(state), {
      encoding: 'utf8',
    });
  } catch (ex) {
    console.log(`Failed to flush to ${configPath}`);
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
