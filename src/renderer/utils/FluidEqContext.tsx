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
import { DEFAULT_DRIVER, IDriverSettings } from '../../common/driver';
import {
  ErrorDescription,
  isBlockingError as isBlockingErrorCode,
} from '../../common/errors';
import { cloneFilters } from '../../common/utils';
import { getEqualizerState } from './equalizerApi';

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
}

type NumericalFilterAction =
  FilterActionEnum.FREQUENCY | FilterActionEnum.GAIN | FilterActionEnum.QUALITY;

export type FilterAction =
  | { type: FilterActionEnum.INIT; filters: IFiltersMap }
  | { type: NumericalFilterAction; id: string; newValue: number }
  | { type: FilterActionEnum.TYPE; id: string; newValue: FilterTypeEnum }
  | { type: FilterActionEnum.ADD; id: string; frequency: number }
  | { type: FilterActionEnum.REMOVE; id: string }
  | { type: FilterActionEnum.CLEAR_GAINS };

type FilterDispatch = (action: FilterAction) => void;

export interface IFluidEqContext extends IState {
  isLoading: boolean;
  globalError: ErrorDescription | undefined;
  /** True only for failures that make the app genuinely unusable. */
  isBlockingError: boolean;
  performHealthCheck: () => void;
  refreshState: () => Promise<void>;
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
  /** Curated target curve written as its own APO layer after the EQ bands. */
  voicing?: IVoicingSettings;
  driver?: IDriverSettings;
  setDriver: (newValue: IDriverSettings) => void;
  setVoicing: (newValue: IVoicingSettings) => void;
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
  const [voicing, setVoicing] = useState<IVoicingSettings>(
    DEFAULT_STATE.voicing ?? DEFAULT_VOICING,
  );
  const [driver, setDriver] = useState<IDriverSettings>(
    DEFAULT_STATE.driver ?? DEFAULT_DRIVER,
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
  const [selectedFilterId, setSelectedFilterIdState] = useState<string>('');
  const [selectedFilterIds, setSelectedFilterIdsState] = useState<string[]>([]);
  const [hoveredFilterId, setHoveredFilterId] = useState<string>('');
  const [filters, dispatchFilter] = useReducer(
    filterReducer,
    DEFAULT_STATE.filters,
  );

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

  const refreshState = useCallback(async () => {
    try {
      const state = await getEqualizerState();
      setIsEnabled(state.isEnabled);
      // Keep the persisted preference so Auto normalize can be disabled for
      // users who want to set the APO preamp manually.
      setAutoPreAmpOn(state.isAutoPreAmpOn);
      setGraphViewOn(state.isGraphViewOn);
      setPreAmp(state.preAmp);
      setConvolution(state.convolution);
      setVoicing(state.voicing ?? DEFAULT_VOICING);
      setDriver(state.driver ?? DEFAULT_DRIVER);
      setHeadset(state.headset);
      setHeadsetTarget(state.headsetTarget);
      dispatchFilter({ type: FilterActionEnum.INIT, filters: state.filters });
      setGlobalError(undefined);
      setIsCaseSensitiveFs(state.isCaseSensitiveFs);
    } catch (e) {
      setGlobalError(e as ErrorDescription);
    }
  }, []);

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
        isEnabled,
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
        voicing,
        driver,
        setDriver,
        setVoicing,
        selectedFilterId,
        setSelectedFilterId,
        selectedFilterIds,
        setSelectedFilterIds,
        toggleFilterSelection,
        hoveredFilterId,
        setHoveredFilterId,
        dispatchFilter,
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
