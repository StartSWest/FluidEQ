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

/** ----- Application Constants ----- */

import { uid } from 'uid';

export const MAX_GAIN = 20;
export const MIN_GAIN = -20;

/**
 * Math.min/Math.max propagate NaN, so a clamp built from them alone is not a
 * guard at all: one bad number from an imported measurement travels through it
 * untouched and reaches Equalizer APO as `Gain NaN dB`, which is not something
 * APO can build a biquad from. Non-finite input collapses to a neutral value
 * instead.
 */
const DEFAULT_QUALITY = 1;

export const clampGain = (gain: number) =>
  Number.isFinite(gain) ? Math.min(MAX_GAIN, Math.max(MIN_GAIN, gain)) : 0;

export const MAX_FREQUENCY = 20000;
export const MIN_FREQUENCY = 1;
export const MIN_QUALITY = 0.01;
// Equalizer APO accepts very narrow filters, but values above 33.3333 make
// the UI unnecessarily difficult to control and are not useful in practice.
export const MAX_QUALITY = 33.3333;

export const clampQuality = (quality: number) =>
  Number.isFinite(quality)
    ? Math.min(MAX_QUALITY, Math.max(MIN_QUALITY, quality))
    : DEFAULT_QUALITY;

/** Centre frequency, bounded and always finite. */
export const clampFrequency = (frequency: number) =>
  Number.isFinite(frequency)
    ? Math.round(Math.min(MAX_FREQUENCY, Math.max(MIN_FREQUENCY, frequency)))
    : MIN_FREQUENCY;

/**
 * The most a measured reference is allowed to ask for.
 *
 * ±20 dB is the limit of what the editor can express and what APO will build.
 * It is far more than a headphone correction should ever need, and published
 * measurements regularly exceed it at the edges of the audible band — where a
 * rig is measuring its own coupling error rather than the headphone. Applying
 * those verbatim produced graphs with +16 dB spikes at 30 Hz that nobody
 * asked for and that mostly just eat headroom.
 */
export const MAX_REFERENCE_GAIN = 12;

/**
 * Below and above these, a measurement is mostly measuring the rig.
 *
 * Set wide on purpose. The first attempt used 40 Hz and clamped a 6.3 dB
 * correction at 31 Hz — which a test caught, and rightly: bass shelves of that
 * size are ordinary and entirely believable. The untrustworthy region is the
 * bottom octave, where few rigs are calibrated, and the top, where coupling
 * resonances and ear geometry dominate.
 */
const REFERENCE_TRUSTED_LOW = 25;
const REFERENCE_TRUSTED_HIGH = 14000;
/** What is allowed out there, where the numbers are least believable. */
const MAX_REFERENCE_GAIN_AT_EDGES = 8;

/**
 * Bound a gain that came from a measurement rather than from the user.
 *
 * Deliberately not applied to bands the user moves themselves: if someone
 * wants +18 dB at 30 Hz that is their business, and the editor should not
 * argue. This is only for curves FluidEQ generates or imports on their behalf,
 * where the number is a claim about a measurement and an implausible claim
 * should not become an implausible sound.
 */
export const clampReferenceGain = (gain: number, frequency: number) => {
  if (!Number.isFinite(gain)) {
    return 0;
  }
  const limit =
    Number.isFinite(frequency) &&
    frequency >= REFERENCE_TRUSTED_LOW &&
    frequency <= REFERENCE_TRUSTED_HIGH
      ? MAX_REFERENCE_GAIN
      : MAX_REFERENCE_GAIN_AT_EDGES;
  return Math.min(limit, Math.max(-limit, gain));
};

// Equalizer APO does not impose AQUA's old 20-band UI limit. 128 keeps the
// editor responsive while allowing large imported and hand-built profiles.
export const MAX_NUM_FILTERS = 128;
export const MIN_NUM_FILTERS = 1;
// Endpoint-scoped profiles are created automatically when a user edits an
// output without choosing a named profile. They stay out of the named profile
// picker but keep the tuning persistent across restarts.
export const AUTOMATIC_PRESET_PREFIX = '.fluideq-auto-';

