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

/**
 * This module executes inside of electron's main process. You can start
 * electron renderer process from here and communicate with the other processes
 * through IPC.
 *
 * When running `npm run build` or `npm run build:main`, this file is compiled to
 * `./src/main.js` using webpack. This gives us some performance wins.
 *
 * What each subject needs is handed to it here and nowhere else, so the answer
 * to "what does this part of the app touch in the main process" is the
 * argument it is registered with.
 */
import { app, BrowserWindow, powerMonitor } from 'electron';
import log from 'electron-log';
import path from 'path';
import fs from 'fs';
import { fetchSettings } from './flush';
import { flushPendingWrites, scheduleWrite } from './asyncWriter';
import {
  getConfigPath,
  getFluidEngineConfigDir,
  isEngineInstalled,
} from './registry';
import {
  FLUID_ENGINE_PROGRAMME_FILENAME,
  FLUID_ENGINE_SPLIT_FILENAME,
} from '../common/audioEngine';
import { readAudioEngineStatus } from './engineStatus';
import { createSecondOutputs } from './secondOutputRoute';
import {
  startNativeOutputHold,
  startNativeOutputMirror,
} from './remoteAudioCapture';
import { createSongLevelStore } from './songLevels';
import { createSongProgramme } from './songProgramme';
import { resetEngineAtSessionEnd, resetEngineForQuit } from './engineQuitReset';
import { startEngineOwnerPipe } from './engineOwnerPipe';
import startEngineAnalysisPipe, {
  readEngineProcesses,
} from './engineAnalysisPipe';
import { createProcessMeter } from './processMeter';
import ChannelEnum from '../common/channels';
import { IState, OUTPUT_STATE_CHANGED_EVENT } from '../common/constants';
import { TSuccess } from '../renderer/utils/equalizerApi';
import { syncOpraDatabase } from './opraUpdater';
import { setUpVideoBrowser } from './videoBrowser';
import {
  beginQuit,
  destroyTray,
  isAppQuitting,
  revealMainWindow,
  setUpTray,
} from './tray';
import { consumeUnattendedRestart } from './unattendedUpdate';
import { accountComeBackSteps, createComeBackWatch } from './comeBackSignals';
import { createMainWindowFactory } from './mainWindow';
import { installCrashLogging } from './crashRecovery';
import { createApoAdoption } from './apoAdopt';
import { registerTransferIpc } from './ipc/transfer';
import { registerReferencesIpc } from './ipc/references';
import { registerKaraokeIpc } from './ipc/karaoke';
import { registerWindowIpc } from './ipc/window';
import { createWindowModes } from './windowMode';
import { registerFiltersIpc } from './ipc/filters';
import registerBandDesignsIpc from './ipc/bandDesigns';
import { registerLayersIpc } from './ipc/layers';
import registerSongEqHandlers from './ipc/songEq';
import registerSongSoundIpc from './ipc/songSound';
import { registerPreampIpc } from './ipc/preamp';
import registerVideoIpc from './ipc/video';
import { registerKaraokeSeparation } from './karaokeSeparation';
import { registerKaraokePitch } from './karaokePitch';
import { registerProfilesIpc } from './ipc/profiles';
import { IOutputWatch, startOutputWatch } from './outputWatch';
import { registerUpdatesIpc } from './ipc/updates';
import { registerLibraryIpc } from './ipc/library';
import {
  dspHostPid,
  dspHostStats,
  registerDspHostIpc,
  shutdownDspHost,
  setDspHostRawLibrary,
} from './ipc/dspHost';
import { registerProcessIpc } from './ipc/processes';
import { registerLibraryPlaylistsIpc } from './ipc/libraryPlaylists';
import { registerEngineHealthIpc } from './ipc/engineHealth';
import { registerLightingIpc } from './ipc/lighting';
import { registerRemoteAudioIpc } from './ipc/remoteAudio';
import { registerForumIpc } from './ipc/forum';
import { registerMotionPreferenceIpc } from './ipc/motionPreference';
import { registerGamesIpc } from './ipc/games';
import { registerSystemVolumeIpc } from './systemVolume';
import { registerStartWithWindowsIpc } from './ipc/startWithWindows';
import { registerSettingsResetIpc } from './ipc/settingsReset';
import { DEFAULT_LIGHTING_SETTINGS } from '../common/lighting/lightingModel';
import { MOTION_SWITCHES, readMotionPreference } from './motionPreference';
import {
  gpuPreferenceSupported,
  HIGH_PERFORMANCE_GPU_SWITCH,
  readGpuPreference,
} from './graphicsPreference';
import { registerGraphicsPreferenceIpc } from './ipc/graphicsPreference';
import { registerOutputMirrorIpc } from './ipc/outputMirror';
import {
  handleLibraryMedia,
  registerPrivilegedSchemes,
} from './library/libraryProtocol';
import { PRODUCT_NAME } from '../common/branding';
import { APP_USER_MODEL_ID } from './appIdentity';
import { appVersion } from './appVersion';
import { loadDeviceProfileSettings } from './deviceProfileSettings';
import onWindowMessage from './ipc/windowMessages';
import { declineDefaultMenu } from './menu';
import registerDevMemoryTrace from './devMemoryTrace';
import createAppUpdates from './appUpdates';
import { createWindowPlacement, firstRunPlacement } from './windowPlacement';
import createMainSession, { outputEditorOf } from './mainSession';
import { getStateForAudioDevice } from './deviceProfiles';
import { createSourceAnalysisPublisher } from './sourceAnalysis';
import { registerSourceAnalysisIpc } from './ipc/sourceAnalysis';
import {
  createProfileStore,
  isAutomaticPresetName,
  shieldReferenceBands,
} from './profileStore';
import createApoDiskSync from './apoDiskSync';
import { createUpdatePath, handleError } from './updatePath';
import registerDiagnosticsIpc from './ipc/diagnostics';
import registerApoConfigIpc from './ipc/apoConfig';
import registerEngineStateIpc from './ipc/engineState';
import registerNativeDialogsIpc from './ipc/nativeDialogs';
import registerWindowsAudioIpc from './ipc/windowsAudio';
import registerSystemMediaIpc from './ipc/systemMedia';
import registerMemberServices from './memberServices';
import { applyLaunchSwitches, isDebug } from './launchSwitches';
import claimTheOnlyCopy from './onlyCopy';
import { chooseLaunchEngine, registerEngineServices } from './engineServices';

