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

/** ----- Application Constants ----- */

import { uid } from 'uid';
import type { IBandDesign } from './bandDesigns';
import { DEFAULT_BAND_QUALITY, qualitiesForRack } from './bandQuality';
import type { ITone } from './tone';
import type { IOutputSound } from './outputSettings';
import {
  IConvolutionProfile,
  IHeadphoneSettings,
  ISmartEqSettings,
} from './profileTypes';

export { AUTOEQ_SOURCE_ID, OPRA_SOURCE_ID } from './profileTypes';
export type {
  IAudioDevice,
  IConvolutionProfile,
  IDeviceProfileAssignment,
  IDeviceProfileSettings,
  IHeadphoneSettings,
  IOpraCurve,
  IOpraDatabaseManifest,
  IOpraProduct,
  IOpraUpdateStatus,
  IPresetV1,
  IPresetV2,
  ISmartEqSettings,
} from './profileTypes';

export const MAX_GAIN = 20;
export const MIN_GAIN = -20;

/**
 * Math.min/Math.max propagate NaN, so a clamp built from them alone is not a
 * guard at all: one bad number from an imported measurement travels through it
 * untouched and reaches Equalizer APO as `Gain NaN dB`, which is not something
 * APO can build a biquad from. Non-finite input collapses to a neutral value
 * instead.
 */
// Two, not one. A Q of 1 is a broad shelf-like bell nearly an octave and a
// half wide, which is why every default layout read as smeared: neighbouring
// bands overlapped so far that moving one moved the sound of three. At 2 a
// band is about two thirds of an octave, which is the spacing of the
// fifteen-band layout this app opens with.
//
// It is the FALLBACK now rather than the answer: a band's width belongs to
// its rack, so the layouts take theirs from `qualityForMainRack`, Add band
// the rack's median, and only a band with no rack to measure — or a value
// that failed to parse — lands here. See `bandQuality.ts`.
export const DEFAULT_QUALITY = DEFAULT_BAND_QUALITY;

export const clampGain = (gain: number) =>
  Number.isFinite(gain) ? Math.min(MAX_GAIN, Math.max(MIN_GAIN, gain)) : 0;

/**
 * The preamp's own floor, and it is nothing like a band's.
 *
 * A BAND'S RANGE IS A TASTE LIMIT. THE PREAMP'S IS AN ARITHMETIC ONE, AND THE
 * TWO HAVE NO REASON TO MATCH. ±20 dB bounds what one filter may be asked to
 * do, which is a judgement about what is musically sensible. The preamp is not
 * a judgement: it is whatever number cancels the chain's peak, and the chain is
 * a SUM of layers that are each allowed 20 dB of their own.
 *
 * Sharing the band limit therefore capped the answer below the question. Two
 * bands at +20 dB an octave apart overlap into about +26 dB of chain peak, and
 * the preamp needed -26 to cancel it — but clamped at -20 it reserved six
 * decibels less than the chain takes, so the output clipped inside Equalizer
 * APO by construction, on a curve the editor had just invited the user to draw.
 * No measurement can recover that: it is the reserve being smaller than what is
 * being reserved against.
 *
 * Sixty decibels covers any chain the editor can express, including several
 * fully boosted layers stacked, and it costs nothing to allow — a preamp is one
 * multiplication, and a value nobody's chain reaches is never written.
 */
export const PREAMP_MIN_GAIN = -60;

/**
 * Bound a preamp rather than a band. See PREAMP_MIN_GAIN.
 *
 * The ceiling stays at MAX_GAIN: a preamp that pushes level UP is makeup for a
 * chain that only cuts, and +20 dB of that is already far more than any real
 * correction asks for. It is only the floor that had to move.
 */
export const clampPreAmp = (gain: number) =>
  Number.isFinite(gain)
    ? Math.min(MAX_GAIN, Math.max(PREAMP_MIN_GAIN, gain))
    : 0;

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
 *
 * `failed` is the one exception to that rule and is sent only while a mandatory
 * update is pending. An ordinary update that cannot be fetched is still not
 * worth interrupting anyone over — the version they have is working. A
 * mandatory one is different: the window is already blocked, so silence would
 * leave a modal that has stopped explaining itself.
 */
