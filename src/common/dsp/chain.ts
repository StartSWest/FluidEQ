/*
<FluidEQ: System-wide parametric audio equalizer interface>
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

import { clampCrossfadeShape } from './crossfadeShape';

import { isTrebleDesign } from '../filterDesign';

import {
  CROSSFADE_CURVES,
  DENOISE_HUM_MODES,
  DENOISE_PROFILE_SOURCES,
  EXCITER_MIN_OCTAVES,
  EXCITER_OCTAVE_SPAN,
  IExciterBandSettings,
  NORMALIZER_MODES,
  TCrossfadeCurve,
  TDenoiseHumMode,
  TDenoiseProfileSource,
  TNormalizerMode,
  constrainExciterBandPosition,
} from './chainStageSettings';
import {
  EQ_ENGINES,
  EQ_MAX_BAND_COUNT,
  EQ_MODELS,
  EQ_PHASE_MODES,
  EQ_STEREO_MODES,
  IDspSettings,
  IEqBandSettings,
  IRange,
  OVERSAMPLE_FACTORS,
  ROOM_HEADS,
  ROOM_PRESETS,
  TEqEngine,
  TEqModel,
  TEqPhase,
  TEqStereo,
} from './chainSettings';
import {
  DSP_DEFAULTS,
  RANGES,
  clampBoolean,
  clampNumber,
  isRecord,
} from './chainDefaults';

// The rack's settings, stage by stage, and its defaults live in the modules
// beside this one; this module stays the one name the app reads them from.
export { DSP_DEFAULTS, EQ_RACK_SIZES, buildEqRack } from './chainDefaults';
export {
  EQ_BAND_COUNT,
  EQ_ENGINES,
  EQ_MAX_BAND_COUNT,
  EQ_MODELS,
  EQ_PHASE_MODES,
  EQ_STEREO_MODES,
  MASTER_LOUDNESS_GAIN_MAX_DB,
  MASTER_LOUDNESS_GAIN_MIN_DB,
  OVERSAMPLE_FACTORS,
  ROOM_HEADS,
  ROOM_PRESETS,
  ROOM_SPEAKERS,
  eqEdited,
} from './chainSettings';
export type {
  IDspSettings,
  IEqBandSettings,
  IEqSettings,
  IMasterSettings,
  IRoomSettings,
  ISurroundSettings,
  TEqEngine,
  TEqModel,
  TEqPhase,
  TEqStereo,
  TRoomHead,
  TRoomPreset,
} from './chainSettings';
export {
  CROSSFADE_CURVES,
  DENOISE_HUM_MODES,
  DENOISE_PROFILE_SOURCES,
  DENOISE_VOICE_MODES,
  EXCITER_BAND_LIMITS,
  EXCITER_MIN_OCTAVES,
  EXCITER_OCTAVE_SPAN,
  MAXIMIZER_MAX_CEILING_DB,
  MAXIMIZER_MAX_LOOK_AHEAD_MS,
  MAXIMIZER_MIN_LOOK_AHEAD_MS,
  MAXIMIZER_MIN_RELEASE_MS,
  NORMALIZER_MODES,
  constrainExciterBandPosition,
  exciterBandEdges,
  exciterBandEdgesForIndex,
  maximumExciterBandRangeAtFrequency,
  organicBandEdges,
  organicRangeQ,
} from './chainStageSettings';
export type {
  IBassForgeSettings,
  IBassPunchSettings,
  ICrossfadeSettings,
  IDenoiseClickSettings,
  IDenoiseHissSettings,
  IDenoiseHumSettings,
  IDenoiseSettings,
  IDenoiseVoiceSettings,
  IDimensionSettings,
  IExciterBandSettings,
  IExciterSettings,
  IInputNormalizerSettings,
  IMaximizerSettings,
  IOrganicSettings,
  IPhaseAlignSettings,
  TCrossfadeCurve,
  TDenoiseHumMode,
  TDenoiseProfileSource,
  TDenoiseVoiceMode,
  TNormalizerMode,
} from './chainStageSettings';

/**
 * What the DSP chain is, as data.
 *
 * Declarative because two very different things build from it: the live
 * `AudioContext` graph the player hears, and the `OfflineAudioContext` that
 * renders a file. A single shape both of them read is the only thing that
 * keeps those two from drifting apart, and a drift there is silent — the
 * exported file simply does not sound like what was auditioned.
 *
 * None of this reaches Equalizer APO, and it cannot. Every APO command is
 * linear, and neither compression nor a generated harmonic is. That is the
 * reason this module exists rather than another layer in `apoRender.ts`.
 *
 * Everything defaults to bypassed. A DSP tab that colours the sound the
 * moment it is opened is one the user did not ask for.
 */

