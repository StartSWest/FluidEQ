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

/* eslint global-require: off, no-console: off, promise/always-return: off */

/**
 * This module executes inside of electron's main process. You can start
 * electron renderer process from here and communicate with the other processes
 * through IPC.
 *
 * When running `npm run build` or `npm run build:main`, this file is compiled to
 * `./src/main.js` using webpack. This gives us some performance wins.
 */
import {
  app,
  BrowserWindow,
  desktopCapturer,
  dialog,
  ipcMain,
  screen,
  shell,
} from 'electron';
import log from 'electron-log';
import { autoUpdater } from 'electron-updater';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { exec, execFile } from 'child_process';
import { createHash } from 'crypto';
import { redact } from '../common/bugReport';
import {
  addFileToPath,
  checkConfigFile,
  stateToString,
  fetchSettings,
  FLUIDEQ_CONFIG_FILENAME,
  save,
  updateConfig,
  savePreset,
  fetchPreset,
  renamePreset,
  doesPresetExist,
  PRESETS_DIR,
  deletePreset,
  PRESET_BASELINES_DIR,
  savePresetBaseline,
  fetchPresetBaseline,
  hasPresetBaseline,
  deletePresetBaseline,
  renamePresetBaseline,
  repairUnusedPreamps,
} from './flush';
import MenuBuilder from './menu';
import { resolveHtmlPath, waitForRenderer } from './util';
import { getConfigPath, isEqualizerAPOInstalled } from './registry';
import { runEqualizerApoSetup } from './equalizerApoSetup';
import { gatherBugReportFacts } from './bugReportFacts';
import ChannelEnum from '../common/channels';
import { getVoicingProfile } from '../common/voicing';
import { getDriverProfile } from '../common/driver';
import { hasSmartEqLayer, sanitizeSmartEqSettings } from '../common/smartEq';
import {
  AutoEqFormat,
  FilterTypeEnum,
  IState,
  IPresetV2,
  IFilter,
  MAX_FREQUENCY,
  MAX_GAIN,
  MAX_NUM_FILTERS,
  MAX_QUALITY,
  MIN_FREQUENCY,
  MIN_GAIN,
  MIN_NUM_FILTERS,
  MIN_QUALITY,
  WINDOW_HEIGHT,
  WINDOW_HEIGHT_EXPANDED,
  WINDOW_MIN_HEIGHT,
  WINDOW_MIN_WIDTH,
  WINDOW_WIDTH,
  getDefaultFilterWithId,
  FixedBandSizeEnum,
  getDefaultFilters,
  IFiltersMap,
  IAudioDevice,
  IDeviceProfileAssignment,
  IDeviceProfileSettings,
  IAutoEqUpdateStatus,
  AUTOMATIC_PRESET_PREFIX,
  APP_UPDATE_EVENT,
  IAppUpdateStatus,
  RENDERER_READY_EVENT,
  OUTPUT_STATE_CHANGED_EVENT,
  AUTOEQ_SOURCE_ID,
} from '../common/constants';
import { ErrorCode } from '../common/errors';
import {
  isFixedBandSizeEnumValue,
  isRestrictedPresetName,
} from '../common/utils';
import {
  adaptLayoutToFixedFrequencies,
  getFixedBandSizeForCount,
  ILayoutSnapshot,
  snapshotFilters,
} from '../common/layouts';
import { TSuccess, TError } from '../renderer/utils/equalizerApi';
import {
  getAutoEqDeviceList,
  getAutoEqPreset,
  getAutoEqResponseList,
} from './autoeq';
import {
  checkAutoEqUpdate,
  syncAutoEqDatabase,
  updateAutoEqDatabase,
} from './autoeqUpdater';
import {
  getSquiglinkDeviceList,
  getSquiglinkPreset,
  getSquiglinkResponseList,
  getSquiglinkSourceList,
  syncSquiglinkDatabase,
} from './squiglink';
import {
  downloadConvolution,
  getConvolutionCatalog,
} from './convolutionCatalog';
import { importConvolutionFile, importEqFile } from './importSettings';
import {
  openVideoLinkExternally,
  setUpVideoBrowser,
  setVideoAdBlockEnabled,
} from './videoBrowser';
import {
  adoptBlock,
  findBlockForDevice,
  hasChainDrifted,
  splitConfigBlocks,
} from '../common/apoSync';
import {
  assignDeviceProfile,
  discoverAudioDevices,
  flushDeviceProfiles,
  getStateForAudioDevice,
  IActiveStateOverride,
  loadDeviceProfileSettings,
  removeAssignmentsForPreset,
  removeDeviceProfile,
  renameAssignedPreset,
  saveDeviceProfileSettings,
  setDefaultAudioDevice,
} from './deviceProfiles';

/**
 * Check GitHub for a newer FluidEQ and tell the user about it in the app.
 *
 * electron-updater fetches one small file — `latest.yml`, generated next to the
 * installer — and compares its version with the running one. Everything else
 * here is about saying so.
 *
 * The stock behaviour is `checkForUpdatesAndNotify()`, which downloads in
 * silence and then raises an OS toast. That is the wrong shape for this app:
 * the toast is easy to miss, it says nothing about what changed, and it appears
 * with no explanation of why the app was using the network. So the events are
 * forwarded to the renderer, which owns the message.
 *
 * Being offline is not an error worth showing. A laptop that opens FluidEQ on a
 * train has nothing to fix, and a red banner saying an update check failed
 * would be pure noise — it is logged and dropped.
 */
const setUpAutoUpdates = () => {
  log.transports.file.level = 'info';
  autoUpdater.logger = log;

  const send = (payload: IAppUpdateStatus) => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return;
    }
    mainWindow.webContents.send(APP_UPDATE_EVENT, payload);
  };

  autoUpdater.on('update-available', (info) => {
    send({ phase: 'available', version: info.version });
  });

  autoUpdater.on('download-progress', (progress) => {
    send({ phase: 'downloading', percent: Math.round(progress.percent) });
  });

  autoUpdater.on('update-downloaded', (info) => {
    send({ phase: 'ready', version: info.version });
  });

  autoUpdater.on('error', (error) => {
    // Almost always "no network" or "GitHub is having a moment". Neither is
    // something the user can act on, and neither should interrupt them.
    log.info('Update check failed', error);
  });

  autoUpdater.checkForUpdates().catch((error) => {
    log.info('Update check could not start', error);
  });

  // Once an hour, so a machine left running for a week still finds out. Cheap:
  // it is a few hundred bytes of YAML unless something has actually changed.
  setInterval(
    () => {
      autoUpdater.checkForUpdates().catch(() => undefined);
    },
    60 * 60 * 1000,
  );
};

let mainWindow: BrowserWindow | null = null;

const WINDOW_STATE_FILENAME = 'window-state.json';

/**
 * How long to wait for that signal before showing anyway.
 *
 * Long enough for a normal first paint, short enough that a renderer which
 * never reports still produces a window rather than an app that appears not to
 * have started.
 */
const RENDERER_PAINT_GRACE_MS = 1500;

interface IWindowState {
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  isMaximized?: boolean;
}

/**
 * Where and how big the window was last time.
 *
 * Restoring the position as well as the size matters more than it sounds:
 * FluidEQ is a frameless window that people park somewhere deliberate — beside
 * a player, on a second screen — and opening centred every launch undoes that
 * decision for them daily.
 */
const loadWindowState = (): IWindowState => {
  try {
    const parsed = JSON.parse(
      fs.readFileSync(path.join(userDataDir, WINDOW_STATE_FILENAME), 'utf8'),
    ) as IWindowState;

    const isSize = (value: unknown): value is number =>
      typeof value === 'number' && Number.isFinite(value) && value > 0;
    const isCoordinate = (value: unknown): value is number =>
      typeof value === 'number' && Number.isFinite(value);

    const state: IWindowState = {
      isMaximized: parsed.isMaximized === true,
    };
    if (isSize(parsed.width) && isSize(parsed.height)) {
      state.width = Math.max(parsed.width, WINDOW_MIN_WIDTH);
      state.height = Math.max(parsed.height, WINDOW_MIN_HEIGHT);
    }

    // A saved position is only usable if a display still covers it. Unplugging
    // a second monitor would otherwise reopen FluidEQ at coordinates nobody can
    // reach, and the only fix would be deleting a file they do not know exists.
    if (isCoordinate(parsed.x) && isCoordinate(parsed.y)) {
      const onScreen = screen.getAllDisplays().some(({ bounds }) => {
        return (
          parsed.x! >= bounds.x - 32 &&
          parsed.y! >= bounds.y - 32 &&
          parsed.x! < bounds.x + bounds.width &&
          parsed.y! < bounds.y + bounds.height
        );
      });
      if (onScreen) {
        state.x = parsed.x;
        state.y = parsed.y;
      }
    }

    return state;
  } catch {
    // No file yet, or one we cannot read. Either way: open at the default.
    return {};
  }
};

/**
 * Remember the window geometry.
 *
 * Maximized and full-screen windows report the size of the screen, not the size
 * the user chose, so the normal bounds are saved instead — that is what should
 * come back when they un-maximize.
 */
const saveWindowState = () => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }
  try {
    const bounds = mainWindow.getNormalBounds();
    const state: IWindowState = {
      width: bounds.width,
      height: bounds.height,
      x: bounds.x,
      y: bounds.y,
      isMaximized: mainWindow.isMaximized(),
    };
    fs.writeFileSync(
      path.join(userDataDir, WINDOW_STATE_FILENAME),
      JSON.stringify(state, null, 2),
      'utf8',
    );
  } catch (error) {
    // Losing the window position is not worth an error on screen.
    console.warn('Unable to save the window position', error);
  }
};

const DATABASES_SYNCED_EVENT = 'databases-synced';

/**
 * Tell the renderer the state now belongs to a different profile.
 *
 * Pushed rather than polled. The renderer holds its own copy of the EQ, the
 * voicing, the driver correction and the convolution, and every one of those
 * belongs to the output it was tuned on — so when Windows (or the user) moves
 * to another endpoint, the panels have to be told to re-read, not left showing
 * the previous device's settings until something else happens to refresh them.
 */
const notifyOutputStateChanged = () => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }
  mainWindow.webContents.send(OUTPUT_STATE_CHANGED_EVENT, {
    deviceId: activeAudioDeviceId,
  });
};

const syncDatabasesOnStartup = async () => {
  const [autoeqResult, squiglinkResult] = await Promise.allSettled([
    syncAutoEqDatabase(),
    syncSquiglinkDatabase(),
  ]);

  if (autoeqResult.status === 'rejected') {
    console.warn(
      'Unable to synchronize the AutoEq database',
      autoeqResult.reason,
    );
  }
  if (squiglinkResult.status === 'rejected') {
    console.warn(
      'Unable to synchronize the Squiglink database',
      squiglinkResult.reason,
    );
  }

  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  mainWindow.webContents.send(DATABASES_SYNCED_EVENT, {
    autoeq:
      autoeqResult.status === 'fulfilled' ? autoeqResult.value : undefined,
    squiglink:
      squiglinkResult.status === 'fulfilled'
        ? squiglinkResult.value
        : undefined,
  });
};

if (process.platform !== 'win32') {
  app.setPath('userData', path.join(app.getPath('temp'), 'fluideq-dev'));
  fs.mkdirSync(app.getPath('userData'), { recursive: true });
}

const setWindowDimension = (isExpanded: boolean) => {
  if (mainWindow) {
    const currWidth = mainWindow.getSize()[0];
    const currHeight = mainWindow.getSize()[1];
    if (isExpanded) {
      mainWindow.setMinimumSize(WINDOW_MIN_WIDTH, WINDOW_MIN_HEIGHT);
      mainWindow.setSize(
        currWidth,
        Math.max(currHeight, WINDOW_HEIGHT_EXPANDED),
      );
    } else {
      mainWindow.setMinimumSize(WINDOW_MIN_WIDTH, WINDOW_MIN_HEIGHT);
      mainWindow.setSize(currWidth, WINDOW_HEIGHT);
    }
  }
};