export interface IAppUpdateStatus {
  phase: 'available' | 'downloading' | 'ready' | 'failed';
  version?: string;
  percent?: number;
  /**
   * Whether this release said, in `latest.yml`, that it must be taken.
   *
   * Present only when it is `true`, and `true` only for the exact well-formed
   * signal — see `common/mandatoryUpdate`. Absent or `false` means the app
   * behaves exactly as it always has.
   */
  isMandatory?: boolean;
  /**
   * Which step failed, for a modal that has to say so in plain language.
   *
   * Only meaningful on the `failed` phase.
   */
  failure?: 'download' | 'install';
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

/**
 * The EQ-shaped part of an output's user-owned custom APO file.
 *
 * The file itself remains outside generated state. This description is
 * refreshed from disk so the graph and the applied-layer row can acknowledge
 * commands that Equalizer APO is already applying.
 */
export interface ICustomFxSettings {
  fileName: string;
  preAmp: number;
  filters: IFiltersMap;
  graphicEq?: IGraphicEqPoint[];
}

/**
 * The same string read back as bands, for anything that needs the shape itself
 * rather than a comparison against it.
 *
 * Smart EQ is the caller that matters. It corrects the output toward a
 * destination, and the user's live bands are part of what it corrects — drag one
 * and it drags back. A headphone correction lives in those same bands and must
 * NOT be corrected, because the capture is a digital loopback and cannot hear
 * the headphone: a correction for something invisible to the measurement can
 * only ever look like error to it.
 *
 * This signature is what tells the two apart. It is the bands exactly as the
 * reference wrote them, so it is the headphone correction with nothing of the
 * user's mixed into it, and whatever differs between it and the live bands is
 * precisely what somebody has moved by hand since.
 *
 * Anything unparseable is dropped rather than guessed at: one non-finite point
 * poisons an entire summed curve rather than a single band of it.
 */
export const parseBandShape = (signature: string | undefined): IFilter[] =>
  (signature ?? '')
    .split('|')
    .filter(Boolean)
    .map((entry, index) => {
      const [type, frequency, gain, quality] = entry.split(':');
      return {
        id: `headset-${index}`,
        type: type as FilterTypeEnum,
        frequency: Number(frequency),
        gain: Number(gain),
        quality: Number(quality),
      };
    })
    .filter(
      (filter) =>
        Number.isFinite(filter.frequency) &&
        Number.isFinite(filter.gain) &&
        Number.isFinite(filter.quality),
    );

export const NO_GAIN_FILTER_TYPES = [
  FilterTypeEnum.BP,
  FilterTypeEnum.LPQ,
  FilterTypeEnum.HPQ,
  FilterTypeEnum.NO,
];

export const WINDOW_HEIGHT = 625;
export const WINDOW_HEIGHT_EXPANDED = 1036;
/**
 * The full app's smallest window, in window units.
 *
 * It went down to 720×620, and the narrow end of that was the whole app
 * squeezed into one column with its panels folded behind edge tabs. The small
 * FluidEQ is the player now, reached by the switch beside the window buttons,
 * so the app stops short of that squeeze. Ivan tried Full HD, then 800 ("too
 * small"), and set 1024×800 on 2026-09-21. A screen smaller than this gets
 * its whole work area instead — see `appMinimumSize`.
 */
export const WINDOW_MIN_WIDTH = 1024;
export const WINDOW_MIN_HEIGHT = 800;

/**
 * The player's own floor, in CSS pixels: fifteen bands still a finger wide
 * each, and the transport on one row.
 *
 * The equalizer raises it from the page when the listener's band layout
 * needs more — thirty-one bands ask for about 480 (`playerWidthForBands`,
 * `PLAYER_WIDTH_FLOOR_CHANNEL`) — so this is the floor of the floor.
 */
export const PLAYER_MIN_WIDTH = 360;
/** One line: the player folded to its strip, in CSS pixels. */
export const PLAYER_FOLD_HEIGHT = 40;
/**
 * Where the player opens the first time, in CSS pixels (Ivan, 2026-09-21).
 *
 * The width is the narrowest that reads well, and the listener's own band
 * layout raises it from the page where it needs more
 * (`playerWidthForBands`). The height is a tall column that suits a
 * 1080-pixel screen, which the deck, the equalizer, the visualizer and the
 * queue fill between them — everything the player opens with
 * (`DEFAULT_DECKS`), in the middle of the screen (`centreIn`). After that
 * the window is the listener's, and grows and shrinks with the decks they
 * open.
 */
export const PLAYER_DEFAULT_WIDTH = 480;
export const PLAYER_DEFAULT_HEIGHT = 1080;

// The index is optional: APO ignores whatever sits between `Filter` and the
// colon, and exporters differ — AutoEq numbers its lines, OPRA does not.
export const FILTER_REGEX =
  /^Filter(?: [1-9]\d*)?: ON (PK|LSC?|HSC?) Fc ([1-9]\d*(?:\.\d+)?) Hz Gain (-?\d+(?:\.\d+)?) dB Q (\d+(?:\.\d+)?)$/;

/**
 * A line that is a band, without reading what the band says.
 *
 * Three places only ever needed to count bands and each grew its own copy of
 * this. One of them kept demanding the index, so the config inspector reported
 * a hand-written or OPRA-shaped `Filter: ON …` file as holding zero bands
 * while APO was applying every one of them.
 */
export const FILTER_LINE_PREFIX_REGEX = /^Filter(?:\s+\d+)?\s*:/i;

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
  /**
   * Whether this band is applied. Absent means yes.
   *
   * Optional because every state, preset and imported measurement written
   * before the switch existed has no opinion about it, and the honest reading
   * of no opinion is the behaviour those files already had. Ask through
   * `isBandEnabled` rather than testing the field: `filter.isEnabled` is
   * falsy for a band that has never been switched off, which is the one wrong
   * answer available.
   */
  isEnabled?: boolean;
}

