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

import ChannelEnum from 'common/channels';
import {
  ErrorCode,
  ErrorDescription,
  getErrorDescription,
} from 'common/errors';
import {
  FilterTypeEnum,
  FixedBandSizeEnum,
  IFiltersMap,
  IState,
  IAudioDevice,
  IDeviceProfileAssignment,
  IDeviceProfileSettings,
  IAutoEqUpdateStatus,
  MAX_FREQUENCY,
  MAX_GAIN,
  MAX_QUALITY,
  MIN_FREQUENCY,
  MIN_GAIN,
  MIN_QUALITY,
  IConvolutionProfile,
  ISquigSource,
} from 'common/constants';
import { IConvolutionCatalogEntry } from 'common/convolution';

const TIMEOUT = 10000;

export interface TSuccess<Type> {
  result: Type;
}

export interface TError {
  errorCode: ErrorCode;
}

type TResult<Type> = TSuccess<Type> | TError;

const toError = (description: ErrorDescription): Error & ErrorDescription =>
  Object.assign(new Error(description.shortError), description);

const promisifyResult = <Type>(
  responseHandler: (
    arg: TResult<Type>,
    resolve: (value: Type | PromiseLike<Type>) => void,
    reject: (reason?: ErrorDescription) => void,
  ) => void,
  channel: string,
  timeout = TIMEOUT,
) => {
  return new Promise<Type>((resolve, reject) => {
    let timer: NodeJS.Timeout;

    const handler = (arg: unknown) => {
      responseHandler(arg as TResult<Type>, resolve, reject);
      clearTimeout(timer);
    };

    window.electron.ipcRenderer.once(channel, handler);

    timer = setTimeout(() => {
      reject(toError(getErrorDescription(ErrorCode.TIMEOUT)));
      window.electron.ipcRenderer.removeListener(channel, handler);
    }, timeout);
  });
};

const buildResponseHandler = <
  Type extends
    | string
    | number
    | boolean
    | void
    | IState
    | IFiltersMap
    | string[]
    | IAudioDevice[]
    | IDeviceProfileSettings
    | IAutoEqUpdateStatus
    | IConvolutionCatalogEntry[]
    | IConvolutionProfile
    | ISquigSource[],
>(
  resultEvaluator: (
    result: Type,
    resolve: (value: Type | PromiseLike<Type>) => void,
    reject: (reason?: ErrorDescription) => void,
  ) => void,
) => {
  return (
    arg: TResult<Type>,
    resolve: (value: Type | PromiseLike<Type>) => void,
    reject: (reason?: ErrorDescription) => void,
  ) => {
    if ('errorCode' in arg) {
      reject(toError(getErrorDescription(arg.errorCode)));
      return;
    }
    const { result } = arg as TSuccess<Type>;
    resultEvaluator(result as Type, resolve, reject);
  };
};

const simpleResponseHandler = <
  Type extends
    | string
    | number
    | boolean
    | void
    | IState
    | IFiltersMap
    | string[]
    | IAudioDevice[]
    | IDeviceProfileSettings
    | IAutoEqUpdateStatus
    | IConvolutionCatalogEntry[]
    | IConvolutionProfile
    | ISquigSource[],
>() =>
  buildResponseHandler<Type>((result, resolve) => {
    resolve(result);
  });

const setterResponseHandler = buildResponseHandler<void>((_result, resolve) =>
  resolve(),
);

/**
 * Perform a health check to verify whether EqualizerAPO is installed
 * @deprecated - Removing with the context refactor
 * @returns { Promise<void> } exception if EqualizerAPO is not okay.
 */
export const healthCheck = (): Promise<void> => {
  const channel = ChannelEnum.HEALTH_CHECK;
  window.electron.ipcRenderer.sendMessage(channel, []);
  return promisifyResult(setterResponseHandler, channel);
};

/**
 * Load preset into backend state
 * @param {string} presetName - name of preset to load
 * @returns { Promise<void> } exception if failed
 */
export const loadPreset = (presetName: string): Promise<void> => {
  const channel = ChannelEnum.LOAD_PRESET;
  window.electron.ipcRenderer.sendMessage(channel, [presetName]);
  return promisifyResult(setterResponseHandler, channel);
};

/**
 * Save preset into preset file
 * @param {string} presetName - name to save preset under
 * @returns { Promise<void> } if save was successful
 */
