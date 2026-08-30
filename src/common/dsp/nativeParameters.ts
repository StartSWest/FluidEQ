/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  CROSSFADE_CURVES,
  EQ_ENGINES,
  EQ_MODELS,
  EQ_PHASE_MODES,
  EQ_STEREO_MODES,
  NORMALIZER_MODES,
} from './chain';
import { FilterTypeEnum } from '../constants';

/**
 * The addressable surface of the DSP chain, as numbers rather than names.
 *
 * One table, from which both the TypeScript control layer and the C++ header
 * are derived, so that renaming a field in `IDspSettings` cannot quietly leave
 * the UI pointing at a different native value. A name exists here only to be
 * read by a person; the wire carries the id.
 *
 * Ids are permanent. A parameter that is removed leaves its id burnt — never
 * reissued for something else — because a host and a renderer from different
 * builds may briefly speak to each other during an update, and a recycled id
 * is the one kind of mismatch the version handshake cannot catch.
 *
 * Ranges are deliberately absent. `clampDspSettings` in `chain.ts` is the only
 * authority on what a value may be, it runs at the renderer trust boundary,
 * and the native core is promised a snapshot that has already been through it.
 * Duplicating the bounds here would create a second authority that drifts.
 */
export const NATIVE_DSP_PARAMETER_SCHEMA_VERSION = 1 as const;

export type TNativeParameterKind = 'boolean' | 'number' | 'enum';

export interface INativeParameter {
  /** Permanent. See the note above on burnt ids. */
  readonly id: number;
  /**
   * Where the value lives in `IDspSettings`, for people and for the generator.
   * `[]` marks the one index carried beside the id in a fast update.
   */
  readonly path: string;
  readonly kind: TNativeParameterKind;
  /**
   * Whether applying this needs work the audio thread must not do.
   *
   * A structural change rebuilds something — a coefficient set, a linear-phase
   * kernel and its partitions, a resampler, a routing topology. It is prepared
   * on a worker and swapped in whole at a block boundary. Everything else is a
   * value the running processor can smooth toward within a block.
   */
  readonly structural?: true;
  /**
   * The vocabulary of an enum parameter, and the wire carries its index.
   *
   * Owned here rather than read from the app's own union, and append-only:
   * reordering one of these lists silently re-points every value a running
   * host is holding. `nativeProtocol.test.ts` asserts each list still covers
   * the union it mirrors, so widening the app without widening the protocol
   * fails loudly rather than at runtime on somebody's machine.
   */
  readonly values?: readonly string[];
}

const EQ_BAND_TYPES: readonly string[] = [
  FilterTypeEnum.PK,
  FilterTypeEnum.NO,
  FilterTypeEnum.LSC,
  FilterTypeEnum.HSC,
  FilterTypeEnum.LPQ,
  FilterTypeEnum.HPQ,
  FilterTypeEnum.BP,
];

