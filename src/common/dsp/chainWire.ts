/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * One chain, as the flat array of doubles the native host decodes.
 *
 * There is exactly one encoder for this, and it lives here rather than beside
 * any of its three callers. The renderer builds a snapshot to send; the parity
 * fixture generator builds the same snapshot to hold the native chain to the
 * TypeScript worklet; the end-to-end smoke test builds one to prove the wire
 * carries it. Three encoders would agree until a field was added to one of
 * them, and the failure mode of that is not a crash — it is every EQ band
 * shifted by one field and still decoding into something plausible.
 *
 * `feq_chain_settings_decode` in `chain_decode.cpp` reads it. Neither side can
 * ask the other what the layout is, so both assert the lead: a scalar added
 * above and forgotten in the C++ is caught by a length check rather than by a
 * user noticing their Q values have become thresholds.
 */
import { FilterTypeEnum } from '../constants';
import {
  DENOISE_HUM_MODES,
  DENOISE_PROFILE_SOURCES,
  DENOISE_VOICE_MODES,
  EQ_ENGINES,
  EQ_MODELS,
  EQ_PHASE_MODES,
  EQ_STEREO_MODES,
  IDspSettings,
  DSP_DEFAULTS,
  ROOM_HEADS,
  ROOM_PRESETS,
  TRoomHead,
} from './chain';
import { roomMuteWire } from './roomSpeakers';

/**
 * Scalars before the variable-length band array. Must equal
 * `FEQ_CHAIN_PARAM_LEAD` in `fluideq/chain.h`.
 */
export const CHAIN_PARAM_LEAD = 158;

/** Tagged optional Room block follows normalizer and explicit game mode. */
export const CHAIN_ROOM_TAG = 1380929357; // ASCII ROOM
export const CHAIN_ROOM_SCHEMA = 1;
export const CHAIN_ROOM_FIELDS = 8;
export const CHAIN_ROOM_TRAILER = 11;
const ROOM_WIRE_KEYS = [
  'rendererVersion',
  'earlyReflectionDb',
  'ambienceMix',
  'ambienceDecayS',
  'ambienceDampingHz',
  'preservePosition',
  'compareOriginal',
  'sourceAlreadySpatial',
] as const;

/**
 * Where the room's head sits in the lead: the eighth of the room's
 * forty-two scalars, which end two before the band count.
 */
const ROOM_HEAD_SLOT = CHAIN_PARAM_LEAD - 45 + 7;

/**
 * Which shipped head a rack on the wire asks for.
 *
 * Main writes the head file beside the rack from the same message the rack
 * arrives in, so the two never disagree; anything out of range reads as the
 * medium head, which is what a rack from before the room means.
 */
export const roomHeadOnWire = (values: readonly number[]): TRoomHead =>
  ROOM_HEADS[values[ROOM_HEAD_SLOT]] ?? 'medium';

/** Fields per EQ band. Must equal `FEQ_CHAIN_BAND_PARAMS`. */
export const CHAIN_BAND_PARAMS = 7;

/**
 * The preset's curve, after everything else on the line: tag, schema, band
 * count and design, then four values a band. `FEQ_CHAIN_TONE_*` in
 * `fluideq/chain.h`, and `presetTone.ts` for what it is for.
 */
export const CHAIN_TONE_TAG = 1414483525; // ASCII TONE
export const CHAIN_TONE_SCHEMA = 1;
export const CHAIN_TONE_HEADER = 4;
export const CHAIN_TONE_BAND_PARAMS = 4;
/** `FEQ_CHAIN_MAX_TONE_BANDS`. */
export const CHAIN_MAX_TONE_BANDS = 48;

/** A band of the curve after the rack: a bell or a shelf. */
export interface IPresetToneBand {
  type: FilterTypeEnum;
  frequency: number;
  gain: number;
  quality: number;
}

/**
 * The curve the Maximizer limits through, as the layer after the rack plays
 * it: its bands, and whether the engine builds them analog-matched.
 */
export interface IPresetTone {
  bands: readonly IPresetToneBand[];
  matched: boolean;
}

/**
 * The order the wire uses for a band's type, which is the protocol's and not
 * the app enum's. Append-only: the wire carries an index into this list, so
 * reordering it re-points every band a running host is holding.
 */
export const CHAIN_FILTER_TYPES: readonly FilterTypeEnum[] = [
  FilterTypeEnum.PK,
  FilterTypeEnum.NO,
  FilterTypeEnum.LSC,
  FilterTypeEnum.HSC,
  FilterTypeEnum.LPQ,
  FilterTypeEnum.HPQ,
  FilterTypeEnum.BP,
];