/**
 * Main tells the renderer that the live state now belongs to another output.
 *
 * Sent whenever the active endpoint changes and its profile has been loaded.
 * Bands, preamp, voicing, driver correction and convolution are all properties
 * of the output they were tuned on, so the renderer re-reads all of them.
 */
export const OUTPUT_STATE_CHANGED_EVENT = 'output-state-changed';

/**
 * The renderer telling main it has painted a real frame.
 *
 * Electron's own 'ready-to-show' is not that: for a React app it fires on an
 * empty root div, so the window appeared blank and filled in a moment later.
 */
export const RENDERER_READY_EVENT = 'renderer-painted';

/** Main tells the renderer where a FluidEQ update has got to. */
export const APP_UPDATE_EVENT = 'app-update';

/**
 * How far along the update is.
 *
 * Deliberately has no "checking" or "up to date" phase. Those are the normal
 * case, they happen on every launch, and reporting them would put a message on
 * screen every time the app opened to say that nothing had happened.
 */
export interface IAppUpdateStatus {
  phase: 'available' | 'downloading' | 'ready';
  version?: string;
  percent?: number;
}

// Need to use LPQ and HPQ to allow users to adjust quality for low/high pass filters
// Need to use LSC and HSC to allow users to adjust quality for low/high shelf filters
export enum FilterTypeEnum {
  PK = 'PK', // Peak ["PK",True,True]
  NO = 'NO', // Notch ["NO",False,True]
  LSC = 'LSC', // Low Shelf ["LSC",True,True]
  HSC = 'HSC', // High Shelf ["HSC",True,True]
  LPQ = 'LPQ', // Low Pass ["LPQ",False,True]
  HPQ = 'HPQ', // High Pass ["HPQ",False,True]
  BP = 'BP', // Band Pass ["BP",False,True]
  // AP = 'AP', // All Pass ["AP",False,True]
  // BWLP = 'BWLP', // Butterworth Low Pass ["BWLP",False,True]
  // BWHP = 'BWHP', // Butterworth High Pass ["BWHP",False,True]
  // LRLP = 'LRLP', // Linkwitz Riley Low Pass ["LRLP",False,True]
  // LRHP = 'LRHP', // Linkwitz Riley High Pass["LRHP",False,True]
  // LSCQ = 'LSCQ', // Low Shelf Q?? ["LSCQ",True,True]
  // HSCQ = 'HSCQ', // High Shelf Q?? ["HSCQ",True,True]
}

/** AutoEQ's three official text formats and their Equalizer APO targets. */
export enum AutoEqFormat {
  PARAMETRIC = 'parametric',
  FIXED_BAND = 'fixed-band',
  GRAPHIC = 'graphic',
}

export interface IGraphicEqPoint {
  frequency: number;
  gain: number;
}

export const FilterTypeToLabelMap: Record<FilterTypeEnum, string> = {
  [FilterTypeEnum.PK]: 'Peak Filter',
  [FilterTypeEnum.NO]: 'Notch Filter',
  [FilterTypeEnum.LSC]: 'Low Shelf Filter',
  [FilterTypeEnum.HSC]: 'High Shelf Filter',
  [FilterTypeEnum.LPQ]: 'Low Pass Filter',
  [FilterTypeEnum.HPQ]: 'High Pass Filter',
  [FilterTypeEnum.BP]: 'Band Pass Filter',
};

export const NO_GAIN_FILTER_TYPES = [
  FilterTypeEnum.BP,
  FilterTypeEnum.LPQ,
  FilterTypeEnum.HPQ,
  FilterTypeEnum.NO,
];

export const WINDOW_WIDTH = 1428;
export const WINDOW_HEIGHT = 625;
export const WINDOW_HEIGHT_EXPANDED = 1036;
export const WINDOW_MIN_WIDTH = 720;
export const WINDOW_MIN_HEIGHT = 620;

