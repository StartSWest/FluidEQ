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
// band is about two thirds of an octave, which is the spacing the layouts
// themselves are laid out at. Every band the app creates on its own — the
// layouts, Add band, and a value that failed to parse — starts here.
export const DEFAULT_QUALITY = 2;

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

export const FilterTypeToLabelMap: Record<FilterTypeEnum, string> = {
  [FilterTypeEnum.PK]: 'Peak Filter',
  [FilterTypeEnum.NO]: 'Notch Filter',
  [FilterTypeEnum.LSC]: 'Low Shelf Filter',
  [FilterTypeEnum.HSC]: 'High Shelf Filter',
  [FilterTypeEnum.LPQ]: 'Low Pass Filter',
  [FilterTypeEnum.HPQ]: 'High Pass Filter',
  [FilterTypeEnum.BP]: 'Band Pass Filter',
};

/**
 * A band set as a comparable string, for "is this still what was applied".
 *
 * Sorted, because band order in the map is not meaningful and a reordering is
 * not an edit. Ids are left out for the same reason: they are minted fresh
 * whenever a layout is rebuilt, so including them would call an untouched
 * tuning modified the moment anything re-created it.
 */
export const describeBandShape = (filters: IFiltersMap): string =>
  Object.values(filters)
    .map(
      (filter) =>
        `${filter.type}:${filter.frequency}:${filter.gain}:${filter.quality}`,
    )
    .sort()
    .join('|');

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
export const WINDOW_MIN_WIDTH = 720;
export const WINDOW_MIN_HEIGHT = 620;

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

