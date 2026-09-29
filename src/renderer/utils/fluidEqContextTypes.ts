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

import {
  FilterTypeEnum,
  IConvolutionProfile,
  IFilterEdit,
  IFiltersMap,
  IHeadphoneSettings,
  IState,
  TApoLayer,
} from '../../common/constants';
import { IBandRevealBand } from './bandReveal';
import { ErrorDescription } from '../../common/errors';
import { IVoicingSettings } from '../../common/voicing';
import { IDriverSettings } from '../../common/driver';
import { ISmartEqSettings } from '../../common/smartEq';
import { type ITone } from '../../common/tone';
import { SelectionMode } from '../../common/bandSelection';

// What the app's context holds and the edits it takes: the whole context,
// its shell and its layers, and the band edits a panel dispatches.
// FluidEqContext.tsx re-exports all of it.

export enum FilterActionEnum {
  INIT,
  FREQUENCY,
  GAIN,
  QUALITY,
  TYPE,
  ADD,
  REMOVE,
  CLEAR_GAINS,
  FIXED_BAND,
  GAINS,
  EDITS,
}

type NumericalFilterAction =
  FilterActionEnum.FREQUENCY | FilterActionEnum.GAIN | FilterActionEnum.QUALITY;

export type FilterAction =
  | { type: FilterActionEnum.INIT; filters: IFiltersMap }
  | { type: NumericalFilterAction; id: string; newValue: number }
  | { type: FilterActionEnum.TYPE; id: string; newValue: FilterTypeEnum }
  | { type: FilterActionEnum.ADD; id: string; frequency: number }
  | { type: FilterActionEnum.REMOVE; id: string }
  /**
   * Several gains at once, as one commit.
   *
   * A band reveal lands a handful of bands per frame and, when it is cut
   * short, the whole remainder in a single go. Dispatching those one at a time
   * would clone the map once per band and hand the response graph a different
   * tuning each time — and the graph's auto-headroom writes Equalizer APO's
   * preamp for every tuning it is shown.
   */
  | { type: FilterActionEnum.GAINS; bands: IBandRevealBand[] }
  /**
   * A group edit, as one commit.
   *
   * `GAINS` above is the same idea for the one parameter a reveal moves. This
   * is the general form, and it exists for the same reason: editing a
   * selection of ten bands one dispatch at a time clones the map ten times and
   * re-renders the response graph ten times for a single turn of a knob, and
   * the graph's auto-headroom writes Equalizer APO's preamp on each one.
   */
  | { type: FilterActionEnum.EDITS; edits: IFilterEdit[] }
  | { type: FilterActionEnum.CLEAR_GAINS };

type FilterDispatch = (action: FilterAction) => void;

export interface IRefreshStateOptions {
  /**
   * Bring the new bands in one at a time, low frequency first, rather than
   * having every slider in the editor jump at once.
   *
   * Purely how it is drawn: the main process has already written the whole
   * tuning to Equalizer APO by the time this is read, and nothing here sends
   * anything back to it. The promise resolves when the last band has landed,
   * so a caller that shows a busy state can hold it for the animation.
   *
   * It resolves with the editor agreeing with the main process either way. An
   * animation cut short still leaves every band on the value Equalizer APO is
   * playing — see the reveal below — because a half-drawn tuning that stayed
   * half-drawn would be a flat editor over a tuned config, and the user's next
   * edit would write the flat one back.
   */
  revealBands?: boolean;
}

