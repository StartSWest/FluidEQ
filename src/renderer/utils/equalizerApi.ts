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
  FilterTypeEnum,
  FixedBandSizeEnum,
  IFilterEdit,
  IFiltersMap,
  IState,
  IAudioDevice,
  IDeviceProfileAssignment,
  IDeviceProfileSettings,
  IOpraUpdateStatus,
  IOpraProduct,
  MAX_FREQUENCY,
  MAX_QUALITY,
  MIN_FREQUENCY,
  MIN_QUALITY,
  ISmartEqSettings,
  TApoLayer,
  clampGain,
  clampPreAmp,
} from 'common/constants';
import { IConvolutionCatalogEntry } from 'common/convolution';
import { IApoConfigTree } from 'common/apoConfig';
import { IChainImport } from 'common/chainBundle';
// Types only. `lookupSongEq`, `checkpointSongEq`, `commitSongEq` and
// `forgetSongEq` below share names with the pure functions in
// `common/songEq.ts` on purpose — thin wrappers over channels of the same
// name — and `import type` erases this so nothing here can resolve to the
// pure implementation by accident.
import type { ISongEqEntry } from 'common/songEq';
import type { ISongIdentity } from 'common/songIdentity';
import type { ITone } from 'common/tone';
import type { IOutputFormat, IOutputFormatChange } from 'main/outputFormat';

import coalesceRequests from 'common/coalescedRequest';
import {
  buildResponseHandler,
  sendRequest,
  setterResponseHandler,
  simpleResponseHandler,
} from './ipcRequest';
import type { TError, TSuccess } from './ipcRequest';

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

/**
 * Load preset into backend state
 * @param {string} presetName - name of preset to load
 * @returns { Promise<void> } exception if failed
 */
export const loadPreset = (presetName: string): Promise<void> => {
  const channel = ChannelEnum.LOAD_PRESET;
  return sendRequest(channel, [presetName], setterResponseHandler);
};

/**
 * Write the current settings into the profile of this name.
 *
 * An update, always: the profile named here is the one that ends up holding
 * the sound. Making a new one is `createPreset`, which is the only call that
 * may invent a name.
 */
export const savePreset = (presetName: string): Promise<void> => {
  const channel = ChannelEnum.SAVE_PRESET;
  return sendRequest(channel, [presetName], setterResponseHandler);
};

/**
 * Start a new profile holding the current settings.
 *
 * Resolves with the name it was actually given, which is numbered when this
 * output already has a profile called that.
 */
export const createPreset = (requestedName: string): Promise<string> => {
  const channel = ChannelEnum.CREATE_PRESET;
  return sendRequest(channel, [requestedName], simpleResponseHandler<string>());
};

/**
 * Delete a preset file in preset folder
 * @param {string} presetName - preset to delete
 * @returns { Promise<void> } if delete was successful
 */
export const deletePreset = (presetName: string): Promise<void> => {
  const channel = ChannelEnum.DELETE_PRESET;
  return sendRequest(channel, [presetName], setterResponseHandler);
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
  return sendRequest(channel, [oldName, newName], setterResponseHandler);
};

/**
 * Get a list of preset file names in preset folder
 * @returns { Promise<string[]> } exception if failed.
 */
export const getPresetListFromFiles = (): Promise<string[]> => {
  const channel = ChannelEnum.GET_PRESET_FILE_LIST;
  return sendRequest(channel, [], simpleResponseHandler<string[]>());
};

/**
 * Put a profile back to the state it was in when the user last pressed Save.
 * Everything since then auto-saved over the profile, so this is the undo.
 * @param {string} presetName - profile to roll back
 * @returns { Promise<void> } exception if there is no saved copy.
 */
export const restorePresetBaseline = (presetName: string): Promise<void> => {
  const channel = ChannelEnum.RESTORE_PRESET_BASELINE;
  return sendRequest(channel, [presetName], setterResponseHandler);
};

/**
 * Which profiles have a manually saved copy behind them.
 * @returns { Promise<string[]> } exception if failed.
 */