/**
 * Whether a band contributes to what is heard.
 *
 * A disabled band keeps its frequency, gain, shape and place in the row; it is
 * simply not written to Equalizer APO and not drawn into the response. That is
 * the whole of the feature — A/B a single band without losing what it was set
 * to, the same bargain the layer bypass switches offer for a whole layer.
 */
export const isBandEnabled = (filter: Pick<IFilter, 'isEnabled'>) =>
  filter.isEnabled !== false;

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
  isEnabled?: boolean;
}

/** Provenance shown when an EQ export was imported from an external tool. */
export interface IEqImportReference {
  source: 'squiglink';
  sourceUrl: string;
  label: string;
  eqFormat: AutoEqFormat;
  filterCount: number;
  /** The original export text, retained so the importer can restore it. */
  text?: string;
}

/**
 * The two cuts at the edges of the whole EQ, each its slope in dB per
 * octave, 0 for none (`eqCuts.ts`).
 */
export interface IEqCuts {
  /** Below 20 Hz. */
  low: number;
  /** Above 20 kHz. */
  high: number;
}

export interface IState extends IOutputSound {
  eqBandDesign?: IBandDesign;
  isEnabled: boolean;
  isAutoPreAmpOn: boolean;
  isEqDoubleOn?: boolean;
  eqMode?: 'normal' | 'double' | 'studio';
  curveEqMode?: 'normal' | 'double' | 'studio';
  eqBandQ?: 'off' | 'fixed' | 'constant' | 'proportional' | 'asymmetric';
  /** Main editable bands only; absent preserves the legacy shared Q setting. */
  mainBandQ?: 'off' | 'proportional' | 'asymmetric';
  curveBandQ?: 'off' | 'fixed' | 'constant' | 'proportional' | 'asymmetric';
  curveSmoothing?: 'off' | 'twelfth' | 'third';
  /**
   * What the music itself measures, per frequency region. SESSION ONLY.
   *
   * Deliberately never persisted. It is evidence about what HAS played, and
   * applying last night's evidence to this morning's record is exactly the
   * promise the measurement cannot make. Every launch starts with no opinion,
   * which reads as the worst case, and walks up from there.
   */
  smartHeadroomProgramme?: Array<{ frequency: number; gain: number }>;
  /** The sample peak supervisor's standing correction, in dB. Session only. */
  smartHeadroomTrimDb?: number;
  /**
   * The listener's own bands, Tone and preset while a song's own sound is
   * lent to it (`main/songSoundLoan.ts`). SESSION ONLY: the state file and the
   * output's profile are written with these in place of the song's, so a
   * song's sound never outlives its song — not through a profile, and not
   * through an app that ends while it plays.
   */
  songSoundLoan?: TSongSoundLoan;
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
  /**
   * The Tone panel's Bass, Mid and Treble, a layer of its own after the bands
   * and never written into them (`tone.ts`). Absent means all three at zero.
   */
  tone?: ITone;
  /** Curated target curve applied as its own APO layer after the EQ bands. */
  voicing?: IVoicingSettings;
  /** Transducer-family correction, its own APO layer after the voicing. */
  driver?: IDriverSettings;
  /** Measured correction, the last APO layer — see src/common/smartEq.ts. */
  smartEq?: ISmartEqSettings;
  /** The published headphone correction, as its own layer. */
  headphone?: IHeadphoneSettings;
  /** Commands read from the active output's user-owned custom APO file. */
  customFx?: ICustomFxSettings;
  /** Metadata for an EQ text imported from an external curve tool. */
  eqImport?: IEqImportReference;
  /**
   * The measured headphone this correction came from.
   *
   * Not a layer — applying a reference writes into the bands themselves — but
   * knowing which model a curve came from is the difference between a set of
   * numbers and a tuning you can reason about, and it is not recoverable from
   * the bands afterwards. The EQ Presets panel reads all three of these back to
   * put its pickers where the user left them after a remount or a restart.
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
 * What a song's own sound replaces while it is lent: the bands and what
 * putting bands on changes beside them, the Tone, and the preset's curve.
 */
export type TSongSoundLoan = Pick<
  IState,
  | 'filters'
  | 'isFlat'
  | 'eqFormat'
  | 'graphicEq'
  | 'eqImport'
  | 'tone'
  | 'voicing'
>;

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
 *  - `tone` is the Tone panel's Bass, Mid and Treble: the user's too, laid
 *    over the bands without being written into them (`tone.ts`).
 *  - `voicing` is the target curve they picked.
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
  'headphone',
  'eq',
  'tone',
  'voicing',
  'smart',
] as const;