/** ----- Equalizer APO Implementation ----- */

// Load initial state from local state file
const userDataDir = app.getPath('userData');
const presetPath = path.join(userDataDir, PRESETS_DIR);
const baselinePath = path.join(userDataDir, PRESET_BASELINES_DIR);
const state: IState = fetchSettings(userDataDir);
const deviceProfileSettings = loadDeviceProfileSettings(userDataDir);
let configPath = '';
let activeAudioDeviceId = '';
let activeAudioDevice: IAudioDevice | undefined;
let hasActiveSessionOverride = false;

const LAYOUT_SETTINGS_FILENAME = 'layout-frequencies.json';
interface ILayoutSettingsFile {
  version: 1;
  devices: Record<string, Record<string, ILayoutSnapshot>>;
}

const layoutSettingsPath = path.join(userDataDir, LAYOUT_SETTINGS_FILENAME);

const loadLayoutSettings = (): ILayoutSettingsFile => {
  try {
    const parsed = JSON.parse(fs.readFileSync(layoutSettingsPath, 'utf8')) as
      Partial<ILayoutSettingsFile> | undefined;
    if (parsed?.version !== 1 || !parsed.devices) {
      throw new Error('Invalid layout settings');
    }
    return {
      version: 1,
      devices:
        typeof parsed.devices === 'object'
          ? (parsed.devices as ILayoutSettingsFile['devices'])
          : {},
    };
  } catch {
    return { version: 1, devices: {} };
  }
};

// One-time repair on startup. Automatic profiles that carry makeup gain but no
// EQ to make up for are leftovers from when switching outputs copied the
// previous device's state across; the effect is an output several dB down for
// no reason, which is not something a user would ever notice as a setting.
const repairedProfiles = repairUnusedPreamps(presetPath);
if (repairedProfiles.length > 0) {
  console.log(
    `Cleared unused preamp on ${repairedProfiles.length} automatic profile(s):`,
    repairedProfiles.join(', '),
  );
}

const layoutSettings = loadLayoutSettings();

const saveLayoutSettings = () => {
  try {
    fs.writeFileSync(
      layoutSettingsPath,
      JSON.stringify(layoutSettings, null, 2),
      'utf8',
    );
  } catch (error) {
    console.warn('Unable to save per-layout frequencies', error);
  }
};

const getLayoutDeviceKey = () => activeAudioDeviceId || 'global';

const getCurrentLayoutSize = () =>
  getFixedBandSizeForCount(Object.keys(state.filters).length);

const captureCurrentLayout = () => {
  const size = getCurrentLayoutSize();
  if (!size) {
    return;
  }
  const deviceKey = getLayoutDeviceKey();
  if (!layoutSettings.devices[deviceKey]) {
    layoutSettings.devices[deviceKey] = {};
  }
  layoutSettings.devices[deviceKey][String(size)] = snapshotFilters(
    state.filters,
  );
  saveLayoutSettings();
};

const clearCurrentLayoutSettings = () => {
  delete layoutSettings.devices[getLayoutDeviceKey()];
  saveLayoutSettings();
};

const getStoredLayout = (
  size: FixedBandSizeEnum,
): ILayoutSnapshot | undefined => {
  const snapshot = layoutSettings.devices[getLayoutDeviceKey()]?.[String(size)];
  if (!Array.isArray(snapshot) || snapshot.length !== size) {
    return undefined;
  }
  if (
    !snapshot.every(
      (band) =>
        Number.isFinite(band.frequency) &&
        Number.isFinite(band.gain) &&
        Number.isFinite(band.quality) &&
        Object.values(FilterTypeEnum).includes(band.type),
    )
  ) {
    return undefined;
  }
  return snapshot;
};

const getAutomaticPresetName = (deviceId: string) =>
  `${AUTOMATIC_PRESET_PREFIX}${createHash('sha1')
    .update(deviceId)
    .digest('hex')
    .slice(0, 12)}`;

const isAutomaticPresetName = (presetName: string) =>
  presetName.startsWith(AUTOMATIC_PRESET_PREFIX);

/**
 * Adopt a device's EQ state without touching app-wide preferences.
 *
 * isEnabled, Auto normalize, the graph toggle and the filesystem-case flag are
 * settings for FluidEQ, not for a pair of headphones. They live in the same
 * IState as the EQ, so assigning a device's state wholesale used to turn the
 * engine back on for anyone who had switched it off, simply because Windows
 * changed the default output.
 */
/**
 * Swap the live state over to what a different output is tuned to.
 *
 * Everything a profile can carry moves — bands, preamp, voicing, driver
 * correction, convolution — because all of it was chosen for the headphones or
 * speakers on that endpoint and means nothing on another one. Only the three
 * app-wide preferences below stay put: whether the engine is on, whether the
 * graph is showing, and what the filesystem is like.
 */
const applyDeviceState = (next: IState) => {
  const { isEnabled, isGraphViewOn, isCaseSensitiveFs, ...deviceState } = next;
  Object.assign(state, deviceState);
};

const getCurrentPreset = (): IPresetV2 => ({
  preAmp: state.preAmp,
  filters: state.filters,
  eqFormat: state.eqFormat,
  graphicEq: state.graphicEq,
  convolution: state.convolution,
  isFlat: state.isFlat,
  // Without these three the device-profile block is rendered from a preset that
  // has no idea they exist, and every one of the layers vanishes from the
  // config the moment a profile is attached.
  voicing: state.voicing,
  driver: state.driver,
  smartEq: state.smartEq,
  isAutoPreAmpOn: state.isAutoPreAmpOn,
  headset: state.headset,
  headsetTarget: state.headsetTarget,
  headsetSource: state.headsetSource,
});

const switchToParametricEditing = () => {
  state.eqFormat = AutoEqFormat.PARAMETRIC;
  state.graphicEq = undefined;
};

/**
 * A profile name this output is allowed to write to.
 *
 * Profiles are files named after the profile, and an assignment points an
 * output at one of them. Nothing stopped two outputs pointing at the same file,
 * so saving on the speakers silently overwrote the headphones' tuning if the
 * two happened to share a name — which is easy, because "Untitled profile 1" is
 * exactly the sort of name two outputs both end up with.
 *
 * The rule: you may write to a name that is free, or one this output already
 * owns. A name owned by a different output gets a number, the same way a file
 * manager does it, and the caller attaches to that instead.
 *
 * Deliberately not a hidden per-device filename. The name is what the user
 * sees in the list and types into the box, and a profile whose real identity
 * was invisible would make renaming and deleting inexplicable.
 */
const reservePresetNameForActiveDevice = (requestedName: string) => {
  const ownedByAnotherOutput = (candidate: string) =>
    Object.values(deviceProfileSettings.assignments).some(
      (assignment) =>
        assignment.presetName === candidate &&
        assignment.deviceId !== activeAudioDeviceId,
    );

  if (!ownedByAnotherOutput(requestedName)) {
    return requestedName;
  }

  let index = 2;
  while (
    ownedByAnotherOutput(`${requestedName} ${index}`) ||
    doesPresetExist(`${requestedName} ${index}`, presetPath)
  ) {
    index += 1;
  }
  return `${requestedName} ${index}`;
};

/**
 * Back to the default editable EQ: ten neutral Peak bands and no preamp.
 *
 * The default layout rather than only zeroed gains, because band pass, notch
 * and the pass filters still shape the signal at 0 dB, and because the stored
 * per-size layout snapshots have to go with them — otherwise pressing a band
 * count afterwards resurrects the tuning that was just cleared. The flat flag
 * is what actually takes the bands out of the config; without it they would be
 * stored and then never written.
 *
 * The attribution goes too: it described bands that no longer exist. Nothing
 * here touches the voicing, the driver correction, the Smart EQ correction or
 * the convolution — those are separate layers, arrived at separately, and
 * clearing the EQ is not a reason to throw them away. Smart EQ in particular is
 * measured rather than chosen, so clearing the reference cannot invalidate it:
 * it describes what came out of the speakers, not what went into the bands. See
 * resetStateToDefaults for the reset that does clear everything.
 */
const resetEqToDefaults = () => {
  switchToParametricEditing();
  clearCurrentLayoutSettings();
  state.filters = getDefaultFilters();
  state.preAmp = 0;
  state.isFlat = true;
  state.headset = undefined;
  state.headsetTarget = undefined;
  state.headsetSource = undefined;
};

/**
 * Put the sound back to neutral: no bands, no layers, no attribution.
 *
 * Everything audible, and everything describing it. Leaving the voicing, the
 * driver correction or the measured Smart EQ curve behind after a reset would
 * mean the EQ page said "flat" while three layers were still shaping the
 * output.
 */
const resetStateToDefaults = () => {
  resetEqToDefaults();
  state.convolution = undefined;
  state.voicing = undefined;
  state.driver = undefined;
  state.smartEq = undefined;
};

/**
 * Give the active output an empty named profile.
 *
 * Every output keeps at least one, so there is always somewhere for an edit to
 * land and always something in the list to select. The number comes from the
 * whole catalogue rather than from this output's share of it, because two
 * outputs cannot own the same name — see reservePresetNameForActiveDevice.
 */
const UNTITLED_PROFILE_PREFIX = 'Untitled profile';

const createEmptyProfileForActiveDevice = () => {
  if (!activeAudioDeviceId) {
    return;
  }
  let index = 1;
  while (doesPresetExist(`${UNTITLED_PROFILE_PREFIX} ${index}`, presetPath)) {
    index += 1;
  }
  const name = `${UNTITLED_PROFILE_PREFIX} ${index}`;
  savePreset(name, getCurrentPreset(), presetPath);
  attachPresetToActiveDevice(name);
};

const attachPresetToActiveDevice = (presetName: string) => {
  if (!activeAudioDeviceId) {
    return false;
  }

  const device = activeAudioDevice;
  assignDeviceProfile(deviceProfileSettings, {
    deviceId: activeAudioDeviceId,
    deviceName: device?.name || activeAudioDeviceId,
    deviceGuid: device?.guid || activeAudioDeviceId,
    presetName,
  });
  saveDeviceProfileSettings(deviceProfileSettings, userDataDir);
  hasActiveSessionOverride = false;
  return true;
};

try {
  // create presets dir if it doesn't exist
  if (!fs.existsSync(presetPath)) {
    fs.mkdirSync(presetPath, { recursive: true });
  }
} catch (e) {
  console.error('Failed to make presets directory!!');
  console.error(e);
  throw e;
}

// spawn child process to update presets folder so that it can support case-sensitive files
if (process.platform === 'win32') {
  exec(
    `fsutil.exe file SetCaseSensitiveInfo "${presetPath}"`,
    (err, stdout, stderr) => {
      // Error handling should occur in this callback function
      if (err) {
        console.error(err.message.trim());
        console.error(stdout.trim());
        console.error(stderr.trim());
        return;
      }

      // Set case sensitive to true if an error was not thrown
      state.isCaseSensitiveFs = true;
    },
  );
}

/** Base wait between attempts, plus up to the same again as jitter. */
const RETRY_DELAY_MS = 500;

/**
 * Retry something that fails because someone else is holding the file.
 *
 * Flat, not exponential, and that is deliberate rather than unfinished. The
 * only thing this guards is two config writes landing at once — a lock held
 * for a few milliseconds, not a service asking to be backed off. Doubling the
 * wait each time would turn a two-second worst case into eight, and every one
 * of those seconds is a user watching their EQ fail to apply.
 *
 * The jitter is the part that matters. Two writers that collide once are on
 * the same cadence by definition, so a fixed delay marches them into the next
 * collision together; spreading the wait is what breaks the lockstep.
 */