export const encodeChainSettings = (settings: IDspSettings): number[] => {
  const {
    exciter,
    eq,
    bassForge,
    bassPunch,
    dimension,
    maximizer,
    master,
    room,
    denoise,
  } = settings;
  const values: number[] = [
    settings.enabled ? 1 : 0,
    // The final guard's switch until 2026-09-22, when the guard was removed:
    // a -0.1 dBTP limiter that held every record mastered above it. The slot
    // stays so no band moves, and a 0 keeps an older engine's guard off.
    0,
    exciter.enabled ? 1 : 0,
    exciter.isolate ? 1 : 0,
    EQ_STEREO_MODES.indexOf(exciter.stereo),
    exciter.align.enabled ? 1 : 0,
    exciter.align.amount,
    exciter.organic.enabled ? 1 : 0,
    exciter.organic.amount,
    exciter.organic.focusHz,
    exciter.organic.range,
  ];
  for (let band = 0; band < 3; band += 1) {
    const source = exciter.bands[band];
    values.push(
      source.enabled ? 1 : 0,
      source.freqHz,
      source.range,
      source.drive,
      source.mix,
      source.texture,
    );
  }
  values.push(
    eq.enabled ? 1 : 0,
    eq.isolate ? 1 : 0,
    EQ_MODELS.indexOf(eq.model),
    eq.modelAmount,
    EQ_ENGINES.indexOf(eq.engine),
    EQ_PHASE_MODES.indexOf(eq.phase),
    EQ_STEREO_MODES.indexOf(eq.stereo),
    eq.monoBelowHz,
    eq.oversample,
    eq.subsonicHz,
    eq.fuzzAmount,
    // The multiband compressor's eighteen words — its switch, two corners
    // and three bands of five — until it was removed on 2026-09-22 at
    // Ivan's call: a stage every preset set and no page showed. They stay
    // as zeros so nothing after them moves, and an older engine reads a
    // compressor that is off.
    ...new Array<number>(18).fill(0),
    dimension.enabled ? 1 : 0,
    dimension.lowWidth,
    dimension.midWidth,
    dimension.highWidth,
    dimension.lowHz,
    dimension.highHz,
    dimension.decorrelation,
    maximizer.enabled ? 1 : 0,
    maximizer.driveDb,
    maximizer.ceilingDb,
    maximizer.lookAheadMs,
    maximizer.releaseMs,
    master.enabled ? 1 : 0,
    master.outputTrimDb,
    master.loudnessMaximize ? 1 : 0,
    master.loudnessTargetLufs,
    master.ceilingDb,
    master.releaseMs,
    master.matchedBypass ? 1 : 0,
    denoise.enabled ? 1 : 0,
    denoise.isolate ? 1 : 0,
    DENOISE_PROFILE_SOURCES.indexOf(denoise.profileSource),
    denoise.hiss.enabled ? 1 : 0,
    denoise.hiss.amount,
    denoise.hiss.floorDb,
    denoise.hiss.sensitivityDb,
    denoise.hiss.smoothing,
    denoise.hum.enabled ? 1 : 0,
    DENOISE_HUM_MODES.indexOf(denoise.hum.mode),
    denoise.hum.harmonics,
    denoise.hum.depthDb,
    denoise.hum.quality,
    denoise.click.enabled ? 1 : 0,
    denoise.click.sensitivity,
    denoise.click.maxRepairSamples,
    denoise.voice.enabled ? 1 : 0,
    DENOISE_VOICE_MODES.indexOf(denoise.voice.mode),
    denoise.voice.amount,
    // Both bass stages go here rather than at the end, and the position is the
    // whole point: `isChainWirePayload` sizes the band array from the LAST lead
    // slot, so anything appended after `eq.bands.length` moves the band count
    // without moving the length check, and every band decodes one slot along
    // into something that still looks like a band.
    //
    // `presetId` is renderer and storage only. It names a profile in a
    // catalogue the native side does not have, so it never goes on the wire.
    bassForge.enabled ? 1 : 0,
    bassForge.isolate ? 1 : 0,
    bassForge.splitHz,
    bassForge.driveDb,
    bassForge.subAmount,
    bassForge.presenceAmount,
    bassForge.texture,
    bassForge.mix,
    bassPunch.enabled ? 1 : 0,
    bassPunch.isolate ? 1 : 0,
    bassPunch.splitHz,
    bassPunch.attack,
    bassPunch.sustain,
    bassPunch.bloomAmount,
    bassPunch.bloomDecayMs,
    bassPunch.duck,
    bassPunch.mix,
    // The room, forty-two scalars in the decoder's order: the switch, the
    // preset, five dials, the head, the headphone switch, then every
    // speaker's angle and then every speaker's level.
    room.enabled ? 1 : 0,
    ROOM_PRESETS.indexOf(room.presetId),
    room.sizeM,
    room.walls,
    room.distanceM,
    room.centreDb,
    room.subDb,
    ROOM_HEADS.indexOf(room.head),
    // The EQ's Treble choice, 1 for Precise, in the slot of a retired Room
    // switch ("Correct the headphones"). Every engine decoded that slot and
    // none ever read it, so an engine before 1.16 plays the cookbook
    // whatever is written here — as it always did — and no scalar after it
    // moves. It sat pinned at 1 while it was nobody's, which is also what
    // Precise, the default, writes.
    eq.treble === 'classic' ? 0 : 1,
    ...room.angles,
    ...room.levels,
    // Bass management and its crossover, then the music upmix and its
    // amount, last of the room's scalars.
    room.bassManagement ? 1 : 0,
    room.crossoverHz,
    room.musicUpmix ? 1 : 0,
    room.upmixAmount,
    // Each speaker's own distance, then the eight mutes, the sub's last —
    // with a solo's six marked as such, for the engine to drop where nothing
    // reaches the soloed speaker (`roomMuteWire`).
    ...room.distances,
    ...roomMuteWire(room.mutes),
    // Surround, in the same place and for the same reason as the bass stages.
    //
    // The Room takes every channel whatever the switch says, because folding
    // the channels around the listener's head IS what it does: on the front
    // pair alone it has nothing to place, and the centre, the sub and the
    // rears would reach the headphones around it through whatever Windows
    // does with them. The stored choice is untouched, so switching the Room
    // off gives it back.
    settings.surround.allChannels || settings.room.enabled ? 1 : 0,
    /**
     * How much limiting the Master's loudness target may spend.
     *
     * On the wire because outside the Library nobody measures the track: the
     * app computes the makeup from a cached analysis and sends it as a gain,
     * and system-wide there is no analysis, so the dial moved and the sound
     * did not — the stage was a ceiling and nothing else. The engine measures
     * the programme itself now, and to do that it needs the one number the
     * app was keeping to itself.
     */
    master.peakLimitingDb,
    // Last in the lead, and it has to stay last: `isChainWirePayload` and
    // `feq_chain_settings_decode` both read the band count from
    // `CHAIN_PARAM_LEAD - 1` to know how long the tail is. A scalar appended
    // after this one moves the count out from under both of them.
    eq.bands.length,
  );
  if (values.length !== CHAIN_PARAM_LEAD) {
    // The lead is a constant on both sides of the wire. A field added above and
    // not accounted for here would push every band along by one and still
    // decode into something plausible, which is the worst kind of wrong.
    throw new Error(
      `chain wire: lead is ${values.length}, expected ${CHAIN_PARAM_LEAD}`,
    );
  }
  eq.bands.forEach((band) => {
    values.push(
      band.enabled ? 1 : 0,
      CHAIN_FILTER_TYPES.indexOf(band.type as FilterTypeEnum),
      band.frequency,
      band.gainDb,
      band.quality,
      band.dynamic ? 1 : 0,
      band.thresholdDb,
    );
  });
  // Append after the bands so older snapshots keep all their existing offsets.
  values.push(
    ['off', 'truePeak', 'loudness'].indexOf(settings.normalizer.mode),
    settings.normalizer.truePeakDbtp,
    settings.normalizer.targetLufs,
  );
  // Game mode, last of all and ONLY when it is on. An engine older than game
  // mode refuses a line one value longer than it knows, and a line that does
  // not ask for game mode has no reason to be one it cannot read — so every
  // rack but a gaming one is the line it always was, on every engine.
  const extendedRoom = ROOM_WIRE_KEYS.some(
    (key) => (room[key] ?? DSP_DEFAULTS.room[key]) !== DSP_DEFAULTS.room[key],
  );
  if (extendedRoom) {
    // Fixed placement removes ambiguity with the old optional game-mode flag.
    // Older decoders refuse this length; none can mistake the tag for a band.
    values.push(
      settings.gameMode ? 1 : 0,
      CHAIN_ROOM_TAG,
      CHAIN_ROOM_SCHEMA,
      CHAIN_ROOM_FIELDS,
      ...ROOM_WIRE_KEYS.map((key) => {
        const value = room[key] ?? DSP_DEFAULTS.room[key];
        return typeof value === 'boolean' ? Number(value) : value;
      }),
    );
  } else if (settings.gameMode) {
    values.push(1);
  }
  return values;
};

