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

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useRef,
  useState,
} from 'react';
import {
  FilterTypeEnum,
  getDefaultFilterWithId,
  getDefaultState,
  IFiltersMap,
  IConvolutionProfile,
  IState,
  OUTPUT_STATE_CHANGED_EVENT,
} from '../../common/constants';
import { DEFAULT_VOICING, IVoicingSettings } from '../../common/voicing';
import { DEFAULT_LOUDNESS, ILoudnessSettings } from '../../common/loudness';
import { DEFAULT_DRIVER, IDriverSettings } from '../../common/driver';
import { ISmartEqSettings } from '../../common/smartEq';
import {
  ErrorDescription,
  isBlockingError as isBlockingErrorCode,
} from '../../common/errors';
import { cloneFilters } from '../../common/utils';
import { getEqualizerState } from './equalizerApi';
import { IBandRevealBand, planBandReveal, revealBands } from './bandReveal';

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
   * Which database it came from: 'autoeq', or a Squiglink source id.
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
  setDriver: (newValue: IDriverSettings) => void;
  setVoicing: (newValue: IVoicingSettings) => void;
  /**
   * The loudness contour. `loudness` itself arrives through IState, since it is
   * persisted with everything else the config describes.
   */
  setLoudness: (newValue: ILoudnessSettings) => void;
  setSmartEq: (newValue?: ISmartEqSettings) => void;
  /** Filter currently selected in the EQ editor and response graph. */
  selectedFilterId: string;
  setSelectedFilterId: (newValue: string) => void;
  /** All filters selected for group editing. The first id is the primary band. */
  selectedFilterIds: string[];
  setSelectedFilterIds: (newValue: string[]) => void;
  toggleFilterSelection: (id: string, additive?: boolean) => void;
  /** Filter currently hovered in either the EQ editor or response graph. */
  hoveredFilterId: string;
  setHoveredFilterId: (newValue: string) => void;
  dispatchFilter: FilterDispatch;
}

const FluidEqContext = createContext<IFluidEqContext | undefined>(undefined);

type IFilterReducer = (
  filters: IFiltersMap,
  action: FilterAction,
) => IFiltersMap;

const filterReducer: IFilterReducer = (
  filters: IFiltersMap,
  action: FilterAction,
) => {
  switch (action.type) {
    case FilterActionEnum.INIT:
      return action.filters;
    case FilterActionEnum.FREQUENCY: {
      const filtersCloned = cloneFilters(filters);
      filtersCloned[action.id].frequency = action.newValue;
      return filtersCloned;
    }
    case FilterActionEnum.GAIN: {
      const filtersCloned = cloneFilters(filters);
      filtersCloned[action.id].gain = action.newValue;
      return filtersCloned;
    }
    case FilterActionEnum.GAINS: {
      // Bands that are no longer here are dropped rather than resurrected:
      // this lands after an await and the set may have lost one meanwhile.
      // Bands already sitting on their value are dropped too, so a batch that
      // asks for nothing returns the map it was given and nothing downstream
      // re-renders over it.
      const landing = action.bands.filter(
        (band) => filters[band.id] && filters[band.id].gain !== band.gain,
      );
      if (landing.length === 0) {
        return filters;
      }
      const filtersCloned = cloneFilters(filters);
      landing.forEach((band) => {
        filtersCloned[band.id].gain = band.gain;
      });
      return filtersCloned;
    }
    case FilterActionEnum.QUALITY: {
      const filtersCloned = cloneFilters(filters);
      filtersCloned[action.id].quality = action.newValue;
      return filtersCloned;
    }
    case FilterActionEnum.TYPE: {
      const filtersCloned = cloneFilters(filters);
      filtersCloned[action.id].type = action.newValue;
      return filtersCloned;
    }
    case FilterActionEnum.ADD: {
      const filtersCloned = cloneFilters(filters);
      filtersCloned[action.id] = {
        ...getDefaultFilterWithId(),
        id: action.id,
        frequency: action.frequency,
      };
      return filtersCloned;
    }
    case FilterActionEnum.REMOVE: {
      const filtersCloned = cloneFilters(filters);
      delete filtersCloned[action.id];
      return filtersCloned;
    }
    case FilterActionEnum.CLEAR_GAINS: {
      // Mirrors the main process: band pass, notch and the pass filters still
      // shape the signal at 0 dB, so clearing also restores the band type.
      const filtersCloned = cloneFilters(filters);
      Object.values(filtersCloned).forEach((f) => {
        f.gain = 0;
        f.type = FilterTypeEnum.PK;
      });
      return filtersCloned;
    }
    default:
      // This throw does not actually do anything because
      // we are in a reducer
      throw new Error('Unhandled action type should not occur');
  }
};