const retryHelper = async (attempts: number, f: () => unknown) => {
  for (let i = 0; i < attempts; i += 1) {
    try {
      await f();
      return;
    } catch (e) {
      if (i === attempts - 1) {
        throw new Error(`Failed to perform action after ${attempts} retries`);
      }
      await new Promise((resolve) => {
        setTimeout(resolve, RETRY_DELAY_MS + Math.random() * RETRY_DELAY_MS);
      });
    }
  }
};

const handleError = (
  event: Electron.IpcMainEvent,
  channel: ChannelEnum | string,
  errorCode: ErrorCode,
  // Only for failures the user can act on — a file at the wrong sample rate,
  // a name that is already taken. Internal faults keep the canned wording.
  detail?: string,
) => {
  const reply: TError = { errorCode, ...(detail ? { detail } : {}) };
  console.log(channel);
  event.reply(channel, reply);
};

const updateConfigPath = async (
  event: Electron.IpcMainEvent,
  channel: ChannelEnum | string,
) => {
  try {
    // Retrive configPath assuming EqualizerAPO is installed
    configPath = await getConfigPath();
    // Overwrite the config file if necessary
    if (!checkConfigFile(configPath)) {
      updateConfig(configPath);
    }
  } catch (e) {
    handleError(event, channel, ErrorCode.CONFIG_NOT_FOUND);
    return false;
  }
  return true;
};

const handleUpdateHelper = async <T>(
  event: Electron.IpcMainEvent,
  channel: ChannelEnum | string,
  response: T,
  syncActiveProfile = false,
  useActiveSessionOverride = false,
) => {
  // Check whether EqualizerAPO is installed every time a change is made
  const isInstalled = await isEqualizerAPOInstalled();
  if (!isInstalled) {
    handleError(event, channel, ErrorCode.EQUALIZER_APO_NOT_INSTALLED);
    return;
  }

  try {
    if (!configPath) {
      configPath = await getConfigPath();
    }
    if (!checkConfigFile(configPath)) {
      updateConfig(configPath);
    }
    const shouldPersistProfile = syncActiveProfile || useActiveSessionOverride;
    let assignment = deviceProfileSettings.assignments[activeAudioDeviceId];
    if (shouldPersistProfile && !assignment && activeAudioDeviceId) {
      const automaticPresetName = getAutomaticPresetName(activeAudioDeviceId);
      attachPresetToActiveDevice(automaticPresetName);
      assignment = deviceProfileSettings.assignments[activeAudioDeviceId];
    }
    if (shouldPersistProfile && assignment) {
      // Every edit lands in the attached profile, named or automatic. The
      // user's manually saved copy is kept separately (see savePresetBaseline
      // in the SAVE_PRESET handler), so auto-saving here can always be undone
      // and never costs them the version they chose to keep.
      savePreset(assignment.presetName, getCurrentPreset(), presetPath);
      hasActiveSessionOverride = false;
    } else if (shouldPersistProfile && !assignment && activeAudioDeviceId) {
      // An output without a profile still needs edits applied immediately.
      // Keep this override scoped to the current endpoint until it gets
      // assigned by explicit profile load or manual save.
      hasActiveSessionOverride = true;
      assignment = deviceProfileSettings.assignments[activeAudioDeviceId];
    }
    if (assignment) {
      // A loaded/saved profile clears the temporary override. A subsequent
      // edit recreates it and remains live-only until the user saves.
      if (syncActiveProfile) {
        hasActiveSessionOverride = false;
      }
    }
    const activeDevicePattern =
      activeAudioDevice?.guid || activeAudioDevice?.name || activeAudioDeviceId;
    const activeOverride: IActiveStateOverride | undefined =
      hasActiveSessionOverride && activeDevicePattern
        ? {
            deviceId: activeAudioDeviceId,
            devicePattern: activeDevicePattern,
            state,
          }
        : undefined;
    // Flush changes to EqualizerAPO with a retry in case several requests to write are occuring at the same time
    await retryHelper(5, () => {
      flushDeviceProfiles(
        deviceProfileSettings,
        presetPath,
        configPath,
        activeOverride,
        state.isEnabled,
      );
    });
  } catch (e) {
    handleError(event, channel, ErrorCode.FAILURE);
    return;
  }

  // Keep a device-scoped snapshot for every fixed layout. This runs after
  // every successful edit, so moving a frequency slider is preserved when the
  // user temporarily switches to another band count.
  captureCurrentLayout();

  // Return a success message of undefined
  const reply: TSuccess<T> = { result: response };
  event.reply(channel, reply);

  // Flush changes to our local state file after informing UI that the changes have been applied
  save(state, userDataDir);
};

const handleUpdate = async (
  event: Electron.IpcMainEvent,
  channel: ChannelEnum | string,
  syncActiveProfile = false,
  useActiveSessionOverride = false,
) => {
  return handleUpdateHelper<void>(
    event,
    channel,
    undefined,
    syncActiveProfile,
    useActiveSessionOverride,
  );
};

const doesFilterIdExist = (
  event: Electron.IpcMainEvent,
  channel: ChannelEnum,
  filterId: string,
) => {
  // Filter id must exist
  if (!(filterId in state.filters)) {
    handleError(event, channel + filterId, ErrorCode.INVALID_PARAMETER);
    return false;
  }
  return true;
};

/**
 * Believe the Equalizer APO config over our own copy of the state.
 *
 * Runs once, before the first flush of the session. The file on disk is what
 * the user is actually hearing; state.txt is only what FluidEQ last believed,
 * and the two part company whenever anything else touches the config — a hand
 * edit, another tool, an APO reinstall, a restore from backup. When they
 * disagree the file wins.
 *
 * Only the audible part is adopted. The voicing, driver and Smart EQ layers
 * reach APO as ordinary `Filter N:` lines with nothing marking them as layers,
 * so reading them back would turn them into hand-placed bands: the pickers
 * would read "none" while the sound was unchanged, and the next edit would
 * write all three in again on top of their own flattened copies. Their identity
 * stays where it can be represented, which is the profile.
 */
let hasAdoptedExistingConfig = false;

const adoptExistingApoConfig = () => {
  if (hasAdoptedExistingConfig || !configPath) {
    return;
  }
  hasAdoptedExistingConfig = true;

  try {
    const filePath = addFileToPath(configPath, FLUIDEQ_CONFIG_FILENAME);
    if (!fs.existsSync(filePath)) {
      return;
    }
    const blocks = splitConfigBlocks(fs.readFileSync(filePath, 'utf8'));
    if (blocks.length === 0) {
      return;
    }

    // Before any endpoint has been discovered the only block that can be about
    // this session is the global one, which is the right answer for a machine
    // with a single output and a harmless one otherwise: the device switch
    // that follows replaces the state wholesale anyway.
    const devicePattern =
      activeAudioDevice?.guid || activeAudioDevice?.name || '';
    const block = findBlockForDevice(blocks, devicePattern);
    if (!block) {
      return;
    }

    const adopted = adoptBlock(block);
    if (!adopted) {
      return;
    }

    // Two things make a block unsafe to adopt, and both were found the hard way
    // by this wiping a live EQ off the screen.
    //
    // 1. A block with a preamp but no filters is not "the user cleared their
    //    bands". It is what FluidEQ writes for a flat EQ, or for one whose only
    //    audible content is a voicing or a convolution. Adopting it emptied the
    //    band editor completely — no sliders at all, which is not a state the
    //    editor is even supposed to be able to reach.
    //
    // 2. The voicing, driver and Smart EQ layers are written into the same
    //    numbered `Filter N:` sequence as the user's own bands, with nothing
    //    distinguishing them. If any of them is active, there is no way to
    //    tell which lines came from where, and adopting would pull the layers
    //    into the band editor as ordinary bands — where the next flush would
    //    then write the layers on top of them again. Smart EQ is the worst
    //    case: it is roughly two dozen bands, so adopting past it would double
    //    a whole measured correction rather than one small curve.
    const hasBands =
      Object.keys(adopted.filters).length > 0 ||
      (adopted.graphicEq?.length ?? 0) > 0;
    const hasIndistinguishableLayers =
      !!state.voicing?.profileId ||
      !!state.driver?.profileId ||
      hasSmartEqLayer(state.smartEq);

    if (!hasBands || hasIndistinguishableLayers) {
      return;
    }

    // Compared against what the writer would actually produce, not against the
    // state fields: the preamp is derived from the whole chain, inert bands are
    // dropped, and the voicing and driver layers are appended. Comparing the
    // raw state would report drift on FluidEQ's own output every launch.
    const expected = stateToString(
      state,
      state.convolution?.fileName,
      block.devicePattern,
    );
    if (!hasChainDrifted(expected, adopted)) {
      // The file says what we would have written. Nothing happened while we
      // were away.
      return;
    }

    console.log(
      `Adopting the Equalizer APO config for ${block.devicePattern}: it no longer matches the stored state.`,
    );
    state.preAmp = adopted.preAmp;
    state.filters = adopted.filters;
    state.eqFormat = adopted.eqFormat;
    state.graphicEq = adopted.graphicEq;
    // Bands exist, so the chain is not flat whatever the stored flag said.
    state.isFlat = Object.keys(adopted.filters).length === 0;
    // The attribution described bands that are no longer these bands.
    state.headset = undefined;
    state.headsetTarget = undefined;
    state.headsetSource = undefined;

    if (adopted.convolutionFileName) {
      // The WAV is still next to the config and still what APO is applying, so
      // keep it applied. Its catalogue name is not recoverable from the config,
      // so it is described by the only thing the file actually states.
      state.convolution = {
        name:
          state.convolution?.fileName === adopted.convolutionFileName
            ? state.convolution.name
            : adopted.convolutionFileName,
        filters: state.convolution?.filters ?? {},
        fileName: adopted.convolutionFileName,
        sourceId: state.convolution?.sourceId,
        sourceUrl: state.convolution?.sourceUrl,
      };
    } else {
      state.convolution = undefined;
    }

    save(state, userDataDir);
  } catch (error) {
    // A config we cannot read is not a reason to refuse to start. FluidEQ will
    // simply write its own over the top, which is the old behaviour.
    console.warn('Unable to read the existing Equalizer APO config', error);
  }
};

ipcMain.on(ChannelEnum.GATHER_BUG_REPORT, async (event) => {
  const channel = ChannelEnum.GATHER_BUG_REPORT;
  try {
    const facts = await gatherBugReportFacts();
    event.reply(channel, { result: facts });
  } catch (e) {
    log.error('Could not gather a bug report', e);
    handleError(event, channel, ErrorCode.FAILURE, (e as Error).message);
  }
});

/**
 * Everything the window has to say, redacted on the way in.
 *
 * Redacted here rather than in the renderer so it is one rule in one place,
 * applied to every line that reaches the file. A stack trace is nothing but
 * paths, and in a packaged build those paths run through the user's profile
 * directory — which carries their account name, and would end up in every bug
 * report emailed to a stranger. `redact` is the same function the report itself
 * uses; the log has to be clean before it is written, not when it is read,
 * because the file is on disk either way.
 */
const REDACT_AS = os.userInfo().username;

ipcMain.on(ChannelEnum.LOG_ERROR, (_event, args) => {
  const [context, detail] = (args as string[]) ?? [];
  log.error(
    `[renderer] ${redact(String(context ?? ''), REDACT_AS)}`,
    redact(String(detail ?? ''), REDACT_AS),
  );
});

ipcMain.on(ChannelEnum.LOG_INFO, (_event, args) => {
  const [message] = (args as string[]) ?? [];
  log.info(`[renderer] ${redact(String(message ?? ''), REDACT_AS)}`);
});