/**
 * Declares the `fluideq-media:` scheme's privileges before the app is ready.
 *
 * Deliberately at module scope, at the top of the file, rather than beside
 * `registerLibraryIpc` further down or inside `whenReady` beside
 * `handleLibraryMedia`: `registerSchemesAsPrivileged` only has an effect when
 * called before `app.whenReady()`, and calling it after gives no error at
 * all — the scheme looks registered and then serves every request as an
 * ordinary untrusted one, which reads exactly like a CSP bug and nothing
 * points back here. See the doc comment on the function itself.
 */
registerPrivilegedSchemes();

// Before `ready` for the same reason: Electron builds its default menu then,
// for an app that has not said it wants none. See `declineDefaultMenu`.
declineDefaultMenu();

let mainWindow: BrowserWindow | null = null;
const getMainWindow = () => mainWindow;

/**
 * Windows' own output notifications, followed by a helper for as long as the
 * app runs; replaces the device list read every three seconds.
 */
let outputWatch: IOutputWatch | undefined;

const memoryTrace = registerDevMemoryTrace(getMainWindow);

/**
 * The full app and the player it turns into, and the floor each keeps. What
 * happens after a switch is attached below, at `windowModes.listen`.
 */
const windowModes = createWindowModes();

// A sandbox for running from a checkout on macOS or Linux, where neither engine
// can be installed. Only there: a packaged build took it too and kept every
// setting, profile and cache in the temp folder, which Linux empties at boot
// and macOS purges, so a start after a reboot began from nothing. Nothing is
// copied over from it: no macOS or Linux build has been published (releases
// carry only the Windows installer), and this is the folder development
// writes to, which a copy would pour into an installed app.
if (process.platform !== 'win32' && !app.isPackaged) {
  app.setPath('userData', path.join(app.getPath('temp'), 'fluideq-dev'));
  fs.mkdirSync(app.getPath('userData'), { recursive: true });
}

/** ----- Equalizer APO Implementation ----- */

// Load initial state from local state file
const userDataDir = app.getPath('userData');

// Animated or reduced as chosen in the app, never as Windows' "Animation
// effects" happens to be set (`motionPreference.ts`): with that off, every
// motion in the app stood down and came back only when the setting did.
const motionAtLaunch = readMotionPreference(userDataDir);
app.commandLine.appendSwitch(MOTION_SWITCHES[motionAtLaunch]);

// On the fast graphics card of a laptop with two, when the listener chose it
// in the graph's View menu (`graphicsPreference.ts`): Chromium takes the
// choice for the whole app and only at launch.
const gpuAtLaunch = readGpuPreference(userDataDir);
if (gpuAtLaunch === 'high' && gpuPreferenceSupported(process.platform)) {
  app.commandLine.appendSwitch(HIGH_PERFORMANCE_GPU_SWITCH);
}

/** Where the "I restarted myself" note lives; see unattendedUpdate.ts. */
const UNATTENDED_RESTART_MARKER_PATH = path.join(
  userDataDir,
  'unattended-update.json',
);

/**
 * Read exactly once, here, at the top of the launch.
 *
 * Reading also clears the marker, so it has to happen in one place — asking a
 * second time would answer false and the window would appear after all. The
 * window factory reads this boolean rather than the file.
 */
const didRestartForUnattendedUpdate = consumeUnattendedRestart(
  UNATTENDED_RESTART_MARKER_PATH,
  appVersion(),
);

const updates = createAppUpdates({
  getMainWindow,
  unattendedRestartMarkerPath: UNATTENDED_RESTART_MARKER_PATH,
});

const placement = createWindowPlacement({
  userDataDir,
  getMainWindow,
  windowModes,
});

const state: IState = fetchSettings(userDataDir);
const deviceProfileSettings = loadDeviceProfileSettings(userDataDir);
const session = createMainSession();

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
    deviceId: session.activeAudioDeviceId,
  });
};

