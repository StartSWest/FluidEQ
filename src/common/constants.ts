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

export const clampGain = (gain: number) =>
  Math.min(MAX_GAIN, Math.max(MIN_GAIN, gain));

export const MAX_FREQUENCY = 20000;
export const MIN_FREQUENCY = 1;
export const MIN_QUALITY = 0.01;
// Equalizer APO accepts very narrow filters, but values above 33.3333 make
// the UI unnecessarily difficult to control and are not useful in practice.
export const MAX_QUALITY = 33.3333;

export const clampQuality = (quality: number) =>
  Math.min(MAX_QUALITY, Math.max(MIN_QUALITY, quality));

// Equalizer APO does not impose AQUA's old 20-band UI limit. 128 keeps the
// editor responsive while allowing large imported and hand-built profiles.
export const MAX_NUM_FILTERS = 128;
export const MIN_NUM_FILTERS = 1;
// Endpoint-scoped profiles are created automatically when a user edits an
// output without choosing a named profile. They stay out of the named profile
// picker but keep the tuning persistent across restarts.
export const AUTOMATIC_PRESET_PREFIX = '.fluideq-auto-';

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