ipcMain.on(ChannelEnum.INSTALL_EQUALIZER_APO, async (event) => {
  const channel = ChannelEnum.INSTALL_EQUALIZER_APO;
  try {
    // Awaited. Elevation is asked for asynchronously, so a synchronous call
    // would report success the instant the prompt appeared and could never
    // report a refusal — which is the most likely outcome of the two.
    await runEqualizerApoSetup();
    log.info('Started the Equalizer APO installer');
    event.reply(channel, { result: undefined });
  } catch (e) {
    log.error('Could not start the Equalizer APO installer', e);
    handleError(event, channel, ErrorCode.FAILURE, (e as Error).message);
  }
});

ipcMain.on(ChannelEnum.HEALTH_CHECK, async (event) => {
  const channel = ChannelEnum.HEALTH_CHECK;
  const res = await updateConfigPath(event, channel);
  if (res) {
    adoptExistingApoConfig();
    await handleUpdate(event, channel);
  }
});

ipcMain.on(ChannelEnum.LOAD_PRESET, async (event, arg) => {
  const channel = ChannelEnum.LOAD_PRESET;
  const presetName = arg[0];
  console.log(`Loading preset: ${presetName}`);

  try {
    const presetSettings: IPresetV2 = fetchPreset(presetName, presetPath);
    clearCurrentLayoutSettings();
    state.preAmp = presetSettings.preAmp;
    state.filters = presetSettings.filters;
    state.eqFormat = presetSettings.eqFormat;
    state.graphicEq = presetSettings.graphicEq;
    state.convolution = presetSettings.convolution;
    state.isFlat = presetSettings.isFlat;
    state.voicing = presetSettings.voicing;
    state.driver = presetSettings.driver;
    state.smartEq = presetSettings.smartEq;
    state.headset = presetSettings.headset;
    state.headsetTarget = presetSettings.headsetTarget;
    state.headsetSource = presetSettings.headsetSource;
    attachPresetToActiveDevice(presetName);
    await handleUpdate(event, channel, true);
  } catch (ex) {
    console.log('Failed to read preset: ', presetName);
    console.log(ex);
    handleError(event, channel, ErrorCode.PRESET_FILE_ERROR);
  }
});

/**
 * Put back the copy the user last saved by hand.
 *
 * Edits auto-save straight into the attached profile, which is convenient
 * right up until you want the version from before you started experimenting.
 * That is what the baseline is: an explicit save is the only thing that writes
 * it, so it always represents a state the user deliberately chose to keep.
 */
ipcMain.on(ChannelEnum.RESTORE_PRESET_BASELINE, async (event, arg) => {
  const channel = ChannelEnum.RESTORE_PRESET_BASELINE;
  const presetName = arg[0] as string;
  try {
    const baseline = fetchPresetBaseline(presetName, baselinePath);
    if (!baseline) {
      handleError(event, channel, ErrorCode.PRESET_FILE_ERROR);
      return;
    }
    clearCurrentLayoutSettings();
    state.preAmp = baseline.preAmp;
    state.filters = baseline.filters;
    state.eqFormat = baseline.eqFormat;
    state.graphicEq = baseline.graphicEq;
    state.convolution = baseline.convolution;
    state.isFlat = baseline.isFlat;
    state.voicing = baseline.voicing;
    state.driver = baseline.driver;
    state.smartEq = baseline.smartEq;
    state.headset = baseline.headset;
    state.headsetTarget = baseline.headsetTarget;
    state.headsetSource = baseline.headsetSource;
    // Restoring writes the profile back to the baseline, but deliberately does
    // NOT rewrite the baseline itself — restoring twice in a row is a no-op
    // rather than a way to lose the copy.
    savePreset(presetName, getCurrentPreset(), presetPath);
    attachPresetToActiveDevice(presetName);
    await handleUpdate(event, channel, true);
  } catch (e) {
    console.log('Failed to restore the saved copy of: ', presetName);
    handleError(event, channel, ErrorCode.PRESET_FILE_ERROR);
  }
});

/** Which profiles have a manually saved copy to go back to. */
ipcMain.on(ChannelEnum.GET_PRESET_BASELINE_NAMES, async (event) => {
  const channel = ChannelEnum.GET_PRESET_BASELINE_NAMES;
  try {
    const names = Object.values(deviceProfileSettings.assignments)
      .map((assignment) => assignment.presetName)
      .concat(
        fs.existsSync(presetPath)
          ? fs.readdirSync(presetPath).filter((n) => !isAutomaticPresetName(n))
          : [],
      )
      .filter(
        (name, index, all) =>
          all.indexOf(name) === index && hasPresetBaseline(name, baselinePath),
      );
    const reply: TSuccess<string[]> = { result: names };
    event.reply(channel, reply);
  } catch (e) {
    handleError(event, channel, ErrorCode.PRESET_FILE_ERROR);
  }
});

ipcMain.on(ChannelEnum.SAVE_PRESET, async (event, arg) => {
  const channel = ChannelEnum.SAVE_PRESET;
  const presetName = arg[0];

  try {
    // Validate that the preset name is not restricted
    if (isRestrictedPresetName(presetName)) {
      handleError(event, channel, ErrorCode.INVALID_PRESET_NAME);
      return;
    }

    // Never over the top of a profile another output is using. Saving on the
    // speakers must not overwrite what the headphones are playing, however
    // similar the two names are.
    const targetName = reservePresetNameForActiveDevice(presetName);

    const preset = getCurrentPreset();
    savePreset(targetName, preset, presetPath);
    // This is the copy the user chose to keep. Later edits auto-save over the
    // profile itself, so this is the only thing left to restore from.
    savePresetBaseline(targetName, preset, baselinePath);
    attachPresetToActiveDevice(targetName);
    await handleUpdateHelper<string>(event, channel, targetName, true);
  } catch (e) {
    handleError(event, channel, ErrorCode.PRESET_FILE_ERROR);
  }
});

ipcMain.on(ChannelEnum.DELETE_PRESET, async (event, arg) => {
  const channel = ChannelEnum.DELETE_PRESET;
  const presetName = arg[0];
  const pathToDelete = path.join(presetPath, presetName);
  console.log(`Deleting preset: ${presetName} at location ${pathToDelete}`);
  try {
    const wasAttachedHere =
      deviceProfileSettings.assignments[activeAudioDeviceId]?.presetName ===
      presetName;

    deletePreset(presetName, presetPath);
    deletePresetBaseline(presetName, baselinePath);
    removeAssignmentsForPreset(deviceProfileSettings, presetName);
    saveDeviceProfileSettings(deviceProfileSettings, userDataDir);

    // Deleting what this output was playing through leaves it with nothing.
    // Reset to neutral and hand it a fresh empty profile rather than leaving
    // the user on a nameless tuning they cannot save to or get back from.
    if (wasAttachedHere) {
      resetStateToDefaults();
      createEmptyProfileForActiveDevice();
    }

    await handleUpdate(event, channel);
  } catch (e) {
    handleError(event, channel, ErrorCode.PRESET_FILE_ERROR);
  }
});

ipcMain.on(ChannelEnum.RENAME_PRESET, async (event, arg) => {
  const channel = ChannelEnum.RENAME_PRESET;
  const [oldName, newName]: string[] = arg;

  // No name change - the UI should handle this scenario and should not reach the BE
  if (oldName === newName) {
    const reply: TSuccess<void> = { result: undefined };
    event.reply(channel, reply);
  }

  try {
    /**
     * Validate the provided name acording to the following rules:
     * - Disallow renaming to a restricted name
     * - Disallow renaming to an existing preset name
     *
     * Note: the function doesPresetExist performs comparisons based on the file system, meaning it whether the comparison
     * is case sensitive depends on the file system settings. For case sensitive systems, the existence of a preset that
     * matches the new name exactly is guaranteed to be an invalid operation (since we already handled the case where the
     * old and new names are exactly equal). For case insensitive systems, there is an edge case where we want to allow
     * the new name to be a duplicate of an existing preset. This is the case where we are renaming a preset to change the
     * casing of the characters.
     */
    if (
      isRestrictedPresetName(newName) ||
      (doesPresetExist(newName, presetPath) &&
        (state.isCaseSensitiveFs ||
          oldName.toLocaleLowerCase() !== newName.toLocaleLowerCase()))
    ) {
      handleError(event, channel, ErrorCode.INVALID_PRESET_NAME);
      return;
    }

    renamePreset(oldName, newName, presetPath);
    renamePresetBaseline(oldName, newName, baselinePath);
    renameAssignedPreset(deviceProfileSettings, oldName, newName);
    saveDeviceProfileSettings(deviceProfileSettings, userDataDir);
    await handleUpdate(event, channel);
  } catch (e) {
    handleError(event, channel, ErrorCode.PRESET_FILE_ERROR);
  }
});

ipcMain.on(ChannelEnum.GET_PRESET_FILE_LIST, async (event) => {
  const channel = ChannelEnum.GET_PRESET_FILE_LIST;

  try {
    const fileNames: string[] = fs
      .readdirSync(presetPath)
      .filter((fileName) => !isAutomaticPresetName(fileName));
    console.log(`Fetched ${fileNames.length} files`);
    const reply: TSuccess<string[]> = { result: fileNames };
    event.reply(channel, reply);
  } catch (e) {
    console.error('Failed to get filenames');
    console.error(e);
    handleError(event, channel, ErrorCode.PRESET_FILE_ERROR);
  }
});

ipcMain.on(ChannelEnum.GET_AUDIO_DEVICES, async (event) => {
  const channel = ChannelEnum.GET_AUDIO_DEVICES;
  try {
    const devices = await discoverAudioDevices();
    const activeDevice = devices.find((device) => device.isDefault);
    if (activeDevice && activeDevice.id !== activeAudioDeviceId) {
      activeAudioDeviceId = activeDevice.id;
      activeAudioDevice = activeDevice;
      // A device switch always starts from that device's attached profile or
      // a clean neutral state. Never carry a previous output's transient EQ.
      hasActiveSessionOverride = false;
      applyDeviceState(
        getStateForAudioDevice(
          deviceProfileSettings,
          activeDevice.id,
          presetPath,
        ),
      );
      // Every output keeps at least one named profile, so there is always
      // somewhere for an edit to land and always something in the list to
      // select. Only for outputs the user actually lands on — creating one
      // eagerly for every endpoint Windows reports would fill the list with
      // profiles for devices nobody has used.
      if (!deviceProfileSettings.assignments[activeDevice.id]) {
        createEmptyProfileForActiveDevice();
      }
      save(state, userDataDir);
      captureCurrentLayout();

      // A Windows output change must immediately replace the APO rules. This
      // prevents the previous device's profile from remaining active until a
      // later EQ edit is made in FluidEQ.
      try {
        if (!configPath) {
          configPath = await getConfigPath();
        }
        if (!checkConfigFile(configPath)) {
          updateConfig(configPath);
        }
        await retryHelper(5, () => {
          flushDeviceProfiles(
            deviceProfileSettings,
            presetPath,
            configPath,
            undefined,
            state.isEnabled,
          );
        });
      } catch (error) {
        console.error(
          'Failed to flush the profile for the active output',
          error,
        );
      }

      // Last, and outside the try: the config write can fail without making the
      // swap any less real, and the panels must never be left describing the
      // output the user just moved away from.
      notifyOutputStateChanged();
    }
    const reply: TSuccess<IAudioDevice[]> = { result: devices };
    event.reply(channel, reply);
  } catch (e) {
    console.error('Failed to enumerate Windows audio endpoints', e);
    handleError(event, channel, ErrorCode.FAILURE);
  }
});