const syncDatabasesOnStartup = async () => {
  const opraResult = await Promise.resolve(syncOpraDatabase())
    .then((value) => ({ status: 'fulfilled' as const, value }))
    .catch((reason) => ({ status: 'rejected' as const, reason }));

  if (opraResult.status === 'rejected') {
    log.warn('Unable to synchronize the OPRA database', opraResult.reason);
  }
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  mainWindow.webContents.send(DATABASES_SYNCED_EVENT, {
    opra: opraResult.status === 'fulfilled' ? opraResult.value : undefined,
  });
};

const profiles = createProfileStore({
  state,
  session,
  deviceProfileSettings,
  userDataDir,
});
profiles.prepareProfileFolders();

/**
 * Believe the Equalizer APO config over our own copy of the state.
 *
 * Runs once, before the first flush of the session. The file on disk is what
 * the user is actually hearing; state.txt is only what FluidEQ last believed,
 * and the two part company whenever anything else touches the config — a hand
 * edit, another tool, an APO reinstall, a restore from backup. When they
 * disagree the file wins.
 *
 * Only the audible part is adopted, and only the part the config can attribute.
 * A config FluidEQ wrote keeps each feature in a file of its own, so the bands
 * can be told apart from the voicing, the driver correction and the measured
 * Smart EQ curve, and read back without dragging any of them along. A flat one
 * — an older FluidEQ's, a hand-written one, another tool's — says nothing about
 * where a `Filter N:` line came from, and there the old caution still holds.
 */
const {
  adoptBypassFromConfig,
  adoptExistingApoConfig,
  readCustomFxForDevice,
  syncCustomFxFromConfig,
} = createApoAdoption({
  hydrateActiveConvolution: profiles.hydrateActiveConvolution,
  session,
  state,
  userDataDir,
});

const diskSync = createApoDiskSync({
  state,
  session,
  deviceProfileSettings,
  userDataDir,
  presetDirForDevice: profiles.presetDirForDevice,
  getCurrentPreset: profiles.getCurrentPreset,
  sessionHeadroom: profiles.sessionHeadroom,
  syncCustomFxFromConfig,
  adoptBypassFromConfig,
  notifyOutputStateChanged,
});

const {
  updateConfigPath,
  handleUpdateHelper,
  handleUpdate,
  reflushCurrentState,
  doesFilterIdExist,
} = createUpdatePath({
  state,
  session,
  deviceProfileSettings,
  userDataDir,
  diskSync,
  presetDirForDevice: profiles.presetDirForDevice,
  getCurrentPreset: profiles.getCurrentPreset,
  sessionHeadroom: profiles.sessionHeadroom,
  attachPresetToActiveDevice: profiles.attachPresetToActiveDevice,
  captureCurrentLayout: profiles.captureCurrentLayout,
});

registerDiagnosticsIpc({
  userDataDir,
  getEngine: () => session.audioEngine,
  handleError,
});

registerEngineStateIpc({
  state,
  snapshot: () => {
    const main = session.playbackAudioDevice;
    let playbackState: IState | undefined;
    if (main) {
      playbackState =
        main.id === session.activeAudioDeviceId
          ? { ...state }
          : structuredClone(
              session.outputStateOverrides?.get(main.id) ??
                getStateForAudioDevice(
                  deviceProfileSettings,
                  main.id,
                  profiles.presetDirForDevice,
                ),
            );
      playbackState.isEnabled = state.isEnabled;
      playbackState.dsp =
        session.outputDspOverrides?.get(main.id) ?? playbackState.dsp;
    }
    const audibleDsp = session.outputDspOverrides?.get(
      session.activeAudioDeviceId,
    );
    const ownsTemporaryRack =
      audibleDsp !== undefined &&
      (state.songSoundLoan !== undefined ||
        JSON.stringify(audibleDsp) !== JSON.stringify(state.dsp));
    return {
      ...state,
      dsp: audibleDsp ?? state.dsp,
      ownedDsp: ownsTemporaryRack ? state.dsp : undefined,
      outputEditor: outputEditorOf(session),
      playbackOutput: main,
      playbackState,
    };
  },
  userDataDir,
  updateConfigPath,
  handleUpdate,
  handleError,
  adoptExistingApoConfig,
  hydrateActiveConvolution: profiles.hydrateActiveConvolution,
  syncCustomFxFromConfig,
});

const { apoGuard } = registerEngineServices({
  userDataDir,
  state,
  session,
  deviceProfileSettings,
  presetDirForDevice: profiles.presetDirForDevice,
  reflush: reflushCurrentState,
  onEngineSwitched: () => {
    Promise.all([
      secondOutputs.reroute(),
      songProgramme.reflush(),
      sourceAnalysis.reflush(),
    ]).catch((error: unknown) =>
      log.error('Could not move output processing to the new engine', error),
    );
  },
});