/*
 * Q for a rack whose bands sit a given distance apart lives in
 * `../bandQuality`, because the main equaliser's layouts and its Add band
 * answer the same question and must answer it the same way.
 */

const clampExciterBand = (
  value: unknown,
  fallback: IExciterBandSettings,
  bandIndex: number,
): IExciterBandSettings => {
  if (!isRecord(value)) {
    return fallback;
  }
  const band = {
    enabled: clampBoolean(value.enabled, fallback.enabled),
    freqHz:
      typeof value.freqHz === 'number' && Number.isFinite(value.freqHz)
        ? value.freqHz
        : fallback.freqHz,
    range: clampNumber(value.range, RANGES.exciterBandRange, fallback.range),
    drive: clampNumber(value.drive, RANGES.exciterDrive, fallback.drive),
    mix: clampNumber(value.mix, RANGES.exciterMix, fallback.mix),
    texture: clampNumber(
      value.texture,
      RANGES.exciterTexture,
      fallback.texture,
    ),
  };
  return {
    ...band,
    ...constrainExciterBandPosition(bandIndex, band.freqHz, band.range),
  };
};

/**
 * Read a settings blob from anywhere and return something usable.
 *
 * Clamps rather than rejects, and falls back field by field rather than
 * wholesale: a preset saved by a later build carrying one value this build
 * does not understand should cost the user that value, not every other
 * setting sitting beside it.
 */
/** The filter shapes an EQ band may claim to be. */
const EQ_TYPES = ['PK', 'NO', 'LSC', 'HSC', 'LPQ', 'HPQ', 'BP'] as const;

/** For a stored band past the default rack, which has no counterpart there. */
const FALLBACK_EQ_BAND: IEqBandSettings = {
  enabled: true,
  type: 'PK',
  frequency: 1_000,
  gainDb: 0,
  dynamic: false,
  thresholdDb: -24,
  quality: 1.4,
};

const clampEqBand = (
  value: unknown,
  fallback: IEqBandSettings,
): IEqBandSettings => {
  if (!isRecord(value)) {
    return fallback;
  }
  return {
    enabled: clampBoolean(value.enabled, fallback.enabled),
    // A stored string that no longer names a shape falls back rather than
    // reaching the coefficient maths, where an unknown type would silently
    // become a high shelf.
    type:
      typeof value.type === 'string' &&
      (EQ_TYPES as readonly string[]).includes(value.type)
        ? value.type
        : fallback.type,
    frequency: clampNumber(
      value.frequency,
      RANGES.eqFrequency,
      fallback.frequency,
    ),
    gainDb: clampNumber(value.gainDb, RANGES.eqGainDb, fallback.gainDb),
    quality: clampNumber(value.quality, RANGES.eqQuality, fallback.quality),
    dynamic: clampBoolean(value.dynamic, fallback.dynamic),
    thresholdDb: clampNumber(
      value.thresholdDb,
      RANGES.eqThresholdDb,
      fallback.thresholdDb,
    ),
  };
};