export const savePreset = (presetName: string): Promise<void> => {
  const channel = ChannelEnum.SAVE_PRESET;
  window.electron.ipcRenderer.sendMessage(channel, [presetName]);
  return promisifyResult(setterResponseHandler, channel);
};

/**
 * Delete a preset file in preset folder
 * @param {string} presetName - preset to delete
 * @returns { Promise<void> } if delete was successful
 */
export const deletePreset = (presetName: string): Promise<void> => {
  const channel = ChannelEnum.DELETE_PRESET;
  window.electron.ipcRenderer.sendMessage(channel, [presetName]);
  return promisifyResult(setterResponseHandler, channel);
};

/**
 * Rename preset from an old name to a new one
 * @param {string} oldName - preset name to change
 * @param {string} newName - new preset name
 * @returns { Promise<void> } if rename was successful
 */
export const renamePreset = (
  oldName: string,
  newName: string,
): Promise<void> => {
  const channel = ChannelEnum.RENAME_PRESET;
  window.electron.ipcRenderer.sendMessage(channel, [oldName, newName]);
  return promisifyResult(setterResponseHandler, channel);
};

/**
 * Get a list of preset file names in preset folder
 * @returns { Promise<string[]> } exception if failed.
 */
export const getPresetListFromFiles = (): Promise<string[]> => {
  const channel = ChannelEnum.GET_PRESET_FILE_LIST;
  window.electron.ipcRenderer.sendMessage(channel, []);
  return promisifyResult(simpleResponseHandler<string[]>(), channel);
};

/**
 * Put a profile back to the state it was in when the user last pressed Save.
 * Everything since then auto-saved over the profile, so this is the undo.
 * @param {string} presetName - profile to roll back
 * @returns { Promise<void> } exception if there is no saved copy.
 */
export const restorePresetBaseline = (presetName: string): Promise<void> => {
  const channel = ChannelEnum.RESTORE_PRESET_BASELINE;
  window.electron.ipcRenderer.sendMessage(channel, [presetName]);
  return promisifyResult(setterResponseHandler, channel);
};

/**
 * Which profiles have a manually saved copy behind them.
 * @returns { Promise<string[]> } exception if failed.
 */
export const getPresetBaselineNames = (): Promise<string[]> => {
  const channel = ChannelEnum.GET_PRESET_BASELINE_NAMES;
  window.electron.ipcRenderer.sendMessage(channel, []);
  return promisifyResult(simpleResponseHandler<string[]>(), channel);
};

export const getAudioDevices = (): Promise<IAudioDevice[]> => {
  const channel = ChannelEnum.GET_AUDIO_DEVICES;
  window.electron.ipcRenderer.sendMessage(channel, []);
  return promisifyResult(simpleResponseHandler<IAudioDevice[]>(), channel);
};

export const setDefaultAudioDevice = (deviceId: string): Promise<void> => {
  const channel = ChannelEnum.SET_DEFAULT_AUDIO_DEVICE;
  window.electron.ipcRenderer.sendMessage(channel, [deviceId]);
  return promisifyResult(setterResponseHandler, channel);
};

export const activateAudioDeviceProfile = (deviceId: string): Promise<void> => {
  const channel = ChannelEnum.ACTIVATE_AUDIO_DEVICE_PROFILE;
  window.electron.ipcRenderer.sendMessage(channel, [deviceId]);
  return promisifyResult(setterResponseHandler, channel);
};

export const getDeviceProfileSettings = (): Promise<IDeviceProfileSettings> => {
  const channel = ChannelEnum.GET_DEVICE_PROFILE_SETTINGS;
  window.electron.ipcRenderer.sendMessage(channel, []);
  return promisifyResult(
    simpleResponseHandler<IDeviceProfileSettings>(),
    channel,
  );
};

export const assignDeviceProfile = (
  assignment: IDeviceProfileAssignment,
): Promise<void> => {
  const channel = ChannelEnum.ASSIGN_DEVICE_PROFILE;
  window.electron.ipcRenderer.sendMessage(channel, [assignment]);
  return promisifyResult(setterResponseHandler, channel);
};

export const removeDeviceProfile = (deviceId: string): Promise<void> => {
  const channel = ChannelEnum.REMOVE_DEVICE_PROFILE;
  window.electron.ipcRenderer.sendMessage(channel, [deviceId]);
  return promisifyResult(setterResponseHandler, channel);
};

