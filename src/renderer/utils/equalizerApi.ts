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

import ChannelEnum from 'common/channels';
import { IGatheredFacts } from 'common/bugReport';
import {
  IFiltersMap,
  IAudioDevice,
  IDeviceProfileAssignment,
  IDeviceProfileSettings,
  IOpraUpdateStatus,
  IOpraProduct,
} from 'common/constants';
import { IConvolutionCatalogEntry } from 'common/convolution';
import { IApoConfigTree } from 'common/apoConfig';
import { IChainImport } from 'common/chainBundle';
// Types only. `lookupSongEq`, `checkpointSongEq`, `commitSongEq` and
// `forgetSongEq` below share names with the pure functions in
// `common/songEq.ts` on purpose — thin wrappers over channels of the same
// name — and `import type` erases this so nothing here can resolve to the
// pure implementation by accident.

import type { IOutputFormat, IOutputFormatChange } from 'main/outputFormat';
import coalesceRequests from 'common/coalescedRequest';
import type { IEqualizerSnapshot } from '../../common/outputSettings';

import {
  buildResponseHandler,
  sendRequest,
  setterResponseHandler,
  simpleResponseHandler,
} from './ipcRequest';
import type { TError, TSuccess } from './ipcRequest';

export {
  addEqualizerSlider,
  checkpointSongEq,
  clearGains,
  commitSongEq,
  forgetSongEq,
  getMainPreAmp,
  getType,
  lookupSongEq,
  removeEqualizerSlider,
  resetEqMode,
  setDriver,
  setEqCut,
  setEqMode,
  setEqShape,
  setFilterValues,
  setFixedBand,
  setFrequency,
  setGain,
  setHeadphone,
  setLayerBypass,
  setMainPreAmp,
  setQuality,
  setSmartEq,
  setTone,
  setType,
  setVoicing,
} from './equalizerEditApi';

// Re-exported: TSuccess and TError are the reply shapes the main process
// builds, and every IPC module imports them from here.
export * from './ipcRequest';

/**
 * Perform a health check to verify whether EqualizerAPO is installed
 * @deprecated - Removing with the context refactor
 * @returns { Promise<void> } exception if EqualizerAPO is not okay.
 */
export const healthCheck = (): Promise<void> => {
  const channel = ChannelEnum.HEALTH_CHECK;
  return sendRequest(channel, [], setterResponseHandler);
};

/**
 * Run the Equalizer APO installer that ships inside FluidEQ's.
 *
 * Not a download link. The installer is already on disk beside the app, so
 * this opens it directly — the alternative was a browser tab pointed at
 * SourceForge, which is a mirror list and a file to find again at the exact
 * moment the app is least able to explain itself.
 *
 * Resolves as soon as the installer has been started, not when it finishes:
 * APO's setup asks which devices to attach to and then asks to restart, so it
 * is minutes of somebody else's window. The health check is what notices the
 * result afterwards.
 * @returns { Promise<void> } exception if it could not be started
 */
export const installEqualizerApo = (): Promise<void> => {
  const channel = ChannelEnum.INSTALL_EQUALIZER_APO;
  return sendRequest(channel, [], setterResponseHandler);
};

/**
 * Everything a bug report needs, already redacted.
 *
 * Gathered in the main process because the logs and the registry are not
 * reachable from a renderer — and redacted there too, so the account name never
 * crosses the bridge in the first place rather than being cleaned up after it
 * arrives.
 * @returns { Promise<IGatheredFacts> } the facts, or an exception
 */
export const gatherBugReport = (): Promise<IGatheredFacts> => {
  const channel = ChannelEnum.GATHER_BUG_REPORT;
  return sendRequest<IGatheredFacts>(
    channel,
    [],
    buildResponseHandler<IGatheredFacts>((result, resolve) => resolve(result)),
  );
};

/**
 * Hand the report's email link to the user's mail app.
 *
 * Through main, which opens it only when it is addressed to this build's own
 * support address. Not `window.open`: the window's link handler opens the web
 * and nothing else, so a `mailto:` sent that way was dropped without a word.
 *
 * No deadline. Main answers the moment Windows does, refused or not, and a
 * mail app that is slow to start has not failed.
 * @returns { Promise<boolean> } whether a mail app was handed the link
 */
/**
 * Says a report gathered at `gatheredAt` has left the machine, so the next
 * report's logs begin there. Fire and forget, like the loggers: the report
 * is already delivered, and a failure to note it only makes the next one
 * longer.
 */