export const clampDspSettings = (value: unknown): IDspSettings => {
  if (!isRecord(value)) {
    return DSP_DEFAULTS;
  }
  const normalizer = isRecord(value.normalizer) ? value.normalizer : {};
  const denoise = isRecord(value.denoise) ? value.denoise : {};
  const denoiseHiss = isRecord(denoise.hiss) ? denoise.hiss : {};
  const denoiseHum = isRecord(denoise.hum) ? denoise.hum : {};
  const denoiseClick = isRecord(denoise.click) ? denoise.click : {};
  const denoiseVoice = isRecord(denoise.voice) ? denoise.voice : {};
  const crossfade = isRecord(value.crossfade) ? value.crossfade : {};
  const eq = isRecord(value.eq) ? value.eq : {};
  const storedEqBands = Array.isArray(eq.bands) ? eq.bands : [];
  const exciter = isRecord(value.exciter) ? value.exciter : {};
  const bassForge = isRecord(value.bassForge) ? value.bassForge : {};
  const bassPunch = isRecord(value.bassPunch)
    ? value.bassPunch
    : DSP_DEFAULTS.bassPunch;
  const dimension = isRecord(value.dimension) ? value.dimension : {};
  const maximizer = isRecord(value.maximizer) ? value.maximizer : {};
  const master = isRecord(value.master) ? value.master : {};
  const room = isRecord(value.room) ? value.room : {};
  const surround = isRecord(value.surround) ? value.surround : {};
  const roomPreset = ROOM_PRESETS.find((id) => id === room.presetId);
  const roomHead = ROOM_HEADS.find((id) => id === room.head);
  // Seven of each, one per speaker, whatever a stored array holds.
  const perSpeaker = (stored: unknown, range: IRange, fallback: number[]) =>
    fallback.map((value, at) =>
      clampNumber(Array.isArray(stored) ? stored[at] : undefined, range, value),
    );
  const storedOrganic = isRecord(exciter.organic) ? exciter.organic : {};
  const storedAlign = isRecord(exciter.align) ? exciter.align : {};
  let exciterStereo = DSP_DEFAULTS.exciter.stereo;
  if (EQ_STEREO_MODES.includes(storedOrganic.stereo as TEqStereo)) {
    exciterStereo = storedOrganic.stereo as TEqStereo;
  }
  if (EQ_STEREO_MODES.includes(exciter.stereo as TEqStereo)) {
    exciterStereo = exciter.stereo as TEqStereo;
  }

  /**
   * Two shapes of stored exciter get carried forward rather than discarded.
   *
   * The FIRST was one crossover, one drive and one mix. All three still exist
   * — they are the high band — and the old corner was "the frequency above
   * which harmonics are generated", which is exactly what that band's lower
   * edge means, so it carries across without reinterpretation.
   *
   * The SECOND had three bands sharing a pair of crossover corners. Those
   * corners were the boundaries between adjacent bands, so they become the
   * edges the bands started adjacent AT — the same three spans, now owned
   * individually and free to move apart or overlap.
   *
   * Falling back to the defaults instead would quietly discard settings
   * somebody tuned by ear, on upgrade, where nobody is watching for it.
   */
  const legacyCorner =
    typeof exciter.crossoverHz === 'number' ? exciter.crossoverHz : undefined;
  const legacyPair = Array.isArray(exciter.crossoverHz)
    ? (exciter.crossoverHz as unknown[])
    : undefined;
  const asHz = (value: unknown, fallback: number) =>
    typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  const splitLow = asHz(legacyPair?.[0], 300);
  const splitHigh = asHz(legacyPair?.[1], 3_000);

  const storedExciterBands: unknown[] = Array.isArray(exciter.bands)
    ? exciter.bands
    : [undefined, undefined, undefined];

  /**
   * A stored pair of edges, as the centre and width that now describe it.
   *
   * Geometric centre and width in octaves, which is the pair the audio reads,
   * so a migrated band covers exactly the span it covered before.
   */
  const asSpan = (low: number, high: number) => ({
    freqHz: Math.sqrt(Math.max(20, low) * Math.min(20_000, high)),
    range: Math.max(
      0,
      Math.min(
        1,
        (Math.log2(Math.min(20_000, high) / Math.max(20, low)) -
          EXCITER_MIN_OCTAVES) /
          EXCITER_OCTAVE_SPAN,
      ),
    ),
  });

  /** The span a stored band should end up with, if it carries none itself. */
  const inheritedSpan = (index: number) => {
    if (legacyCorner !== undefined && index === 2) {
      return asSpan(legacyCorner, 20_000);
    }
    if (legacyPair) {
      return [
        asSpan(20, splitLow),
        asSpan(splitLow, splitHigh),
        asSpan(splitHigh, 20_000),
      ][index];
    }
    const fallback = DSP_DEFAULTS.exciter.bands[index];
    return { freqHz: fallback.freqHz, range: fallback.range };
  };

  /* A pre-band exciter's drive and mix belong to the high band. */
  if (legacyCorner !== undefined && !Array.isArray(exciter.bands)) {
    storedExciterBands[2] = {
      ...DSP_DEFAULTS.exciter.bands[2],
      drive: exciter.drive,
      mix: exciter.mix,
    };
  }

  return {
    enabled: clampBoolean(value.enabled, DSP_DEFAULTS.enabled),
    presetId:
      typeof value.presetId === 'string'
        ? value.presetId
        : DSP_DEFAULTS.presetId,
    normalizer: {
      mode: NORMALIZER_MODES.includes(normalizer.mode as TNormalizerMode)
        ? (normalizer.mode as TNormalizerMode)
        : DSP_DEFAULTS.normalizer.mode,
      truePeakDbtp: clampNumber(
        normalizer.truePeakDbtp,
        RANGES.normalizerTruePeakDbtp,
        DSP_DEFAULTS.normalizer.truePeakDbtp,
      ),
      targetLufs: clampNumber(
        normalizer.targetLufs,
        RANGES.normalizerTargetLufs,
        DSP_DEFAULTS.normalizer.targetLufs,
      ),
    },
    denoise: {
      enabled: clampBoolean(denoise.enabled, DSP_DEFAULTS.denoise.enabled),
      presetId:
        typeof denoise.presetId === 'string'
          ? denoise.presetId
          : DSP_DEFAULTS.denoise.presetId,
      isolate: clampBoolean(denoise.isolate, DSP_DEFAULTS.denoise.isolate),
      profileSource: DENOISE_PROFILE_SOURCES.includes(
        denoise.profileSource as TDenoiseProfileSource,
      )
        ? (denoise.profileSource as TDenoiseProfileSource)
        : DSP_DEFAULTS.denoise.profileSource,
      hiss: {
        enabled: clampBoolean(
          denoiseHiss.enabled,
          DSP_DEFAULTS.denoise.hiss.enabled,
        ),
        amount: clampNumber(
          denoiseHiss.amount,
          RANGES.denoiseAmount,
          DSP_DEFAULTS.denoise.hiss.amount,
        ),
        floorDb: clampNumber(
          denoiseHiss.floorDb,
          RANGES.denoiseFloorDb,
          DSP_DEFAULTS.denoise.hiss.floorDb,
        ),
        sensitivityDb: clampNumber(
          denoiseHiss.sensitivityDb,
          RANGES.denoiseSensitivityDb,
          DSP_DEFAULTS.denoise.hiss.sensitivityDb,
        ),
        smoothing: clampNumber(
          denoiseHiss.smoothing,
          RANGES.denoiseSmoothing,
          DSP_DEFAULTS.denoise.hiss.smoothing,
        ),
      },
      hum: {
        enabled: clampBoolean(
          denoiseHum.enabled,
          DSP_DEFAULTS.denoise.hum.enabled,
        ),
        mode: DENOISE_HUM_MODES.includes(denoiseHum.mode as TDenoiseHumMode)
          ? (denoiseHum.mode as TDenoiseHumMode)
          : DSP_DEFAULTS.denoise.hum.mode,
        // Rounded, because this counts notches. A stored 6.5 would otherwise
        // place six and leave the seventh half-built.
        harmonics: Math.round(
          clampNumber(
            denoiseHum.harmonics,
            RANGES.denoiseHumHarmonics,
            DSP_DEFAULTS.denoise.hum.harmonics,
          ),
        ),
        depthDb: clampNumber(
          denoiseHum.depthDb,
          RANGES.denoiseHumDepthDb,
          DSP_DEFAULTS.denoise.hum.depthDb,
        ),
        quality: clampNumber(
          denoiseHum.quality,
          RANGES.denoiseHumQuality,
          DSP_DEFAULTS.denoise.hum.quality,
        ),
      },
      click: {
        enabled: clampBoolean(
          denoiseClick.enabled,
          DSP_DEFAULTS.denoise.click.enabled,
        ),
        sensitivity: clampNumber(
          denoiseClick.sensitivity,
          RANGES.denoiseClickSensitivity,
          DSP_DEFAULTS.denoise.click.sensitivity,
        ),
        // A sample count, and the repair loop indexes with it.
        maxRepairSamples: Math.round(
          clampNumber(
            denoiseClick.maxRepairSamples,
            RANGES.denoiseClickRepairSamples,
            DSP_DEFAULTS.denoise.click.maxRepairSamples,
          ),
        ),
      },
      voice: {
        enabled: clampBoolean(
          denoiseVoice.enabled,
          DSP_DEFAULTS.denoise.voice.enabled,
        ),
        mode: DSP_DEFAULTS.denoise.voice.mode,
        amount: clampNumber(
          denoiseVoice.amount,
          RANGES.denoiseAmount,
          DSP_DEFAULTS.denoise.voice.amount,
        ),
      },
    },
    crossfade: {
      enabled: clampBoolean(crossfade.enabled, DSP_DEFAULTS.crossfade.enabled),
      durationMs: clampNumber(
        crossfade.durationMs,
        RANGES.crossfadeDurationMs,
        DSP_DEFAULTS.crossfade.durationMs,
      ),
      curve: CROSSFADE_CURVES.includes(crossfade.curve as TCrossfadeCurve)
        ? (crossfade.curve as TCrossfadeCurve)
        : DSP_DEFAULTS.crossfade.curve,
      shape: clampCrossfadeShape(crossfade.shape),
    },
    eq: {
      enabled: clampBoolean(eq.enabled, DSP_DEFAULTS.eq.enabled),
      isolate: clampBoolean(eq.isolate, DSP_DEFAULTS.eq.isolate),
      // A stored name that no longer exists falls back rather than reaching
      // the coefficient maths, where an unknown model would silently become
      // whichever branch happens to be last.
      model: EQ_MODELS.includes(eq.model as TEqModel)
        ? (eq.model as TEqModel)
        : 'clean',
      modelAmount: clampNumber(eq.modelAmount, { min: 0, max: 1 }, 1),
      engine: EQ_ENGINES.includes(eq.engine as TEqEngine)
        ? (eq.engine as TEqEngine)
        : 'serial',
      phase: EQ_PHASE_MODES.includes(eq.phase as TEqPhase)
        ? (eq.phase as TEqPhase)
        : 'minimum',
      stereo: EQ_STEREO_MODES.includes(eq.stereo as TEqStereo)
        ? (eq.stereo as TEqStereo)
        : 'stereo',
      // Zero is off. Above 300 Hz this stops being a safety measure and starts
      // collapsing the image somewhere people can hear it.
      monoBelowHz:
        typeof eq.monoBelowHz === 'number' && eq.monoBelowHz > 0
          ? Math.min(300, Math.max(40, eq.monoBelowHz))
          : 0,
      // A stored `true` predates the factor and meant twice, so it still does.
      oversample: OVERSAMPLE_FACTORS.includes(eq.oversample as number)
        ? (eq.oversample as number)
        : (eq.oversample === true && 2) || 1,
      // Zero means off, and any other value is pulled into a range where a
      // high pass is protective rather than audible.
      subsonicHz:
        typeof eq.subsonicHz === 'number' && eq.subsonicHz > 0
          ? Math.min(40, Math.max(10, eq.subsonicHz))
          : 0,
      fuzzAmount: clampNumber(eq.fuzzAmount, { min: 0, max: 1 }, 0),
      // A rack stored before the choice existed plays Precise, as the main
      // EQ's layers did when theirs arrived.
      treble: isTrebleDesign(eq.treble) ? eq.treble : DSP_DEFAULTS.eq.treble,
      presetId: typeof eq.presetId === 'string' ? eq.presetId : '',
      // The stored rack decides its own length now, so an imported ten-filter
      // curve comes back as ten bands rather than being padded out to fifteen
      // with silent ones. A band past the default rack has no fallback of its
      // own, so it borrows the generic bell — reached only when a stored entry
      // is corrupt, since a sound one supplies every field itself.
      bands: Array.from(
        {
          length: Math.min(
            EQ_MAX_BAND_COUNT,
            Math.max(1, storedEqBands.length || DSP_DEFAULTS.eq.bands.length),
          ),
        },
        (_, index) =>
          clampEqBand(
            storedEqBands[index],
            DSP_DEFAULTS.eq.bands[index] ?? FALLBACK_EQ_BAND,
          ),
      ),
      sourceBands: (Array.isArray(eq.sourceBands) ? eq.sourceBands : [])
        .slice(0, EQ_MAX_BAND_COUNT)
        .map((band) => clampEqBand(band, FALLBACK_EQ_BAND)),
    },
    exciter: {
      enabled: clampBoolean(exciter.enabled, DSP_DEFAULTS.exciter.enabled),
      presetId: typeof exciter.presetId === 'string' ? exciter.presetId : '',
      // An Organic-only mode from the previous build becomes the whole-stage
      // mode rather than being discarded during migration.
      stereo: exciterStereo,
      bands: DSP_DEFAULTS.exciter.bands.map((fallback, index) =>
        clampExciterBand(
          storedExciterBands[index],
          {
            ...fallback,
            ...inheritedSpan(index),
          },
          index,
        ),
      ),
      organic: {
        enabled: clampBoolean(
          storedOrganic.enabled,
          DSP_DEFAULTS.exciter.organic.enabled,
        ),
        amount: clampNumber(
          storedOrganic.amount,
          RANGES.organicAmount,
          DSP_DEFAULTS.exciter.organic.amount,
        ),
        focusHz: clampNumber(
          storedOrganic.focusHz,
          RANGES.organicFocusHz,
          DSP_DEFAULTS.exciter.organic.focusHz,
        ),
        range: clampNumber(
          storedOrganic.range,
          RANGES.organicRange,
          DSP_DEFAULTS.exciter.organic.range,
        ),
      },
      align: {
        enabled: clampBoolean(
          storedAlign.enabled,
          DSP_DEFAULTS.exciter.align.enabled,
        ),
        amount: clampNumber(
          storedAlign.amount,
          RANGES.alignAmount,
          DSP_DEFAULTS.exciter.align.amount,
        ),
      },
      // Clamped like any other flag, and NOT forced false here.
      //
      // Forcing it here is what stopped isolate working at all. This function
      // is not only a storage reader: it runs on every patch AND on every
      // settings message the worklet receives, so a value forced false here is
      // stripped between the button and the audio. Not persisting it is a fact
      // about STORAGE, and it belongs where storage is read — `readStored` in
      // `store.ts` drops it there, which is the only place it should be
      // dropped.
      isolate: clampBoolean(exciter.isolate, DSP_DEFAULTS.exciter.isolate),
    },
    bassForge: {
      enabled: clampBoolean(bassForge.enabled, DSP_DEFAULTS.bassForge.enabled),
      isolate: clampBoolean(bassForge.isolate, DSP_DEFAULTS.bassForge.isolate),
      presetId:
        typeof bassForge.presetId === 'string' ? bassForge.presetId : '',
      splitHz: clampNumber(
        bassForge.splitHz,
        RANGES.bassSplitHz,
        DSP_DEFAULTS.bassForge.splitHz,
      ),
      driveDb: clampNumber(
        bassForge.driveDb,
        RANGES.bassForgeDriveDb,
        DSP_DEFAULTS.bassForge.driveDb,
      ),
      subAmount: clampNumber(
        bassForge.subAmount,
        RANGES.bassForgeAmount,
        DSP_DEFAULTS.bassForge.subAmount,
      ),
      presenceAmount: clampNumber(
        bassForge.presenceAmount,
        RANGES.bassForgeAmount,
        DSP_DEFAULTS.bassForge.presenceAmount,
      ),
      texture: clampNumber(
        bassForge.texture,
        RANGES.bassForgeTexture,
        DSP_DEFAULTS.bassForge.texture,
      ),
      mix: clampNumber(
        bassForge.mix,
        RANGES.bassAmount,
        DSP_DEFAULTS.bassForge.mix,
      ),
    },
    bassPunch: {
      enabled: clampBoolean(bassPunch.enabled, DSP_DEFAULTS.bassPunch.enabled),
      isolate: clampBoolean(bassPunch.isolate, DSP_DEFAULTS.bassPunch.isolate),
      presetId:
        typeof bassPunch.presetId === 'string' ? bassPunch.presetId : '',
      splitHz: clampNumber(
        bassPunch.splitHz,
        RANGES.bassSplitHz,
        DSP_DEFAULTS.bassPunch.splitHz,
      ),
      attack: clampNumber(
        bassPunch.attack,
        RANGES.bassPunchShape,
        DSP_DEFAULTS.bassPunch.attack,
      ),
      sustain: clampNumber(
        bassPunch.sustain,
        RANGES.bassPunchShape,
        DSP_DEFAULTS.bassPunch.sustain,
      ),
      bloomAmount: clampNumber(
        bassPunch.bloomAmount,
        RANGES.bassAmount,
        DSP_DEFAULTS.bassPunch.bloomAmount,
      ),
      bloomDecayMs: clampNumber(
        bassPunch.bloomDecayMs,
        RANGES.bassPunchBloomDecayMs,
        DSP_DEFAULTS.bassPunch.bloomDecayMs,
      ),
      duck: clampNumber(
        bassPunch.duck,
        RANGES.bassAmount,
        DSP_DEFAULTS.bassPunch.duck,
      ),
      // Older saved chains predate Mix and already played the complete effect.
      mix: clampNumber(bassPunch.mix, RANGES.bassPunchMix, 1),
    },
    dimension: {
      enabled: clampBoolean(dimension.enabled, DSP_DEFAULTS.dimension.enabled),
      presetId:
        typeof dimension.presetId === 'string' ? dimension.presetId : '',
      lowWidth: clampNumber(
        dimension.lowWidth,
        RANGES.dimensionLowWidth,
        DSP_DEFAULTS.dimension.lowWidth,
      ),
      midWidth: clampNumber(
        dimension.midWidth,
        RANGES.dimensionWidth,
        DSP_DEFAULTS.dimension.midWidth,
      ),
      highWidth: clampNumber(
        dimension.highWidth,
        RANGES.dimensionWidth,
        DSP_DEFAULTS.dimension.highWidth,
      ),
      lowHz: clampNumber(
        dimension.lowHz,
        RANGES.dimensionLowHz,
        DSP_DEFAULTS.dimension.lowHz,
      ),
      highHz: clampNumber(
        dimension.highHz,
        RANGES.dimensionHighHz,
        DSP_DEFAULTS.dimension.highHz,
      ),
      decorrelation: clampNumber(
        dimension.decorrelation,
        RANGES.dimensionDecorrelation,
        DSP_DEFAULTS.dimension.decorrelation,
      ),
    },
    maximizer: {
      enabled: clampBoolean(maximizer.enabled, DSP_DEFAULTS.maximizer.enabled),
      presetId:
        typeof maximizer.presetId === 'string' ? maximizer.presetId : '',
      driveDb: clampNumber(
        maximizer.driveDb,
        RANGES.maximizerDriveDb,
        DSP_DEFAULTS.maximizer.driveDb,
      ),
      ceilingDb: clampNumber(
        maximizer.ceilingDb,
        RANGES.ceilingDb,
        DSP_DEFAULTS.maximizer.ceilingDb,
      ),
      lookAheadMs: clampNumber(
        maximizer.lookAheadMs,
        RANGES.lookAheadMs,
        DSP_DEFAULTS.maximizer.lookAheadMs,
      ),
      releaseMs: clampNumber(
        maximizer.releaseMs,
        RANGES.maximizerReleaseMs,
        DSP_DEFAULTS.maximizer.releaseMs,
      ),
    },
    master: {
      enabled: clampBoolean(master.enabled, DSP_DEFAULTS.master.enabled),
      presetId: typeof master.presetId === 'string' ? master.presetId : '',
      outputTrimDb: clampNumber(
        master.outputTrimDb,
        RANGES.masterOutputTrimDb,
        DSP_DEFAULTS.master.outputTrimDb,
      ),
      loudnessMaximize: clampBoolean(
        master.loudnessMaximize,
        DSP_DEFAULTS.master.loudnessMaximize,
      ),
      loudnessTargetLufs: clampNumber(
        master.loudnessTargetLufs,
        RANGES.masterLoudnessTargetLufs,
        DSP_DEFAULTS.master.loudnessTargetLufs,
      ),
      ceilingDb: clampNumber(
        master.ceilingDb,
        RANGES.masterCeilingDb,
        DSP_DEFAULTS.master.ceilingDb,
      ),
      releaseMs: clampNumber(
        master.releaseMs,
        RANGES.masterReleaseMs,
        DSP_DEFAULTS.master.releaseMs,
      ),
      peakLimitingDb: clampNumber(
        master.peakLimitingDb,
        RANGES.masterPeakLimitingDb,
        DSP_DEFAULTS.master.peakLimitingDb,
      ),
      matchedBypass: clampBoolean(
        master.matchedBypass,
        DSP_DEFAULTS.master.matchedBypass,
      ),
    },
    room: {
      enabled: clampBoolean(room.enabled, DSP_DEFAULTS.room.enabled),
      presetId: roomPreset ?? DSP_DEFAULTS.room.presetId,
      rendererVersion: room.rendererVersion === 2 ? 2 : 1,
      earlyReflectionDb: clampNumber(
        room.earlyReflectionDb,
        RANGES.roomEarlyReflectionDb,
        DSP_DEFAULTS.room.earlyReflectionDb,
      ),
      ambienceMix: clampNumber(
        room.ambienceMix,
        RANGES.roomAmbienceMix,
        DSP_DEFAULTS.room.ambienceMix,
      ),
      ambienceDecayS: clampNumber(
        room.ambienceDecayS,
        RANGES.roomAmbienceDecayS,
        DSP_DEFAULTS.room.ambienceDecayS,
      ),
      ambienceDampingHz: clampNumber(
        room.ambienceDampingHz,
        RANGES.roomAmbienceDampingHz,
        DSP_DEFAULTS.room.ambienceDampingHz,
      ),
      preservePosition: clampBoolean(
        room.preservePosition,
        DSP_DEFAULTS.room.preservePosition,
      ),
      // Held off, whatever was stored: see `IRoomSettings`.
      compareOriginal: false,
      sourceAlreadySpatial: false,
      sizeM: clampNumber(room.sizeM, RANGES.roomSizeM, DSP_DEFAULTS.room.sizeM),
      walls: clampNumber(room.walls, RANGES.roomWalls, DSP_DEFAULTS.room.walls),
      distanceM: clampNumber(
        room.distanceM,
        RANGES.roomDistanceM,
        DSP_DEFAULTS.room.distanceM,
      ),
      centreDb: clampNumber(
        room.centreDb,
        RANGES.roomDb,
        DSP_DEFAULTS.room.centreDb,
      ),
      subDb: clampNumber(room.subDb, RANGES.roomDb, DSP_DEFAULTS.room.subDb),
      head: roomHead ?? DSP_DEFAULTS.room.head,
      angles: perSpeaker(
        room.angles,
        RANGES.roomAngleDeg,
        DSP_DEFAULTS.room.angles,
      ),
      levels: perSpeaker(
        room.levels,
        RANGES.roomLevelDb,
        DSP_DEFAULTS.room.levels,
      ),
      bassManagement: clampBoolean(
        room.bassManagement,
        DSP_DEFAULTS.room.bassManagement,
      ),
      crossoverHz: clampNumber(
        room.crossoverHz,
        RANGES.roomCrossoverHz,
        DSP_DEFAULTS.room.crossoverHz,
      ),
      musicUpmix: clampBoolean(room.musicUpmix, DSP_DEFAULTS.room.musicUpmix),
      upmixAmount: clampNumber(
        room.upmixAmount,
        RANGES.roomUpmixAmount,
        DSP_DEFAULTS.room.upmixAmount,
      ),
      distances: perSpeaker(
        room.distances,
        RANGES.roomDistanceM,
        DSP_DEFAULTS.room.distances,
      ),
      mutes: DSP_DEFAULTS.room.mutes.map((fallback, at) =>
        clampBoolean(
          Array.isArray(room.mutes) ? room.mutes[at] : undefined,
          fallback,
        ),
      ),
    },
    surround: {
      allChannels: clampBoolean(
        surround.allChannels,
        DSP_DEFAULTS.surround.allChannels,
      ),
    },
    gameMode: clampBoolean(value.gameMode, DSP_DEFAULTS.gameMode),
  };
};