/** What a well-formed snapshot for this many bands must be. */
export const chainWireLength = (bandCount: number): number =>
  CHAIN_PARAM_LEAD + bandCount * CHAIN_BAND_PARAMS + 3;

/**
 * The band types a curve can carry: the ones with an exact inverse, which is
 * what the Maximizer takes the curve off again with. As wire indices.
 */
const TONE_TYPES_ON_WIRE: readonly number[] = [
  FilterTypeEnum.PK,
  FilterTypeEnum.LSC,
  FilterTypeEnum.HSC,
].map((type) => CHAIN_FILTER_TYPES.indexOf(type));

/** A band the Maximizer can limit through: `feq_chain_settings_decode`'s bounds. */
const isToneBand = (
  typeOnWire: number,
  frequency: number,
  gain: number,
  quality: number,
): boolean =>
  TONE_TYPES_ON_WIRE.includes(typeOnWire) &&
  frequency >= 10 &&
  frequency <= 40_000 &&
  gain >= -30 &&
  gain <= 30 &&
  quality >= 0.05 &&
  quality <= 40;

/** Whether `at` starts a well-formed curve that ends the line. */
const isToneTrailer = (value: readonly number[], at: number): boolean => {
  const [tag, schema, count, matched] = value.slice(at, at + CHAIN_TONE_HEADER);
  if (
    tag !== CHAIN_TONE_TAG ||
    schema !== CHAIN_TONE_SCHEMA ||
    !Number.isInteger(count) ||
    count < 1 ||
    count > CHAIN_MAX_TONE_BANDS ||
    (matched !== 0 && matched !== 1) ||
    value.length !== at + CHAIN_TONE_HEADER + count * CHAIN_TONE_BAND_PARAMS
  ) {
    return false;
  }
  for (let band = 0; band < count; band += 1) {
    const read = at + CHAIN_TONE_HEADER + band * CHAIN_TONE_BAND_PARAMS;
    if (
      !isToneBand(
        value[read],
        value[read + 1],
        value[read + 2],
        value[read + 3],
      )
    ) {
      return false;
    }
  }
  return true;
};