/**
 * Get a list of supported auto eq device names
 * @returns { Promise<string[]> } exception if failed.
 */
export const getAutoEqDeviceList = (): Promise<string[]> => {
  const channel = ChannelEnum.GET_AUTO_EQ_DEVICE_LIST;
  window.electron.ipcRenderer.sendMessage(channel, []);
  return promisifyResult(simpleResponseHandler<string[]>(), channel);
};

/**
 * Get a list of supported auto eq responses for the given device
 * @param {string} deviceName - device to search auto eq presets under
 * @returns { Promise<string[]> } exception if failed.
 */
export const getAutoEqResponseList = (
  deviceName: string,
): Promise<string[]> => {
  const channel = ChannelEnum.GET_AUTO_EQ_RESPONSE_LIST;
  window.electron.ipcRenderer.sendMessage(channel, [deviceName]);
  return promisifyResult(simpleResponseHandler<string[]>(), channel);
};

/**
 * Load autoeq preset for given device name and response into the backend state
 * @param {string} deviceName - device to search auto eq presets under
 * @param {string} responseName - response to load
 * @returns { Promise<void> } exception if failed
 */
export const loadAutoEqPreset = (
  deviceName: string,
  responseName: string,
  profileName?: string,
): Promise<void> => {
  const channel = ChannelEnum.LOAD_AUTO_EQ_PRESET;
  window.electron.ipcRenderer.sendMessage(channel, [
    deviceName,
    responseName,
    profileName,
  ]);
  return promisifyResult(setterResponseHandler, channel);
};

const DEFAULT_SQUIG_SOURCE = 'squiglink-gadgetrytech-headphones-headsets';

export const getSquiglinkSourceList = (): Promise<ISquigSource[]> => {
  const channel = ChannelEnum.GET_SQUIGLINK_SOURCE_LIST;
  window.electron.ipcRenderer.sendMessage(channel, []);
  return promisifyResult(simpleResponseHandler<ISquigSource[]>(), channel);
};

export const getSquiglinkDeviceList = (
  sourceId = DEFAULT_SQUIG_SOURCE,
): Promise<string[]> => {
  const channel = ChannelEnum.GET_SQUIGLINK_DEVICE_LIST;
  window.electron.ipcRenderer.sendMessage(channel, [sourceId]);
  return promisifyResult(simpleResponseHandler<string[]>(), channel);
};

export const getSquiglinkResponseList = (
  sourceIdOrDevice: string,
  deviceMaybe?: string,
): Promise<string[]> => {
  const channel = ChannelEnum.GET_SQUIGLINK_RESPONSE_LIST;
  const sourceId = deviceMaybe ? sourceIdOrDevice : DEFAULT_SQUIG_SOURCE;
  const deviceName = deviceMaybe || sourceIdOrDevice;
  window.electron.ipcRenderer.sendMessage(channel, [sourceId, deviceName]);
  return promisifyResult(simpleResponseHandler<string[]>(), channel);
};

export const loadSquiglinkPreset = (
  sourceIdOrDevice: string,
  deviceOrResponse: string,
  responseOrProfile?: string,
  profileName?: string,
): Promise<void> => {
  const channel = ChannelEnum.LOAD_SQUIGLINK_PRESET;
  const sourceId = profileName ? sourceIdOrDevice : DEFAULT_SQUIG_SOURCE;
  const deviceName = profileName ? deviceOrResponse : sourceIdOrDevice;
  const responseName = profileName ? responseOrProfile : deviceOrResponse;
  const profile = profileName || responseOrProfile;
  window.electron.ipcRenderer.sendMessage(channel, [
    sourceId,
    deviceName,
    responseName,
    profile,
  ]);
  return promisifyResult(setterResponseHandler, channel);
};

export const getConvolutionCatalog = (
  query = '',
): Promise<IConvolutionCatalogEntry[]> => {
  const channel = ChannelEnum.GET_CONVOLUTION_CATALOG;
  window.electron.ipcRenderer.sendMessage(channel, [query]);
  return promisifyResult(
    simpleResponseHandler<IConvolutionCatalogEntry[]>(),
    channel,
    60 * 1000,
  );
};

export const downloadConvolution = (entryId: string): Promise<void> => {
  const channel = ChannelEnum.DOWNLOAD_CONVOLUTION;
  window.electron.ipcRenderer.sendMessage(channel, [entryId]);
  return promisifyResult(setterResponseHandler, channel, 5 * 60 * 1000);
};