export const NATIVE_DSP_PARAMETERS = [
  { id: 1001, path: 'enabled', kind: 'boolean' },

  { id: 1101, path: 'normalizer.mode', kind: 'enum', values: NORMALIZER_MODES },
  { id: 1102, path: 'normalizer.truePeakDbtp', kind: 'number' },
  { id: 1103, path: 'normalizer.targetLufs', kind: 'number' },

  { id: 1201, path: 'crossfade.enabled', kind: 'boolean' },
  { id: 1202, path: 'crossfade.durationMs', kind: 'number' },
  { id: 1203, path: 'crossfade.curve', kind: 'enum', values: CROSSFADE_CURVES },

  { id: 1301, path: 'exciter.enabled', kind: 'boolean' },
  { id: 1302, path: 'exciter.isolate', kind: 'boolean' },
  {
    id: 1303,
    path: 'exciter.stereo',
    kind: 'enum',
    values: EQ_STEREO_MODES,
    structural: true,
  },
  { id: 1310, path: 'exciter.align.enabled', kind: 'boolean' },
  { id: 1311, path: 'exciter.align.amount', kind: 'number' },
  { id: 1320, path: 'exciter.organic.enabled', kind: 'boolean' },
  { id: 1321, path: 'exciter.organic.amount', kind: 'number' },
  { id: 1322, path: 'exciter.organic.focusHz', kind: 'number' },
  { id: 1323, path: 'exciter.organic.range', kind: 'number' },
  { id: 1330, path: 'exciter.bands[].enabled', kind: 'boolean' },
  { id: 1331, path: 'exciter.bands[].freqHz', kind: 'number' },
  { id: 1332, path: 'exciter.bands[].range', kind: 'number' },
  { id: 1333, path: 'exciter.bands[].drive', kind: 'number' },
  { id: 1334, path: 'exciter.bands[].mix', kind: 'number' },
  { id: 1335, path: 'exciter.bands[].texture', kind: 'number' },

  { id: 1401, path: 'eq.enabled', kind: 'boolean' },
  { id: 1402, path: 'eq.isolate', kind: 'boolean' },
  { id: 1403, path: 'eq.model', kind: 'enum', values: EQ_MODELS },
  { id: 1404, path: 'eq.modelAmount', kind: 'number' },
  {
    id: 1405,
    path: 'eq.engine',
    kind: 'enum',
    values: EQ_ENGINES,
    structural: true,
  },
  {
    id: 1406,
    path: 'eq.phase',
    kind: 'enum',
    values: EQ_PHASE_MODES,
    structural: true,
  },
  {
    id: 1407,
    path: 'eq.stereo',
    kind: 'enum',
    values: EQ_STEREO_MODES,
    structural: true,
  },
  { id: 1408, path: 'eq.monoBelowHz', kind: 'number' },
  { id: 1409, path: 'eq.oversample', kind: 'number', structural: true },
  { id: 1410, path: 'eq.subsonicHz', kind: 'number' },
  { id: 1411, path: 'eq.fuzzAmount', kind: 'number' },
  { id: 1420, path: 'eq.bands[].enabled', kind: 'boolean' },
  {
    id: 1421,
    path: 'eq.bands[].type',
    kind: 'enum',
    values: EQ_BAND_TYPES,
    structural: true,
  },
  { id: 1422, path: 'eq.bands[].frequency', kind: 'number' },
  { id: 1423, path: 'eq.bands[].gainDb', kind: 'number' },
  { id: 1424, path: 'eq.bands[].quality', kind: 'number' },
  { id: 1425, path: 'eq.bands[].dynamic', kind: 'boolean' },
  { id: 1426, path: 'eq.bands[].thresholdDb', kind: 'number' },

  { id: 1501, path: 'compressor.enabled', kind: 'boolean' },
  {
    id: 1502,
    path: 'compressor.crossoverHz.0',
    kind: 'number',
    structural: true,
  },
  {
    id: 1503,
    path: 'compressor.crossoverHz.1',
    kind: 'number',
    structural: true,
  },
  { id: 1510, path: 'compressor.bands[].thresholdDb', kind: 'number' },
  { id: 1511, path: 'compressor.bands[].ratio', kind: 'number' },
  { id: 1512, path: 'compressor.bands[].attackMs', kind: 'number' },
  { id: 1513, path: 'compressor.bands[].releaseMs', kind: 'number' },
  { id: 1514, path: 'compressor.bands[].makeupDb', kind: 'number' },

  { id: 1601, path: 'maximizer.enabled', kind: 'boolean' },
  { id: 1602, path: 'maximizer.ceilingDb', kind: 'number' },
  { id: 1603, path: 'maximizer.lookAheadMs', kind: 'number', structural: true },
  { id: 1604, path: 'maximizer.releaseMs', kind: 'number' },
  // 1605 rather than a renumber: the ids are the wire's own names and a
  // stored automation would follow the number, not the path.
  { id: 1605, path: 'maximizer.driveDb', kind: 'number' },

  { id: 1801, path: 'dimension.enabled', kind: 'boolean' },
  { id: 1802, path: 'dimension.lowWidth', kind: 'number' },
  { id: 1803, path: 'dimension.midWidth', kind: 'number' },
  { id: 1804, path: 'dimension.highWidth', kind: 'number' },
  { id: 1805, path: 'dimension.lowHz', kind: 'number' },
  { id: 1806, path: 'dimension.highHz', kind: 'number' },
  { id: 1807, path: 'dimension.decorrelation', kind: 'number' },

  { id: 1701, path: 'master.enabled', kind: 'boolean' },
  { id: 1702, path: 'master.outputTrimDb', kind: 'number' },
  { id: 1703, path: 'master.loudnessMaximize', kind: 'boolean' },
  { id: 1704, path: 'master.loudnessTargetLufs', kind: 'number' },
  { id: 1705, path: 'master.ceilingDb', kind: 'number' },
  { id: 1706, path: 'master.releaseMs', kind: 'number' },

  /**
   * The A/B that proves the safety net is the net and not the sound.
   *
   * Carried in the protocol rather than left to a build flag because the whole
   * value of it is switching while the same audio plays.
   */
  { id: 1901, path: 'debug.outputSafetyEnabled', kind: 'boolean' },
] as const satisfies readonly INativeParameter[];

export type TNativeParameterId = (typeof NATIVE_DSP_PARAMETERS)[number]['id'];

const BY_ID = new Map<number, INativeParameter>(
  NATIVE_DSP_PARAMETERS.map((parameter) => [parameter.id, parameter]),
);

/**
 * Deliberately not `NATIVE_DSP_PARAMETERS.length`.
 *
 * A duplicated id would make the map shorter than the table and every lookup
 * for the shadowed parameter would answer with its twin — a control silently
 * driving the wrong processor, which is precisely the failure numeric ids are
 * meant to prevent. The test asserts these two agree.
 */
export const NATIVE_DSP_PARAMETER_COUNT = BY_ID.size;

export const nativeParameter = (id: number): INativeParameter | undefined =>
  BY_ID.get(id);

export const isNativeParameterId = (id: number): id is TNativeParameterId =>
  BY_ID.has(id);

/** Which parameters need preparing off the audio thread before they can apply. */
export const isStructuralParameter = (id: number): boolean =>
  BY_ID.get(id)?.structural === true;

/**
 * The wire form of an enum value: its index in the parameter's own vocabulary.
 *
 * `undefined` for a value the protocol has never heard of, which a caller must
 * treat as a refusal rather than coercing to zero — zero is a real setting.
 */
export const encodeNativeEnum = (
  id: number,
  value: string,
): number | undefined => {
  const index = BY_ID.get(id)?.values?.indexOf(value);
  return index === undefined || index < 0 ? undefined : index;
};

export const decodeNativeEnum = (
  id: number,
  index: number,
): string | undefined => BY_ID.get(id)?.values?.[index];