/** The Room's trailer, when there is one, is right after the game word. */
const isRoomTrailer = (value: readonly number[], at: number): boolean => {
  if (value.length < at + CHAIN_ROOM_TRAILER) {
    return false;
  }
  const [
    tag,
    schema,
    fields,
    renderer,
    early,
    mix,
    decay,
    damping,
    preserve,
    compare,
    spatial,
  ] = value.slice(at, at + CHAIN_ROOM_TRAILER);
  return (
    tag === CHAIN_ROOM_TAG &&
    schema === CHAIN_ROOM_SCHEMA &&
    fields === CHAIN_ROOM_FIELDS &&
    (renderer === 1 || renderer === 2) &&
    early >= -60 &&
    early <= 0 &&
    mix >= 0 &&
    mix <= 1 &&
    decay >= 0.1 &&
    decay <= 1.8 &&
    damping >= 1000 &&
    damping <= 12000 &&
    [preserve, compare, spatial].every((flag) => flag === 0 || flag === 1)
  );
};

/**
 * Whether a value could be one, checked at the IPC boundary.
 *
 * The renderer is the only side that builds these and main is the only side
 * that forwards them, but main validates anyway: the boundary is where a
 * malformed message stops, and "the only caller is ours" is a property of
 * today's code rather than of the channel.
 */
export const isChainWirePayload = (value: unknown): value is number[] => {
  if (!Array.isArray(value) || value.length < CHAIN_PARAM_LEAD) {
    return false;
  }
  // Visit every index: Array.every skips holes, which the host serializer
  // otherwise turns into zero-filled scalars instead of rejecting the input.
  for (let index = 0; index < value.length; index += 1) {
    const entry = value[index];
    if (typeof entry !== 'number' || !Number.isFinite(entry)) {
      return false;
    }
  }
  const bands = value[CHAIN_PARAM_LEAD - 1];
  if (!Number.isInteger(bands) || bands < 0 || bands > 64) {
    return false;
  }
  const length = chainWireLength(bands);
  if (value.length === length - 3) {
    return true;
  }
  if (value.length < length) {
    return false;
  }
  // After the normalizer's three, in the only order they can stand: the game
  // word, the Room's trailer, the preset's curve (`appendPresetTone`).
  if (value.length > length && value[length] !== 0 && value[length] !== 1) {
    return false;
  }
  let at = length + 1;
  if (isRoomTrailer(value, at)) {
    at += CHAIN_ROOM_TRAILER;
  }
  if (value.length > at && !isToneTrailer(value, at)) {
    return false;
  }
  const [mode, ceiling, target] = value.slice(length - 3, length);
  return (
    Number.isInteger(mode) &&
    mode >= 0 &&
    mode <= 2 &&
    ceiling >= -12 &&
    ceiling <= -0.1 &&
    target >= -24 &&
    target <= -5
  );
};