export type TApoFeature = (typeof APO_FEATURES)[number];

/**
 * The word a feature's file is named by, which is also what the Config page
 * calls it: `fluideq-<slug>-<word>.txt`.
 *
 * The voicing's is `preset`. That layer carries a preset's curve now — a DSP
 * preset's, on either engine, or a voicing picked by hand — and the EQ page
 * calls it Preset; the Config page alone said "voicing", on its pill and in
 * its file name. The feature keeps its key wherever it is stored, because
 * that is saved data; only the name on disk and on screen moved.
 */
const APO_FEATURE_FILE_WORDS: Readonly<Record<TApoFeature, string>> = {
  driver: 'driver',
  headphone: 'headphone',
  eq: 'eq',
  tone: 'tone',
  voicing: 'preset',
  smart: 'smart',
};

export const apoFeatureFileWord = (feature: TApoFeature): string =>
  APO_FEATURE_FILE_WORDS[feature];

/**
 * The feature a file's word names, now or before: the voicing's file was
 * `-voicing.txt` until 2026-09-21, and a config written then must still read
 * as the voicing's until the next write renames it.
 */
export const apoFeatureOfFileWord = (word: string): TApoFeature | undefined => {
  const lower = word.toLowerCase();
  return (
    APO_FEATURES.find((feature) => APO_FEATURE_FILE_WORDS[feature] === lower) ??
    APO_FEATURES.find((feature) => feature === lower)
  );
};

/** Every word a feature's file is or was named by, for a file-name pattern. */
export const APO_FEATURE_FILE_WORD_PATTERN = [
  ...new Set([...Object.values(APO_FEATURE_FILE_WORDS), ...APO_FEATURES]),
].join('|');

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
export const APO_LAYERS = [...APO_FEATURES, 'convolution', 'custom'] as const;

export type TApoLayer = (typeof APO_LAYERS)[number];

/**
 * A generated feature file edited directly in Equalizer APO.
 *
 * Kept beside the picker settings rather than replacing them, so the app can
 * show the exact audible curve while still knowing which curated profile the
 * layer came from. Choosing a profile again removes the override.
 */
export interface IApoLayerOverride {
  filters: IFiltersMap;
  graphicEq?: IGraphicEqPoint[];
}

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
  /** Exact applied file contents after an external APO edit. */
  apoOverride?: IApoLayerOverride;
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
  /** Exact applied file contents after an external APO edit. */
  apoOverride?: IApoLayerOverride;
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

/** ----- Default Values ----- */

export enum FixedBandSizeEnum {
  SIX = 6,
  TEN = 10,
  FIFTEEN = 15,
  TWENTY = 20,
  THIRTY_ONE = 31,
}

/**
 * The same five, in the order they are offered.
 *
 * A numeric enum's `Object.values` holds both directions of the mapping, so
 * every reader of the list had to filter the names back out first. Written
 * once, here.
 */