ipcMain.on(ChannelEnum.SET_DEFAULT_AUDIO_DEVICE, async (event, arg) => {
  const channel = ChannelEnum.SET_DEFAULT_AUDIO_DEVICE;
  try {
    await setDefaultAudioDevice(arg[0] as string);
    const reply: TSuccess<void> = { result: undefined };
    event.reply(channel, reply);
  } catch (e) {
    console.error('Failed to change the Windows audio output', e);
    handleError(event, channel, ErrorCode.FAILURE);
  }
});

ipcMain.on(ChannelEnum.ACTIVATE_AUDIO_DEVICE_PROFILE, async (event, arg) => {
  const channel = ChannelEnum.ACTIVATE_AUDIO_DEVICE_PROFILE;
  const nextState = getStateForAudioDevice(
    deviceProfileSettings,
    arg[0] as string,
    presetPath,
  );
  activeAudioDeviceId = arg[0] as string;
  clearCurrentLayoutSettings();
  hasActiveSessionOverride = false;
  applyDeviceState(nextState);
  if (!deviceProfileSettings.assignments[activeAudioDeviceId]) {
    createEmptyProfileForActiveDevice();
  }
  await handleUpdate(event, channel);
  notifyOutputStateChanged();
});

ipcMain.on(ChannelEnum.GET_DEVICE_PROFILE_SETTINGS, async (event) => {
  const reply: TSuccess<IDeviceProfileSettings> = {
    result: deviceProfileSettings,
  };
  event.reply(ChannelEnum.GET_DEVICE_PROFILE_SETTINGS, reply);
});

ipcMain.on(ChannelEnum.ASSIGN_DEVICE_PROFILE, async (event, arg) => {
  const channel = ChannelEnum.ASSIGN_DEVICE_PROFILE;
  const assignment = arg[0] as IDeviceProfileAssignment;
  try {
    fetchPreset(assignment.presetName, presetPath);
    assignDeviceProfile(deviceProfileSettings, assignment);
    saveDeviceProfileSettings(deviceProfileSettings, userDataDir);
    await handleUpdate(event, channel);
  } catch (e) {
    console.error('Failed to assign device profile', e);
    handleError(event, channel, ErrorCode.PRESET_FILE_ERROR);
  }
});

ipcMain.on(ChannelEnum.REMOVE_DEVICE_PROFILE, async (event, arg) => {
  const channel = ChannelEnum.REMOVE_DEVICE_PROFILE;
  removeDeviceProfile(deviceProfileSettings, arg[0]);
  saveDeviceProfileSettings(deviceProfileSettings, userDataDir);
  await handleUpdate(event, channel);
});

ipcMain.on(ChannelEnum.GET_AUTO_EQ_DEVICE_LIST, async (event) => {
  const channel = ChannelEnum.GET_AUTO_EQ_DEVICE_LIST;
  console.log(`Getting AutoEQ Device List`);

  try {
    const fileNames: string[] = getAutoEqDeviceList();
    console.log(`Fetched ${fileNames.length} files`);
    const reply: TSuccess<string[]> = { result: fileNames };
    event.reply(channel, reply);
  } catch (e) {
    console.error('Failed to get devices');
    console.error(e);
    handleError(event, channel, ErrorCode.AUTO_EQ_READ_ERROR);
  }
});

ipcMain.on(ChannelEnum.GET_AUTO_EQ_RESPONSE_LIST, async (event, arg) => {
  const channel = ChannelEnum.GET_AUTO_EQ_RESPONSE_LIST;
  const deviceName: string = arg[0];
  console.log(`Getting AutoEQ supported response list for ${deviceName}`);

  try {
    const fileNames: string[] = getAutoEqResponseList(deviceName);
    console.log(`Fetched ${fileNames.length} files`);
    const reply: TSuccess<string[]> = { result: fileNames };
    event.reply(channel, reply);
  } catch (e) {
    console.error(`Failed to get supported responses for ${deviceName}`);
    console.error(e);
    handleError(event, channel, ErrorCode.AUTO_EQ_READ_ERROR);
  }
});

ipcMain.on(ChannelEnum.LOAD_AUTO_EQ_PRESET, async (event, arg) => {
  const channel = ChannelEnum.LOAD_AUTO_EQ_PRESET;
  const [deviceName, responseName] = arg as [string, string, string?];

  try {
    const presetSettings: IPresetV2 = getAutoEqPreset(deviceName, responseName);
    clearCurrentLayoutSettings();
    state.preAmp = presetSettings.preAmp;
    state.filters = presetSettings.filters;
    state.eqFormat = presetSettings.eqFormat;
    state.graphicEq = presetSettings.graphicEq;
    // Which model these bands came from, and out of which database. Not
    // recoverable from the bands, and the difference between a curve you can
    // reason about and a set of numbers. The source is recorded because the
    // same model name exists in several databases with unrelated measurements
    // behind it, so the name alone cannot lead back to this measurement.
    state.headset = deviceName;
    state.headsetTarget = responseName;
    state.headsetSource = AUTOEQ_SOURCE_ID;
    // AutoEQ may be ParametricEQ, FixedBandEQ, or GraphicEQ. Replace only the
    // EQ stage; an already loaded convolution remains an independent APO
    // stage.
    state.isFlat = false;
    await handleUpdate(event, channel, false, true);
  } catch (ex) {
    console.log(
      `Failed to load autoeq preset from ${deviceName} to ${responseName}`,
    );
    console.log(ex);
    handleError(event, channel, ErrorCode.PRESET_FILE_ERROR);
  }
});

ipcMain.on(ChannelEnum.GET_SQUIGLINK_SOURCE_LIST, async (event) => {
  const channel = ChannelEnum.GET_SQUIGLINK_SOURCE_LIST;
  try {
    const sources = await getSquiglinkSourceList();
    event.reply(channel, { result: sources } as TSuccess<
      Awaited<ReturnType<typeof getSquiglinkSourceList>>
    >);
  } catch (error) {
    console.error('Failed to get Squiglink source list', error);
    handleError(event, channel, ErrorCode.AUTO_EQ_READ_ERROR);
  }
});

ipcMain.on(ChannelEnum.GET_SQUIGLINK_DEVICE_LIST, async (event, arg) => {
  const channel = ChannelEnum.GET_SQUIGLINK_DEVICE_LIST;
  try {
    const sourceId = typeof arg?.[0] === 'string' ? arg[0] : undefined;
    const devices = await getSquiglinkDeviceList(sourceId);
    event.reply(channel, { result: devices } as TSuccess<string[]>);
  } catch (error) {
    console.error('Failed to get Squiglink device list', error);
    handleError(event, channel, ErrorCode.AUTO_EQ_READ_ERROR);
  }
});

ipcMain.on(ChannelEnum.GET_SQUIGLINK_RESPONSE_LIST, async (event, arg) => {
  const channel = ChannelEnum.GET_SQUIGLINK_RESPONSE_LIST;
  try {
    const sourceId = typeof arg?.[0] === 'string' ? arg[0] : undefined;
    const deviceName = arg?.[1] as string;
    const responses = await getSquiglinkResponseList(
      sourceId || deviceName,
      sourceId ? deviceName : undefined,
    );
    event.reply(channel, { result: responses } as TSuccess<string[]>);
  } catch (error) {
    console.error('Failed to get Squiglink response list', error);
    handleError(event, channel, ErrorCode.AUTO_EQ_READ_ERROR);
  }
});

ipcMain.on(ChannelEnum.LOAD_SQUIGLINK_PRESET, async (event, arg) => {
  const channel = ChannelEnum.LOAD_SQUIGLINK_PRESET;
  const isLegacyRequest = arg.length === 3;
  const sourceId = isLegacyRequest ? undefined : (arg[0] as string);
  const deviceName = (isLegacyRequest ? arg[0] : arg[1]) as string;
  const responseName = (isLegacyRequest ? arg[1] : arg[2]) as string;
  try {
    const presetSettings = sourceId
      ? await getSquiglinkPreset(sourceId, deviceName, responseName)
      : await getSquiglinkPreset(deviceName, responseName);
    clearCurrentLayoutSettings();
    state.preAmp = presetSettings.preAmp;
    state.filters = presetSettings.filters;
    state.eqFormat = AutoEqFormat.PARAMETRIC;
    state.graphicEq = undefined;
    state.headset = deviceName;
    state.headsetTarget = responseName;
    // Left undefined on the legacy three-argument request, which does not say
    // which database it meant. The panel falls back to matching on the model
    // name, which is what it did before the source was recorded at all.
    state.headsetSource = sourceId;
    // Squiglink responses are editable EQ bands. Keep any separately selected
    // convolution profile in place while replacing only the EQ chain.
    state.isFlat = false;
    await handleUpdate(event, channel, false, true);
  } catch (error) {
    console.error(
      `Failed to load Squiglink preset from ${deviceName} / ${responseName}`,
      error,
    );
    handleError(event, channel, ErrorCode.PRESET_FILE_ERROR);
  }
});

ipcMain.on(ChannelEnum.GET_CONVOLUTION_CATALOG, async (event, arg) => {
  const channel = ChannelEnum.GET_CONVOLUTION_CATALOG;
  try {
    const query = typeof arg?.[0] === 'string' ? arg[0] : '';
    const reply: TSuccess<Awaited<ReturnType<typeof getConvolutionCatalog>>> = {
      result: await getConvolutionCatalog(query),
    };
    event.reply(channel, reply);
  } catch (error) {
    console.error('Failed to get convolution catalogue', error);
    handleError(event, channel, ErrorCode.AUTO_EQ_READ_ERROR);
  }
});

ipcMain.on(ChannelEnum.DOWNLOAD_CONVOLUTION, async (event, arg) => {
  const channel = ChannelEnum.DOWNLOAD_CONVOLUTION;
  const entryId = arg?.[0];
  if (typeof entryId !== 'string' || !entryId) {
    handleError(event, channel, ErrorCode.INVALID_PARAMETER);
    return;
  }
  try {
    if (!configPath) {
      configPath = await getConfigPath();
    }
    state.convolution = await downloadConvolution(entryId, configPath);
    await handleUpdate(event, channel, false, true);
  } catch (error) {
    console.error('Failed to download convolution profile', error);
    handleError(event, channel, ErrorCode.AUTO_EQ_READ_ERROR);
  }
});

/**
 * Drop the reference, and with it the bands it produced.
 *
 * Applying a reference writes the measurement straight into the bands, so the
 * model is not a label sitting beside them — it is where every one of those
 * numbers came from. Keeping them after disclaiming their origin leaves a curve
 * nobody, the app included, can account for: not the user's tuning, not any
 * model's, just leftovers. A flat EQ is somewhere to start from; that is not.
 *
 * Deliberately the same reset as Clear EQ, down to leaving the voicing, the
 * driver correction, the measured Smart EQ curve and the convolution alone —
 * those were arrived at separately and the reference never spoke for them.
 */
ipcMain.on(ChannelEnum.CLEAR_HEADSET, async (event) => {
  const channel = ChannelEnum.CLEAR_HEADSET;
  resetEqToDefaults();
  // Replies with the new bands, the same as Clear EQ, so a caller that is not
  // about to re-read the whole state can adopt them: getDefaultFilters mints
  // fresh ids, and every id the renderer still holds has just stopped existing.
  await handleUpdateHelper<IFiltersMap>(
    event,
    channel,
    state.filters,
    false,
    true,
  );
});

ipcMain.on(ChannelEnum.CLEAR_CONVOLUTION, async (event) => {
  const channel = ChannelEnum.CLEAR_CONVOLUTION;
  state.convolution = undefined;
  await handleUpdate(event, channel, false, true);
});

/**
 * Pick a file the user already has and apply it.
 *
 * The dialog lives here rather than in the renderer because the renderer never
 * gets to see a filesystem path — it asks for an import and is told what was
 * applied. Cancelling is a normal outcome, not an error: it replies with an
 * empty description and nothing changes.
 */