// Two dozen dependencies, and the list is worth reading rather than skipping:
// most of them are about audio devices, not files. A profile only means
// anything relative to the output it is attached to, so this and the device
// handlers are one subject with two names — which the extraction made visible
// rather than fixed.
const profilesIpc = registerProfilesIpc({
  state,
  userDataDir,
  activeBaselineDir: profiles.activeBaselineDir,
  deviceProfileSettings,
  session,
  handleUpdate,
  handleUpdateHelper,
  handleError,
  runProfileMutation: profiles.runProfileMutation,
  attachPresetToActiveDevice: profiles.attachPresetToActiveDevice,
  clearCurrentLayoutSettings: profiles.clearCurrentLayoutSettings,
  createEmptyProfileForActiveDevice: profiles.createEmptyProfileForActiveDevice,
  getCurrentPreset: profiles.getCurrentPreset,
  hydrateActiveConvolution: profiles.hydrateActiveConvolution,
  isAutomaticPresetName,
  availableProfileNameForActiveDevice:
    profiles.availableProfileNameForActiveDevice,
  presetDirForDevice: profiles.presetDirForDevice,
  activePresetDir: profiles.activePresetDir,
  resetStateToDefaults: profiles.resetStateToDefaults,
  adoptExistingApoConfig,
  applyDeviceState: profiles.applyDeviceState,
  captureCurrentLayout: profiles.captureCurrentLayout,
  notifyOutputStateChanged,
  guardAgainstApo: apoGuard.check,
  onPlaybackOutputChanged: () => sourceAnalysis.reflush(),
});

registerApoConfigIpc({
  session,
  deviceProfileSettings,
  presetDirForDevice: profiles.presetDirForDevice,
  readCustomFxForDevice,
  handleError,
});

registerReferencesIpc({
  applyingLayer: profiles.applyingLayer,
  handleError,
  handleUpdate,
  handleUpdateHelper,
  session,
  shieldReferenceBands,
  state,
});

registerTransferIpc({
  activePresetDir: profiles.activePresetDir,
  applyingLayer: profiles.applyingLayer,
  attachPresetToActiveDevice: profiles.attachPresetToActiveDevice,
  availableProfileNameForActiveDevice:
    profiles.availableProfileNameForActiveDevice,
  activeBaselineDir: profiles.activeBaselineDir,
  clearCurrentLayoutSettings: profiles.clearCurrentLayoutSettings,
  resetEqToDefaults: profiles.resetEqToDefaults,
  deviceProfileSettings,
  getMainWindow,
  handleError,
  handleUpdateHelper,
  hydrateActiveConvolution: profiles.hydrateActiveConvolution,
  presetDirForDevice: profiles.presetDirForDevice,
  session,
  shieldReferenceBands,
  state,
});

registerPreampIpc({
  state,
  canMeasureHeadroom: () =>
    session.audioEngine === 'apo' &&
    !session.engineSwitching &&
    session.activeAudioDeviceId === session.playbackAudioDevice?.id,
  usesNativeHeadroom: () => session.audioEngine === 'fluid',
  handleUpdate,
  handleUpdateHelper,
  handleError,
});

registerVideoIpc();
registerKaraokeSeparation();
registerKaraokePitch();

// The EQ chain, in two files rather than five hundred lines of this one.
//
// What each list names is what that half of the chain is able to reach. The
// bands need the layout machinery because changing the band count has to
// remember where the old ones were; the layers do not, and now cannot.
registerBandDesignsIpc({
  state,
  userDataDir,
  handleUpdateHelper,
  handleError,
  switchToParametricEditing: profiles.switchToParametricEditing,
  captureCurrentLayout: profiles.captureCurrentLayout,
});

registerFiltersIpc({
  state,
  handleUpdate,
  handleUpdateHelper,
  handleError,
  doesFilterIdExist,
  captureCurrentLayout: profiles.captureCurrentLayout,
  getStoredLayout: profiles.getStoredLayout,
  switchToParametricEditing: profiles.switchToParametricEditing,
  applyingLayer: profiles.applyingLayer,
});

registerLayersIpc({
  state,
  handleUpdate,
  handleError,
  applyingLayer: profiles.applyingLayer,
});

registerSongEqHandlers(userDataDir);
registerSongSoundIpc({
  state,
  userDataDir,
  handleUpdateHelper,
  getOutputEditor: () => outputEditorOf(session),
});

onWindowMessage(ChannelEnum.SET_WINDOW_SIZE, async (event, arg) => {
  const channel = ChannelEnum.SET_WINDOW_SIZE;
  placement.setWindowDimension(arg[0]);

  const reply: TSuccess<void> = { result: undefined };
  event.reply(channel, reply);
});

onWindowMessage('quit-app', () => {
  // Declining the disclaimer means the app should not run, so this is one of
  // the paths that genuinely ends the process rather than hiding the window.
  beginQuit();
  app.quit();
});

// What changed, and installing it. The updater goes across as a getter: it is
// built asynchronously at startup and stays unset when its signature or feed
// checks fail, so a reference captured here would be undefined forever.
registerUpdatesIpc({ getActiveAutoUpdater: updates.getActiveAutoUpdater });

registerNativeDialogsIpc();
registerWindowsAudioIpc();