export const markBugReportDelivered = (gatheredAt: string): void => {
  try {
    window.electron.ipcRenderer.sendMessage(ChannelEnum.BUG_REPORT_DELIVERED, [
      gatheredAt,
    ]);
  } catch {
    // The preload is missing; the next report simply starts earlier.
  }
};

export const openSupportEmail = (url: string): Promise<boolean> => {
  const channel = ChannelEnum.OPEN_SUPPORT_EMAIL;
  return sendRequest<boolean>(
    channel,
    [url],
    buildResponseHandler<boolean>((result, resolve) => resolve(result)),
  );
};

const presetRequestArgs = (names: string[], deviceId?: string) =>
  deviceId ? [...names, { deviceId }] : names;

/**
 * Load preset into backend state
 * @param {string} presetName - name of preset to load
 * @returns { Promise<void> } exception if failed
 */
export const loadPreset = (
  presetName: string,
  deviceId?: string,
): Promise<void> => {
  const channel = ChannelEnum.LOAD_PRESET;
  return sendRequest(
    channel,
    presetRequestArgs([presetName], deviceId),
    setterResponseHandler,
  );
};

/**
 * Write the current settings into the profile of this name.
 *
 * An update, always: the profile named here is the one that ends up holding
 * the sound. Making a new one is `createPreset`, which is the only call that
 * may invent a name.
 */
export const savePreset = (
  presetName: string,
  deviceId?: string,
): Promise<void> => {
  const channel = ChannelEnum.SAVE_PRESET;
  return sendRequest(
    channel,
    presetRequestArgs([presetName], deviceId),
    setterResponseHandler,
  );
};

/**
 * Start a new profile holding the current settings.
 *
 * Resolves with the name it was actually given, which is numbered when this
 * output already has a profile called that.
 */
export const createPreset = (
  requestedName: string,
  deviceId?: string,
): Promise<string> => {
  const channel = ChannelEnum.CREATE_PRESET;
  return sendRequest(
    channel,
    presetRequestArgs([requestedName], deviceId),
    simpleResponseHandler<string>(),
  );
};

/**
 * Delete a preset file in preset folder
 * @param {string} presetName - preset to delete
 * @returns { Promise<void> } if delete was successful
 */
export const deletePreset = (
  presetName: string,
  deviceId?: string,
): Promise<void> => {
  const channel = ChannelEnum.DELETE_PRESET;
  return sendRequest(
    channel,
    presetRequestArgs([presetName], deviceId),
    setterResponseHandler,
  );
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
  deviceId?: string,
): Promise<void> => {
  const channel = ChannelEnum.RENAME_PRESET;
  return sendRequest(
    channel,
    presetRequestArgs([oldName, newName], deviceId),
    setterResponseHandler,
  );
};

/**
 * Get a list of preset file names in preset folder
 * @returns { Promise<string[]> } exception if failed.
 */
export const getPresetListFromFiles = (
  deviceId?: string,
): Promise<string[]> => {
  const channel = ChannelEnum.GET_PRESET_FILE_LIST;
  return sendRequest(
    channel,
    deviceId ? [{ deviceId }] : [],
    simpleResponseHandler<string[]>(),
  );
};

/**
 * Put a profile back to the state it was in when the user last pressed Save.
 * Everything since then auto-saved over the profile, so this is the undo.
 * @param {string} presetName - profile to roll back
 * @returns { Promise<void> } exception if there is no saved copy.
 */
export const restorePresetBaseline = (
  presetName: string,
  deviceId?: string,
): Promise<void> => {
  const channel = ChannelEnum.RESTORE_PRESET_BASELINE;
  return sendRequest(
    channel,
    presetRequestArgs([presetName], deviceId),
    setterResponseHandler,
  );
};

/**
 * Which profiles have a manually saved copy behind them.
 * @returns { Promise<string[]> } exception if failed.
 */
export const getPresetBaselineNames = (
  deviceId?: string,
): Promise<string[]> => {
  const channel = ChannelEnum.GET_PRESET_BASELINE_NAMES;
  return sendRequest(
    channel,
    deviceId ? [{ deviceId }] : [],
    simpleResponseHandler<string[]>(),
  );
};