export const getPresetBaselineNames = (): Promise<string[]> => {
  const channel = ChannelEnum.GET_PRESET_BASELINE_NAMES;
  return sendRequest(channel, [], simpleResponseHandler<string[]>());
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
export const getEqualizerState = (): Promise<IState> => {
  const channel = ChannelEnum.GET_STATE;

  return sendRequest(channel, [], simpleResponseHandler<IState>());
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

/**
 * Get the current main preamplification gain value
 * @deprecated - Removing with the context refactor
 * @returns { Promise<number> } gain - current system gain value, [-60, 20]
 */
export const getMainPreAmp = (): Promise<number> => {
  const channel = ChannelEnum.GET_PREAMP;
  return sendRequest(channel, [], simpleResponseHandler<number>());
};

/**
 * Adjusts the main preamplification gain value
 * @param {number} gain - new gain value, brought into [-60, 20]
 *
 * Clamped rather than rejected, and it used to throw.
 *
 * Throwing was defensible when every caller was a slider, because a slider
 * cannot produce an out-of-range number and one that did was a bug worth
 * hearing about. It is not defensible now that the largest caller is derived:
 * auto normalize computes this from the whole chain, five layers deep, and a
 * chain wanting more headroom than the range allows is an ordinary thing rather
 * than a fault. What the throw did with it was take the app away — the call
 * happens in an effect on mount, so the failure arrived before anything was on
 * screen and returned on every restart, because the chain that caused it is on
 * disk. The user could not even reach the sliders to undo it.
 *
 * The boundary is the honest answer in both cases, and it is the PREAMP's, not
 * a band's: `clampPreAmp` reaches -60 dB, where `clampGain` stopped at -20 and
 * so cancelled nothing deeper than one fully boosted band. A headphone
 * correction plays as published now, past ±20 dB, and the level that cancels
 * it has to be able to follow it down — otherwise the reserve is smaller than
 * what is being reserved against and the output clips by construction (Ivan,
 * 2026-09-23: "manual yes -60"). Auto normalize already reached -60; this is
 * the hand-set one catching up. Nothing here is silently wrong: the value
 * written is the value shown.
 */
export const setMainPreAmp = (gain: number) => {
  const channel = ChannelEnum.SET_PREAMP;
  return sendRequest(channel, [clampPreAmp(gain)], setterResponseHandler);
};

/**
 * Adjusts a slider's gain value
 * @param {string} filterId - id of the slider being adjusted
 * @param {number} gain - new gain value, brought into [-20, 20]
 *
 * Clamped for the same reason as `setMainPreAmp`: a band that has ended up
 * outside the range must come back to the edge of it, because a band that
 * refuses every write is a band nobody can drag back.
 */
export const setGain = (filterId: string, gain: number) => {
  const channel = ChannelEnum.SET_FILTER_GAIN;
  return sendRequest(
    channel,
    [filterId, clampGain(gain)],
    setterResponseHandler,
    { replyChannel: channel + filterId },
  );
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
  return sendRequest(channel, [filterId, frequency], setterResponseHandler, {
    replyChannel: channel + filterId,
  });
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
  return sendRequest(channel, [filterId, quality], setterResponseHandler, {
    replyChannel: channel + filterId,
  });
};

/**
 * Get a slider's filter type
 * @deprecated - Removing with the context refactor
 * @param {string} filterId - id of the slider being adjusted
 * @returns { Promise<FilterTypeEnum> } filter type - value in FilterTypeEnum
 */
export const getType = (filterId: string): Promise<FilterTypeEnum> => {
  const channel = ChannelEnum.GET_FILTER_TYPE;
  return sendRequest<FilterTypeEnum>(
    channel,
    [filterId],
    simpleResponseHandler<FilterTypeEnum>(),
    { replyChannel: channel + filterId },
  );
};

/**
 * Adjusts a slider's filter type
 * @param {string} filterId - id of the slider being adjusted
 * @param {string} filterType - new filter type
 */
export const setType = (filterId: string, filterType: string) => {
  const channel = ChannelEnum.SET_FILTER_TYPE;
  return sendRequest(channel, [filterId, filterType], setterResponseHandler, {
    replyChannel: channel + filterId,
  });
};

/**
 * Change several bands at once, at the cost of changing one
 * @param {IFilterEdit[]} edits - one entry per band, carrying only the fields that move
 * @returns { Promise<void> } exception if failed, or if any edit is invalid
 */
export const setFilterValues = (edits: IFilterEdit[]) => {
  const channel = ChannelEnum.SET_FILTER_VALUES;
  // The reply is keyed on the bare channel rather than on a band id, because
  // the batch has no single band to name. One group edit may therefore be in
  // flight at a time — which is what the caller wants anyway: two overlapping
  // batches over the same selection would race to write the same config.
  return sendRequest(channel, [edits], setterResponseHandler);
};

/**
 * Add another slider
 * @param {number} frequency - frequency of the new slider
 * @returns { Promise<void> } exception if failed
 */
export const addEqualizerSlider = (frequency: number): Promise<string> => {
  const channel = ChannelEnum.ADD_FILTER;
  return sendRequest(channel, [frequency], simpleResponseHandler<string>());
};

/**
 * Remove slider
 * @param {string} filterId - id of the slider to be removed
 * @returns { Promise<void> } exception if failed
 */
export const removeEqualizerSlider = (filterId: string): Promise<void> => {
  const channel = ChannelEnum.REMOVE_FILTER;
  return sendRequest(channel, [filterId], setterResponseHandler);
};

/**
 * Reset the EQ to the default neutral ten-band layout
 * @returns { Promise<IFiltersMap> } the restored filters, exception if failed
 */
export const clearGains = (): Promise<IFiltersMap> => {
  const channel = ChannelEnum.CLEAR_GAINS;
  return sendRequest<IFiltersMap>(
    channel,
    [],
    simpleResponseHandler<IFiltersMap>(),
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
  dspEq?: import('../../common/dsp/chain').IEqSettings,
): Promise<void> => {
  const channel = ChannelEnum.SET_VOICING;
  return sendRequest(
    channel,
    dspEq ? [profileId, intensity, dspEq] : [profileId, intensity],
    setterResponseHandler,
  );
};

/**
 * Select the driver-family correction layer.
 * @param {string} profileId - profile to apply, or '' for none
 * @param {number} intensity - 0..1 scale over the profile's gains
 * @returns { Promise<void> } exception if the profile is unknown.
 */
/**
 * How much of the published headphone correction to apply, or none at all.
 *
 * `undefined` clears the layer. Only the strength is sent — the filters came
 * from a measurement and are not the renderer's to rewrite.
 */
export const setHeadphone = (intensity?: number): Promise<void> => {
  const channel = ChannelEnum.SET_HEADPHONE;
  return sendRequest(channel, [intensity], setterResponseHandler);
};

export const setDriver = (
  profileId: string,
  intensity: number,
): Promise<void> => {
  const channel = ChannelEnum.SET_DRIVER;
  return sendRequest(channel, [profileId, intensity], setterResponseHandler);
};

/**
 * Store what Smart EQ measured, as its own layer.
 *
 * Deliberately not routed through setGain: this correction is not made of the
 * user's bands and must never overwrite them.
 * @param { ISmartEqSettings } settings - the measured layer, or undefined to remove it
 * @returns { Promise<void> } exception if the payload is not a layer
 */
export const setSmartEq = (settings?: ISmartEqSettings): Promise<void> => {
  const channel = ChannelEnum.SET_SMART_EQ;
  return sendRequest(channel, [settings], setterResponseHandler);
};

// These four deliberately share names with the pure functions of the same
// name in common/songEq.ts. Those take the whole store and return a new one;
// these talk to main over IPC and return a promise. The renderer reaches the
// song EQ store only through these wrappers, never by importing the pure
// functions directly.

/**
 * What this output remembers about a song, if anything.
 * @param { string } deviceId - the active output
 * @param { ISongIdentity } identity - what is playing
 * @returns { Promise<ISongEqEntry | undefined> } the saved curve, or nothing
 */
export const lookupSongEq = (
  deviceId: string,
  identity: ISongIdentity,
): Promise<ISongEqEntry | undefined> => {
  const channel = ChannelEnum.LOOKUP_SONG_EQ;
  return sendRequest(
    channel,
    [deviceId, identity],
    simpleResponseHandler<ISongEqEntry | undefined>(),
  );
};

/**
 * Write what has been learned so far, without counting it as a play.
 * @param { string } deviceId - the active output
 * @param { ISongIdentity } identity - what is playing
 * @param { ISmartEqSettings } layer - the correction as it stands
 * @returns { Promise<void> } exception if the payload is not a layer
 */
export const checkpointSongEq = (
  deviceId: string,
  identity: ISongIdentity,
  layer: ISmartEqSettings,
): Promise<void> => {
  const channel = ChannelEnum.CHECKPOINT_SONG_EQ;
  return sendRequest(
    channel,
    [deviceId, identity, layer],
    setterResponseHandler,
  );
};

/**
 * Write the finished curve and count the play.
 * @param { string } deviceId - the active output
 * @param { ISongIdentity } identity - what was playing
 * @param { ISmartEqSettings } layer - the correction as it ended
 * @returns { Promise<void> } exception if the payload is not a layer
 */
export const commitSongEq = (
  deviceId: string,
  identity: ISongIdentity,
  layer: ISmartEqSettings,
): Promise<void> => {
  const channel = ChannelEnum.COMMIT_SONG_EQ;
  return sendRequest(
    channel,
    [deviceId, identity, layer],
    setterResponseHandler,
  );
};

/**
 * Forget one song on one output.
 *
 * The whole identity, not its key: the entry is very often filed under a
 * different key from the one playing — that is what the alias index is for —
 * and main resolves it the same way a lookup does.
 * @param { string } deviceId - the output to forget it on
 * @param { ISongIdentity } identity - the song to forget
 * @returns { Promise<void> } exception if the payload is not an identity
 */
export const forgetSongEq = (
  deviceId: string,
  identity: ISongIdentity,
): Promise<void> => {
  const channel = ChannelEnum.FORGET_SONG_EQ;
  return sendRequest(channel, [deviceId, identity], setterResponseHandler);
};

export const resetEqMode = (): Promise<void> => {
  const channel = ChannelEnum.RESET_EQ_MODE;
  return sendRequest(channel, [], setterResponseHandler);
};

export const setEqShape = (
  scope: 'eq' | 'curves',
  kind: 'q' | 'smoothing',
  value: NonNullable<IState['eqBandQ'] | IState['curveSmoothing']>,
): Promise<void> => {
  const channel = ChannelEnum.SET_EQ_SHAPE;
  return sendRequest(channel, [scope, kind, value], setterResponseHandler);
};

export const setEqMode = (
  mode: NonNullable<IState['eqMode']>,
  scope: 'eq' | 'curves' = 'eq',
): Promise<void> => {
  const channel = ChannelEnum.SET_EQ_MODE;
  return sendRequest(channel, [mode, scope], setterResponseHandler);
};

/**
 * One of the cuts at the edges of the whole EQ, as its slope in dB per
 * octave, 0 for none (`eqCuts.ts`).
 */
export const setEqCut = (
  cut: keyof NonNullable<IState['eqCuts']>,
  slope: number,
): Promise<void> => {
  const channel = ChannelEnum.SET_EQ_CUT;
  return sendRequest(channel, [cut, slope], setterResponseHandler);
};

/**
 * The Tone panel's three dials, written as their own layer (`tone.ts`).
 *
 * Deliberately not routed through the bands: the tone is laid over them and
 * never written into them, which is the whole point of it being a layer.
 * @param { ITone | null } tone - the three values, or null for all at zero
 * @returns { Promise<void> } exception if the values are not three numbers
 */
export const setTone = (tone: ITone | null): Promise<void> => {
  const channel = ChannelEnum.SET_TONE;
  return sendRequest(channel, [tone], setterResponseHandler);
};

/**
 * Switch a layer out of the Equalizer APO config, or back into it.
 *
 * Nothing about the layer changes — its settings stay exactly where they were,
 * and all that moves is whether its file is included. That is what makes this
 * an A/B switch rather than a remove-and-reapply: pressing it twice returns to
 * precisely the sound it started from, with nothing recomputed and nothing
 * measured again.
 * @param { TApoLayer } feature - which layer
 * @param { boolean } isBypassed - true to take it out of the config
 * @returns { Promise<void> } exception if the layer is not one of the five
 */
export const setLayerBypass = (
  feature: TApoLayer,
  isBypassed: boolean,
): Promise<void> => {
  const channel = ChannelEnum.SET_LAYER_BYPASS;
  return sendRequest(channel, [feature, isBypassed], setterResponseHandler);
};

/**
 * Sets filters to be the corresponding fixed band configuration
 * @param { FixedBandSizeEnum } size - Number of bands in the fixed configuration
 * @returns { Promise<void> } exception if failed
 */
export const setFixedBand = (size: FixedBandSizeEnum): Promise<IFiltersMap> => {
  const channel = ChannelEnum.SET_FIXED_BAND;
  return sendRequest<IFiltersMap>(
    channel,
    [size],
    simpleResponseHandler<IFiltersMap>(),
  );
};