/**
 * Which song the machine is playing, for the FluidEQ Engine's live leveling
 * — see `songProgramme.ts`. Fed by the same media watcher as the bar, and
 * by the engine's statuses for the songs it finished learning.
 */
const songProgramme = createSongProgramme({
  store: createSongLevelStore(userDataDir),
  mainEndpoint: () => session.playbackAudioDevice?.guid,
  fileName: FLUID_ENGINE_PROGRAMME_FILENAME,
  write: scheduleWrite,
  // The rack write's refusals (`ipc/audioEngine.ts`): not this engine, or
  // mid-switch. And installed before the path is asked for, because asking
  // creates the directory.
  resolveConfigDir: async () =>
    session.audioEngine === 'fluid' &&
    !session.engineSwitching &&
    (await isEngineInstalled('fluid'))
      ? getConfigPath('fluid')
      : undefined,
  watchEngine: () => engineHealth.read(),
});

registerSystemMediaIpc({ onMedia: songProgramme.onMedia });

// Every switch between the app and the player is written down at once — a
// window closed straight after one must open in the mode it was left in — and
// the page is told, because what it draws is the mode.
windowModes.listen(() => {
  placement.saveWindowState();
  placement.sendWindowState();
});

// Handlers that own a subject rather than a slice of this file's scope.
//
// Everything each one can reach is in its `register` argument, so the answer to
// "what does the Karaoke tab touch in the main process" is a type signature
// instead of a reading of this whole file. `mainWindow` goes across as a
// getter because it is replaced over the life of the process.
registerWindowIpc({
  getMainWindow,
  sendWindowState: placement.sendWindowState,
  getWindowState: () => placement.windowStateOf(mainWindow),
  windowModes,
});

const stopRemoteAudioLan = registerRemoteAudioIpc({
  getMainWindow,
  userDataDir,
});

// Second outputs, played straight from the FluidEQ Engine where it can and
// as the helper's copy everywhere else — `secondOutputRoute.ts`.
const secondOutputs = createSecondOutputs({
  getEngine: () => session.audioEngine,
  readStatus: () => readAudioEngineStatus(userDataDir, session.audioEngine),
  readHealth: () => engineHealth.read(),
  writeSplit: (text) =>
    scheduleWrite(
      path.join(getFluidEngineConfigDir(), FLUID_ENGINE_SPLIT_FILENAME),
      text,
    ),
  startMirror: startNativeOutputMirror,
  startHold: startNativeOutputHold,
  syncProfiles: async (outputs) => {
    const previous = session.secondOutputDevices;
    session.secondOutputDevices = outputs;
    try {
      // The helper can still play when the chosen engine is absent. Keep
      // the endpoints for a later installation, with no EQ files to prepare.
      if (
        !session.audioEngine ||
        !(await isEngineInstalled(session.audioEngine))
      ) {
        return;
      }
      const result = await reflushCurrentState();
      if (!result.ok) {
        throw new Error('Could not prepare second output profiles.');
      }
    } catch (error) {
      session.secondOutputDevices = previous;
      throw error;
    }
  },
});
const stopOutputMirrors = registerOutputMirrorIpc(getMainWindow, secondOutputs);

// Game profiles: what the launchers have installed, and which program
// Windows has put in front. The watcher behind it runs only while the window
// asks for it — see `ipc/games.ts`.
registerGamesIpc({
  getMainWindow,
  // A game in front holds the desktop backgrounds still: they and the game
  // draw on the same graphics card, and the one being played is the one that
  // matters.
  onPlaying: (playing) => members.wallpaperIpc.setGameInFront(playing),
});

// The system volume, for the compact player's slider when what is playing is
// another program's. The helper behind it runs only while the window shows
// that slider — see `systemVolume.ts`.
registerSystemVolumeIpc(getMainWindow);

const members = registerMemberServices({ getMainWindow, userDataDir });

// The tools menu's animations row: the saved choice, and the one this launch
// was started with, so the row can say when a restart is still owed.
const motionPreferenceIpc = registerMotionPreferenceIpc({
  userDataDir,
  atLaunch: motionAtLaunch,
  logger: log,
});

// The row under it: whether Windows starts FluidEQ at sign-in. Nothing is
// kept here — Windows holds the answer, in this person's own startup entry.
const startWithWindowsIpc = registerStartWithWindowsIpc({ logger: log });

// The View menu's graphics card row, the same way: the saved choice and the
// one this launch was started with.
const graphicsPreferenceIpc = registerGraphicsPreferenceIpc({
  userDataDir,
  atLaunch: gpuAtLaunch,
  platform: process.platform,
  logger: log,
});

// The forum: the project's GitHub Discussions. Independent of the FluidEQ
// account — reading needs nothing and writing needs a GitHub sign-in — and
// registering contacts nothing until the Forum tab asks.
const forumIpc = registerForumIpc({
  getMainWindow,
  userDataDir,
  logger: log,
});

registerKaraokeIpc({
  userDataDir,
  getMainWindow,
});

