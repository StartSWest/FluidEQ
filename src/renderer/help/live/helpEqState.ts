/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import {
  FixedBandSizeEnum,
  getDefaultFilters,
  getDefaultState,
  type IFilter,
  type IFiltersMap,
} from 'common/constants';
import type { IFluidEqContext } from '../../utils/FluidEqContext';

/**
 * The equaliser the EQ chapter's figures are drawn from: ten bands in a gentle
 * smile — a little low end and air, the middle eased — on one output with the
 * FluidEQ Engine on it, handed to the page's own parts through
 * `FluidEqProviderWrapper` in place of the reader's state. Every setter does
 * nothing: the figures are inert, and a press that reached one would change
 * nothing anyway.
 */

/** Each band's gain, lowest frequency first. */
const GAINS = [3.5, 2.5, 1, -1, -2, -1, 0.5, 1.5, 2.5, 3];

const bands = (): IFiltersMap => {
  const sorted = Object.values(getDefaultFilters(FixedBandSizeEnum.TEN)).sort(
    (a, b) => a.frequency - b.frequency,
  );
  const map: IFiltersMap = {};
  sorted.forEach((filter, at) => {
    const band: IFilter = {
      ...filter,
      id: `help-band-${at}`,
      gain: GAINS[at] ?? 0,
    };
    map[band.id] = band;
  });
  return map;
};

const nothing = () => undefined;
const DEFAULT_STATE = getDefaultState();

export const HELP_EQ_FILTERS = bands();

/** The fifth band, the 500 Hz cut, chosen where a figure shows a selection. */
export const HELP_EQ_SELECTED = 'help-band-4';

const helpEqState = (selected: readonly string[] = []): IFluidEqContext => ({
  ...DEFAULT_STATE,
  activeDeviceId: 'help-output',
  isLoading: false,
  globalError: undefined,
  isBlockingError: false,
  isEngineUsable: true,
  driver: undefined,
  setDriver: nothing,
  setHeadphone: nothing,
  bypassed: [],
  refreshState: async () => undefined,
  isEnabled: true,
  isAutoPreAmpOn: true,
  isGraphViewOn: true,
  isCaseSensitiveFs: DEFAULT_STATE.isCaseSensitiveFs,
  preAmp: -3.5,
  convolution: undefined,
  filters: HELP_EQ_FILTERS,
  performHealthCheck: nothing,
  setGlobalError: nothing,
  setIsEnabled: nothing,
  setAutoPreAmpOn: nothing,
  setGraphViewOn: nothing,
  setPreAmp: nothing,
  setConvolution: nothing,
  setVoicing: nothing,
  smartEq: undefined,
  setSmartEq: nothing,
  setTone: nothing,
  selectedFilterId: selected[0] ?? '',
  setSelectedFilterId: nothing,
  selectedFilterIds: [...selected],
  setSelectedFilterIds: nothing,
  nextFilterSelection: (id: string) => [id],
  toggleFilterSelection: nothing,
  hoveredFilterId: '',
  setHoveredFilterId: nothing,
  dispatchFilter: nothing,
  getBandSetGeneration: () => 0,
  bandSetReplacement: 0,
});

export default helpEqState;
