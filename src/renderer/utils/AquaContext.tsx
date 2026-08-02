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
  IState,
} from '../../common/constants';
import { ErrorDescription } from '../../common/errors';
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

export interface IAquaContext extends IState {
  isLoading: boolean;
  globalError: ErrorDescription | undefined;
  performHealthCheck: () => void;
  refreshState: () => Promise<void>;
  setGlobalError: (newValue?: ErrorDescription) => void;
  setIsEnabled: (newValue: boolean) => void;
  setAutoPreAmpOn: (newValue: boolean) => void;
  setGraphViewOn: (newValue: boolean) => void;
  setPreAmp: (newValue: number) => void;
  /** Filter currently selected in the EQ editor and response graph. */
  selectedFilterId: string;
  setSelectedFilterId: (newValue: string) => void;
  /** Filter currently hovered in either the EQ editor or response graph. */
  hoveredFilterId: string;
  setHoveredFilterId: (newValue: string) => void;
  dispatchFilter: FilterDispatch;
}

const AquaContext = createContext<IAquaContext | undefined>(undefined);

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
      const filtersCloned = cloneFilters(filters);
      Object.values(filtersCloned).forEach((f) => {
        f.gain = 0;
      });
      return filtersCloned;
    }
    default:
      // This throw does not actually do anything because
      // we are in a reducer
      throw new Error('Unhandled action type should not occur');
  }
};

export interface IAquaProviderWrapperProps {
  value: IAquaContext;
  children: ReactNode;
}

interface IAquaProviderProps {
  children: ReactNode;
}

export const AquaProviderWrapper = ({
  value,
  children,
}: IAquaProviderWrapperProps) => {
  return <AquaContext.Provider value={value}>{children}</AquaContext.Provider>;
};

export const AquaProvider = ({ children }: IAquaProviderProps) => {
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
  const [selectedFilterId, setSelectedFilterId] = useState<string>('');
  const [hoveredFilterId, setHoveredFilterId] = useState<string>('');
  const [filters, dispatchFilter] = useReducer(
    filterReducer,
    DEFAULT_STATE.filters,
  );

  const [isLoading, setIsLoading] = useState<boolean>(true);

  const setGraphViewOn = (newValue: boolean) => {
    setIsGraphViewOn(newValue);
    const root = document.getElementById('root');
    root?.setAttribute('class', newValue ? '' : 'minimized');
  };

  const refreshState = useCallback(async () => {
    try {
      const state = await getEqualizerState();
      setIsEnabled(state.isEnabled);
      // Automatic headroom protection is always enabled. Keep the state field
      // for compatibility with older config files, but do not let a legacy
      // false value disable the live auto-balance behavior.
      setAutoPreAmpOn(true);
      setGraphViewOn(state.isGraphViewOn);
      setPreAmp(state.preAmp);
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

  return (
    <AquaProviderWrapper
      value={{
        isLoading,
        globalError,
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
        selectedFilterId,
        setSelectedFilterId,
        hoveredFilterId,
        setHoveredFilterId,
        dispatchFilter,
      }}
    >
      {children}
    </AquaProviderWrapper>
  );
};

export const useAquaContext = () => {
  const context = useContext(AquaContext);
  if (context === undefined) {
    throw new Error('useAquaContext must be used within an AquaProvider');
  }
  return context;
};