export const FIXED_BAND_SIZES: readonly FixedBandSizeEnum[] = [
  FixedBandSizeEnum.SIX,
  FixedBandSizeEnum.TEN,
  FixedBandSizeEnum.FIFTEEN,
  FixedBandSizeEnum.TWENTY,
  FixedBandSizeEnum.THIRTY_ONE,
];

/**
 * Band centres for each quick layout.
 *
 * Every centre in every layout is an ISO 266 preferred frequency, and each
 * layout is a whole number of third-octave steps along that series: three for
 * the ten (the octave series), two for the fifteen (two-thirds), one for the
 * thirty-one (third), five for the six (five-thirds), and the twenty's
 * deliberate mix of one and two. Four of the six and two of the ten were not
 * — 60, 170, 1500 and 12000, and 32 and 64 for 31.5 and 63 — which put four
 * of this app's five racks off the series every hardware graphic EQ, every
 * measurement microphone and every room-correction file is labelled in, and
 * made a band here mean a slightly different frequency from a band of the
 * same name anywhere else.
 *
 * The six is still the musical shorthand set — one band per range a listener
 * reaches for: weight, warmth, body, presence, attack and air — now at 40,
 * 125, 400, 1250, 4000 and 12500, which is that shape on the standard's own
 * centres. (It ran 100 Hz to 3.2 kHz before that, which left both the
 * sub-bass and the whole top octave unreachable.)
 *
 * Twenty is the fifteen with five ISO centres put back where the
 * two-thirds-octave series skips them and a listener can hear the gap. It
 * runs third-octave from 63 to 250 — 80, 125 and 200 added — which is the
 * range every room and every headphone argues about and where one wide band
 * takes its neighbours with it; and third-octave again from 6.3k to 16k, with
 * 8k and 12.5k added, where the fifteen crosses presence, sibilance and air
 * in two steps. Everything between keeps the two-thirds spacing, where the
 * ear is least fussy about exactly which frequency moved.
 *
 * It is what the app opens with: the third-octave rack is more bands than
 * most listeners want to drag, and the plain fifteen leaves those five
 * decisions unavailable.
 */
export const FIXED_BAND_FREQUENCIES: Record<FixedBandSizeEnum, number[]> = {
  [FixedBandSizeEnum.SIX]: [40, 125, 400, 1250, 4000, 12500],
  [FixedBandSizeEnum.TEN]: [
    31.5, 63, 125, 250, 500, 1000, 2000, 4000, 8000, 16000,
  ],
  [FixedBandSizeEnum.FIFTEEN]: [
    25, 40, 63, 100, 160, 250, 400, 630, 1000, 1600, 2500, 4000, 6300, 10000,
    16000,
  ],
  [FixedBandSizeEnum.TWENTY]: [
    25, 40, 63, 80, 100, 125, 160, 200, 250, 400, 630, 1000, 1600, 2500, 4000,
    6300, 8000, 10000, 12500, 16000,
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
  quality: DEFAULT_QUALITY,
  type: FilterTypeEnum.PK,
};

export const getDefaultFilterWithId = (): IFilter => {
  return {
    id: uid(8),
    ...DEFAULT_FILTER_TEMPLATE,
  };
};

/**
 * The bands an equaliser starts with when nobody has chosen any.
 *
 * Fifteen: the 2/3-octave series. Ten is the octave series, a grid wide enough
 * that pulling one band down takes a good part of the range either side with
 * it — the resolution somebody reaches for a shelf at is finer than that.
 *
 * Not the twenty, which was this for an hour: twenty sliders across a
 * 1920-wide window leave each one too narrow to read or to drag, and the rack
 * is the page. It is a layout somebody picks on a wide screen, not the one
 * the app opens with. Both callers that ask with no size get this: a profile
 * that has never been tuned, and Clear EQ.
 */
export const getDefaultFilters = (
  size: FixedBandSizeEnum = FixedBandSizeEnum.FIFTEEN,
): IFiltersMap => {
  const filters: IFiltersMap = {};
  // One Q for the whole layout, from its span and its count: a
  // thirty-one-band layout at the fifteen-band's Q is three bands playing
  // every note, and a six-band at it leaves holes nothing can reach. One
  // number across a layout rather than a width per band, so every band of it
  // moves the same way (`bandQuality.ts`).
  const widths = qualitiesForRack(FIXED_BAND_FREQUENCIES[size]);
  FIXED_BAND_FREQUENCIES[size].forEach((f, at) => {
    const filter: IFilter = {
      ...getDefaultFilterWithId(),
      frequency: f,
      quality: widths[at],
    };
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