// Registers the channels; it does not start anything. The host is a process
// that opens an audio endpoint, and opening one wakes the hardware — so it
// waits until the renderer asks, which it does when something is about to be
// heard. A checkout that has never built the native target simply reports the
// engine unavailable and the TypeScript one carries on.
const sourceAnalysis = createSourceAnalysisPublisher({
  resolveConfigDir: async () => {
    if (
      session.audioEngine !== 'fluid' ||
      session.engineSwitching ||
      !(await isEngineInstalled('fluid'))
    ) {
      return undefined;
    }
    return getConfigPath('fluid');
  },
  resolveSourceEndpoint: async () => session.playbackAudioDevice?.guid,
  write: scheduleWrite,
  readHealth: () => engineHealth.read(),
  setRawLibrary: setDspHostRawLibrary,
  prepareEngine: async () => {
    const result = await reflushCurrentState();
    if (!result.ok) {
      throw new Error('Could not prepare the output processing.');
    }
  },
});
session.systemRackEnabled = (deviceId) => {
  const device = session.secondOutputDevices?.find(
    (one) => one.id === deviceId,
  );
  const guid =
    device?.guid ??
    (session.playbackAudioDevice?.id === deviceId
      ? session.playbackAudioDevice.guid
      : undefined) ??
    session.audioDevices?.find((one) => one.id === deviceId)?.guid ??
    deviceProfileSettings.assignments[deviceId]?.deviceGuid;
  return (
    !guid ||
    sourceAnalysis.rackEnabledFor(
      guid,
      device ? session.playbackAudioDevice?.guid : undefined,
    )
  );
};
registerSourceAnalysisIpc(getMainWindow, sourceAnalysis);
registerDspHostIpc({
  getMainWindow,
  onVoiceModelChanged: () => sourceAnalysis.refreshVoice(),
});
// Dynamic lighting (Plus): keyboards, mice and headsets in the colours of the
// scene on the graph. Starts nothing until the window sends a frame or opens
// the page — the helper, Razer's service and the identity registration all
// wait for a member to switch it on.
const lighting = registerLightingIpc({
  userDataDir,
  appVersion: appVersion(),
  getMainWindow,
  entitled: () => members.accountIpc.entitlement.status().state !== 'none',
});
// The helper's exit hands every Windows lamp back; Razer's session is ended
// rather than left to lapse.
app.on('will-quit', () => lighting.dispose());
// The main menu's "Reset all settings", for the settings kept on this side;
// the window forgets its own and reloads once this answers.
registerSettingsResetIpc({
  userDataDir,
  ownerContents: () =>
    mainWindow && !mainWindow.isDestroyed()
      ? mainWindow.webContents
      : undefined,
  resetDesktopBackgrounds: () => members.wallpaperIpc.reset(),
  resetLighting: () => lighting.setSettings(DEFAULT_LIGHTING_SETTINGS),
  unpinWindow: () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      windowModes.setPinned(mainWindow, false);
    }
  },
  logger: log,
});
// The process list, which needs the host's pid to include it as a row — the
// DSP engine is our own child rather than Electron's, so `getAppMetrics` has
// never heard of it.
registerProcessIpc({
  getMainWindow,
  getNativeHostPid: dspHostPid,
  getNativeHostStats: dspHostStats,
  getLightingHelperPid: () => lighting.helperPid(),
  getSystemEngineProcesses: readEngineProcesses,
  meter: createProcessMeter(),
});

const libraryIpc = registerLibraryIpc({
  userDataDir,
  getMainWindow,
});

registerLibraryPlaylistsIpc({
  userDataDir,
  getMainWindow,
});

// What the FluidEQ Engine says about each output, for the notice that says
// when it is failing and for the songs it finished levelling. Watches nothing
// until the window first asks or a song is announced to the engine.
const engineHealth = registerEngineHealthIpc({
  getMainWindow,
  onHealth: (health) => {
    songProgramme.onHealth(health);
    secondOutputs.onHealth(health);
    sourceAnalysis.onHealth(health);
  },
});

applyLaunchSwitches();

/**
 * Take the EQ off every output as FluidEQ goes — see `engineQuitReset.ts`.
 *
 * Only once this process has written an engine config: `configPath` is set by
 * the first health check. The copy that quits at once because another is
 * already running never gets that far, and resetting from there would take
 * the EQ off the copy the user is actually using.
 */
const resetActiveEngineForQuit = async (): Promise<void> => {
  if (session.configPath) {
    await sourceAnalysis.release().catch((error) => {
      log.error('Clearing the Library source failed', error);
    });
    await resetEngineForQuit(session.configPath);
  }
};

const resetActiveEngineAtSessionEnd = (): void => {
  outputWatch?.stop();
  if (session.configPath) {
    resetEngineAtSessionEnd(session.configPath);
  }
};

// Somebody coming back to the computer, and the app getting out of their way.
// The account and Plus refresh on every build; updates only while there is an
// updater, which development, macOS and Linux never have.
const comeBack = createComeBackWatch({
  powerMonitor,
  accountSteps: accountComeBackSteps({
    entitlement: members.accountIpc.entitlement,
    scenePacks: members.scenePacksIpc,
    memberSharing: members.memberSharingIpc,
    plusGallery: members.plusGalleryIpc,
    sceneReviews: members.plusReviewIpc,
    plusTermsNotice: members.plusTermsNoticeIpc,
    leaderboard: members.leaderboardIpc,
  }),
  getActiveAutoUpdater: updates.getActiveAutoUpdater,
  applyUpdateIfUnattended: updates.applyUpdateIfUnattended,
  logger: log,
});