export const PREAMP_REGEX = /^Preamp: (-?\d+(?:\.\d+)?) dB$/;
export const FILTER_REGEX =
  /^Filter [1-9]\d*: ON (PK|LSC?|HSC?) Fc ([1-9]\d*(?:\.\d+)?) Hz Gain (-?\d+(?:\.\d+)?) dB Q (\d+(?:\.\d+)?)$/;

/** ----- Application Interfaces ----- */

export interface IFiltersMap {
  [key: string]: IFilter;
} // key is the same id as whats in IFilter

export interface IFilter {
  id: string;
  frequency: number;
  gain: number;
  type: FilterTypeEnum;
  quality: number;
}

/**
 * One band's share of a group edit.
 *
 * Every field but the id is optional because a group edit moves one parameter
 * across a selection: the batch that changes ten gains says nothing about ten
 * frequencies, and an absent field must leave the band's own value alone
 * rather than resetting it to a default.
 */
export interface IFilterEdit {
  id: string;
  frequency?: number;
  gain?: number;
  quality?: number;
  type?: FilterTypeEnum;
}

export interface IState {
  isEnabled: boolean;
  isAutoPreAmpOn: boolean;
  isGraphViewOn: boolean;
  isCaseSensitiveFs: boolean;
  /** True after Reset gains until the user edits an EQ band again. */
  isFlat?: boolean;
  preAmp: number;
  filters: IFiltersMap;
  /** Format used when the currently loaded AutoEQ profile was imported. */
  eqFormat?: AutoEqFormat;
  /** Full GraphicEQ points; kept separately from editable filter projections. */
  graphicEq?: IGraphicEqPoint[];
  convolution?: IConvolutionProfile;
  /** Curated target curve applied as its own APO layer after the EQ bands. */
  voicing?: IVoicingSettings;
  /** The loudness contour. Its own layer, like the voicing. */
  loudness?: ILoudnessSettings;
  /** Transducer-family correction, its own APO layer after the voicing. */
  driver?: IDriverSettings;
  /** Measured correction, the last APO layer — see src/common/smartEq.ts. */
  smartEq?: ISmartEqSettings;
  /**
   * The measured headphone the bands were generated from.
   *
   * Not a layer — applying a reference writes into the bands themselves — but
   * knowing which model a curve came from is the difference between a set of
   * numbers and a tuning you can reason about, and it is not recoverable from
   * the bands afterwards. The AutoEQ panel reads all three of these back to put
   * its pickers where the user left them after a remount or a restart.
   */
  headset?: string;
  /**
   * Which measurement of that headphone.
   *
   * Separate from the model because most models have several — different rigs,
   * different target curves — and they do not sound alike. The model name alone
   * would call two quite different tunings the same thing, and Apply would
   * claim a target was already applied when a different one was.
   */
  headsetTarget?: string;
  /**
   * Which database the model was looked up in — see AUTOEQ_SOURCE_ID.
   *
   * Model names collide across databases, and the same model measured on two
   * rigs has entirely different measurement names, so the model name alone
   * cannot say which list to go looking in. Without this, restoring a selection
   * picks whichever database happens to sort first and then cannot find the
   * measurement in it. Optional: profiles written before it existed carry the
   * model name and nothing else, and must still restore by name alone.
   */
  headsetSource?: string;
  /**
   * Layers switched off without being thrown away.
   *
   * The whole of A/B testing: a correction is either an improvement or it is
   * not, and the only way to know is to hear the same passage both ways within
   * a few seconds of itself. Removing the layer and applying it again is not
   * that — Smart EQ takes half a minute to measure, and a voicing you have
   * cleared is a voicing you have to go and find.
   *
   * A bypassed feature keeps every one of its settings and simply loses its
   * `Include:` line, so nothing is stashed, nothing is reconstructed, and there
   * is no half-applied state to land in. It also means the config still tells
   * the whole truth about what is being applied, which is why this can survive
   * a restart where the old session-only stash could not.
   */
  bypassed?: TApoLayer[];
}

