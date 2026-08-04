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

import { getDefaultState } from 'common/constants';
import { ErrorDescription } from 'common/errors';
import { FilterAction, IFluidEqContext } from 'renderer/utils/FluidEqContext';

const DEFAULT_STATE = getDefaultState();

const defaultFluidEqContext: IFluidEqContext = {
  isLoading: false,
  globalError: undefined,
  isBlockingError: false,
  driver: undefined,
  setDriver: () => {},
  refreshState: async () => {},
  isEnabled: DEFAULT_STATE.isEnabled,
  isAutoPreAmpOn: DEFAULT_STATE.isAutoPreAmpOn,
  isGraphViewOn: DEFAULT_STATE.isGraphViewOn,
  isCaseSensitiveFs: DEFAULT_STATE.isCaseSensitiveFs,
  preAmp: DEFAULT_STATE.preAmp,
  convolution: DEFAULT_STATE.convolution,
  filters: DEFAULT_STATE.filters,
  performHealthCheck: () => {},
  setGlobalError: (_newValue?: ErrorDescription) => {},
  setIsEnabled: (_newValue: boolean) => {},
  setAutoPreAmpOn: (_newValue: boolean) => {},
  setGraphViewOn: (_newValue: boolean) => {},
  setPreAmp: (_newValue: number) => {},
  setConvolution: () => {},
  setVoicing: () => {},
  smartEq: undefined,
  setSmartEq: () => {},
  selectedFilterId: '',
  setSelectedFilterId: (_newValue: string) => {},
  selectedFilterIds: [],
  setSelectedFilterIds: (_newValue: string[]) => {},
  toggleFilterSelection: (_id: string, _additive?: boolean) => {},
  hoveredFilterId: '',
  setHoveredFilterId: (_newValue: string) => {},
  dispatchFilter: (_action: FilterAction) => {},
  getBandSetGeneration: () => 0,
};

export default defaultFluidEqContext;