/**
 * The Equalizer APO config as it stands on disk.
 *
 * Undefined when FluidEQ has never written there, which is a different thing
 * from an empty config and worth saying differently.
 * @returns { Promise<IApoConfigTree | undefined> } the tree, or nothing
 */
export const getApoConfigTree = (): Promise<IApoConfigTree> => {
  const channel = ChannelEnum.GET_APO_CONFIG_TREE;
  return sendRequest(channel, [], simpleResponseHandler<IApoConfigTree>());
};

/**
 * Write one config file back to disk.
 *
 * The main process checks the name against the files FluidEQ generates and
 * refuses anything else, so a bad name is an error rather than a write.
 * @param { string } fileName - a generated config file, no path
 * @param { string } contents - what it should say
 * @returns { Promise<void> } exception if the name is not one we may write
 */
export const writeApoConfigFile = (
  fileName: string,
  contents: string,
): Promise<void> => {
  const channel = ChannelEnum.WRITE_APO_CONFIG_FILE;
  return sendRequest(channel, [fileName, contents], setterResponseHandler);
};

/**
 * Show the desktop Save As dialog for a shareable DSP rack.
 *
 * The result is false only when the dialog was cancelled. Main owns the path
 * and validates the serialised preset before writing it.
 */
export const exportEqPreset = (
  suggestedName: string,
  contents: string,
): Promise<boolean> => {
  const channel = ChannelEnum.EXPORT_EQ_PRESET;
  return sendRequest(
    channel,
    [suggestedName, contents],
    simpleResponseHandler<boolean>(),
  );
};

/** Show the desktop Save As dialog for a complete DSP filter chain. */
export const exportDspChainPreset = (
  suggestedName: string,
  contents: string,
): Promise<boolean> => {
  const channel = ChannelEnum.EXPORT_DSP_PRESET;
  return sendRequest(
    channel,
    [suggestedName, contents],
    simpleResponseHandler<boolean>(),
  );
};

/**
 * One output's whole chain, out to a file.
 *
 * Named by the `Device:` pattern rather than by endpoint id, because that is
 * what the config panel has: it reads the config off disk, where an output is a
 * GUID or a name and never the id Windows uses internally.
 *
 * Resolves with an empty string when the save dialog was cancelled, which is an
 * ordinary outcome rather than a failure.
 */
export const exportDeviceChain = (devicePattern: string): Promise<string> => {
  const channel = ChannelEnum.EXPORT_DEVICE_CHAIN;
  return sendRequest(channel, [devicePattern], simpleResponseHandler<string>());
};

/**
 * A chain from a file, onto the output being listened on.
 *
 * Takes no argument for that reason: importing changes what is heard, and the
 * only output somebody can check the result on is the one already playing.
 *
 * Answers with more than a note because part of a bundle can be refused while
 * the rest of it lands — the sender's custom block, when it carries something
 * that would execute. Main can only report that as a flag; the sentence for it
 * lives where the dictionary does.
 */
export const importDeviceChain = (): Promise<IChainImport> => {
  const channel = ChannelEnum.IMPORT_DEVICE_CHAIN;
  return sendRequest(channel, [], simpleResponseHandler<IChainImport>());
};

/**
 * The list as the window last read it — see `readKnownAudioDevices`.
 */
let knownDevices: IAudioDevice[] | undefined;
let isWatchingForChanges = false;

/**
 * Coalesced: every panel that names an output re-reads this list on the same
 * output change, and each read is a PowerShell enumeration in main.
 */
const requestAudioDevices = coalesceRequests((): Promise<IAudioDevice[]> => {
  const channel = ChannelEnum.GET_AUDIO_DEVICES;
  return sendRequest(channel, [], simpleResponseHandler<IAudioDevice[]>());
});

/** Ask main for the list now — for the output panel's own refresh. */
export const getAudioDevices = async (): Promise<IAudioDevice[]> => {
  const devices = await requestAudioDevices();
  knownDevices = devices;
  return devices;
};

const settleAudioDevices = simpleResponseHandler<IAudioDevice[]>();

const isAudioDevicesReply = (
  payload: unknown,
): payload is TSuccess<IAudioDevice[]> | TError =>
  typeof payload === 'object' &&
  payload !== null &&
  ('errorCode' in payload ||
    ('result' in payload && Array.isArray(payload.result)));