export const clearConvolution = (): Promise<void> => {
  const channel = ChannelEnum.CLEAR_CONVOLUTION;
  window.electron.ipcRenderer.sendMessage(channel, []);
  return promisifyResult(setterResponseHandler, channel);
};

export const checkAutoEqUpdate = (): Promise<IAutoEqUpdateStatus> => {
  const channel = ChannelEnum.CHECK_AUTO_EQ_UPDATE;
  window.electron.ipcRenderer.sendMessage(channel, []);
  return promisifyResult(simpleResponseHandler<IAutoEqUpdateStatus>(), channel);
};

export const updateAutoEqDatabase = (): Promise<IAutoEqUpdateStatus> => {
  const channel = ChannelEnum.UPDATE_AUTO_EQ_DATABASE;
  window.electron.ipcRenderer.sendMessage(channel, []);
  return promisifyResult(
    simpleResponseHandler<IAutoEqUpdateStatus>(),
    channel,
    5 * 60 * 1000,
  );
};

/**
 * Get the full equalizer state
 * @returns { Promise<IState> } return the state, exception if failed.
 */
export const getEqualizerState = (): Promise<IState> => {
  const channel = ChannelEnum.GET_STATE;
  window.electron.ipcRenderer.sendMessage(channel, []);

  return promisifyResult(simpleResponseHandler<IState>(), channel);
};

/**
 * Get the current equalizer status
 * @deprecated - Removing with the context refactor
 * @returns { Promise<boolean> } true for on, false for off, exception otherwise
 */
export const getEqualizerStatus = (): Promise<boolean> => {
  const channel = ChannelEnum.GET_ENABLE;
  window.electron.ipcRenderer.sendMessage(channel, []);

  return promisifyResult(simpleResponseHandler<boolean>(), channel);
};

/**
 * Enable Equalizer
 * @returns { Promise<void> } exception if failed.
 */
export const enableEqualizer = (): Promise<void> => {
  const channel = ChannelEnum.SET_ENABLE;
  window.electron.ipcRenderer.sendMessage(channel, [true]);
  return promisifyResult(setterResponseHandler, channel);
};

/**
 * Disable Equalizer
 * @returns { Promise<void> } exception if failed.
 */
export const disableEqualizer = (): Promise<void> => {
  const channel = ChannelEnum.SET_ENABLE;
  window.electron.ipcRenderer.sendMessage(channel, [false]);
  return promisifyResult(setterResponseHandler, channel);
};

/**
 * Enable Auto Pre-Amp
 * @returns { Promise<void> } exception if failed.
 */
export const enableAutoPreAmp = (): Promise<void> => {
  const channel = ChannelEnum.SET_AUTO_PREAMP;
  window.electron.ipcRenderer.sendMessage(channel, [true]);
  return promisifyResult(setterResponseHandler, channel);
};

/**
 * Disable Auto Pre-Amp
 * @returns { Promise<void> } exception if failed.
 */
export const disableAutoPreAmp = (): Promise<void> => {
  const channel = ChannelEnum.SET_AUTO_PREAMP;
  window.electron.ipcRenderer.sendMessage(channel, [false]);
  return promisifyResult(setterResponseHandler, channel);
};

/**
 * Enable Graph View
 * @returns { Promise<void> } exception if failed.
 */
export const enableGraphView = (): Promise<void> => {
  const channel = ChannelEnum.SET_GRAPH_VIEW;
  window.electron.ipcRenderer.sendMessage(channel, [true]);
  return promisifyResult(setterResponseHandler, channel);
};

/**
 * Disable Graph View
 * @returns { Promise<void> } exception if failed.
 */
export const disableGraphView = (): Promise<void> => {
  const channel = ChannelEnum.SET_GRAPH_VIEW;
  window.electron.ipcRenderer.sendMessage(channel, [false]);
  return promisifyResult(setterResponseHandler, channel);
};

/**
 * Get the current main preamplification gain value
 * @deprecated - Removing with the context refactor
 * @returns { Promise<number> } gain - current system gain value in the range [-20, 20]
 */
export const getMainPreAmp = (): Promise<number> => {
  const channel = ChannelEnum.GET_PREAMP;
  window.electron.ipcRenderer.sendMessage(channel, []);
  return promisifyResult(simpleResponseHandler<number>(), channel);
};

