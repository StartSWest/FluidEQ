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

import { type IBandDesign } from './bandDesigns';
import { type ITone } from './tone';
import type {
  AutoEqFormat,
  IApoLayerOverride,
  IDriverSettings,
  IEqImportReference,
  IFilter,
  IFiltersMap,
  IGraphicEqPoint,
  IVoicingSettings,
  TApoLayer,
} from './constants';

// What a profile is made of and where it comes from: the headphone and
// Smart EQ layers, both preset formats, a convolution, an audio device and
// the profile assigned to it, and the OPRA library's records.
// constants.ts re-exports all of it.

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
  /** Original text and attribution when this correction came from Squiglink. */
  eqImport?: IEqImportReference;
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
  eqBandDesign?: IBandDesign;
  preAmp: number;
  filters: IFiltersMap;
  isEqDoubleOn?: boolean;
  eqMode?: 'normal' | 'double' | 'studio';
  curveEqMode?: 'normal' | 'double' | 'studio';
  eqBandQ?: 'off' | 'fixed' | 'constant' | 'proportional' | 'asymmetric';
  mainBandQ?: 'off' | 'proportional' | 'asymmetric';
  curveBandQ?: 'off' | 'fixed' | 'constant' | 'proportional' | 'asymmetric';
  curveSmoothing?: 'off' | 'twelfth' | 'third';
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
  tone?: ITone;
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
  /**
   * Whether the FluidEQ Engine's APO is registered on this particular
   * Windows endpoint.
   *
   * `null`/missing means Windows could not answer, not that the engine is
   * absent — the same convention as `isEqualizerApoAttached`, and for the
   * same reason: a registry read failure must read as "unknown", not as a
   * confident "not attached".
   */
  isFluidEngineAttached?: boolean | null;
  /**
   * Whether Windows runs audio effects on this output at all.
   *
   * `false` for an output with no endpoint key under `MMDevices\Audio\Render`,
   * which is the only place either engine can attach. Remote Desktop's audio
   * is the case that exists: it is listed as an output like any other, but it
   * lives under `RemoteRender` with no effect slots, so both flags above read
   * `false` there and the repair they led to could never work. `null`/missing
   * means Windows could not answer, the same convention as those flags.
   */
  canHostEffects?: boolean | null;
  /**
   * Whether Windows is set to run the effects it has on this output.
   *
   * This is the "Audio enhancements" switch in Sound settings (the old
   * panel's "Disable all enhancements"). Turned off, Windows loads no system
   * effect on that output — ours included — while the registry still says
   * the engine is attached and the engine itself, never loaded, has nothing
   * to report. That combination is silent in every direction, which is what
   * made it worth asking Windows directly. `null`/missing means Windows did
   * not answer, the same convention as the flags above.
   */
  effectsEnabled?: boolean | null;
  /**
   * The rate Windows runs this output at in shared mode — its "Default
   * Format" in Sound settings, and so the rate every system effect on it,
   * the FluidEQ Engine included, processes at. Missing when Windows did not
   * say.
   */
  sampleRate?: number;
  /**
   * How many channels that format has — 2 for stereo, 6 for 5.1, 8 for 7.1.
   * Windows sends a game's or a film's surround only to an output with that
   * many, which is what the Room's one-press 7.1 changes. Missing when
   * Windows did not say.
   */
  channels?: number;
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