/**
 * The features a chain is built from, in the order Equalizer APO applies them.
 *
 * The sequence reads physical, then intended, then taste, then measured: fix
 * the transducer, aim at a target, season it, correct what is left.
 *
 *  - `driver` compensates the transducer itself — a property of the hardware,
 *    like the impulse response above it. Below the voicing it read as if it
 *    were correcting the voicing.
 *  - `eq` is the user's own bands, or the GraphicEQ curve that stands in for
 *    them.
 *  - `voicing` is the target curve they picked.
 *  - `loudness` is a preference about how loud this should feel rather than a
 *    fix for anything, so it sits on top of all three corrections.
 *  - `smart` is last of all, because it is a correction of everything above it:
 *    the capture that produced it heard the bands, the voicing and the driver
 *    together, so its residual only means anything stacked on top of them.
 *    Anything appended after it would be un-measured.
 *
 * Nothing audible depends on the order. Cascaded biquads are linear, so their
 * magnitudes add in dB whatever the sequence, and the preamp is a peak over the
 * same set either way. It is for whoever is reading the config at two in the
 * morning wondering which layer did what — and for which file they are reading,
 * since each of these is written to one of its own.
 *
 * Here rather than beside the writer because three places have to agree on
 * these names: the config files, the persisted state, and the row of chips.
 */
export const APO_FEATURES = [
  'driver',
  'eq',
  'voicing',
  'loudness',
  'smart',
] as const;

export type TApoFeature = (typeof APO_FEATURES)[number];

/**
 * Everything that can be switched off, which is the features plus the impulse.
 *
 * The convolution is not a feature and never gets a file: it is one
 * `Convolution:` line in the device file, because APO applies an impulse
 * response as a stage of its own ahead of the filters. But it is a layer in
 * every sense the person listening cares about — it is on the row of chips, it
 * shapes the sound, and the question "is this what I am hearing" is exactly as
 * worth answering for it as for a voicing.
 *
 * Switching it off is the same act either way: a line that is not written. So
 * it shares the list, and only the writer knows the difference.
 */
export const APO_LAYERS = [...APO_FEATURES, 'convolution'] as const;

export type TApoLayer = (typeof APO_LAYERS)[number];

/**
 * Which voicing is active and how strongly.
 *
 * Lives here rather than in voicing.ts because it is part of the persisted
 * state shape, and voicing.ts already depends on this module.
 */
export interface IVoicingSettings {
  /** Empty means no voicing layer at all. */
  profileId: string;
  /** 0..1 scale applied to every gain in the profile. */
  intensity: number;
}

/**
 * Which driver compensation is active and how strongly.
 *
 * Same shape and same reasoning as IVoicingSettings: it is part of the
 * persisted state, and driver.ts already depends on this module.
 */
export interface IDriverSettings {
  /** Empty means no driver layer at all. */
  profileId: string;
  /** 0..1 scale applied to every gain in the profile. */
  intensity: number;
}

/**
 * The build has no copy of Equalizer APO's installer in it.
 *
 * The one failure where sending somebody to SourceForge is the right answer,
 * and it is a broken build rather than anything they did. Every other failure —
 * declining the permission prompt above all — means the installer is right
 * there and they should simply try again. Matching on the message text would
 * work until the day somebody rewords it.
 */
export const APO_BUNDLE_MISSING = 'apo-bundle-missing';

/**
 * Where to send somebody when, and only when, the bundle really is absent.
 *
 * Here rather than beside one of the buttons because there are two of them —
 * the prerequisite notice and the reinstall menu item — and the second one
 * spent a release showing `apo-bundle-missing` as an error message instead,
 * because the rule for what to do about that sentinel lived inside the first.
 */
export const EQUALIZER_APO_OFFICIAL_DOWNLOAD =
  'https://sourceforge.net/projects/equalizerapo/files/latest/download';