/**
 * The list main read by itself because Windows said the outputs moved
 * (`outputWatch.ts`), pushed once main has followed it — which is what the
 * output panel used to poll for every three seconds.
 *
 * Each push reaches `listener` as the reading a request would have been: the
 * list, or the error main would have replied with. The kept list takes the
 * list first, exactly as `getAudioDevices` does, because nothing the window
 * read is newer.
 */
export const subscribeAudioDevices = (
  listener: (reading: Promise<IAudioDevice[]>) => void,
): (() => void) => {
  const off = window.electron?.ipcRenderer.on(
    ChannelEnum.AUDIO_DEVICES_CHANGED,
    (payload: unknown) => {
      // Main builds this in one place (`followOutputs`) with the reply's own
      // type; anything else is not an answer about the outputs.
      if (!isAudioDevicesReply(payload)) {
        return;
      }
      const reading = new Promise<IAudioDevice[]>((resolve, reject) => {
        settleAudioDevices(payload, resolve, reject);
      }).then((devices) => {
        knownDevices = devices;
        return devices;
      });
      listener(reading);
    },
  );
  return off ?? (() => undefined);
};

/**
 * The list the window already holds, asked for only when it may have moved.
 *
 * The output panel reads the list when it mounts and when the window is come
 * back to, and main pushes it whenever Windows says the outputs moved
 * (`subscribeAudioDevices`); every page that names an output — the EQ's
 * rate and the graph's, the DSP meters, the output being listened to — asked
 * main again each time it was opened: one more PowerShell run per visit, for
 * the list the panel had just read. The kept list is dropped whenever
 * something says the outputs may have moved — an output change announced, a
 * device plugged in or pulled out, or the window being come back to, where
 * Sound settings may have been used — so a reader after any of them asks main
 * exactly as before. Dropped in the capture phase, ahead of the readers' own
 * listeners for the same events: the extra-outputs mirror re-reads the list
 * on `devicechange`, and read after this it got the list from before the
 * change.
 *
 * The window's own focus only. Focus does not bubble but it is captured, so a
 * capturing listener on the window hears every control that takes focus — a
 * tab pressed was enough to drop the list, and the page it opened asked main
 * again, the run this exists to save.
 */
export const readKnownAudioDevices = (): Promise<IAudioDevice[]> => {
  if (!isWatchingForChanges) {
    isWatchingForChanges = true;
    const forget = () => {
      knownDevices = undefined;
    };
    window.addEventListener('fluideq-output-changed', forget, true);
    window.addEventListener(
      'focus',
      (event) => {
        if (event.target === window) {
          forget();
        }
      },
      true,
    );
    document.addEventListener('visibilitychange', forget, true);
    navigator.mediaDevices?.addEventListener?.('devicechange', forget, true);
  }
  return knownDevices ? Promise.resolve(knownDevices) : getAudioDevices();
};

export const setDefaultAudioDevice = (deviceId: string): Promise<void> => {
  const channel = ChannelEnum.SET_DEFAULT_AUDIO_DEVICE;
  return sendRequest(channel, [deviceId], setterResponseHandler);
};

/** One output's shared-mode format, and whether its driver takes 7.1. */
export const readOutputFormat = (deviceId: string): Promise<IOutputFormat> => {
  const channel = ChannelEnum.READ_OUTPUT_FORMAT;
  return sendRequest(
    channel,
    [deviceId],
    simpleResponseHandler<IOutputFormat>(),
  );
};

/** The Room's one press: the output becomes 7.1, its old format remembered. */
export const setOutputSevenOne = (
  deviceId: string,
): Promise<IOutputFormatChange> => {
  const channel = ChannelEnum.SET_OUTPUT_SEVEN_ONE;
  return sendRequest(
    channel,
    [deviceId],
    simpleResponseHandler<IOutputFormatChange>(),
  );
};

/** A shipped head's text, for the Fit dialog to render its pairs through. */
export const readRoomHeadText = (head: string): Promise<string> => {
  const channel = ChannelEnum.READ_ROOM_HEAD;
  return sendRequest(channel, [head], simpleResponseHandler<string>());
};

/** Undo: the output goes back to what it was before the press. */
export const restoreOutputFormat = (
  deviceId: string,
): Promise<IOutputFormatChange> => {
  const channel = ChannelEnum.RESTORE_OUTPUT_FORMAT;
  return sendRequest(
    channel,
    [deviceId],
    simpleResponseHandler<IOutputFormatChange>(),
  );
};