const createMainWindow = createMainWindowFactory({
  firstRunPlacement,
  isDebug,
  loadWindowState: placement.loadWindowState,
  saveWindowState: placement.saveWindowState,
  sendWindowState: placement.sendWindowState,
  sendFullScreenState: placement.sendFullScreenState,
  windowModes,
  setActiveAutoUpdater: updates.setActiveAutoUpdater,
  setMainWindow: (next) => {
    mainWindow = next;
    // Windows shutting down or logging off reaches the app only as this
    // window event: Electron sends no `before-quit` for it on Windows.
    next?.on('session-end', resetActiveEngineAtSessionEnd);
    if (next) {
      comeBack.watchWindow(next);
      libraryIpc.watchWindow(next);
    }
  },
  setUpAutoUpdates: updates.setUpAutoUpdates,
  setUpMemoryTraceTrigger: memoryTrace.setUpMemoryTraceTrigger,
  startMemoryProbe: memoryTrace.startMemoryProbe,
  startsHidden: () => didRestartForUnattendedUpdate,
  syncDatabasesOnStartup,
});

// At module scope rather than inside `whenReady`: the window that never opens
// is exactly the failure worth catching (`crashRecovery.ts`).
installCrashLogging();

// The first line of every launch, so a start with no window after it shows in
// the log as a start with no window after it, rather than as the absence of
// everything. An installer starts the app itself and passes `--updated`, which
// is what tells a launch that came out of setup from one somebody made.
log.info(
  `FluidEQ ${appVersion()} starting: pid ${process.pid}, packaged=${app.isPackaged}, from setup=${process.argv.includes('--updated')}`,
);

/**
 * Add event listeners...
 */

app.on('window-all-closed', () => {
  // Respect the OSX convention of having the application in memory even
  // after all windows have been closed
  //
  // Reached far less often than it used to be: the close button hides the
  // window rather than closing it, so on the ordinary path there is still a
  // window and this never fires. What is left is the real closes — the tray's
  // Quit, the disclaimer gate, an installer replacing the app — and for those
  // quitting is the right answer, which is why the branch is unchanged.
  if (process.platform !== 'darwin') {
    // Said out loud for the same reason as the launch line above: this is one
    // of the ways the app can end with nothing else in the log after it.
    log.info('Every window is closed, so FluidEQ is quitting.');
    app.quit();
  }
});

// Set once the coalescing writer has drained; see `before-quit`.
let pendingWritesFlushed = false;

app.on('before-quit', (event) => {
  // The state file, the attached profile and the APO config are written
  // asynchronously and coalesced (asyncWriter), so a quit that arrives
  // straight after a slider drag can find the last position still in the
  // queue. Hold the quit until it lands, then quit again; the second pass
  // falls through to the shutdown below. A few small files: milliseconds.
  //
  // Then the engine in use is turned off, so no output keeps FluidEQ's EQ
  // once FluidEQ is gone; the next launch writes it back.
  if (!pendingWritesFlushed) {
    event.preventDefault();
    // The window's geometry joins the queue first, so the write the close
    // handler asks for later finds it on disk and has nothing left to do; and
    // a memory trace still recording is written rather than lost.
    placement.saveWindowState();
    Promise.all([flushPendingWrites(), memoryTrace.stopMemoryTrace()])
      .catch(() => undefined)
      .then(resetActiveEngineForQuit)
      .catch((error) => log.error('Resetting the audio engine failed', error))
      .finally(() => {
        pendingWritesFlushed = true;
        app.quit();
      });
    return;
  }
  // The backstop for every quit that did not come from inside the app: an
  // installer, a session logout, Task Manager. Each of those reaches the
  // window's `close` handler, which cancels anything it is not told is a real
  // quit — so without this line a Windows shutdown would be refused by a
  // window trying to hide itself into the tray.
  beginQuit();
  destroyTray();
  stopRemoteAudioLan();
  stopOutputMirrors();
  members.dispose();
  // The forum's GitHub sign-in holds a loopback socket for the same reason.
  forumIpc.dispose();
  motionPreferenceIpc.dispose();
  startWithWindowsIpc.dispose();
  graphicsPreferenceIpc.dispose();
  // Here rather than in `will-quit`, which is already too late to wait for
  // anything asynchronous. A host left running holds an audio endpoint open,
  // and an endpoint held by a process whose parent has gone is one Windows
  // reclaims only when it notices.
  shutdownDspHost().catch(() => undefined);
  // No sync after the one in flight: nothing reads the folder from here on.
  diskSync.stop();
});

const isTheOnlyCopy = claimTheOnlyCopy({ userDataDir, getMainWindow });

/**
 * Everything that runs once Electron is ready, as a function of its own.
 *
 * It used to be the body of a `.then` on `whenReady`, which made every
 * promise chain inside it a chain nested in a handler. Named and hoisted
 * out, the window creation can simply be awaited.
 */