const showImportDialog = async (
  title: string,
  filters: Electron.FileFilter[],
) => {
  const result = mainWindow
    ? await dialog.showOpenDialog(mainWindow, {
        title,
        filters,
        properties: ['openFile'],
      })
    : await dialog.showOpenDialog({ title, filters, properties: ['openFile'] });
  return result.canceled ? undefined : result.filePaths[0];
};

ipcMain.on(ChannelEnum.IMPORT_EQ_FILE, async (event) => {
  const channel = ChannelEnum.IMPORT_EQ_FILE;
  try {
    const sourcePath = await showImportDialog('Import EQ settings', [
      { name: 'EQ settings', extensions: ['txt', 'json'] },
      { name: 'All files', extensions: ['*'] },
    ]);
    if (!sourcePath) {
      const reply: TSuccess<string> = { result: '' };
      event.reply(channel, reply);
      return;
    }

    const imported = importEqFile(sourcePath);
    clearCurrentLayoutSettings();
    state.preAmp = imported.preAmp;
    state.filters = imported.filters;
    state.eqFormat = imported.eqFormat;
    state.graphicEq = imported.graphicEq;
    // These bands came from a file, not from a measured model.
    state.headset = undefined;
    state.headsetTarget = undefined;
    state.headsetSource = undefined;
    // An imported EQ is a tuning, so the flat flag has to come off or the
    // bands would be parsed, stored, and then not written.
    state.isFlat = false;
    await handleUpdateHelper<string>(
      event,
      channel,
      imported.unsupported > 0
        ? `Imported ${Object.keys(imported.filters).length} bands from the ${imported.sourceLabel}. ${imported.unsupported} band(s) used a filter type FluidEQ cannot edit and were skipped.`
        : `Imported ${Object.keys(imported.filters).length} bands from the ${imported.sourceLabel}.`,
      false,
      true,
    );
  } catch (error) {
    console.error('Failed to import EQ settings', error);
    handleError(
      event,
      channel,
      ErrorCode.IMPORT_ERROR,
      error instanceof Error ? error.message : undefined,
    );
  }
});

ipcMain.on(ChannelEnum.IMPORT_CONVOLUTION_FILE, async (event) => {
  const channel = ChannelEnum.IMPORT_CONVOLUTION_FILE;
  try {
    const sourcePath = await showImportDialog('Import an impulse response', [
      { name: 'WAV impulse response', extensions: ['wav'] },
    ]);
    if (!sourcePath) {
      const reply: TSuccess<string> = { result: '' };
      event.reply(channel, reply);
      return;
    }

    if (!configPath) {
      configPath = await getConfigPath();
    }
    state.convolution = importConvolutionFile(sourcePath, configPath);
    await handleUpdateHelper<string>(
      event,
      channel,
      `Applied ${state.convolution.name}.`,
      false,
      true,
    );
  } catch (error) {
    console.error('Failed to import a convolution file', error);
    handleError(
      event,
      channel,
      ErrorCode.IMPORT_ERROR,
      error instanceof Error ? error.message : undefined,
    );
  }
});

ipcMain.on(ChannelEnum.CHECK_AUTO_EQ_UPDATE, async (event) => {
  const channel = ChannelEnum.CHECK_AUTO_EQ_UPDATE;
  try {
    const reply: TSuccess<IAutoEqUpdateStatus> = {
      result: await checkAutoEqUpdate(),
    };
    event.reply(channel, reply);
  } catch (error) {
    console.warn('Unable to check for an AutoEq database update', error);
    handleError(event, channel, ErrorCode.AUTO_EQ_READ_ERROR);
  }
});

ipcMain.on(ChannelEnum.UPDATE_AUTO_EQ_DATABASE, async (event) => {
  const channel = ChannelEnum.UPDATE_AUTO_EQ_DATABASE;
  try {
    const reply: TSuccess<IAutoEqUpdateStatus> = {
      result: await updateAutoEqDatabase(),
    };
    event.reply(channel, reply);
  } catch (error) {
    console.error('Unable to update the AutoEq database', error);
    handleError(event, channel, ErrorCode.AUTO_EQ_READ_ERROR);
  }
});

ipcMain.on(ChannelEnum.GET_STATE, async (event) => {
  const channel = ChannelEnum.GET_STATE;
  const res = await updateConfigPath(event, channel);
  if (res) {
    const reply: TSuccess<IState> = { result: state };
    event.reply(channel, reply);
  } else {
    handleError(event, channel, ErrorCode.CONFIG_NOT_FOUND);
  }
});

ipcMain.on(ChannelEnum.GET_ENABLE, async (event) => {
  const reply: TSuccess<boolean> = { result: !!state.isEnabled };
  event.reply(ChannelEnum.GET_ENABLE, reply);
});

ipcMain.on(ChannelEnum.SET_ENABLE, async (event, arg) => {
  // eslint-disable-next-line prefer-destructuring
  state.isEnabled = arg[0];
  await handleUpdate(event, ChannelEnum.SET_ENABLE);
});

ipcMain.on(ChannelEnum.SET_AUTO_PREAMP, async (event, arg) => {
  // eslint-disable-next-line prefer-destructuring
  state.isAutoPreAmpOn = arg[0];
  await handleUpdate(event, ChannelEnum.SET_AUTO_PREAMP);
});

ipcMain.on(ChannelEnum.SET_GRAPH_VIEW, async (event, arg) => {
  // eslint-disable-next-line prefer-destructuring
  state.isGraphViewOn = arg[0];
  await handleUpdate(event, ChannelEnum.SET_GRAPH_VIEW);
});

ipcMain.on(ChannelEnum.SET_VIDEO_AD_BLOCK, (_event, arg) => {
  setVideoAdBlockEnabled(Boolean(arg[0]));
});

ipcMain.on(ChannelEnum.OPEN_VIDEO_LINK_EXTERNALLY, (_event, arg) => {
  openVideoLinkExternally(String(arg[0] ?? ''));
});

ipcMain.on(ChannelEnum.GET_PREAMP, async (event) => {
  const reply: TSuccess<number> = { result: state.preAmp || 0 };
  event.reply(ChannelEnum.GET_PREAMP, reply);
});

ipcMain.on(ChannelEnum.SET_PREAMP, async (event, arg) => {
  const channel = ChannelEnum.SET_PREAMP;
  const gain = parseFloat(arg[0]) || 0;

  if (gain < MIN_GAIN || gain > MAX_GAIN) {
    handleError(event, channel, ErrorCode.INVALID_PARAMETER);
    return;
  }

  state.preAmp = gain;
  await handleUpdate(event, channel, false, true);
});

ipcMain.on(ChannelEnum.GET_FILTER_GAIN, async (event, arg) => {
  const channel = ChannelEnum.GET_FILTER_GAIN;
  const filterId = arg[0];

  // Filter id must exist
  if (!doesFilterIdExist(event, channel, filterId)) {
    return;
  }

  const reply: TSuccess<number> = {
    result: state.filters[filterId].gain || 0,
  };
  event.reply(channel + filterId, reply);
});

ipcMain.on(ChannelEnum.SET_FILTER_GAIN, async (event, arg) => {
  const channel = ChannelEnum.SET_FILTER_GAIN;
  const filterId = arg[0];
  const gain = parseFloat(arg[1]) || 0;

  // Filter id must exist
  if (!doesFilterIdExist(event, channel, filterId)) {
    return;
  }

  if (gain < MIN_GAIN || gain > MAX_GAIN) {
    handleError(event, channel + filterId, ErrorCode.INVALID_PARAMETER);
    return;
  }

  switchToParametricEditing();
  state.filters[filterId].gain = gain;
  state.isFlat = false;
  await handleUpdate(event, channel + filterId, false, true);
});

ipcMain.on(ChannelEnum.GET_FILTER_FREQUENCY, async (event, arg) => {
  const channel = ChannelEnum.GET_FILTER_FREQUENCY;
  const filterId = arg[0];

  // Filter id must exist
  if (!doesFilterIdExist(event, channel, filterId)) {
    return;
  }

  const reply: TSuccess<number> = {
    result: state.filters[filterId].frequency || 10,
  };
  event.reply(channel + filterId, reply);
});

ipcMain.on(ChannelEnum.SET_FILTER_FREQUENCY, async (event, arg) => {
  const channel = ChannelEnum.SET_FILTER_FREQUENCY;
  const filterId = arg[0];
  const frequency = parseInt(arg[1], 10) || 0;

  // Filter id must exist
  if (!doesFilterIdExist(event, channel, filterId)) {
    return;
  }

  if (frequency < MIN_FREQUENCY || frequency > MAX_FREQUENCY) {
    handleError(event, channel + filterId, ErrorCode.INVALID_PARAMETER);
    return;
  }

  switchToParametricEditing();
  state.filters[filterId].frequency = frequency;
  state.isFlat = false;
  await handleUpdate(event, channel + filterId, false, true);
});

ipcMain.on(ChannelEnum.GET_FILTER_QUALITY, async (event, arg) => {
  const channel = ChannelEnum.GET_FILTER_QUALITY;
  const filterId = arg[0];

  // Filter id must exist
  if (!doesFilterIdExist(event, channel, filterId)) {
    return;
  }

  const reply: TSuccess<number> = {
    result: state.filters[filterId].quality || 10,
  };
  event.reply(channel + filterId, reply);
});

ipcMain.on(ChannelEnum.SET_FILTER_QUALITY, async (event, arg) => {
  const channel = ChannelEnum.SET_FILTER_QUALITY;
  const filterId = arg[0];
  const quality = parseFloat(arg[1]) || 0;

  // Filter id must exist
  if (!doesFilterIdExist(event, channel, filterId)) {
    return;
  }

  if (quality < MIN_QUALITY || quality > MAX_QUALITY) {
    handleError(event, channel + filterId, ErrorCode.INVALID_PARAMETER);
    return;
  }

  switchToParametricEditing();
  state.filters[filterId].quality = quality;
  state.isFlat = false;
  await handleUpdate(event, channel + filterId, false, true);
});

ipcMain.on(ChannelEnum.GET_FILTER_TYPE, async (event, arg) => {
  const channel = ChannelEnum.GET_FILTER_TYPE;
  const filterId = arg[0];

  // Filter id must exist
  if (!doesFilterIdExist(event, channel, filterId)) {
    return;
  }

  const reply: TSuccess<string> = {
    result: state.filters[filterId].type,
  };
  event.reply(channel + filterId, reply);
});

ipcMain.on(ChannelEnum.SET_FILTER_TYPE, async (event, arg) => {
  const channel = ChannelEnum.SET_FILTER_TYPE;
  const filterId = arg[0];
  const filterType = arg[1];

  // Filter id must exist
  if (!doesFilterIdExist(event, channel, filterId)) {
    return;
  }

  if (!Object.values(FilterTypeEnum).includes(filterType)) {
    handleError(event, channel + filterId, ErrorCode.INVALID_PARAMETER);
    return;
  }

  switchToParametricEditing();
  state.filters[filterId].type = filterType as FilterTypeEnum;
  state.isFlat = false;
  await handleUpdate(event, channel + filterId, false, true);
});

ipcMain.on(ChannelEnum.GET_FILTER_COUNT, async (event) => {
  const reply: TSuccess<number> = {
    result: Object.keys(state.filters).length,
  };
  event.reply(ChannelEnum.GET_FILTER_COUNT, reply);
});