export const activateAudioDeviceProfile = (deviceId: string): Promise<void> => {
  const channel = ChannelEnum.ACTIVATE_AUDIO_DEVICE_PROFILE;
  return sendRequest(channel, [deviceId], setterResponseHandler);
};

export const getDeviceProfileSettings = (): Promise<IDeviceProfileSettings> => {
  const channel = ChannelEnum.GET_DEVICE_PROFILE_SETTINGS;
  return sendRequest(
    channel,
    [],
    simpleResponseHandler<IDeviceProfileSettings>(),
  );
};

export const assignDeviceProfile = (
  assignment: IDeviceProfileAssignment,
  secondOutputOnly = false,
): Promise<void> => {
  const channel = ChannelEnum.ASSIGN_DEVICE_PROFILE;
  return sendRequest(
    channel,
    secondOutputOnly ? [assignment, true] : [assignment],
    setterResponseHandler,
  );
};

export const removeDeviceProfile = (deviceId: string): Promise<void> => {
  const channel = ChannelEnum.REMOVE_DEVICE_PROFILE;
  return sendRequest(channel, [deviceId], setterResponseHandler);
};

/**
 * Get every headphone in the bundled OPRA library, with its curve metadata.
 * @returns { Promise<IOpraProduct[]> } exception if failed.
 */
export const getOpraProductList = (): Promise<IOpraProduct[]> => {
  const channel = ChannelEnum.GET_OPRA_PRODUCT_LIST;
  return sendRequest(channel, [], simpleResponseHandler<IOpraProduct[]>());
};

/**
 * What to call an OPRA product on screen, resolved from its id.
 * @param {string} productId - OPRA product id, `vendor::slug`
 * @param {string} curveId - append the measurement's name when given
 * @returns { Promise<string> } empty when this library does not know the id
 */
export const getOpraLabel = (
  productId: string,
  curveId?: string,
): Promise<string> => {
  const channel = ChannelEnum.GET_OPRA_LABEL;
  return sendRequest(
    channel,
    [productId, curveId],
    simpleResponseHandler<string>(),
  );
};

/**
 * Load one OPRA curve into the backend state as the headphone layer.
 * @param {string} productId - OPRA product id, `vendor::slug`
 * @param {string} curveId - which of that product's curves to apply
 * @returns { Promise<void> } exception if failed
 */
export const loadOpraPreset = (
  productId: string,
  curveId: string,
  profileName?: string,
): Promise<void> => {
  const channel = ChannelEnum.LOAD_OPRA_PRESET;
  return sendRequest(
    channel,
    [productId, curveId, profileName],
    setterResponseHandler,
  );
};

export const getConvolutionCatalog = (
  query = '',
): Promise<IConvolutionCatalogEntry[]> => {
  const channel = ChannelEnum.GET_CONVOLUTION_CATALOG;
  return sendRequest(
    channel,
    [query],
    simpleResponseHandler<IConvolutionCatalogEntry[]>(),
  );
};

export const downloadConvolution = (entryId: string): Promise<void> => {
  const channel = ChannelEnum.DOWNLOAD_CONVOLUTION;
  return sendRequest(channel, [entryId], setterResponseHandler);
};

/**
 * Clear the reference model and the bands it wrote.
 *
 * Hands back the new filter map for the same reason clearGains does: the reset
 * mints fresh band ids, so every id the caller is still holding has just
 * stopped existing.
 */
export const clearHeadset = (): Promise<IFiltersMap> => {
  const channel = ChannelEnum.CLEAR_HEADSET;
  return sendRequest(channel, [], simpleResponseHandler<IFiltersMap>());
};

export const clearConvolution = (): Promise<void> => {
  const channel = ChannelEnum.CLEAR_CONVOLUTION;
  return sendRequest(channel, [], setterResponseHandler);
};

/**
 * Import an EQ from a file the user picks.
 *
 * Resolves with a short description of what was applied, or an empty string if
 * they cancelled — the caller shows the former and ignores the latter.
 */
export const importEqFile = (): Promise<string> => {
  const channel = ChannelEnum.IMPORT_EQ_FILE;
  return sendRequest(channel, [], simpleResponseHandler<string>());
};

/** Apply EQ text pasted or read by the Squiglink import panel. */
export const importEqText = (
  text: string,
  label = 'Squiglink export',
  destination: 'eq' | 'curve' = 'eq',
): Promise<string> => {
  const channel = ChannelEnum.IMPORT_EQ_TEXT;
  return sendRequest(
    channel,
    [text, label, destination],
    simpleResponseHandler<string>(),
  );
};