/**
 * Adjusts the main preamplification gain value
 * @param {number} gain - new gain value in [-20, 20]
 */
export const setMainPreAmp = (gain: number) => {
  const channel = ChannelEnum.SET_PREAMP;
  if (gain > MAX_GAIN || gain < MIN_GAIN) {
    throw new Error(
      `Invalid gain value - outside of range [${MIN_GAIN}, ${MAX_GAIN}]`,
    );
  }
  window.electron.ipcRenderer.sendMessage(channel, [gain]);
  return promisifyResult(setterResponseHandler, channel);
};

/**
 * Get the a slider's gain value
 * @deprecated - Removing with the context refactor
 * @param {string} filterId - id of the slider being adjusted
 * @returns { Promise<number> } gain - current system gain value in the range [-20, 20]
 */
export const getGain = (filterId: string): Promise<number> => {
  const channel = ChannelEnum.GET_FILTER_GAIN;
  window.electron.ipcRenderer.sendMessage(channel, [filterId]);
  return promisifyResult(simpleResponseHandler<number>(), channel + filterId);
};

/**
 * Adjusts a slider's gain value
 * @param {string} filterId - id of the slider being adjusted
 * @param {number} gain - new gain value in [-20, 20]
 */
export const setGain = (filterId: string, gain: number) => {
  const channel = ChannelEnum.SET_FILTER_GAIN;
  if (gain > MAX_GAIN || gain < MIN_GAIN) {
    throw new Error(
      `Invalid gain value - outside of range [${MIN_GAIN}, ${MAX_GAIN}]`,
    );
  }
  window.electron.ipcRenderer.sendMessage(channel, [filterId, gain]);
  return promisifyResult(setterResponseHandler, channel + filterId);
};

/**
 * Get a slider's frequency
 * @deprecated - Removing with the context refactor
 * @param {string} filterId - id of the slider being adjusted
 * @returns { Promise<number> } frequency - frequency value in the range [0, 20000]
 */
export const getFrequency = (filterId: string): Promise<number> => {
  const channel = ChannelEnum.GET_FILTER_FREQUENCY;
  window.electron.ipcRenderer.sendMessage(channel, [filterId]);
  return promisifyResult(simpleResponseHandler<number>(), channel + filterId);
};

/**
 * Adjusts a slider's frequency
 * @param {string} filterId - id of the slider being adjusted
 * @param {frequency} frequency - new frequency value in [0, 20000]
 */
export const setFrequency = (filterId: string, frequency: number) => {
  const channel = ChannelEnum.SET_FILTER_FREQUENCY;
  if (frequency < MIN_FREQUENCY || frequency > MAX_FREQUENCY) {
    throw new Error(
      `Invalid gain value - outside of range (${MIN_FREQUENCY}, ${MAX_FREQUENCY}]`,
    );
  }
  window.electron.ipcRenderer.sendMessage(channel, [filterId, frequency]);
  return promisifyResult(setterResponseHandler, channel + filterId);
};

/**
 * Get a slider's quality
 * @deprecated - Removing with the context refactor
 * @param {string} filterId - id of the slider being adjusted
 * @returns { Promise<number> } quality - value in the range [0.01, 33.3333]
 */
export const getQuality = (filterId: string): Promise<number> => {
  const channel = ChannelEnum.GET_FILTER_QUALITY;
  window.electron.ipcRenderer.sendMessage(channel, [filterId]);
  return promisifyResult(simpleResponseHandler<number>(), channel + filterId);
};

/**
 * Adjusts a slider's quality
 * @param {string} filterId - id of the slider being adjusted
 * @param {number} quality - new quality value in [0.01, 33.3333]
 */
export const setQuality = (filterId: string, quality: number) => {
  const channel = ChannelEnum.SET_FILTER_QUALITY;
  if (quality < MIN_QUALITY || quality > MAX_QUALITY) {
    throw new Error(
      `Invalid quality value - outside of range [${MIN_QUALITY}, ${MAX_QUALITY}]`,
    );
  }
  window.electron.ipcRenderer.sendMessage(channel, [filterId, quality]);
  return promisifyResult(setterResponseHandler, channel + filterId);
};

/**
 * Get a slider's filter type
 * @deprecated - Removing with the context refactor
 * @param {string} filterId - id of the slider being adjusted
 * @returns { Promise<FilterTypeEnum> } filter type - value in FilterTypeEnum
 */