/**
 * The loudness contour, on or off and how strongly.
 *
 * Here rather than in loudness.ts for the same reason as the two above: it is
 * part of the persisted state, and loudness.ts already depends on this module.
 */
export interface ILoudnessSettings {
  isOn: boolean;
  /** 0..1 scale applied to every gain in the curve. */
  intensity: number;
}

/**
 * What Smart EQ measured, as a layer.
 *
 * Here for the same reason as the two above: it is part of the persisted state
 * shape, and smartEq.ts already depends on this module. Unlike the voicing and
 * the driver it is not a named profile — nobody picked it, it was measured — so
 * what has to be stored is the correction itself.
 */
export interface ISmartEqSettings {
  /** The correction, keyed by band id. Nothing audible means no layer at all. */
  filters: IFiltersMap;
  /** Whether the capture heard the whole correctable band or only part of it. */
  status?: 'ready' | 'partial';
  /** The range the capture actually covered, so the UI can say what it did. */
  lowFrequency?: number;
  highFrequency?: number;
}

export interface IPresetV1 {
  preAmp: number;
  filters: IFilter[];
}

export interface IPresetV2 {
  preAmp: number;
  filters: IFiltersMap;
  eqFormat?: AutoEqFormat;
  graphicEq?: IGraphicEqPoint[];
  isFlat?: boolean;
  /** Optional headset correction rendered as an APO convolution before EQ. */
  convolution?: IConvolutionProfile;
  /**
   * The layers belong to the profile, not to the session.
   *
   * Device profile blocks are rendered from the preset file alone, so anything
   * missing here simply never reaches Equalizer APO — which is exactly what
   * used to happen to the voicing and the driver once a device had a profile
   * attached. Storing them per profile also matches how they are used:
   * different headphones want different driver compensation, and a Smart EQ
   * correction measured on one output says nothing about another.
   */
  voicing?: IVoicingSettings;
  /** The loudness contour. Its own layer, like the voicing. */
  loudness?: ILoudnessSettings;
  driver?: IDriverSettings;
  smartEq?: ISmartEqSettings;
  /**
   * Whether this profile wants its preamp derived from its own chain.
   *
   * Recorded per profile because the alternative is guessing: a preamp the user
   * typed themselves looks identical to a cached automatic one, and recomputing
   * over the top of a deliberate setting throws it away silently. Absent means
   * automatic, which is what every profile written before this existed was.
   */
  isAutoPreAmpOn?: boolean;
  /** Which measured headphone this profile's bands came from, if any. */
  headset?: string;
  /** Which measurement of it — models usually have more than one. */
  headsetTarget?: string;
  /** Which database it came from; absent in profiles predating the field. */
  headsetSource?: string;
  /**
   * Layers this profile has switched off — see IState.bypassed.
   *
   * Per profile for the same reason the layers themselves are: a driver
   * correction switched off while comparing headphones has nothing to say about
   * what the speakers should be doing.
   */
  bypassed?: TApoLayer[];
}

export interface IConvolutionProfile {
  name: string;
  filters: IFiltersMap;
  /** Relative WAV filename stored in the Equalizer APO config directory. */
  fileName?: string;
  /** Original public source URL, retained for attribution and re-downloads. */
  sourceUrl?: string;
  sourceId?: string;
}

export interface IAudioDevice {
  id: string;
  name: string;
  guid: string;
  isDefault: boolean;
  isActive: boolean;
}

export interface IDeviceProfileAssignment {
  deviceId: string;
  deviceName: string;
  deviceGuid: string;
  presetName: string;
}

export interface IDeviceProfileSettings {
  version: 1;
  assignments: Record<string, IDeviceProfileAssignment>;
}

export interface IAutoEqDatabaseManifest {
  version: 1;
  sourceCommit: string;
  modelCount: number;
  profileCount: number;
  generatedAt: string;
}