ipcMain.on(ChannelEnum.ADD_FILTER, async (event, arg) => {
  const channel = ChannelEnum.ADD_FILTER;
  const frequency: number = arg[0];

  // Cannot exceed the maximum number of filters
  // Frequency must be in valid range
  if (
    Object.keys(state.filters).length >= MAX_NUM_FILTERS ||
    frequency < MIN_FREQUENCY ||
    frequency > MAX_FREQUENCY
  ) {
    handleError(event, channel, ErrorCode.INVALID_PARAMETER);
    return;
  }

  switchToParametricEditing();
  const newFilter: IFilter = { ...getDefaultFilterWithId(), frequency };
  state.filters[newFilter.id] = newFilter;
  state.isFlat = false;
  await handleUpdateHelper(event, channel, newFilter.id, false, true);
});

ipcMain.on(ChannelEnum.REMOVE_FILTER, async (event, arg) => {
  const channel = ChannelEnum.REMOVE_FILTER;
  const filterId: string = arg[0];

  // Cannot fall below the minimum number of filters
  if (Object.keys(state.filters).length <= MIN_NUM_FILTERS) {
    handleError(event, channel, ErrorCode.INVALID_PARAMETER);
    return;
  }

  // Filter id must exist
  if (!doesFilterIdExist(event, channel, filterId)) {
    return;
  }

  switchToParametricEditing();
  // delete does not throw exception even if the filterId does not exist
  delete state.filters[filterId];
  state.isFlat = false;
  await handleUpdate(event, channel, false, true);
});

ipcMain.on(ChannelEnum.CLEAR_GAINS, async (event) => {
  const channel = ChannelEnum.CLEAR_GAINS;

  resetEqToDefaults();

  // EQ reset is independent from convolution. Persist the resulting state
  // (including any active convolution) to the device profile so APO keeps the
  // impulse response enabled after the EQ bands are cleared.
  await handleUpdateHelper<IFiltersMap>(
    event,
    channel,
    state.filters,
    false,
    true,
  );
});

ipcMain.on(ChannelEnum.SET_FIXED_BAND, async (event, arg) => {
  const channel = ChannelEnum.SET_FIXED_BAND;
  const size: FixedBandSizeEnum = arg[0];
  if (!isFixedBandSizeEnumValue(size)) {
    handleError(event, channel, ErrorCode.INVALID_PARAMETER);
    return;
  }

  // Capture the high-resolution layout before replacing it. The snapshot is
  // device-scoped and survives app restarts, so returning to a previous band
  // count restores its original frequencies and tuning.
  captureCurrentLayout();
  const sourceSnapshot = snapshotFilters(state.filters);
  switchToParametricEditing();
  const storedSnapshot = getStoredLayout(size);
  const targetSnapshot =
    storedSnapshot || adaptLayoutToFixedFrequencies(sourceSnapshot, size);
  const nextFilters = getDefaultFilters(size);
  Object.values(nextFilters)
    .sort((left, right) => left.frequency - right.frequency)
    .forEach((filter, index) => {
      const savedBand = targetSnapshot[index];
      if (!savedBand) {
        return;
      }
      filter.frequency = savedBand.frequency;
      filter.gain = savedBand.gain;
      filter.quality = savedBand.quality;
      filter.type = savedBand.type;
    });
  state.filters = nextFilters;
  state.isFlat = false;

  await handleUpdateHelper<IFiltersMap>(
    event,
    channel,
    state.filters,
    false,
    true,
  );
});

ipcMain.on(ChannelEnum.SET_VOICING, async (event, arg) => {
  const channel = ChannelEnum.SET_VOICING;
  const profileId: string = arg[0];
  const intensity: number = arg[1];

  if (
    typeof profileId !== 'string' ||
    (profileId !== '' && !getVoicingProfile(profileId)) ||
    !Number.isFinite(intensity)
  ) {
    handleError(event, channel, ErrorCode.INVALID_PARAMETER);
    return;
  }

  // The voicing is a layer of its own, so this never touches state.filters.
  state.voicing = {
    profileId,
    intensity: Math.min(1, Math.max(0, intensity)),
  };

  await handleUpdate(event, channel, false, true);
});

ipcMain.on(ChannelEnum.SET_LOUDNESS, async (event, arg) => {
  const channel = ChannelEnum.SET_LOUDNESS;
  const isOn: boolean = arg[0];
  const intensity: number = arg[1];

  if (typeof isOn !== 'boolean' || !Number.isFinite(intensity)) {
    handleError(event, channel, ErrorCode.INVALID_PARAMETER);
    return;
  }

  // A layer of its own, like the voicing, so this never touches state.filters —
  // switching it off restores the tuning underneath it exactly.
  state.loudness = {
    isOn,
    intensity: Math.min(1, Math.max(0, intensity)),
  };

  await handleUpdate(event, channel, false, true);
});

ipcMain.on(ChannelEnum.SET_DRIVER, async (event, arg) => {
  const channel = ChannelEnum.SET_DRIVER;
  const profileId: string = arg[0];
  const intensity: number = arg[1];

  if (
    typeof profileId !== 'string' ||
    (profileId !== '' && !getDriverProfile(profileId)) ||
    !Number.isFinite(intensity)
  ) {
    handleError(event, channel, ErrorCode.INVALID_PARAMETER);
    return;
  }

  // Its own layer, like the voicing: never touches state.filters, so the
  // user's bands survive switching driver types and switching back.
  state.driver = {
    profileId,
    intensity: Math.min(1, Math.max(0, intensity)),
  };

  await handleUpdate(event, channel, false, true);
});

/**
 * Store what Smart EQ measured, as a layer of its own.
 *
 * Same contract as the voicing and the driver: this never touches
 * state.filters. Smart EQ used to write its answer straight into the user's
 * bands, which meant a measurement silently overwrote a tuning somebody had
 * built by hand and there was no way to undo one without losing the other. As a
 * layer the two are independent in both directions — clearing the reference
 * leaves the correction standing, and clearing the correction leaves the bands
 * and the reference alone.
 *
 * An empty or unusable payload removes the layer, which is how the "Also
 * applied" chip clears it.
 */
ipcMain.on(ChannelEnum.SET_SMART_EQ, async (event, arg) => {
  const channel = ChannelEnum.SET_SMART_EQ;
  const settings = arg?.[0];

  if (
    settings !== undefined &&
    settings !== null &&
    typeof settings !== 'object'
  ) {
    handleError(event, channel, ErrorCode.INVALID_PARAMETER);
    return;
  }

  state.smartEq = sanitizeSmartEqSettings(settings);
  await handleUpdate(event, channel, false, true);
});

ipcMain.on(ChannelEnum.SET_WINDOW_SIZE, async (event, arg) => {
  const channel = ChannelEnum.SET_WINDOW_SIZE;
  setWindowDimension(arg[0]);

  const reply: TSuccess<void> = { result: undefined };
  event.reply(channel, reply);
});

ipcMain.on('quit-app', () => {
  app.quit();
});

/**
 * The release notes, read from the file that ships with the app.
 *
 * A file rather than a string baked into the bundle, so writing an entry is
 * editing CHANGELOG.md and nothing else — no constant to update, no chance of
 * the two drifting apart. It is also the same file people read on GitHub.
 */
ipcMain.handle('get-changelog', () => {
  const candidates = [
    path.join(process.resourcesPath, 'CHANGELOG.md'),
    path.join(__dirname, '../../CHANGELOG.md'),
    path.join(app.getAppPath(), 'CHANGELOG.md'),
  ];
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) {
    return '';
  }
  try {
    return fs.readFileSync(found, 'utf8');
  } catch {
    return '';
  }
});

/**
 * Close FluidEQ and run the downloaded installer.
 *
 * Only ever reached from the "restart to update" button, which the renderer
 * only shows once electron-updater has reported the download finished — so by
 * the time this runs there is definitely something to install.
 */
ipcMain.handle('install-update', () => {
  // `false` for isSilent: the NSIS installer shows its progress, which is the
  // honest thing when the app the user was using has just vanished.
  autoUpdater.quitAndInstall(false, true);
});

ipcMain.handle('open-equalizer-apo-configurator', async () => {
  try {
    const equalizerApoRoot = path.dirname(await getConfigPath());
    const configuratorPath = ['DeviceSelector.exe', 'Configurator.exe']
      .map((fileName) => path.join(equalizerApoRoot, fileName))
      .find((candidate) => fs.existsSync(candidate));

    if (!configuratorPath) {
      return 'Equalizer APO device configurator was not found.';
    }

    return shell.openPath(configuratorPath);
  } catch {
    return 'Equalizer APO is not installed or its installation could not be located.';
  }
});

ipcMain.handle('open-equalizer-apo-settings', async () => {
  try {
    const equalizerApoRoot = path.dirname(await getConfigPath());
    // Equalizer APO 1.4.x renamed the old Configurator executable to Editor.
    // Keep the legacy name as a fallback for older installations.
    const settingsPath = ['Editor.exe', 'Configurator.exe']
      .map((fileName) => path.join(equalizerApoRoot, fileName))
      .find((candidate) => fs.existsSync(candidate));

    if (!settingsPath) {
      return 'Equalizer APO settings were not found.';
    }

    return shell.openPath(settingsPath);
  } catch {
    return 'Equalizer APO is not installed or its installation could not be located.';
  }
});

ipcMain.handle('restart-windows-audio', async () => {
  if (process.platform !== 'win32') {
    return 'Restarting Windows Audio is only available on Windows.';
  }

  const restartCommand = Buffer.from(
    'Restart-Service -Name Audiosrv -Force',
    'utf16le',
  ).toString('base64');
  const elevateCommand = [
    "$process = Start-Process -FilePath 'powershell.exe'",
    '-Verb RunAs -WindowStyle Hidden',
    `-ArgumentList '-NoProfile','-EncodedCommand','${restartCommand}'`,
    '-Wait -PassThru;',
    'exit $process.ExitCode',
  ].join(' ');

  return new Promise<string>((resolve) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', elevateCommand],
      { windowsHide: true },
      (error) => {
        resolve(
          error
            ? 'Windows Audio could not be restarted. Approve the administrator prompt and try again.'
            : '',
        );
      },
    );
  });
});

const sendWindowState = () => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }
  mainWindow.webContents.send('window-state-changed', {
    isMaximized: mainWindow.isMaximized(),
  });
};

ipcMain.handle('window-minimize', () => {
  mainWindow?.minimize();
});

ipcMain.handle('window-toggle-maximize', () => {
  if (!mainWindow) {
    return false;
  }
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow.maximize();
  }
  sendWindowState();
  return mainWindow.isMaximized();
});

ipcMain.handle('window-close', () => {
  mainWindow?.close();
});

ipcMain.handle('window-is-maximized', () => mainWindow?.isMaximized() ?? false);

/**
 * Real fullscreen — the OS kind, with the taskbar gone.
 *
 * Has to happen here: a renderer can ask for the Fullscreen API, but that
 * fullscreens an element within the window rather than the window itself, so
 * the taskbar and the window frame stay. The graph's fullscreen mode is for
 * watching something, and a strip of Windows chrome along the bottom of it is
 * the difference between a mode and a bigger panel.
 *
 * The window state is pushed afterwards because the titlebar's own buttons read
 * it, and a maximise button that still says "restore" while the window has no
 * frame at all is a control describing something that is not on screen.
 */
ipcMain.handle('window-set-full-screen', (_event, next: boolean) => {
  if (!mainWindow) {
    return false;
  }
  mainWindow.setFullScreen(!!next);
  sendWindowState();
  return mainWindow.isFullScreen();
});

if (process.env.NODE_ENV === 'production') {
  const sourceMapSupport = require('source-map-support');
  sourceMapSupport.install();
}

const isDebug =
  process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';

// Containerized development environments often run as root and do not expose
// Chromium's setuid sandbox. This is never enabled in packaged production.
if (isDebug && process.getuid?.() === 0) {
  app.commandLine.appendSwitch('no-sandbox');
  app.commandLine.appendSwitch('disable-setuid-sandbox');
}