const onAppReady = async () => {
  // Which engine, before anything can ask for a config directory.
  session.audioEngine = await chooseLaunchEngine(userDataDir);
  await sourceAnalysis.release().catch((error) => {
    log.error('Clearing the previous Library source failed', error);
  });

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
  app.setName(PRODUCT_NAME);
  if (process.platform === 'win32') {
    // Without this the taskbar attributes the window to Electron itself,
    // which is also why notifications and pinning misbehave in development.
    // An installed build's must stay equal to electron-builder's `appId`,
    // which is why it is written once, in branding; the development build
    // has one of its own, or the taskbar draws it with the installed app's
    // icon (`appIdentity.ts`).
    app.setAppUserModelId(APP_USER_MODEL_ID);
  }
  // Before any window exists, so the player's session and the rules its web
  // contents run under are in place by the time one can be attached.
  setUpVideoBrowser();
  // Needs the session to exist, which is why this is here and not beside
  // `registerPrivilegedSchemes` at the top of the file — that call only
  // declares the scheme's privileges and has to run before `whenReady`;
  // this one answers its requests and has to run after.
  handleLibraryMedia({ userDataDir, getTrackPath: libraryIpc.trackPath });
  // Before the window, so before anything writes an engine configuration: the
  // FluidEQ Engine only applies one while this process holds its pipe open,
  // which is how a FluidEQ ended from Task Manager stops shaping the audio.
  // See `engineOwnerPipe.ts`. Never rejects.
  await startEngineAnalysisPipe(getMainWindow);
  await startEngineOwnerPipe();
  try {
    await createMainWindow();
    // AFTER THE WINDOW, NOT BEFORE IT.
    //
    // This used to run first, so that the window's `close` handler could
    // ask the tray about a quit from the very first close it saw. That
    // ordering put a native shell call ahead of everything the app is for:
    // when tray creation failed hard — not by throwing, which is caught,
    // but by taking the process down — the app exited before a window ever
    // appeared, and the only trace was four log lines and no error. An
    // app that cannot open because its notification icon is unhappy has
    // its priorities backwards.
    //
    // Nothing is lost by waiting. `isAppQuitting` reports false until a
    // quit is armed, which is the correct answer for every close that can
    // happen in the milliseconds before this runs.
    setUpTray({
      getMainWindow,
      // The full app, in the middle of the screen. Both halves matter: a
      // player that cannot be reached cannot be switched back from its own
      // titlebar, and a window put back in the middle as a player is still a
      // player somebody may not be able to use.
      onRecoverWindow: () => {
        if (!mainWindow || mainWindow.isDestroyed()) {
          return;
        }
        const window = mainWindow;
        windowModes
          .setMode(window, 'app')
          .catch((error) => log.warn('Tray recovery could not switch', error))
          .finally(() => windowModes.recentre(window));
      },
      // Same code path as the notification click and the in-window
      // banner — installActiveUpdate is the one place that decides
      // whether we have a downloaded, verified installer to run.
      onInstallUpdate: updates.installActiveUpdate,
      // Fires the same check the four-hour schedule fires. A miss (the
      // updater is not initialised yet, or the network fails) is not
      // worth interrupting the user; `catch` keeps it in the log.
      onCheckForUpdates: () => {
        const activeAutoUpdater = updates.getActiveAutoUpdater();
        if (!activeAutoUpdater) {
          log.info('Tray "check for updates" ignored: updater is not active.');
          return;
        }
        activeAutoUpdater.checkNow().catch((error) => {
          log.info('Manual update check failed', error);
        });
      },
    });

    // A launch that came back from an unattended update deliberately left
    // the window off screen, because the tray is the way back to it. If
    // the tray did not build, that way back does not exist: the process
    // would be running with no icon and no window, which from the outside
    // is indistinguishable from not starting at all. `isAppQuitting` is
    // how tray.ts reports the failure — it arms the flag so the close
    // button closes for real — and nothing legitimate has armed it this
    // early in a launch.
    if (didRestartForUnattendedUpdate && isAppQuitting()) {
      log.warn(
        'No tray icon after an unattended update; showing the window so FluidEQ can still be reached.',
      );
      revealMainWindow(getMainWindow);
    }
  } catch (error) {
    log.error(`Failed to create the ${PRODUCT_NAME} window`, error);
  }
  if (process.platform === 'win32') {
    outputWatch = startOutputWatch({
      onOutputs: (devices) =>
        profilesIpc.followOutputs(devices, (channel, payload) => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send(channel, payload);
          }
        }),
    });
    // Stopped at the first quit pass, before the engine is reset: the
    // helper's last report would otherwise rewrite a config being neutralised.
    app.on('before-quit', () => outputWatch?.stop());
  }
  app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (mainWindow === null) {
      createMainWindow().catch((error) => {
        log.error(`Failed to create the ${PRODUCT_NAME} window`, error);
      });
    }
  });
};

app
  .whenReady()
  .then(() => isTheOnlyCopy)
  .then((isOnly) => (isOnly ? onAppReady() : undefined))
  .catch(log.error);