/** Import a WAV impulse response the user picks. Same contract as above. */
export const importConvolutionFile = (): Promise<string> => {
  const channel = ChannelEnum.IMPORT_CONVOLUTION_FILE;
  return sendRequest(channel, [], simpleResponseHandler<string>());
};

export const checkOpraUpdate = (): Promise<IOpraUpdateStatus> => {
  const channel = ChannelEnum.CHECK_OPRA_UPDATE;
  return sendRequest(channel, [], simpleResponseHandler<IOpraUpdateStatus>());
};

export const updateOpraDatabase = (): Promise<IOpraUpdateStatus> => {
  const channel = ChannelEnum.UPDATE_OPRA_DATABASE;
  return sendRequest(channel, [], simpleResponseHandler<IOpraUpdateStatus>());
};

/**
 * Get the full equalizer state
 * @returns { Promise<IState> } return the state, exception if failed.
 */
export const getEqualizerState = (): Promise<IEqualizerSnapshot> => {
  const channel = ChannelEnum.GET_STATE;

  return sendRequest(channel, [], simpleResponseHandler<IEqualizerSnapshot>());
};

/**
 * Enable Equalizer
 * @returns { Promise<void> } exception if failed.
 */
export const enableEqualizer = (): Promise<void> => {
  const channel = ChannelEnum.SET_ENABLE;
  return sendRequest(channel, [true], setterResponseHandler);
};

/**
 * Disable Equalizer
 * @returns { Promise<void> } exception if failed.
 */
export const disableEqualizer = (): Promise<void> => {
  const channel = ChannelEnum.SET_ENABLE;
  return sendRequest(channel, [false], setterResponseHandler);
};

/**
 * Enable Auto Pre-Amp
 * @returns { Promise<void> } exception if failed.
 */
export const enableAutoPreAmp = (): Promise<number> => {
  const channel = ChannelEnum.SET_AUTO_PREAMP;
  return sendRequest(channel, [true], simpleResponseHandler<number>());
};

/**
 * Disable Auto Pre-Amp
 * @returns { Promise<void> } exception if failed.
 */
export const disableAutoPreAmp = (): Promise<number> => {
  const channel = ChannelEnum.SET_AUTO_PREAMP;
  return sendRequest(channel, [false], simpleResponseHandler<number>());
};

/**
 * Report what the capture has heard to the process that owns the preamp.
 *
 * Only one report is in flight. A correlated reply confirms the config write;
 * cancellation removes the listener when the capture or engine changes.
 */
export const sendSmartHeadroomMeasurement = (
  programme: Array<{ frequency: number; gain: number }>,
  trimDb: number,
  onApplied: (applied: boolean) => void,
): (() => void) => {
  const requestId = crypto.randomUUID();
  const unsubscribe = window.electron.ipcRenderer.on(
    ChannelEnum.SET_SMART_HEADROOM_MEASUREMENT,
    (reply: unknown) => {
      if (!reply || typeof reply !== 'object' || !('result' in reply)) {
        return;
      }
      const result = reply.result as { requestId?: unknown; applied?: unknown };
      if (!result || result.requestId !== requestId) {
        return;
      }
      unsubscribe();
      onApplied(result.applied === true);
    },
  );
  window.electron.ipcRenderer.sendMessage(
    ChannelEnum.SET_SMART_HEADROOM_MEASUREMENT,
    [programme, trimDb, requestId],
  );
  return unsubscribe;
};

/**
 * Enable Graph View
 * @returns { Promise<void> } exception if failed.
 */
export const enableGraphView = (): Promise<void> => {
  const channel = ChannelEnum.SET_GRAPH_VIEW;
  return sendRequest(channel, [true], setterResponseHandler);
};

/**
 * Disable Graph View
 * @returns { Promise<void> } exception if failed.
 */
export const disableGraphView = (): Promise<void> => {
  const channel = ChannelEnum.SET_GRAPH_VIEW;
  return sendRequest(channel, [false], setterResponseHandler);
};

// These four deliberately share names with the pure functions of the same
// name in common/songEq.ts. Those take the whole store and return a new one;
// these talk to main over IPC and return a promise. The renderer reaches the
// song EQ store only through these wrappers, never by importing the pure
// functions directly.