export interface IFluidEqContext extends IState {
  /**
   * The endpoint everything on screen is currently tuning.
   *
   * Usually the Windows default, but not always: a profile can be activated
   * for an output you are not listening on, which is how a mirrored device
   * gets set up without having to be made the default first. Anything that
   * needs to know whose EQ the live state describes reads this.
   */
  activeDeviceId: string;
  isLoading: boolean;
  globalError: ErrorDescription | undefined;
  /** True only for failures that make the app genuinely unusable. */
  isBlockingError: boolean;
  /**
   * Whether the equaliser can actually do anything right now.
   *
   * Two separate reasons it cannot: the user has switched it off, or Equalizer
   * APO is not installed and there is nothing behind the sliders at all. They
   * are different situations and the notice says which — but the controls have
   * to behave identically, because in both cases moving a slider changes
   * nothing you can hear.
   *
   * Derived here rather than written out at each of the panels, so that a
   * fourth place added later cannot quietly forget half of the condition and
   * leave one pane live over an engine that is not there.
   */
  isEngineUsable: boolean;
  performHealthCheck: () => void;
  refreshState: (options?: IRefreshStateOptions) => Promise<void>;
  /**
   * A number that changes whenever the set of bands does.
   *
   * Applying a reference, clearing the EQ, switching output and changing the
   * band count all throw away every band on screen and mint new ids; deleting
   * or adding one changes the set more modestly. Anything that runs across such
   * a boundary — an animation walking the bands, a measurement about to write a
   * correction — is describing a tuning nobody is looking at any more, and must
   * compare this against what it read at the start before it writes.
   */
  getBandSetGeneration: () => number;
  setGlobalError: (newValue?: ErrorDescription) => void;
  setIsEnabled: (newValue: boolean) => void;
  setAutoPreAmpOn: (newValue: boolean) => void;
  setGraphViewOn: (newValue: boolean) => void;
  setPreAmp: (newValue: number) => void;
  /** Optional APO convolution profile applied before the editable EQ. */
  convolution?: IConvolutionProfile;
  setConvolution: (newValue?: IConvolutionProfile) => void;
  /** Which measured headphone the current bands came from, if any. */
  headset?: string;
  /** Which measurement of it. */
  headsetTarget?: string;
  /**
   * Which bundled database it came from: 'autoeq'. Legacy values are retained
   * only so older profiles can still be read safely.
   *
   * Undefined for profiles written before the source was recorded, so the
   * AutoEQ panel has to read "unknown" as a real answer and fall back to
   * matching the model by name rather than treating it as a mismatch.
   */
  headsetSource?: string;
  /** Curated target curve written as its own APO layer after the EQ bands. */
  voicing?: IVoicingSettings;
  driver?: IDriverSettings;
  /**
   * What Smart EQ measured, as its own layer.
   *
   * Undefined means nothing measured, or a correction of 0 dB everywhere —
   * which amounts to the same thing and is stored as the same thing.
   */
  smartEq?: ISmartEqSettings;
  /**
   * Layers switched off without being thrown away.
   *
   * Read from the state rather than held here, because the config is what
   * actually decides it: a bypassed layer is one whose `Include:` is not
   * written, so the file, the profile and this row all say the same thing and
   * an A/B comparison survives a restart.
   */
  bypassed: TApoLayer[];
  setDriver: (newValue: IDriverSettings) => void;
  setVoicing: (newValue: IVoicingSettings) => void;
  setSmartEq: (newValue?: ISmartEqSettings) => void;
  /** The Tone panel's three dials as main last wrote them (`tone.ts`). */
  setTone: (newValue?: ITone) => void;
  /** The published headphone correction, as its own layer. */
  headphone?: IHeadphoneSettings;
  setHeadphone: (newValue?: IHeadphoneSettings) => void;
  /** The active output's user-owned custom APO file, when it has commands. */
  customFx?: IState['customFx'];
  /** Filter currently selected in the EQ editor and response graph. */
  selectedFilterId: string;
  setSelectedFilterId: (newValue: string) => void;
  /** All filters selected for group editing. The first id is the primary band. */
  selectedFilterIds: string[];
  setSelectedFilterIds: (newValue: string[]) => void;
  /**
   * The selection a click on a band produces — the band alone, toggled into
   * the group, or a shift-range from the last plainly clicked band — without
   * applying it. For the graph, which needs the ids before it sets up a drag.
   */
  nextFilterSelection: (id: string, mode: SelectionMode) => string[];
  /** Apply a click on a band to the selection. */
  toggleFilterSelection: (id: string, mode?: SelectionMode) => void;
  /** Filter currently hovered in either the EQ editor or response graph. */
  hoveredFilterId: string;
  setHoveredFilterId: (newValue: string) => void;
  dispatchFilter: FilterDispatch;
}

/**
 * The part of the context that says what state the equaliser is in, and the
 * actions that change it — every one of them stable for the provider's life.
 *
 * WHY THREE CONTEXTS AND NOT ONE. Everything used to be one object, built
 * afresh on each render of the provider, and the provider renders on every
 * frame of a band drag, every step of a knob and every band the pointer
 * crosses. Every reader re-rendered with it — the window's root among them,
 * so the titlebar, both side columns, the open page and any mounted player
 * redrew sixty times a second for a change to one band. Readers now take the
 * narrowest of the three that has what they use: this one changes when the
 * equaliser is switched, fails or loads; `IFluidEqLayers` when a layer, a mode
 * or the band count does; the whole context with every band edit, the preamp,
 * the selection and the hover.
 */
export type IFluidEqShell = Pick<
  IFluidEqContext,
  | 'activeDeviceId'
  | 'isLoading'
  | 'globalError'
  | 'isBlockingError'
  | 'isEngineUsable'
  | 'isEnabled'
  | 'isAutoPreAmpOn'
  | 'isGraphViewOn'
  | 'isCaseSensitiveFs'
  | 'performHealthCheck'
  | 'refreshState'
  | 'setGlobalError'
  | 'setIsEnabled'
  | 'setAutoPreAmpOn'
  | 'setGraphViewOn'
  | 'setPreAmp'
  | 'setConvolution'
  | 'setDriver'
  | 'setVoicing'
  | 'setSmartEq'
  | 'setTone'
  | 'setHeadphone'
  | 'setSelectedFilterId'
  | 'setSelectedFilterIds'
  | 'setHoveredFilterId'
  | 'dispatchFilter'
  | 'getBandSetGeneration'
>;

/**
 * The shell, and every layer and mode the chain carries — what changes when
 * somebody picks something, never while a band is dragged. `bandCount` is the
 * one thing of the bands' here: it moves only when a band is added or removed.
 */
export type IFluidEqLayers = IFluidEqShell &
  Pick<
    IFluidEqContext,
    | 'convolution'
    | 'headset'
    | 'headsetTarget'
    | 'headsetSource'
    | 'voicing'
    | 'driver'
    | 'smartEq'
    | 'tone'
    | 'headphone'
    | 'customFx'
    | 'bypassed'
    | 'isEqDoubleOn'
    | 'eqMode'
    | 'eqBandDesign'
    | 'curveEqMode'
    | 'eqBandQ'
    | 'curveBandQ'
    | 'curveSmoothing'
    | 'eqCuts'
    | 'eqFormat'
    | 'graphicEq'
    | 'eqImport'
    | 'isFlat'
  > & { bandCount: number };