export const getType = (filterId: string): Promise<FilterTypeEnum> => {
  const channel = ChannelEnum.GET_FILTER_TYPE;
  window.electron.ipcRenderer.sendMessage(channel, [filterId]);
  return promisifyResult<FilterTypeEnum>(
    simpleResponseHandler<FilterTypeEnum>(),
    channel + filterId,
  );
};

/**
 * Adjusts a slider's filter type
 * @param {string} filterId - id of the slider being adjusted
 * @param {string} filterType - new filter type
 */
export const setType = (filterId: string, filterType: string) => {
  const channel = ChannelEnum.SET_FILTER_TYPE;
  window.electron.ipcRenderer.sendMessage(channel, [filterId, filterType]);
  return promisifyResult(setterResponseHandler, channel + filterId);
};

/**
 * Get number of equalizer bands
 * @deprecated - Removing with the context refactor
 * @returns { Promise<number> } exception if failed
 */
export const getEqualizerSliderCount = (): Promise<number> => {
  const channel = ChannelEnum.GET_FILTER_COUNT;
  window.electron.ipcRenderer.sendMessage(channel, []);
  return promisifyResult(simpleResponseHandler<number>(), channel);
};

/**
 * Add another slider
 * @param {number} frequency - frequency of the new slider
 * @returns { Promise<void> } exception if failed
 */
export const addEqualizerSlider = (frequency: number): Promise<string> => {
  const channel = ChannelEnum.ADD_FILTER;
  window.electron.ipcRenderer.sendMessage(channel, [frequency]);
  return promisifyResult(simpleResponseHandler<string>(), channel);
};

/**
 * Remove slider
 * @param {string} filterId - id of the slider to be removed
 * @returns { Promise<void> } exception if failed
 */
export const removeEqualizerSlider = (filterId: string): Promise<void> => {
  const channel = ChannelEnum.REMOVE_FILTER;
  window.electron.ipcRenderer.sendMessage(channel, [filterId]);
  return promisifyResult(setterResponseHandler, channel);
};

/**
 * Reset the EQ to the default neutral ten-band layout
 * @returns { Promise<IFiltersMap> } the restored filters, exception if failed
 */
export const clearGains = (): Promise<IFiltersMap> => {
  const channel = ChannelEnum.CLEAR_GAINS;
  window.electron.ipcRenderer.sendMessage(channel, []);
  return promisifyResult<IFiltersMap>(
    simpleResponseHandler<IFiltersMap>(),
    channel,
  );
};

/**
 * Apply a curated voicing as its own APO layer, leaving the EQ bands alone
 * @param { string } profileId - empty string removes the layer
 * @param { number } intensity - 0..1 scale on the profile's gains
 * @returns { Promise<void> } exception if failed
 */
export const setVoicing = (
  profileId: string,
  intensity: number,
): Promise<void> => {
  const channel = ChannelEnum.SET_VOICING;
  window.electron.ipcRenderer.sendMessage(channel, [profileId, intensity]);
  return promisifyResult(setterResponseHandler, channel);
};

/**
 * Sets filters to be the corresponding fixed band configuration
 * @param { FixedBandSizeEnum } size - Number of bands in the fixed configuration
 * @returns { Promise<void> } exception if failed
 */
export const setFixedBand = (size: FixedBandSizeEnum): Promise<IFiltersMap> => {
  const channel = ChannelEnum.SET_FIXED_BAND;
  window.electron.ipcRenderer.sendMessage(channel, [size]);
  return promisifyResult<IFiltersMap>(
    simpleResponseHandler<IFiltersMap>(),
    channel,
  );
};

/**
 * Increase Window Size
 * @returns { Promise<void> } exception if failed.
 */
export const increaseWindowSize = (): Promise<void> => {
  const channel = ChannelEnum.SET_WINDOW_SIZE;
  window.electron.ipcRenderer.sendMessage(channel, [true]);
  return promisifyResult(setterResponseHandler, channel);
};

/**
 * Decrease Window Size
 * @returns { Promise<void> } exception if failed.
 */
export const decreaseWindowSize = (): Promise<void> => {
  const channel = ChannelEnum.SET_WINDOW_SIZE;
  window.electron.ipcRenderer.sendMessage(channel, [false]);
  return promisifyResult(setterResponseHandler, channel);
};