export interface IFluidEqProviderWrapperProps {
  value: IFluidEqContext;
  children: ReactNode;
}

interface IFluidEqProviderProps {
  children: ReactNode;
}

export const FluidEqProviderWrapper = ({
  value,
  children,
}: IFluidEqProviderWrapperProps) => {
  return (
    <FluidEqContext.Provider value={value}>{children}</FluidEqContext.Provider>
  );
};

export const FluidEqProvider = ({ children }: IFluidEqProviderProps) => {
  const [globalError, setGlobalError] = useState<
    ErrorDescription | undefined
  >();

  const DEFAULT_STATE = getDefaultState();

  const [isEnabled, setIsEnabled] = useState<boolean>(DEFAULT_STATE.isEnabled);
  const [isAutoPreAmpOn, setAutoPreAmpOn] = useState<boolean>(
    DEFAULT_STATE.isAutoPreAmpOn,
  );
  const [isGraphViewOn, setIsGraphViewOn] = useState<boolean>(
    DEFAULT_STATE.isGraphViewOn,
  );
  const [isCaseSensitiveFs, setIsCaseSensitiveFs] = useState<boolean>(
    DEFAULT_STATE.isCaseSensitiveFs,
  );
  const [preAmp, setPreAmp] = useState<number>(DEFAULT_STATE.preAmp);
  const [loudness, setLoudness] = useState<ILoudnessSettings>(
    DEFAULT_STATE.loudness ?? DEFAULT_LOUDNESS,
  );
  const [voicing, setVoicing] = useState<IVoicingSettings>(
    DEFAULT_STATE.voicing ?? DEFAULT_VOICING,
  );
  const [driver, setDriver] = useState<IDriverSettings>(
    DEFAULT_STATE.driver ?? DEFAULT_DRIVER,
  );
  const [smartEq, setSmartEq] = useState<ISmartEqSettings | undefined>(
    DEFAULT_STATE.smartEq,
  );
  const [convolution, setConvolution] = useState<
    IConvolutionProfile | undefined
  >(DEFAULT_STATE.convolution);
  const [headset, setHeadset] = useState<string | undefined>(
    DEFAULT_STATE.headset,
  );
  const [headsetTarget, setHeadsetTarget] = useState<string | undefined>(
    DEFAULT_STATE.headsetTarget,
  );
  const [headsetSource, setHeadsetSource] = useState<string | undefined>(
    DEFAULT_STATE.headsetSource,
  );
  const [selectedFilterId, setSelectedFilterIdState] = useState<string>('');
  const [selectedFilterIds, setSelectedFilterIdsState] = useState<string[]>([]);
  const [hoveredFilterId, setHoveredFilterId] = useState<string>('');
  const [filters, applyFilterAction] = useReducer(
    filterReducer,
    DEFAULT_STATE.filters,
  );

  // Bumped by the three actions that change which bands exist, as opposed to
  // moving a value on a band that is still there. Wrapping the reducer's own
  // dispatch is what makes the count unmissable: every caller in the app
  // already goes through the context to reach the bands.
  const bandSetGenerationRef = useRef(0);
  const getBandSetGeneration = useCallback(
    () => bandSetGenerationRef.current,
    [],
  );

  // INIT alone, where the count above also takes in adding and deleting a
  // band. A reveal has to tell those two apart: replaced means some newer
  // tuning owns the editor and the rest of this one must never be asserted
  // over it, while added or deleted means this tuning is still the one on
  // screen and the bands the animation never reached are still at 0 dB.
  const bandSetReplacementRef = useRef(0);

  // Set only while a reveal is drawing. Anything that reaches the context
  // through dispatchFilter while it is — the reveal's own frames go straight
  // to the reducer — is a band the user moved, and they moved it with the main
  // process listening. Painting the reference over it would leave the editor
  // showing a gain Equalizer APO is not playing.
  const revealEditedIdsRef = useRef<Set<string> | undefined>(undefined);

  const dispatchFilter = useCallback((action: FilterAction) => {
    if (
      action.type === FilterActionEnum.INIT ||
      action.type === FilterActionEnum.ADD ||
      action.type === FilterActionEnum.REMOVE
    ) {
      bandSetGenerationRef.current += 1;
    }
    if (action.type === FilterActionEnum.INIT) {
      bandSetReplacementRef.current += 1;
    }
    // Only the gain: a band whose frequency or Q was nudged mid-reveal still
    // wants the reference's gain, and skipping it would strand that one band
    // at 0 dB — the very thing this is here to prevent.
    if (action.type === FilterActionEnum.GAIN) {
      revealEditedIdsRef.current?.add(action.id);
    }
    applyFilterAction(action);
  }, []);

  const [isLoading, setIsLoading] = useState<boolean>(true);

  const setSelectedFilterIds = useCallback((newValue: string[]) => {
    const uniqueIds = [...new Set(newValue.filter(Boolean))];
    setSelectedFilterIdsState(uniqueIds);
    setSelectedFilterIdState(uniqueIds[0] ?? '');
  }, []);

  const setSelectedFilterId = useCallback(
    (newValue: string) => {
      setSelectedFilterIds(newValue ? [newValue] : []);
    },
    [setSelectedFilterIds],
  );

  const toggleFilterSelection = useCallback(
    (id: string, additive = false) => {
      if (!additive) {
        setSelectedFilterIds(
          selectedFilterIds.includes(id) ? selectedFilterIds : [id],
        );
        return;
      }
      const nextIds = selectedFilterIds.includes(id)
        ? selectedFilterIds.filter((selectedId) => selectedId !== id)
        : [...selectedFilterIds, id];
      setSelectedFilterIds(nextIds);
    },
    [selectedFilterIds, setSelectedFilterIds],
  );

  const setGraphViewOn = (newValue: boolean) => {
    setIsGraphViewOn(newValue);
    const root = document.getElementById('root');
    root?.setAttribute('class', newValue ? '' : 'minimized');
  };

  const refreshState = useCallback(
    async (options?: IRefreshStateOptions) => {
      try {
        const state = await getEqualizerState();
        setIsEnabled(state.isEnabled);
        setLoudness(state.loudness ?? DEFAULT_LOUDNESS);
        // Keep the persisted preference so Auto normalize can be disabled for
        // users who want to set the APO preamp manually.
        setAutoPreAmpOn(state.isAutoPreAmpOn);
        setGraphViewOn(state.isGraphViewOn);
        setPreAmp(state.preAmp);
        setConvolution(state.convolution);
        setVoicing(state.voicing ?? DEFAULT_VOICING);
        setDriver(state.driver ?? DEFAULT_DRIVER);
        setSmartEq(state.smartEq);
        setHeadset(state.headset);
        setHeadsetTarget(state.headsetTarget);
        setHeadsetSource(state.headsetSource);

        // The band set lands whole either way — same ids, same frequencies,
        // same types — so the layout is right from the first frame and only
        // the gains climb in. Anything else would look like bands appearing
        // out of nowhere rather than like the EQ being tuned.
        const plan = options?.revealBands
          ? planBandReveal(state.filters)
          : undefined;
        dispatchFilter({
          type: FilterActionEnum.INIT,
          filters: plan?.initial ?? state.filters,
        });
        setGlobalError(undefined);
        setIsCaseSensitiveFs(state.isCaseSensitiveFs);

        if (!plan) {
          return;
        }

        // Both claimed after our own INIT, so the reveal is not cancelled by
        // the very replacement it is there to animate.
        const generation = bandSetGenerationRef.current;
        const replacement = bandSetReplacementRef.current;
        const editedDuringReveal = new Set<string>();
        revealEditedIdsRef.current = editedDuringReveal;

        // Straight to the reducer rather than through dispatchFilter: what the
        // reveal draws is not an edit, and recording it as one would make the
        // animation skip every band it had already shown. One action per frame
        // rather than one per band, so the graph — and the auto-headroom write
        // it drives — sees a frame, not a band.
        const land = (bands: IBandRevealBand[]) => {
          const remaining = bands.filter(
            (band) => !editedDuringReveal.has(band.id),
          );
          if (remaining.length > 0) {
            applyFilterAction({
              type: FilterActionEnum.GAINS,
              bands: remaining,
            });
          }
        };

        try {
          const finished = await revealBands(plan.steps, land, {
            isCurrent: () => bandSetGenerationRef.current === generation,
          });
          if (finished || bandSetReplacementRef.current !== replacement) {
            // Either it ran to the end, or a whole new band set took the
            // editor — a second reference applied, Clear EQ, an output switch,
            // all of which arrive as an INIT. What is on screen is right and
            // the rest of this tuning is history.
            return;
          }
          // Otherwise a band was added or deleted, which stops the animation
          // without replacing anything: every band it had not reached is still
          // holding the 0 dB it starts from while Equalizer APO and the saved
          // profile carry the whole reference. Land the remainder at once — a
          // flat editor over a tuned config is a lie the user cannot see, and
          // their next slider drag would write it back.
          land(plan.steps.flat());
        } finally {
          if (revealEditedIdsRef.current === editedDuringReveal) {
            revealEditedIdsRef.current = undefined;
          }
        }
      } catch (e) {
        setGlobalError(e as ErrorDescription);
      }
    },
    [dispatchFilter],
  );

  const performHealthCheck = useCallback(async () => {
    setIsLoading(true);
    await refreshState();
    setIsLoading(false);
  }, [refreshState]);

  useEffect(() => {
    performHealthCheck();
  }, [performHealthCheck]);

  // The main process owns the switch: it notices Windows changing endpoint,
  // loads that output's profile and then says so. Everything on screen — bands,
  // preamp, voicing, driver correction, convolution — is a property of the
  // output it was tuned on, so all of it is re-read here rather than each panel
  // being left to work out that it is now showing the wrong device.
  useEffect(() => {
    const unsubscribe = window.electron.ipcRenderer.on(
      OUTPUT_STATE_CHANGED_EVENT,
      () => {
        refreshState();
        // The profile card and the output picker key off this to re-read which
        // profile is attached where.
        window.dispatchEvent(new CustomEvent('fluideq-output-changed'));
      },
    );
    return () => {
      unsubscribe();
    };
  }, [refreshState]);

  return (
    <FluidEqProviderWrapper
      value={{
        isLoading,
        globalError,
        isBlockingError: isBlockingErrorCode(globalError),
        isEngineUsable: isEnabled && !isBlockingErrorCode(globalError),
        isEnabled,
        loudness,
        setLoudness,
        isAutoPreAmpOn,
        isGraphViewOn,
        isCaseSensitiveFs,
        preAmp,
        filters,
        performHealthCheck,
        refreshState,
        setGlobalError,
        setIsEnabled,
        setAutoPreAmpOn,
        setGraphViewOn,
        setPreAmp,
        convolution,
        setConvolution,
        headset,
        headsetTarget,
        headsetSource,
        voicing,
        driver,
        smartEq,
        setDriver,
        setVoicing,
        setSmartEq,
        selectedFilterId,
        setSelectedFilterId,
        selectedFilterIds,
        setSelectedFilterIds,
        toggleFilterSelection,
        hoveredFilterId,
        setHoveredFilterId,
        dispatchFilter,
        getBandSetGeneration,
      }}
    >
      {children}
    </FluidEqProviderWrapper>
  );
};

export const useFluidEqContext = () => {
  const context = useContext(FluidEqContext);
  if (context === undefined) {
    throw new Error('useFluidEqContext must be used within an FluidEqProvider');
  }
  return context;
};