export interface IAutoEqUpdateStatus {
  current: IAutoEqDatabaseManifest;
  latest?: IAutoEqDatabaseManifest;
  updateAvailable: boolean;
}

/**
 * The bundled AutoEq database, as a source id.
 *
 * Squiglink sources name themselves in their manifest; the local database has
 * no manifest to name it, so the id is written here once and shared. Both
 * processes persist it into headsetSource and compare against it, and a typo
 * in either would silently stop a restored selection matching.
 */
export const AUTOEQ_SOURCE_ID = 'autoeq';

export interface IEqSource {
  /** Stable source id. Squiglink ids are supplied by its official manifest. */
  id: string;
  name: string;
  description: string;
  attributionUrl: string;
  online: boolean;
}

export interface ISquigSource {
  id: string;
  username: string;
  name: string;
  type: string;
  website: string;
  dataUrl: string;
}

/** ----- Default Values ----- */

export enum FixedBandSizeEnum {
  SIX = 6,
  TEN = 10,
  FIFTEEN = 15,
  THIRTY_ONE = 31,
}

/**
 * Band centres for each quick layout.
 *
 * Ten, fifteen and thirty-one are the ISO octave, 2/3-octave and 1/3-octave
 * series used by hardware graphic EQs. Six is the musical shorthand set —
 * roughly 1.5 octaves apart, one band per range a listener actually reaches
 * for: weight, warmth, body, presence, attack and air. (It previously ran
 * 100 Hz to 3.2 kHz, which left both the sub-bass and the whole top octave
 * unreachable.)
 */
export const FIXED_BAND_FREQUENCIES: Record<FixedBandSizeEnum, number[]> = {
  [FixedBandSizeEnum.SIX]: [60, 170, 500, 1500, 4000, 12000],
  [FixedBandSizeEnum.TEN]: [
    32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000,
  ],
  [FixedBandSizeEnum.FIFTEEN]: [
    25, 40, 63, 100, 160, 250, 400, 630, 1000, 1600, 2500, 4000, 6300, 10000,
    16000,
  ],
  [FixedBandSizeEnum.THIRTY_ONE]: [
    20, 25, 31.5, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630,
    800, 1000, 1250, 1600, 2000, 2500, 3150, 4000, 5000, 6300, 8000, 10000,
    12500, 16000, 20000,
  ],
};

const DEFAULT_FILTER_TEMPLATE = {
  frequency: 1000,
  gain: 0,
  quality: 1,
  type: FilterTypeEnum.PK,
};

export const getDefaultFilterWithId = (): IFilter => {
  return {
    id: uid(8),
    ...DEFAULT_FILTER_TEMPLATE,
  };
};

export const getDefaultFilters = (
  size: FixedBandSizeEnum = FixedBandSizeEnum.TEN,
): IFiltersMap => {
  const filters: IFiltersMap = {};
  FIXED_BAND_FREQUENCIES[size].forEach((f) => {
    const filter: IFilter = { ...getDefaultFilterWithId(), frequency: f };
    filters[filter.id] = filter;
  });
  return filters;
};

export const getDefaultState = (): IState => {
  return {
    isEnabled: true,
    isAutoPreAmpOn: true,
    isGraphViewOn: true, // true as default so that spinner can be seen on initial load
    isCaseSensitiveFs: false, // false as default so we assume windows case insensitive behavior (foo = FoO)
    preAmp: 0,
    filters: getDefaultFilters(),
  };
};

export const RESERVED_FILE_NAMES_SET = new Set([
  'CON',
  'PRN',
  'AUX',
  'NUL',
  'COM1',
  'COM2',
  'COM3',
  'COM4',
  'COM5',
  'COM6',
  'COM7',
  'COM8',
  'COM9',
  'COM0',
  'LPT1',
  'LPT2',
  'LPT3',
  'LPT4',
  'LPT5',
  'LPT6',
  'LPT7',
  'LPT8',
  'LPT9',
  'LPT0',
]);