/** Where the game word stands on a line, when it has one. */
const gameWordAt = (values: readonly number[]): number =>
  chainWireLength(values[CHAIN_PARAM_LEAD - 1]);

/** Call only after isChainWirePayload at the IPC boundary. */
export const hasRoomTrailer = (values: readonly number[]): boolean =>
  isRoomTrailer(values, gameWordAt(values) + 1);

/** Where the preset's curve starts on a line, or -1 for none. */
const toneAt = (values: readonly number[]): number => {
  const at =
    gameWordAt(values) + 1 + (hasRoomTrailer(values) ? CHAIN_ROOM_TRAILER : 0);
  return values.length > at && values[at] === CHAIN_TONE_TAG ? at : -1;
};

/** Call only after isChainWirePayload at the IPC boundary. */
export const hasPresetTone = (values: readonly number[]): boolean =>
  toneAt(values) >= 0;

/**
 * The line without the preset's curve, as the encoder wrote it before the
 * curve was put after it — for an engine older than the curve on the wire,
 * which refuses a line longer than it knows and bypasses the whole rack.
 *
 * The game word goes too when it was written only for the curve to stand
 * after: off, and with no Room trailer behind it. An engine older than game
 * mode refuses that word as well.
 */
export const withoutPresetTone = (values: number[]): number[] => {
  const at = toneAt(values);
  if (at < 0) {
    return values;
  }
  const line = values.slice(0, at);
  return line.length === gameWordAt(line) + 1 && line[line.length - 1] === 0
    ? line.slice(0, -1)
    : line;
};

/**
 * The line with the preset's curve after it, for the Maximizer to limit
 * through (`FeqChainToneSettings`).
 *
 * After the game word — written off where the line had none, which is what
 * its absence means — and after the Room's trailer where there is one. A
 * curve with no band the Maximizer can invert leaves the line as it was, and
 * a line that already carries a curve has it replaced rather than doubled.
 */
export const appendPresetTone = (
  values: number[],
  tone: IPresetTone | undefined,
): number[] => {
  const line = withoutPresetTone(values);
  const bands = (tone?.bands ?? [])
    .map((band) => ({
      ...band,
      typeOnWire: CHAIN_FILTER_TYPES.indexOf(band.type),
    }))
    .filter((band) =>
      isToneBand(band.typeOnWire, band.frequency, band.gain, band.quality),
    )
    .slice(0, CHAIN_MAX_TONE_BANDS);
  // A line from before the normalizer has nowhere for a curve to stand that
  // a decoder would not read as something else; the encoder writes none.
  if (
    tone === undefined ||
    bands.length === 0 ||
    line.length < gameWordAt(line)
  ) {
    return line;
  }
  return [
    ...line,
    ...(line.length === gameWordAt(line) ? [0] : []),
    CHAIN_TONE_TAG,
    CHAIN_TONE_SCHEMA,
    bands.length,
    tone.matched ? 1 : 0,
    ...bands.flatMap((band) => [
      band.typeOnWire,
      band.frequency,
      band.gain,
      band.quality,
    ]),
  ];
};

/** Game mode follows the normalizer, before any versioned Room trailer. */
export const gameModeOnWire = (values: readonly number[]): boolean =>
  isChainWirePayload(values) &&
  values[chainWireLength(values[CHAIN_PARAM_LEAD - 1])] === 1;
/**
 * With Room disabled its extended settings are inaudible, so older racks
 * remain usable. An engine that cannot read the Room's trailer is older than
 * the preset's curve on the wire too, so the curve goes with it.
 */
export const legacyChainWithoutInactiveRoom = (
  values: number[],
): number[] | undefined => {
  const line = withoutPresetTone(values);
  if (!hasRoomTrailer(line)) {
    return line;
  }
  const sourceBypassed = line[line.length - 1] === 1;
  if (line[0] !== 0 && line[CHAIN_PARAM_LEAD - 45] !== 0 && !sourceBypassed) {
    return undefined;
  }
  const base = line.slice(0, -CHAIN_ROOM_TRAILER);
  if (sourceBypassed) {
    base[CHAIN_PARAM_LEAD - 45] = 0;
  }
  return base[base.length - 1] === 0 ? base.slice(0, -1) : base;
};