export interface IState {
  isEnabled: boolean;
  isAutoPreAmpOn: boolean;
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
   * The bands exactly as the reference wrote them — see describeBandShape.
   *
   * What "modified" is measured against. Recorded where the model is applied,
   * because that is the only place that knows what it wrote: the chips used to
   * take this snapshot themselves on the render after a reference arrived,
   * which caught the bands mid-animation and then called an untouched tuning
   * modified forever. Being state rather than a ref, it also survives leaving
   * the tab and coming back.
   */
  headsetSignature?: string;
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
  'voicing',
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

/**
 * What Smart EQ measured, as a layer.
 *
 * Here for the same reason as the two above: it is part of the persisted state
 * shape, and smartEq.ts already depends on this module. Unlike the voicing and
 * the driver it is not a named profile — nobody picked it, it was measured — so
 * what has to be stored is the correction itself.
 */
/**
 * A published headphone correction, kept as a layer of its own.
 *
 * IT USED TO BE WRITTEN INTO THE USER'S BANDS, and that was wrong in three ways
 * at once. Clearing the EQ threw the headphone correction away with the tuning.
 * Smart EQ, which measures the output and cannot hear a transducer, saw the
 * correction as error and flattened it over a few passes — a cost this project
 * has been carrying knowingly, with a comment saying "a headphone correction
 * that must survive belongs in the driver layer". And a curve somebody spent an
 * afternoon on could be lost by dragging one band.
 *
 * As its own layer none of that is true: it survives a clear, it is handed back
 * to the solver as something not to correct, and it can be switched off and on
 * without touching anything the user wrote.
 *
 * Distinct from `driver` even though both correct a transducer. The driver
 * profile is a broad character — what a balanced armature does — chosen from a
 * short list. This is a specific published measurement of a specific model, and
 * somebody may well want both: the model's own curve, and then a nudge for the
 * kind of driver it is.
 */
export interface IHeadphoneSettings {
  /** The correction as filters. Nothing audible means no layer at all. */
  filters: IFiltersMap;
  /**
   * The same correction as a graphic curve, when that is how it was published.
   *
   * AutoEQ ships some profiles as a list of points rather than as biquads, and
   * Equalizer APO renders those natively with one `GraphicEQ:` command. The
   * parser projects them onto peaking filters as well, so the graph and the band
   * controls have something to draw — but that projection is an approximation of
   * the curve, not the curve, and applying it in place of the real thing throws
   * away resolution nobody asked to lose.
   *
   * So both are carried and the writer prefers this one. `filters` stays
   * populated as the fallback and as what the editor reads.
   */
  graphicEq?: IGraphicEqPoint[];
  /**
   * How much of it to apply, 0 to 1.
   *
   * Published corrections are frequently stronger than people want — a full
   * Harman match is a big change — and halving one is a real listening choice
   * rather than a compromise. The same control the voicing and the driver have.
   */
  intensity: number;
  /** Exact applied file contents after an external APO edit. */
  apoOverride?: IApoLayerOverride;
}

export interface ISmartEqSettings {
  /** The correction, keyed by band id. Nothing audible means no layer at all. */
  filters: IFiltersMap;
  /**
   * How much of it to apply, 0 to 1. Absent means all of it.
   *
   * The same control the voicing, the driver and the headphone correction have,
   * and it arrived last because this is the layer that writes itself: a
   * measurement decides what the filters are, so there was nothing to dial back
   * from. That is exactly the argument for it, though — a measured correction
   * is a claim about the room, and half of one is a reasonable thing to want
   * when the claim is more confident than you are.
   *
   * Optional rather than defaulted at the type level: every profile saved
   * before this existed has no such field, and absent has to keep meaning full
   * strength or those all become silent on upgrade.
   */
  intensity?: number;
  /** Exact applied file contents after an external APO edit. */
  apoOverride?: IApoLayerOverride;
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
  driver?: IDriverSettings;
  smartEq?: ISmartEqSettings;
  headphone?: IHeadphoneSettings;
  /** Metadata for an EQ text imported from an external curve tool. */
  eqImport?: IEqImportReference;
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
   * The bands as the reference wrote them, so "modified" is a fact.
   *
   * Recorded where the model is applied, because that is the only place that
   * knows what it wrote. The row of chips used to snapshot this itself on the
   * render after a reference arrived — which caught the bands mid-animation,
   * and was a ref, so it also forgot everything on remount.
   */
  headsetSignature?: string;
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
  /**
   * The measured magnitude response of the WAV Equalizer APO actually loads.
   *
   * Companion ParametricEQ filters are only a visual approximation and do not
   * include the gain baked into the impulse. Persisting the measured response
   * lets auto-normalize use the real file while keeping profile switches free
   * of disk analysis.
   */
  response?: IGraphicEqPoint[];
  /** Highest measured WAV magnitude between 10 Hz and 20 kHz, in dB. */
  peakGainDb?: number;
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
  /**
   * Whether Equalizer APO is registered on this particular Windows endpoint.
   *
   * `null`/missing means Windows could not answer, not that APO is absent. The
   * renderer only warns on an explicit `false`, so a registry read failure
   * cannot send somebody into the Device Selector on a guess.
   */
  isEqualizerApoAttached?: boolean | null;
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

/** One published correction curve, with the credit it has to carry. */
export interface IOpraCurve {
  id: string;
  /** Who produced the curve — "AutoEQ", "oratory1990", "Rtings/AutoEQ". */
  author: string;
  /** Who measured it, e.g. "Measured by crinacle" or "Harman Target". */
  details: string;
  /** Present on about a twelfth of them; rendered only when it is there. */
  link?: string;
}

/** One headphone, as OPRA models it: a vendor, a name and its curves. */
export interface IOpraProduct {
  /** `vendor::slug`, unique, and safe to use as a path. */
  id: string;
  /** Display name of the vendor, for grouping the picker. */
  vendor: string;
  name: string;
  /** `over_the_ear` | `on_ear` | `in_ear` | `earbuds`. */
  subtype: string;
  curves: IOpraCurve[];
}

/**
 * Which snapshot of the library is installed.
 *
 * Keyed on a hash of the upstream dataset, and deliberately not on an upstream
 * revision id. The AutoEq library this replaces compared the upstream commit,
 * which stopped moving in July 2025 — so the check could only ever answer "up
 * to date", and the published newer database could never reach anybody. A
 * content hash cannot go stale that way: if the data differs, the hash differs.
 */
export interface IOpraDatabaseManifest {
  version: 1;
  contentHash: string;
  vendorCount: number;
  productCount: number;
  curveCount: number;
  generatedAt: string;
}

export interface IOpraUpdateStatus {
  current: IOpraDatabaseManifest;
  latest?: IOpraDatabaseManifest;
  updateAvailable: boolean;
}

/**
 * The bundled OPRA database, as a source id.
 *
 * The id is written once and shared by the main and renderer processes. It is
 * persisted into headsetSource so a restored selection can be matched without
 * guessing which catalogue supplied it.
 */
export const OPRA_SOURCE_ID = 'opra';

/**
 * The catalogue that used to supply corrections, and still supplies impulse
 * responses.
 *
 * Kept for two reasons. The convolution catalogue is still AutoEq's — OPRA
 * publishes no impulse responses — and it tags its entries with this id. And
 * presets saved before the switch carry `headsetSource: 'autoeq'`; their bands
 * are stored with them so they still apply, and the picker uses this to
 * recognise such a selection as one it cannot re-highlight rather than as a
 * corrupt one.
 */
export const AUTOEQ_SOURCE_ID = 'autoeq';

/** ----- Default Values ----- */

export enum FixedBandSizeEnum {
  SIX = 6,
  TEN = 10,
  FIFTEEN = 15,
  THIRTY_ONE = 31,
}

/**
 * The same four, in the order they are offered.
 *
 * A numeric enum's `Object.values` holds both directions of the mapping, so
 * every reader of the list had to filter the names back out first. Written
 * once, here.
 */
export const FIXED_BAND_SIZES: readonly FixedBandSizeEnum[] = [
  FixedBandSizeEnum.SIX,
  FixedBandSizeEnum.TEN,
  FixedBandSizeEnum.FIFTEEN,
  FixedBandSizeEnum.THIRTY_ONE,
];

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
 * Fifteen rather than ten: the 2/3-octave series. Ten is the octave series,
 * a grid wide enough that pulling one band down takes a good part of the
 * range either side with it — the resolution somebody reaches for a shelf at
 * is finer than that. Both callers that ask with no size get this: a profile
 * that has never been tuned, and Clear EQ.
 */
export const getDefaultFilters = (
  size: FixedBandSizeEnum = FixedBandSizeEnum.FIFTEEN,
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