if (isDebug) {
  require('electron-debug').default();
}

const installExtensions = async () => {
  const installer = require('electron-devtools-installer');
  const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
  const extensions = ['REACT_DEVELOPER_TOOLS'];

  return installer
    .default(
      extensions.map((name) => installer[name]),
      forceDownload,
    )
    .catch(console.log);
};

const createMainWindow = async () => {
  // React DevTools are optional. Keeping them opt-in avoids invoking the
  // installer's legacy session APIs on every development launch.
  if (isDebug && process.env.INSTALL_EXTENSIONS === 'true') {
    await installExtensions();
  }

  const RESOURCES_PATH = app.isPackaged
    ? path.join(process.resourcesPath, 'assets')
    : path.join(__dirname, '../../assets');

  const getAssetPath = (...paths: string[]): string => {
    return path.join(RESOURCES_PATH, ...paths);
  };

  const restored = loadWindowState();

  mainWindow = new BrowserWindow({
    show: false,
    width: restored.width ?? WINDOW_WIDTH,
    minWidth: WINDOW_MIN_WIDTH,
    height: restored.height ?? WINDOW_HEIGHT,
    minHeight: WINDOW_MIN_HEIGHT,
    // A saved position if there is one and a screen still covers it —
    // otherwise the middle of the display.
    //
    // Omitting both leaves the placement to Chromium, which offsets each new
    // window down and right from the last one. On a first run that put FluidEQ
    // somewhere off-centre and slightly high for no reason anybody could see,
    // and it is the very first impression the app makes. `center` is ignored
    // when x and y are given, so the two cannot fight.
    ...(restored.x !== undefined && restored.y !== undefined
      ? { x: restored.x, y: restored.y }
      : { center: true }),
    // .ico carries every size Windows asks for — taskbar, alt-tab and the
    // window corner each want a different one, and scaling a single png for
    // all three is what makes it look soft.
    icon: getAssetPath(process.platform === 'win32' ? 'icon.ico' : 'icon.png'),
    resizable: true,
    frame: false,
    // Chromium paints white until the first frame of the page arrives. On a
    // frameless dark window that is a full-size white flash, and it happens
    // before any CSS has loaded, so no stylesheet can prevent it. Matching the
    // shell's own background means the gap is invisible.
    backgroundColor: '#04090f',
    webPreferences: {
      preload: app.isPackaged
        ? path.join(__dirname, 'preload.js')
        : path.join(__dirname, '../../.erb/dll/preload.js'),
      // Chromium fetches a hunspell dictionary the first time a spellchecked
      // field is focused and then keeps it resident. The only text anyone
      // types here is a preset name, so it buys nothing and costs a download
      // and a couple of megabytes for the life of the process.
      spellcheck: false,
      // What lets the Video tab exist at all. Off by default in Electron, and
      // only half the story: the tag is enabled here, and every attachment it
      // makes is stripped and re-specified in videoBrowser.ts, which is where
      // the player's actual privileges are decided.
      webviewTag: true,
      // The default, stated rather than assumed because it is load-bearing:
      // minimised or fully occluded, Chromium drops timers and animation
      // frames to roughly one a second. The meter, the creature and the whole
      // of euphoria mode are driven by animation frames, so leaving this on is
      // what stops a window nobody is looking at from animating at full rate.
      backgroundThrottling: true,
    },
  });

  mainWindow.webContents.session.setDisplayMediaRequestHandler(
    (request, callback) => {
      if (
        !mainWindow ||
        request.frame !== mainWindow.webContents.mainFrame ||
        !request.audioRequested
      ) {
        callback({});
        return;
      }

      // Chromium still requires a video source for getDisplayMedia even when
      // the renderer only consumes the audio track. Use the FluidEQ window as
      // that source instead of a monitor: monitor capture is what triggers
      // WGC's CreateForMonitor/E_ACCESSDENIED failures on some Windows setups.
      // The loopback audio stream remains system-wide and is independent of
      // the video source.
      const provideLoopbackSource = async () => {
        try {
          const sources = await desktopCapturer.getSources({
            types: ['window'],
            thumbnailSize: { width: 0, height: 0 },
            fetchWindowIcons: false,
          });
          const windowSourceId = mainWindow?.getMediaSourceId();
          const source =
            sources.find((candidate) => candidate.id === windowSourceId) ||
            sources.find((candidate) =>
              candidate.name.toLowerCase().includes('fluideq'),
            ) ||
            sources[0];

          if (source) {
            callback({ video: source, audio: 'loopback' });
          } else {
            // A frame source is a valid final fallback if Windows does not
            // expose any capturable windows (for example while minimized).
            callback({ video: request.frame || undefined, audio: 'loopback' });
          }
        } catch {
          callback({ video: request.frame || undefined, audio: 'loopback' });
        }
      };
      provideLoopbackSource();
    },
  );

  // Only when there is nothing remembered. The saved size is a decision the
  // user made; forcing the graph-view height over the top of it would undo that
  // on every launch, which is exactly what restoring the window is meant to
  // stop. Toggling the graph in-session still resizes.
  if (restored.width === undefined) {
    setWindowDimension(state.isGraphViewOn);
  }

  let hasRevealedMainWindow = false;
  const revealMainWindow = () => {
    if (!mainWindow || hasRevealedMainWindow) {
      return;
    }
    hasRevealedMainWindow = true;

    if (process.env.START_MINIMIZED) {
      mainWindow.minimize();
    } else {
      // Maximize before showing, so the window does not appear at its restored
      // size and then visibly snap outward.
      if (restored.isMaximized) {
        mainWindow.maximize();
      }
      mainWindow.show();
    }

    if (isDebug) {
      // When in debug mode, show dev tools after the app loads.
      mainWindow.webContents.openDevTools();
    }
  };

  // `ready-to-show` fires when Chromium has a first frame, which for a React
  // app is an empty <div id="root"> — the window would appear, sit blank, and
  // then fill in. The renderer says when it has actually painted something
  // (see RENDERER_READY_EVENT); this is only the fallback for a renderer that
  // never gets that far, so a crashed bundle still shows a window with an
  // error in it rather than nothing at all.
  mainWindow.once('ready-to-show', () => {
    setTimeout(revealMainWindow, RENDERER_PAINT_GRACE_MS);
  });
  ipcMain.once(RENDERER_READY_EVENT, revealMainWindow);
  mainWindow.on('maximize', sendWindowState);
  mainWindow.on('unmaximize', sendWindowState);
  mainWindow.on('enter-full-screen', sendWindowState);
  mainWindow.on('leave-full-screen', sendWindowState);
  // Debounced: dragging a window fires 'resize' continuously, and writing a
  // file on every frame of that would be absurd. 400ms after the user stops.
  let saveTimer: NodeJS.Timeout | undefined;
  const scheduleSave = () => {
    if (saveTimer) {
      clearTimeout(saveTimer);
    }
    saveTimer = setTimeout(saveWindowState, 400);
  };
  mainWindow.on('resize', scheduleSave);
  mainWindow.on('move', scheduleSave);
  mainWindow.on('maximize', scheduleSave);
  mainWindow.on('unmaximize', scheduleSave);

  mainWindow.on('close', () => {
    // Synchronously, before the window goes: a pending debounce would never
    // fire, so closing right after a resize would lose that resize.
    if (saveTimer) {
      clearTimeout(saveTimer);
    }
    saveWindowState();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  const rendererUrl = resolveHtmlPath('index.html');
  mainWindow.webContents.on('did-finish-load', sendWindowState);
  // Polling for the dev server is an optimisation, not a gate. Giving up used
  // to throw out of createMainWindow with nothing to catch it, so a slow bundle
  // produced an unhandled rejection and no window at all — while
  // webpack-dev-middleware was perfectly willing to hold the request until the
  // bundle finished. Load either way and let that happen.
  await waitForRenderer(rendererUrl).catch((error) => {
    console.warn(
      'Renderer was not ready in time; loading anyway and letting the dev server finish.',
      error,
    );
  });
  await mainWindow.loadURL(rendererUrl);

  // If ready-to-show was skipped by a fast dev-server response, reveal the
  // already-loaded window instead of leaving an invisible Electron process.
  revealMainWindow();

  // Keep both public measurement databases current without blocking the first
  // paint. The renderer receives an event when the background sync finishes
  // and refreshes whichever source is currently selected.
  syncDatabasesOnStartup().catch((error) => {
    console.warn('Database startup synchronization failed', error);
  });

  const menuBuilder = new MenuBuilder(mainWindow);
  menuBuilder.buildMenu();

  // Open urls in the user's browser
  mainWindow.webContents.setWindowOpenHandler((edata) => {
    shell.openExternal(edata.url);
    return { action: 'deny' };
  });

  setUpAutoUpdates();
};

/**
 * Write down what killed it, before it dies.
 *
 * Nothing here changes what happens — a throw with nobody to catch it still
 * ends the process, and it should. What changes is whether there is any record
 * afterwards. Without these, the only trace of a crash in a packaged build is
 * the window disappearing, and the bug report that follows says "it closed",
 * which is not something anybody can fix.
 *
 * Installed at module scope rather than inside `whenReady`, because the window
 * that never opens is exactly the failure worth catching, and by `whenReady` a
 * good deal of the app has already run.
 */
const setUpCrashLogging = () => {
  // Moved up from the updater's setup, which does not run until a window is
  // being built. Everything logged before that point was going to the console
  // and no further — including, by definition, every failure to get that far.
  log.transports.file.level = 'info';

  process.on('uncaughtException', (error) => {
    log.error('Uncaught exception in the main process', error);
  });

  process.on('unhandledRejection', (reason) => {
    log.error('Unhandled promise rejection in the main process', reason);
  });

  // The window's own process, or a video player's, dying underneath us. The
  // reason is Chromium's — 'crashed', 'oom', 'killed' — and it is the only
  // evidence there is for a page that took its process with it.
  app.on('render-process-gone', (_event, contents, details) => {
    log.error(
      `Render process gone (${contents.getType()}): ${details.reason}`,
      details,
    );
  });

  app.on('child-process-gone', (_event, details) => {
    log.error(
      `Child process gone (${details.type}): ${details.reason}`,
      details,
    );
  });
};

setUpCrashLogging();

/**
 * Add event listeners...
 */

app.on('window-all-closed', () => {
  // Respect the OSX convention of having the application in memory even
  // after all windows have been closed
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app
  .whenReady()
  .then(() => {
    // Identity, set here rather than at module scope on purpose.
    //
    // app.setName feeds app.getPath('userData'), which is read at import time
    // (userDataDir, above) to find the presets. Renaming before that point
    // would move the data directory out from under an existing install. By the
    // time the app is ready the path is already resolved, so this reaches only
    // app.getName() and the strings Electron derives from it — default dialog
    // titles and the About panel.
    //
    // None of the Windows-visible identity comes from here: Task Manager reads
    // the exe's FileDescription resource, which electron-builder stamps from
    // build.productName at package time, and the taskbar groups by the AUMID
    // set on the next line.
    app.setName('FluidEQ');
    if (process.platform === 'win32') {
      // Without this the taskbar attributes the window to Electron itself,
      // which is also why notifications and pinning misbehave in development.
      app.setAppUserModelId('com.gigabytz.fluideq');
    }
    // Before any window exists, so the player's session and the rules its web
    // contents run under are in place by the time one can be attached.
    setUpVideoBrowser();
    createMainWindow().catch((error) => {
      console.error('Failed to create the FluidEQ window', error);
    });
    app.on('activate', () => {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (mainWindow === null) {
        createMainWindow().catch((error) => {
          console.error('Failed to create the FluidEQ window', error);
        });
      }
    });
  })
  .catch(console.log);
