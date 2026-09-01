/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  CROSSFADE_CURVES,
  DENOISE_HUM_MODES,
  DENOISE_PROFILE_SOURCES,
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
/**
 * Bumped to 2 for the bass stages below: adding parameters changes what a
 * renderer must see for the chain to be complete, and a renderer built
 * against an older host is missing two whole stages rather than one field.
 * The version exists so that mismatch fails the handshake loudly, before any
 * audio runs, rather than the renderer silently rendering controls neither
 * stage is listening to.
 */
export const NATIVE_DSP_PARAMETER_SCHEMA_VERSION = 2 as const;

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
   * The vocabulary of an enum parameter, and the wire carries its INDEX.
   *
   * Read from the app's own unions in `chain.ts` — all but `EQ_BAND_TYPES`,
   * which is assembled here out of `FilterTypeEnum` and is therefore the only
   * one that can fall behind what the app can produce.
   *
   * APPEND-ONLY, and that is the part with teeth. `encodeNativeEnum` sends
   * `indexOf(value)`; `decodeNativeEnum` reads `values[index]`. So reordering
   * one of these lists silently re-points every value a running host is
   * holding, and the edit that does it looks like tidying `chain.ts` — it
   * passes the type checker and touches no file with "protocol" in its name.
   *
   * `nativeParameters.test.ts` pins each vocabulary's exact order as literals
   * and checks that `EQ_BAND_TYPES` still covers `FilterTypeEnum`, so a reorder
   * fails loudly rather than at runtime on somebody's machine. (An earlier
   * version of this comment named `nativeProtocol.test.ts`, which never
   * existed — the invariant was documented as guarded for as long as it went
   * unguarded.)
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

  /**
   * A fresh thousand-block, and 2000-2199 belongs to the two bass stages.
   *
   * Reserved rather than merely used: `claude/noise-reduction-filter-a41ca7` is
   * designing four more native-only modules against the same table, and two
   * branches both reaching for the next free id is the one collision this scheme
   * cannot recover from. A wire lead can be renumbered on merge; an id cannot,
   * because a stored automation follows the number rather than the path. Denoise
   * starts at 2200.
   */
  { id: 2001, path: 'bassForge.enabled', kind: 'boolean' },
  { id: 2008, path: 'bassForge.isolate', kind: 'boolean' },
  { id: 2002, path: 'bassForge.splitHz', kind: 'number', structural: true },
  { id: 2003, path: 'bassForge.driveDb', kind: 'number' },
  { id: 2004, path: 'bassForge.subAmount', kind: 'number' },
  { id: 2005, path: 'bassForge.presenceAmount', kind: 'number' },
  { id: 2006, path: 'bassForge.texture', kind: 'number' },
  { id: 2007, path: 'bassForge.mix', kind: 'number' },

  { id: 2101, path: 'bassPunch.enabled', kind: 'boolean' },
  { id: 2108, path: 'bassPunch.isolate', kind: 'boolean' },
  { id: 2102, path: 'bassPunch.splitHz', kind: 'number', structural: true },
  { id: 2103, path: 'bassPunch.attack', kind: 'number' },
  { id: 2104, path: 'bassPunch.sustain', kind: 'number' },
  { id: 2105, path: 'bassPunch.bloomAmount', kind: 'number' },
  // Not structural: the comb delays are fixed at the longest and only the
  // feedback gain moves, so the dial never reallocates a buffer.
  { id: 2106, path: 'bassPunch.bloomDecayMs', kind: 'number' },
  { id: 2107, path: 'bassPunch.duck', kind: 'number' },

  { id: 1701, path: 'master.enabled', kind: 'boolean' },
  { id: 1702, path: 'master.outputTrimDb', kind: 'number' },
  { id: 1703, path: 'master.loudnessMaximize', kind: 'boolean' },
  { id: 1704, path: 'master.loudnessTargetLufs', kind: 'number' },
  { id: 1705, path: 'master.ceilingDb', kind: 'number' },
  { id: 1706, path: 'master.releaseMs', kind: 'number' },
  /**
   * A term of the track-level makeup rather than something the chain applies,
   * which is why it is here and not in the chain snapshot — the same place
   * `normalizer.targetLufs` sits, and for the same reason.
   */
  { id: 1707, path: 'master.peakLimitingDb', kind: 'number' },
  { id: 1708, path: 'master.matchedBypass', kind: 'boolean' },

  /**
   * The A/B that proves the safety net is the net and not the sound.
   *
   * Carried in the protocol rather than left to a build flag because the whole
   * value of it is switching while the same audio plays.
   */
  { id: 1901, path: 'debug.outputSafetyEnabled', kind: 'boolean' },

  /*
   * Denoise owns 2200-2299. 2000-2199 belongs to the bass stages.
   *
   * Gaps between the four module runs are deliberate. A fifth hiss dial
   * extends 2215 to 2216 rather than reaching into the hum run, because an id
   * cannot be moved once it has shipped and stored automation follows it.
   */
  { id: 2201, path: 'denoise.enabled', kind: 'boolean' },
  { id: 2202, path: 'denoise.isolate', kind: 'boolean' },
  {
    id: 2203,
    path: 'denoise.profileSource',
    kind: 'enum',
    values: DENOISE_PROFILE_SOURCES,
  },

  { id: 2211, path: 'denoise.hiss.enabled', kind: 'boolean' },
  { id: 2212, path: 'denoise.hiss.amount', kind: 'number' },
  { id: 2213, path: 'denoise.hiss.floorDb', kind: 'number' },
  { id: 2214, path: 'denoise.hiss.sensitivityDb', kind: 'number' },
  { id: 2215, path: 'denoise.hiss.smoothing', kind: 'number' },

  { id: 2221, path: 'denoise.hum.enabled', kind: 'boolean' },
  {
    id: 2222,
    path: 'denoise.hum.mode',
    kind: 'enum',
    values: DENOISE_HUM_MODES,
  },
  // Structural: the notch count is how many biquads the comb allocates.
  { id: 2223, path: 'denoise.hum.harmonics', kind: 'number', structural: true },
  { id: 2224, path: 'denoise.hum.depthDb', kind: 'number' },
  { id: 2225, path: 'denoise.hum.quality', kind: 'number' },

  { id: 2231, path: 'denoise.click.enabled', kind: 'boolean' },
  { id: 2232, path: 'denoise.click.sensitivity', kind: 'number' },
  // Structural: the repair limit sizes the detector's lookahead buffer.
  {
    id: 2233,
    path: 'denoise.click.maxRepairSamples',
    kind: 'number',
    structural: true,
  },

  // Structural: engaging the model builds the session, its worker and the
  // latency ring, none of which can be allocated from the audio callback.
  {
    id: 2241,
    path: 'denoise.voice.enabled',
    kind: 'boolean',
    structural: true,
  },
  { id: 2242, path: 'denoise.voice.amount', kind: 'number' },
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

export const isNativeParameterId = (id: number): id is TNativeParameterId =>
  BY_ID.has(id);

/** Which parameters need preparing off the audio thread before they can apply. */

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
