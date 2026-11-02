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
import { fetchSettings, save } from './flush';
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
  startRawSourceCapture,
} from './remoteAudioCapture';
import { createSongLevelStore } from './songLevels';
import { createSongProgramme } from './songProgramme';
import { resetEngineAtSessionEnd, resetEngineForQuit } from './engineQuitReset';
import {
  announceEngineOwner,
  ENGINE_OWNER_PIPE,
  startEngineOwnerPipe,
} from './engineOwnerPipe';
import { INativeTray, startNativeTray } from './nativeTray/startNativeTray';
import { forgetRoomHead } from './roomHead';
import startEngineAnalysisPipe, {
  readEngineProcesses,
} from './engineAnalysisPipe';
import { createProcessMeter } from './processMeter';
import ChannelEnum from '../common/channels';
import {
  IState,
  OUTPUT_STATE_CHANGED_EVENT,
  type ISmartEqSettings,
} from '../common/constants';
import { TSuccess } from '../renderer/utils/equalizerApi';
import { syncOpraDatabase } from './opraUpdater';
import { setUpVideoBrowser } from './videoBrowser';
import {
  beginQuit,
  destroyTray,
  fallBackToElectronTray,
  isAppQuitting,
  showTrayForLeaving,
  revealMainWindow,
  setTrayTintedIcon,
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
import registerSongEqIpc from './ipc/songEq';
import { createSongEqMemory } from './songEqMemory';
import { createSongEqEntries } from './songEqEntries';
import { SONG_EQ_CHANNEL } from '../common/songEqStatus';
import { isContinuousMode } from '../common/smartEqMode';
import { registerPreampIpc } from './ipc/preamp';
import registerVideoIpc from './ipc/video';
import { registerKaraokeSeparation } from './karaokeSeparation';
import { registerKaraokePitch } from './karaokePitch';
import { registerProfilesIpc } from './ipc/profiles';
import { IOutputWatch, startOutputWatch } from './outputWatch';
import { registerUpdatesIpc } from './ipc/updates';
import { registerLibraryIpc } from './ipc/library';
import registerLibraryPlayerIpc from './ipc/libraryPlayer';
import createLibraryPlayer from './libraryPlayer/libraryPlayer';
import { createHostEngine } from './libraryPlayer/hostEngine';
import libraryHostPort from './libraryPlayer/hostPort';
import { createPlaybackSession } from './libraryPlayer/playbackSession';
import { createSourcePublication } from './libraryPlayer/sourcePublication';
import watchWindowSeen from './windowSeen';
import { createWindowUnload } from './windowUnload';
import { createAppLeave, leaveToTray, relaunchCommand } from './appLeave';
import { onShareServiceRunning } from './shareAudio/host';
import { createNowPlayingFeed } from './nowPlayingFeed';
import { followWindowPage, registerWindowHoldsIpc } from './ipc/windowHolds';
import { LIBRARY_PLAYER_CHANNEL } from '../common/library/playerWire';
import {
  dspHostPid,
  dspHostSampleRate,
  dspHostStats,
  listenToDspHostAnalysis,
  registerDspHostIpc,
  shutdownDspHost,
  setDspHostRawLibrary,
} from './ipc/dspHost';
import { registerProcessIpc } from './ipc/processes';
import { registerLibraryPlaylistsIpc } from './ipc/libraryPlaylists';
import { registerEngineHealthIpc } from './ipc/engineHealth';
import { registerLightingIpc } from './ipc/lighting';
import { findSceneHost } from './lighting/lampSceneHost';
import {
  readLampSceneChoice,
  type ILampSceneChoice,
} from '../common/lighting/lampSceneChoice';
import { registerRemoteAudioIpc } from './ipc/remoteAudio';
import registerSystemSoundPort from './ipc/systemSoundPort';
import { createKeptFile } from '../core/files/keptFile';
import createCoreClient from './coreProcess/coreHost';
import {
  NO_KEPT_GAMES,
  parseKeptDspPresets,
  parseKeptGames,
  parseRackHold,
} from '../common/coreCopies';
import registerCoreCopies from './ipc/coreCopies';
import { createPresetPicks } from './presetPicks';
import registerPresetPicksIpc from './ipc/presetPicks';
import { createSongMemory } from './songMemory';
import { createGameSound } from './gameSound';
import mainText from './mainText';
import { createSongSoundMemory } from './songSoundMemory';
import registerSongMemoryIpc from './ipc/songMemory';
import registerNowPlayingIpc from './ipc/nowPlaying';
import registerSmartEqIpc from './ipc/smartEq';
import { createSmartEqRunner } from './smartEq/smartEqRunner';
import {
  type IRawSourceTaps,
  openRawSourceFrames,
} from './smartEq/rawSourceFrames';
import {
  DEFAULT_SMART_EQ_SETTINGS,
  SMART_EQ_CHANNEL,
  parseSmartEqCoreSettings,
} from '../common/smartEqCore';
import { sanitizeSmartEqSettings } from '../common/smartEq';
import {
  SONG_MEMORY_CHANNEL,
  parseSongMemorySwitch,
} from '../common/songMemoryStatus';
import { outputRackLine } from './outputDsp';
import { registerForumIpc } from './ipc/forum';
import { registerMotionPreferenceIpc } from './ipc/motionPreference';
import { registerGamesIpc } from './ipc/games';
import { registerSystemVolumeIpc } from './systemVolume';
import { registerStartWithWindowsIpc } from './ipc/startWithWindows';
import {
  moveStartWithWindowsIntoTray,
  START_IN_TRAY_ARG,
} from './startWithWindows';
import { registerSettingsResetIpc } from './ipc/settingsReset';
import { registerTaskbarIconIpc } from './taskbarIcon';
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
import { ownsTemporaryRack } from './outputRack';
import { getStateForAudioDevice } from './deviceProfiles';
import { createSourceAnalysisPublisher } from './sourceAnalysis';
import {
  createProfileStore,
  isAutomaticPresetName,
  shieldReferenceBands,
} from './profileStore';
import createApoDiskSync from './apoDiskSync';
import { createUpdatePath, handleError, isErrorReply } from './updatePath';
import registerDiagnosticsIpc from './ipc/diagnostics';
import { registerPerformanceLog } from './ipc/performance';
import registerApoConfigIpc from './ipc/apoConfig';
import registerEngineStateIpc from './ipc/engineState';
import registerNativeDialogsIpc from './ipc/nativeDialogs';
import registerWindowsAudioIpc from './ipc/windowsAudio';
import registerSystemMediaIpc from './ipc/systemMedia';
import {
  findSystemMediaExecutable,
  pauseOthersCommand,
  pauseOtherSystemPlayers,
  sendSystemMediaCommand,
  SYSTEM_MEDIA_SELF_ID,
} from './systemMedia';
import { songHandover } from './nativeTray/songHandover';
import registerMemberServices from './memberServices';
import { applyLaunchSwitches, isDebug } from './launchSwitches';
import { devSandbox, isSealedSandbox, ownAppUserModelId } from './devSandbox';
import claimTheOnlyCopy from './onlyCopy';
import { registerAppLinks } from './appLinks';
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
 * A window hidden in the tray, let go when nothing holds it and built again
 * when it is opened (`windowUnload.ts`). The flag is set from the moment it
 * is let go until a window is built again, so its close goes through rather
 * than hiding, and its going is not taken for every window being closed.
 *
 * Closed, never destroyed: a destroyed page runs nothing on its way out, and
 * the page saves things as it goes — the Karaoke session, the Maker's view,
 * where a video stood (`pagehide`).
 */
let isWindowLetGo = false;
const windowUnload = createWindowUnload({
  unload: () => {
    const window = mainWindow;
    if (window && !window.isDestroyed()) {
      isWindowLetGo = true;
      window.once('closed', () => appLeave.hold('window', false));
      window.close();
    }
  },
  log: (message) => log.info(message),
});
/**
 * Electron leaving with FluidEQ going on from its tray (`appLeave.ts`):
 * only while FluidEQ-Tray holds FluidEQ, and never on the way to a quit.
 */
const appLeave = createAppLeave({
  canLeave: () => nativeTray !== undefined && !isAppQuitting(),
  leave: () => {
    leaveToTray({
      showTrayForLeaving,
      // And what the quit's second pass lets go: the output watch, the disk
      // sync and the DSP host, whose endpoint Windows reclaims only when it
      // notices a parent gone.
      windDown: () =>
        windDown()
          .then(() => {
            outputWatch?.stop();
            diskSync.stop();
            return shutdownDspHost();
          })
          .catch(() => undefined),
      tellTray: async () => {
        if (!nativeTray) {
          return false;
        }
        const tray = nativeTray;
        // The song the engine is told goes on from the tray.
        const songs = await songHandover({
          resolveConfigDir: songConfigDir,
          mediaExecutable: findSystemMediaExecutable(),
          selfId: SYSTEM_MEDIA_SELF_ID,
          userDataDir,
          mainEndpoint: session.playbackAudioDevice?.guid,
          singlePlayer: singlePlayerSwitch.isSinglePlayer(),
          pauseOthers: pauseOthersCommand(),
        }).catch(() => undefined);
        return tray.leave(
          relaunchCommand(
            {
              execPath: process.execPath,
              argv: process.argv,
              cwd: process.cwd(),
            },
            [START_IN_TRAY_ARG, '--updated'],
          ),
          songs,
        );
      },
      exit: () => app.exit(0),
      restart: () => {
        app.relaunch({
          args: [
            ...process.argv.slice(1).filter((arg) => arg !== START_IN_TRAY_ARG),
            START_IN_TRAY_ARG,
          ],
        });
        app.exit(0);
      },
      log: (message, error) =>
        error === undefined ? log.warn(message) : log.error(message, error),
    }).catch((error: unknown) =>
      log.error('Leaving to the tray failed', error),
    );
  },
  log: (message) => log.info(message),
});
// Main's jobs with no window, each held exactly while it runs (the core
// split's step 6): the Library playing, Share Audio's service, the desk
// lights' helper, a background set on any monitor, the core hearing for
// something, a game watched for and the media watcher are said where they
// start and stop. Following Windows' outputs holds nothing: every output's
// sound is written to its own files on both engines (`deviceProfiles.ts`,
// `outputConfigFiles.ts`), a new one plays neutral until it is saved as it
// would with main here, and a launch reads the outputs afresh.
registerWindowHoldsIpc(getMainWindow, {
  pageSaid: (holds) => {
    windowUnload.pageSaid(holds);
    // The page is there: Share Audio's links are its to answer again.
    remoteAudio.windowless.pageSaid();
  },
});
/** The window, unless it is on its way out from the tray. */
const usableWindow = () => (isWindowLetGo ? null : mainWindow);

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

/**
 * Windows started this launch at sign-in (`startWithWindows.ts`): FluidEQ
 * starts in the tray, applying its sound, and the tray opens the window.
 */
const startedInTray = process.argv.includes(START_IN_TRAY_ARG);

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
/** FluidEQ-Tray, once it runs (`nativeTray/`); undefined where it cannot. */
let nativeTray: INativeTray | undefined;
const session = createMainSession((configPath) =>
  nativeTray?.setConfigPath(configPath),
);

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
  // Another output's sound is the one edited now, which may start or stop
  // what the core's jobs do — with or without a window to tell.
  followTheSound();
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
  // Read lazily: the core's jobs are made further down, and nothing is
  // updated before the window or the health check asks.
  onUpdated: () => followTheSound(),
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
    return {
      ...state,
      dsp: audibleDsp ?? state.dsp,
      ownedDsp: ownsTemporaryRack(state, audibleDsp) ? state.dsp : undefined,
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

const { apoGuard, writeLegacyRack } = registerEngineServices({
  userDataDir,
  state,
  session,
  deviceProfileSettings,
  presetDirForDevice: profiles.presetDirForDevice,
  reflush: reflushCurrentState,
  onEngineSwitched: (from) => {
    Promise.all([
      secondOutputs.reroute(),
      songProgramme.reflush(),
      sourceAnalysis.reflush(),
      presetPicks.followEngineSwitch(from),
    ]).catch((error: unknown) =>
      log.error('Could not move output processing to the new engine', error),
    );
  },
  onRackChanged: () => songMemory.soundMayHaveChanged(),
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
  notifyOutputStateChanged,
  guardAgainstApo: apoGuard.check,
  onPlaybackOutputChanged: () => sourceAnalysis.reflush(),
  yieldSongSound: () => songMemory.yieldSound(),
  keepSongSound: () => songMemory.keepSound(),
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
  userDataDir,
  activePresetDir: profiles.activePresetDir,
  applyingLayer: profiles.applyingLayer,
  attachPresetToActiveDevice: profiles.attachPresetToActiveDevice,
  availableProfileNameForActiveDevice:
    profiles.availableProfileNameForActiveDevice,
  activeBaselineDir: profiles.activeBaselineDir,
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

/** Equalizer APO plays, and the output being edited is the one it plays. */
const canMeasureHeadroom = () =>
  session.audioEngine === 'apo' &&
  !session.engineSwitching &&
  session.activeAudioDeviceId === session.playbackAudioDevice?.id;
const preamp = registerPreampIpc({
  state,
  canMeasureHeadroom,
  usesNativeHeadroom: () => session.audioEngine === 'fluid',
  tellWindowPreAmp: (preAmp) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(ChannelEnum.AUTO_PREAMP_SETTLED, {
        result: preAmp,
      });
    }
  },
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
});

registerFiltersIpc({
  state,
  handleUpdate,
  handleUpdateHelper,
  handleError,
  doesFilterIdExist,
  switchToParametricEditing: profiles.switchToParametricEditing,
  applyingLayer: profiles.applyingLayer,
});

registerLayersIpc({
  state,
  handleUpdate,
  handleError,
  applyingLayer: profiles.applyingLayer,
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
 * What the speakers play, heard by the core in a process of its own —
 * "FluidEQ Core", running only while something needs to hear the output
 * (`coreProcess/coreClient.ts`). It feeds the window's live displays over a
 * port the window opens, in place of the screen-share capture Chromium needed
 * a process of its own for; the desktop backgrounds' frames, so a background
 * behind a minimised FluidEQ needs nothing of the window; the song memories'
 * clocks; and Auto normalize on Equalizer APO, whose trims main writes.
 */
/** Where the native helpers are: packaged, then where development builds them. */
const nativeDirs = [
  path.join(process.resourcesPath, 'native'),
  path.join(__dirname, '../../native/.build/bin'),
];
const core = createCoreClient({
  nativeDirs,
  applyTrim: preamp.applyHeadroomTrim,
  log,
});
registerSystemSoundPort(getMainWindow, core.attachWindowPort);
const { desktopSound } = core;
core.onNeeded((needed) => appLeave.hold('job:listening', needed));
onShareServiceRunning((running) => appLeave.hold('job:share', running));

/**
 * The window's lists the core acts on with no window to ask: the game
 * profiles and the saved chains, handed over at launch and on every change
 * (`ipc/coreCopies.ts`).
 */
const keptGames = createKeptFile({
  filePath: path.join(userDataDir, 'game-profiles.json'),
  parse: parseKeptGames,
  empty: NO_KEPT_GAMES,
  log,
});
const keptDspPresets = createKeptFile({
  filePath: path.join(userDataDir, 'dsp-presets.json'),
  parse: parseKeptDspPresets,
  empty: [],
  log,
});
/** Which preset's rack is off only because Equalizer APO cannot run it. */
const rackHold = createKeptFile({
  filePath: path.join(userDataDir, 'rack-held-for-apo.json'),
  parse: parseRackHold,
  empty: '',
  log,
});
registerCoreCopies({
  getMainWindow,
  games: keptGames,
  dspPresets: keptDspPresets,
  rackHold,
});

/**
 * A change the core made to the edited output's state, through the same
 * update path the window's edits take; whether it landed.
 */
const landUpdate = async (label: string): Promise<boolean> => {
  let landed = false;
  await handleUpdate(
    {
      reply: (_channel, payload) => {
        landed = !isErrorReply(payload);
      },
    },
    label,
    false,
    true,
  );
  return landed;
};

/** The core changed the edited output's sound by itself: the window reads it. */
const tellWindowSoundChanged = () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(ChannelEnum.OUTPUT_SOUND_CHANGED);
  }
};

/** Presets put on by the core: every picker's, and at a switch of engine. */
const presetPicks = createPresetPicks({
  state,
  session,
  savedChains: keptDspPresets.read,
  rackHold,
  applyingLayer: profiles.applyingLayer,
  update: (sink, label) => handleUpdate(sink, label, false, true),
  runProfileMutation: profiles.runProfileMutation,
  openPlayingOutput: profilesIpc.openPlayingOutput,
  writeLegacyRack: () =>
    writeLegacyRack((version) =>
      outputRackLine({
        state,
        audibleDsp:
          session.outputDspOverrides?.get(session.activeAudioDeviceId) ??
          state.dsp,
        rackHere:
          session.systemRackEnabled?.(session.activeAudioDeviceId) ?? true,
        version,
      }),
    ),
  tellWindow: tellWindowSoundChanged,
});
registerPresetPicksIpc(presetPicks);

/**
 * The song memories count a song's time on the core's hearing of the
 * output; where the core cannot hear it (no source on this platform yet),
 * the window's players tick their clock (`needsClock`), so a window in the
 * tray is kept while either asks for that. The songs themselves main names
 * without a window (`nowPlayingFeed.ts`).
 */
const clocksAsked = { memory: false, smartEq: false };
const holdForSongs = (change: Partial<typeof clocksAsked>) => {
  Object.assign(clocksAsked, change);
  windowUnload.hold('songs', clocksAsked.memory || clocksAsked.smartEq);
};

/**
 * Which sound each song is played with, remembered and put back by the
 * core (`songMemory.ts`), its switch kept here beside it.
 */
const songMemory = createSongMemory({
  state,
  session,
  memory: createSongSoundMemory(userDataDir),
  savedChains: keptDspPresets.read,
  isOn: createKeptFile<boolean | undefined>({
    filePath: path.join(userDataDir, 'song-sound-switch.json'),
    parse: parseSongMemorySwitch,
    empty: undefined,
    log,
  }),
  update: landUpdate,
  tellWindowSound: tellWindowSoundChanged,
  tellWindowStatus: (status) => {
    holdForSongs({ memory: status.needsClock });
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(SONG_MEMORY_CHANNEL.status, status);
    }
  },
  createClock: core.createClock,
});
holdForSongs({ memory: songMemory.status().needsClock });
registerSongMemoryIpc({ getMainWindow, memory: songMemory });

/**
 * Smart EQ's measurements, run by the core (`smartEq/smartEqRunner.ts`) on
 * the settings the window keeps and hands over, hearing the sound before
 * FluidEQ touches it.
 */
const smartEqSettings = createKeptFile({
  filePath: path.join(userDataDir, 'smart-eq-settings.json'),
  parse: parseSmartEqCoreSettings,
  empty: DEFAULT_SMART_EQ_SETTINGS,
  log,
});
const sendToWindow = (channel: string, payload: unknown) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload);
  }
};
const rawSourceTaps: IRawSourceTaps = {
  startProcessCapture:
    process.platform === 'win32'
      ? startRawSourceCapture
      : () => Promise.reject(new Error('eq.smart.error.noSource')),
  listenToHost: listenToDspHostAnalysis,
  hostSampleRate: dspHostSampleRate,
};
/** The edited output's Smart EQ layer, written as the window's edit was. */
const writeSmartEqLayer = (layer: ISmartEqSettings | undefined) => {
  profiles.applyingLayer('smart');
  state.smartEq = sanitizeSmartEqSettings(layer);
  return landUpdate(ChannelEnum.SET_SMART_EQ);
};
/**
 * Each song's Smart EQ layer, filed while a running mode refines it and lent
 * back the next time the song plays (`songEqMemory.ts`).
 */
const songEq = createSongEqMemory({
  entries: createSongEqEntries(userDataDir),
  writeLayer: writeSmartEqLayer,
  editedDevice: () => session.activeAudioDeviceId,
  tellWindowLayer: (layer) =>
    sendToWindow(SMART_EQ_CHANNEL.wrote, {
      kind: 'remembered',
      layer,
      from: undefined,
      moved: [],
    }),
  tellWindowStatus: (status) => {
    holdForSongs({ smartEq: status.needsClock });
    sendToWindow(SONG_EQ_CHANNEL.status, status);
  },
  createClock: core.createClock,
});
holdForSongs({ smartEq: songEq.status().needsClock });
registerSongEqIpc({ getMainWindow, memory: songEq });
const smartEq = createSmartEqRunner({
  settings: smartEqSettings.read,
  layer: () => state.smartEq,
  isBypassed: () => Boolean(state.bypassed?.includes('smart')),
  write: writeSmartEqLayer,
  openSource: (kind, onFrame, onLost) =>
    openRawSourceFrames(rawSourceTaps, { kind, onFrame, onLost }),
  text: mainText,
  now: () => performance.now(),
  tellState: (runState) => sendToWindow(SMART_EQ_CHANNEL.state, runState),
  tellRemark: (remark) => sendToWindow(SMART_EQ_CHANNEL.remark, remark),
  // What the graph draws moves with every frame heard, ten times a second
  // or so: a window nobody can see is not woken for it.
  tellView: (view) => {
    if (mainWindow?.isVisible() && !mainWindow.isMinimized()) {
      sendToWindow(SMART_EQ_CHANNEL.view, view);
    }
  },
  tellWrote: (wrote) => sendToWindow(SMART_EQ_CHANNEL.wrote, wrote),
  // As the update path will keep it, so the song memory knows it as ours.
  onRefined: (layer) => songEq.ownWrite(sanitizeSmartEqSettings(layer)),
});
/**
 * Smart EQ's two jobs, after every update and every change of its settings:
 * whether the running mode runs, and what the song memory follows — the
 * edited output, its layer, and whether a running mode refines it.
 */
const followSmartEq = () => {
  smartEq.follow();
  const { continuous, mode } = smartEqSettings.read();
  songEq.follow({
    deviceId: session.activeAudioDeviceId,
    layer: state.smartEq,
    isAutoEqRunning:
      continuous &&
      isContinuousMode(mode) &&
      !state.bypassed?.includes('smart'),
  });
};
smartEqSettings.onChange(followSmartEq);
registerSmartEqIpc({
  getMainWindow,
  runner: smartEq,
  settings: smartEqSettings,
});

/**
 * What is played, for the core's jobs that follow songs: named by the
 * window's players while there is a window, and by main from the Library's
 * host and the media watcher while there is none (`nowPlayingFeed.ts`).
 */
const nowPlayingFeed = createNowPlayingFeed(
  ({ identity, isPlaying, isLibrary }) => {
    songMemory.nowPlaying(identity, isPlaying);
    songEq.nowPlaying(identity, isPlaying);
    smartEq.nowPlaying({
      songKey: identity?.key,
      isPlaying,
      source: isLibrary ? 'host' : 'process',
    });
  },
);
registerNowPlayingIpc({
  getMainWindow,
  onNowPlaying: nowPlayingFeed.pageSaid,
});

/** Auto normalize on Equalizer APO, heard and decided by the core. */
const { apoHeadroom } = core;

/**
 * The parts of the chain an edit to which makes Auto normalize look again,
 * each with its text at the last look: a part is read as text only when it
 * has been replaced, and compared as text before it counts, because a profile
 * read again hands every part a new object whether anything in it changed.
 */
const chainParts = () => [
  state.filters,
  state.graphicEq,
  state.eqMode,
  state.curveEqMode,
  state.mainBandQ,
  state.eqBandQ,
  state.curveBandQ,
  state.curveSmoothing,
  state.isEqDoubleOn,
  state.driver,
  state.headphone,
  state.voicing,
  state.smartEq,
  state.convolution,
  state.customFx,
  state.bypassed,
];
let lastChain: { parts: unknown[]; texts: string[] } | undefined;

/**
 * After every change to the sound, the core's jobs that follow it are told:
 * whether Auto normalize on Equalizer APO listens, and whether the chain it
 * keeps under full scale was edited.
 */
function followTheSound(): void {
  apoHeadroom.follow({
    enabled: state.isAutoPreAmpOn && state.isEnabled && canMeasureHeadroom(),
    trimDb: state.smartHeadroomTrimDb ?? 0,
    hasLegacyProgramme: Boolean(state.smartHeadroomProgramme?.length),
  });
  const parts = chainParts();
  const last = lastChain;
  const texts = parts.map((part, at) =>
    last && Object.is(part, last.parts[at])
      ? last.texts[at]
      : (JSON.stringify(part) ?? 'null'),
  );
  if (last && texts.some((text, at) => text !== last.texts[at])) {
    apoHeadroom.edited();
  }
  lastChain = { parts, texts };
  songMemory.soundMayHaveChanged();
  gameSound.soundMayHaveChanged();
  followSmartEq();
}

/**
 * Which song the machine is playing, for the FluidEQ Engine's live leveling
 * — see `songProgramme.ts`. Fed by the same media watcher as the bar, and
 * by the engine's statuses for the songs it finished learning.
 */
/**
 * The FluidEQ Engine's folder for the song programme, here and from the tray
 * (`songHandover.ts`): the rack write's refusals (`ipc/audioEngine.ts`) — not
 * this engine, or mid-switch — and installed before the path is asked for,
 * because asking creates it.
 */
const songConfigDir = async (): Promise<string | undefined> =>
  session.audioEngine === 'fluid' &&
  !session.engineSwitching &&
  (await isEngineInstalled('fluid'))
    ? getConfigPath('fluid')
    : undefined;
const songProgramme = createSongProgramme({
  store: createSongLevelStore(userDataDir),
  mainEndpoint: () => session.playbackAudioDevice?.guid,
  fileName: FLUID_ENGINE_PROGRAMME_FILENAME,
  write: scheduleWrite,
  resolveConfigDir: songConfigDir,
  watchEngine: () => engineHealth.read(),
});

const singlePlayerSwitch = registerSystemMediaIpc({
  onMedia: (snapshot) => {
    nowPlayingFeed.systemSaid(snapshot);
    remoteAudio.windowless.systemSaid(snapshot);
    return songProgramme.onMedia(snapshot);
  },
  getMainWindow,
});

// The media watcher names the song for the FluidEQ Engine's leveling and
// keeps one player at a time. Under that engine both go on from the tray
// while main is gone (`songHandover.ts`); under Equalizer APO there is no
// song to tell, nothing is handed over, and one player at a time holds main.
const trayCarriesMedia = () =>
  session.audioEngine === 'fluid' &&
  nativeTray !== undefined &&
  findSystemMediaExecutable() !== undefined;
appLeave.holdWhile(
  'job:media',
  () =>
    !trayCarriesMedia() &&
    (session.audioEngine === 'fluid' || singlePlayerSwitch.isSinglePlayer()),
);

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

const remoteAudio = registerRemoteAudioIpc({
  getMainWindow,
  userDataDir,
  holdWindow: (isHeld) => windowUnload.hold('share-audio', isHeld),
  // What a linked computer's press and the one-player rule reach while the
  // window is let go in the tray: the players main runs or hears.
  players: {
    library: (command) => libraryPlayer.command(command),
    system: (command, positionMs) => {
      sendSystemMediaCommand(command, positionMs).catch((error) =>
        log.warn(
          `A linked computer's press did not reach the player: ${String(error)}`,
        ),
      );
    },
    pauseOtherPlayers: () => {
      pauseOtherSystemPlayers('').catch((error) =>
        log.warn(`The other players could not be paused: ${String(error)}`),
      );
    },
    isSinglePlayer: singlePlayerSwitch.isSinglePlayer,
    setSinglePlayer: singlePlayerSwitch.setSinglePlayer,
  },
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

// Game profiles: what the launchers have installed, which program Windows
// has put in front, and the sound a game puts on, decided by the core
// (`gameSound.ts`). The watcher runs while the core has profiles to match or
// the Games page asks — see `ipc/games.ts`.
const gamesIpc = registerGamesIpc({
  getMainWindow,
  onFront: (program) => {
    gameSound.heard(program).catch(() => undefined);
  },
  onGone: (pid) => {
    gameSound.ended(pid).catch(() => undefined);
  },
  coreWantsWatch: () => {
    const { enabled, profiles: kept } = keptGames.read();
    return enabled && kept.length > 0;
  },
  sounding: () => gameSound.sounding(),
});
const gameSound = createGameSound({
  state,
  session,
  games: keptGames,
  savedChains: keptDspPresets.read,
  openPlayingOutput: async () => {
    let opened = false;
    await profiles.runProfileMutation(async () => {
      opened = await profilesIpc.openPlayingOutput();
    });
    return opened;
  },
  pick: (presetId) =>
    presetPicks.pick(
      { id: presetId, quick: true, deviceId: session.activeAudioDeviceId },
      // A refusal is the update path's to log; there is nobody to answer.
      { reply: () => undefined },
      'gameSound',
    ),
  songMemory,
  holdProcess: gamesIpc.hold,
  showCard: gamesIpc.showCard,
  tellWindow: gamesIpc.tellSounding,
  // A game in front holds the desktop backgrounds still: they and the game
  // draw on the same graphics card, and the one being played is the one that
  // matters.
  onPlaying: (playing) => members.wallpaperIpc.setGameInFront(playing),
  t: mainText,
});
/** A game watched for, by its kept profiles: the watcher is main's child. */
const holdForGames = () => {
  const { enabled, profiles: kept } = keptGames.read();
  appLeave.hold('job:games', enabled && kept.length > 0);
};
holdForGames();
keptGames.onChange(() => {
  gamesIpc.refreshWatch();
  gameSound.gamesChanged().catch(() => undefined);
  holdForGames();
});

// The system volume, for the compact player's slider when what is playing is
// another program's. The helper behind it runs only while the window shows
// that slider — see `systemVolume.ts`.
registerSystemVolumeIpc(getMainWindow);

/** `FluidEQ-Scenes.exe` beside the app, and the ANGLE beside this executable. */
const sceneHostExecutable =
  process.platform === 'win32' ? findSceneHost(nativeDirs) : undefined;
const members = registerMemberServices({
  getMainWindow,
  userDataDir,
  desktopSound,
  desktopBusy: (busy) => appLeave.hold('job:desktop', busy),
  // The desktop backgrounds it draws without a hidden page per monitor.
  ...(sceneHostExecutable
    ? {
        sceneHost: {
          executable: sceneHostExecutable,
          angleDir: path.dirname(process.execPath),
        },
      }
    : {}),
  holdWindow: windowUnload.hold,
  // Only a window let go in the tray is built again; one that is there, shown
  // or hidden, is left as it is.
  wakeWindow: () => (usableWindow() ? Promise.resolve() : bringBackWindow()),
});

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
  // A sealed sandbox's source goes into its own folder, which no engine reads
  // (see `devSandbox.ts`), so no engine's status may answer for it: read the
  // real ones and every Play waited for an acknowledgement that could not come.
  readHealth: () =>
    isSealedSandbox ? Promise.resolve({ outputs: [] }) : engineHealth.read(),
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
  onRunning: (running) => appLeave.hold('job:lighting', running),
  entitled: () => members.ownsAnyScene(),
  // The desk lights drawn by `FluidEQ-Scenes.exe` on the ANGLE beside this
  // executable, from the window's last choice, kept so a launch in the tray
  // lights the desk before any window has spoken.
  lampScenes: {
    executable: sceneHostExecutable,
    angleDir: path.dirname(process.execPath),
    log,
    ...members.lampScenes,
    kept: createKeptFile<ILampSceneChoice | null>({
      filePath: path.join(userDataDir, 'lamp-scene.json'),
      parse: (raw) => readLampSceneChoice(raw) ?? null,
      empty: null,
      log,
    }),
  },
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
  // The window reads the state again as it reloads after the reset, so the
  // switch is right in memory at once; the file follows on the writer's own
  // schedule, as after any edit.
  showGraph: () => {
    state.isGraphViewOn = true;
    save(state, userDataDir).catch((error) =>
      log.error('Settings reset: could not save the graph switch', error),
    );
  },
  stopSongMemory: () => songMemory.setOn(false),
  resetSmartEq: () => smartEqSettings.keep(DEFAULT_SMART_EQ_SETTINGS),
  resetKeepPlaying: () => {
    libraryPlayer.command({ kind: 'continuation', isOn: true });
  },
  logger: log,
});
// The taskbar button in the window's colours; the installed icon while it
// wears the app's own (`taskbarIcon.ts`). The same .ico the window is made
// with (`mainWindow.ts`), found the same way.
registerTaskbarIconIpc({
  userDataDir,
  stockIconPath: app.isPackaged
    ? path.join(process.resourcesPath, 'assets', 'icon.ico')
    : path.join(__dirname, '../../assets/icon.ico'),
  getWindow: () => mainWindow,
  logger: log,
  onIcon: setTrayTintedIcon,
});
// The process list, which needs the host's pid to include it as a row — the
// DSP engine is our own child rather than Electron's, so `getAppMetrics` has
// never heard of it.
const processList = registerProcessIpc({
  getMainWindow,
  getNativeHostPid: dspHostPid,
  getNativeHostStats: dspHostStats,
  getLightingHelperPid: () => lighting.helperPid(),
  getDesktopScenesPid: () => members.wallpaperIpc.desktopScenesPid(),
  getSystemEngineProcesses: readEngineProcesses,
  meter: createProcessMeter(),
});
registerPerformanceLog({
  getMainWindow,
  listProcesses: processList.listQuietly,
});

const libraryIpc = registerLibraryIpc({
  userDataDir,
  getMainWindow,
});

/**
 * The Library player, in the core: the queue, the songs moving on and fading
 * into each other, the session kept across restarts, all driving the native
 * host directly (`libraryPlayer/`). The window draws it and sends presses,
 * and its own element plays what the host cannot — a video, or every song on
 * a machine without a host. Before any window exists, so a launch puts the
 * last session back cued whether or not a window ever opens.
 */
const libraryHost = libraryHostPort();
const libraryPlayer = createLibraryPlayer({
  library: libraryIpc,
  ...(libraryHost
    ? { createHost: (events) => createHostEngine(libraryHost, events) }
    : {}),
  sources: createSourcePublication(sourceAnalysis),
  session: createPlaybackSession(userDataDir, log),
  window: {
    view: (view) => {
      // Its host and its queue are main's: the Library playing holds it.
      appLeave.hold('job:library', view.isPlaying);
      nowPlayingFeed.libraryViewed(view);
      remoteAudio.windowless.libraryViewed(view);
      sendToWindow(LIBRARY_PLAYER_CHANNEL.view, view);
    },
    // The bar's clock, four times a second while a song plays: a window
    // nobody can see is not woken for it, and asks again when it is back.
    clock: (clock) => {
      remoteAudio.windowless.libraryClock(clock);
      if (mainWindow?.isVisible() && !mainWindow.isMinimized()) {
        sendToWindow(LIBRARY_PLAYER_CHANNEL.clock, clock);
      }
    },
  },
});
libraryIpc.onTracksChanged(libraryPlayer.tracksChanged);
registerLibraryPlayerIpc({ getMainWindow, player: libraryPlayer });

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
    if (!isSealedSandbox) {
      sourceAnalysis.onHealth(health);
    }
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

/**
 * FluidEQ-Tray ended while FluidEQ runs. Electron's tray takes the icon and
 * main the engine's line, as where the program cannot run at all. A tray
 * that lost its line to main took the EQ off every output on the way out —
 * it cannot tell main ending from the line breaking — so the sound is
 * written back too, as after an engine switch.
 */
const nativeTrayLost = (servedEngineLine: boolean): void => {
  nativeTray = undefined;
  if (isAppQuitting()) {
    return;
  }
  log.warn(
    'FluidEQ-Tray ended while FluidEQ runs; the tray icon and the engine line come back to this process.',
  );
  fallBackToElectronTray();
  if (servedEngineLine) {
    startEngineOwnerPipe().catch(() => undefined);
  }
  if (session.configPath) {
    forgetRoomHead(session.configPath);
  }
  Promise.all([
    reflushCurrentState(),
    secondOutputs.reroute(),
    songProgramme.reflush(),
    sourceAnalysis.reflush(),
  ]).catch((error: unknown) =>
    log.error('Could not write the sound back after FluidEQ-Tray ended', error),
  );
};

/**
 * What a quit winds down before it turns the engines off, and what leaving
 * FluidEQ to its tray winds down instead: a song edited while it played
 * filed, its own sound handed back, the Library's session kept and its host
 * let go, the listening helper with it, and every write on its way landed.
 * Never rejects; each part's failure is logged and the next goes on.
 */
const windDown = (): Promise<void> =>
  songMemory
    .close()
    .catch((error) => log.error('The song memory could not close', error))
    .then(() => songEq.close())
    .catch((error) =>
      log.error('The Smart EQ song memory could not close', error),
    )
    .then(() => libraryPlayer.close())
    .catch((error) => log.error('The Library player could not close', error))
    .then(() => core.close())
    .then(() =>
      Promise.all([flushPendingWrites(), memoryTrace.stopMemoryTrace()]),
    )
    .then(() => undefined)
    .catch(() => undefined);

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
    sceneStore: members.sceneOwnership,
    scenePacks: members.scenePacksIpc,
    memberSharing: members.memberSharingIpc,
    plusGallery: members.plusGalleryIpc,
    sceneReviews: members.plusReviewIpc,
    plusTermsNotice: members.plusTermsNoticeIpc,
    sceneAnnouncements: members.sceneAnnouncementsIpc,
    addons: members.addons,
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
      isWindowLetGo = false;
      followWindowPage(next, next.webContents, getMainWindow, {
        pageLeft: () => {
          windowUnload.pageLeft();
          nowPlayingFeed.pageLeft();
          remoteAudio.windowless.pageLeft();
        },
      });
      comeBack.watchWindow(next);
      libraryIpc.watchWindow(next);
      // A paused Library song lets its host go while nobody can see the
      // window (`hostWanted`).
      watchWindowSeen(next, libraryPlayer.windowSeen);
    }
  },
  setUpAutoUpdates: updates.setUpAutoUpdates,
  setUpMemoryTraceTrigger: memoryTrace.setUpMemoryTraceTrigger,
  startMemoryProbe: memoryTrace.startMemoryProbe,
  startsHidden: () => didRestartForUnattendedUpdate || startedInTray,
  onHiddenInTray: windowUnload.hiddenInTray,
  isLettingGo: () => isWindowLetGo,
  syncDatabasesOnStartup,
});

/**
 * The window back from wherever it went: shown if it is there, built again
 * if it was let go in the tray (`windowUnload.ts`). A new window shows itself
 * once its page has painted, as the launch's does; one build at a time, so
 * a double click on the tray builds one window. Nothing before the launch's
 * own window has been started: a second launch arriving while this one is
 * still starting would otherwise build a second window beside it. And a
 * window still closing on its way out of the tray is waited for, then built
 * again: shown, it would vanish under the hand that opened it.
 *
 * Settles once the window is there, or once it will not be (quitting, or
 * before the launch's window), so a caller that needs its page — the
 * Studio's agent door — can wait on it rather than on a guess.
 */
let isLaunchWindowStarted = false;
let windowBuilding: Promise<void> | undefined;
let windowComingBack: Promise<void> | undefined;
const bringBackWindow = (): Promise<void> => {
  const window = mainWindow;
  if (window && !window.isDestroyed()) {
    if (!isWindowLetGo) {
      revealMainWindow(getMainWindow);
      return Promise.resolve();
    }
    windowComingBack ??= new Promise<void>((resolve) => {
      window.once('closed', () => resolve());
    }).then(() => {
      windowComingBack = undefined;
      return bringBackWindow();
    });
    return windowComingBack;
  }
  if (windowBuilding) {
    return windowBuilding;
  }
  if (!isLaunchWindowStarted || isAppQuitting()) {
    return Promise.resolve();
  }
  log.info('Building the window again: it was let go in the tray.');
  appLeave.hold('window', true);
  windowBuilding = createMainWindow()
    .catch((error) => {
      log.error(`Failed to create the ${PRODUCT_NAME} window`, error);
    })
    .finally(() => {
      windowBuilding = undefined;
    });
  return windowBuilding;
};

// At module scope rather than inside `whenReady`: the window that never opens
// is exactly the failure worth catching (`crashRecovery.ts`).
installCrashLogging();

// The first line of every launch, so a start with no window after it shows in
// the log as a start with no window after it, rather than as the absence of
// everything. An installer starts the app itself and passes `--updated`, which
// is what tells a launch that came out of setup from one somebody made.
log.info(
  `FluidEQ ${appVersion()} starting: pid ${process.pid}, packaged=${app.isPackaged}, from setup=${process.argv.includes('--updated')}, in tray=${startedInTray}`,
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
  //
  // Except a window let go in the tray (`windowUnload.ts`): that is the app
  // putting its window down, not anybody closing it, and the tray builds it
  // again.
  if (isWindowLetGo) {
    return;
  }
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
    // A song edited while it played is filed, its own sound handed back and
    // every write landed before the engine is turned off (`windDown`).
    windDown()
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
  // Here rather than in `will-quit`, which is already too late to wait for
  // anything asynchronous. A host left running holds an audio endpoint open,
  // and an endpoint held by a process whose parent has gone is one Windows
  // reclaims only when it notices.
  shutdownDspHost().catch(() => undefined);
  // No sync after the one in flight: nothing reads the folder from here on.
  diskSync.stop();
});

// What only a quit that is going ahead may take down: the account and every
// service on it, the forum, the tray, the network links. `before-quit` can
// still be called off after it runs — the windows close only after it, and a
// close that does not happen ends the quit with the process alive — and these
// used to be disposed there: on 2026-10-24 a quit that never finished left the
// dev window running with every one of their channels unregistered, so Sign
// out, the credits and the forum each answered "No handler registered".
// `will-quit` comes once every window has closed, when nothing can call the
// quit off. The forum's GitHub sign-in holds a loopback socket, which this
// still closes on every real quit, Windows' own included.
app.on('will-quit', () => {
  smartEq.close();
  destroyTray();
  remoteAudio.stop();
  stopOutputMirrors();
  members.dispose();
  forumIpc.dispose();
  motionPreferenceIpc.dispose();
  startWithWindowsIpc.dispose();
  graphicsPreferenceIpc.dispose();
});

const isTheOnlyCopy = claimTheOnlyCopy({ userDataDir, bringBackWindow });
// `fluideq://` links, before `ready`: macOS delivers one at launch as an event.
registerAppLinks();

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
    // A sandbox groups apart from the development window it runs beside.
    app.setAppUserModelId(ownAppUserModelId(APP_USER_MODEL_ID));
    // After the id, which is the startup entry's name: read before it, the
    // entry would be looked for under Electron's own.
    moveStartWithWindowsIntoTray(log);
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
  // FluidEQ Engine only applies one while FluidEQ holds its pipe open, which
  // is how a FluidEQ ended from Task Manager stops shaping the audio. See
  // `engineOwnerPipe.ts`. Never rejects.
  //
  // Neither of the engine's pipes in a sealed development sandbox
  // (`devSandbox.ts`): an engine that found the sandbox's owner pipe instead
  // of the listener's FluidEQ would stop applying the EQ the moment the
  // sandbox quit. The display pipe is served under a name no engine knows, so
  // its readouts are answered — with nothing — rather than refused many times
  // a second. A live sandbox serves both: it is FluidEQ while it runs.
  if (devSandbox && isSealedSandbox) {
    log.info(
      `Development sandbox in ${devSandbox.root}: the engine's pipes are left to the real FluidEQ.`,
    );
    await startEngineAnalysisPipe(
      getMainWindow,
      `\\\\.\\pipe\\FluidEQ-Sandbox-Analysis-${process.pid}`,
    );
  } else {
    await startEngineAnalysisPipe(getMainWindow);
  }
  // FluidEQ-Tray holds the engine's line where it runs, and takes the EQ off
  // every output if this process ends without its own quit; main holds the
  // line itself only where the program cannot run.
  const servesEngineLine = !(devSandbox && isSealedSandbox);
  nativeTray = await startNativeTray({
    userDataDir,
    ownerPipe: servesEngineLine ? ENGINE_OWNER_PIPE : undefined,
    configPath: session.configPath,
    onLost: () => nativeTrayLost(servesEngineLine),
  });
  if (servesEngineLine) {
    if (nativeTray) {
      announceEngineOwner();
    } else {
      await startEngineOwnerPipe();
    }
  }
  try {
    isLaunchWindowStarted = true;
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
      // A window on its way out of the tray is no window to show: the tray
      // waits for it to go and builds another (`bringBackWindow`).
      getMainWindow: usableWindow,
      onWindowMissing: bringBackWindow,
      nativeSurface: nativeTray?.surface,
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
      onOutputs: (devices) => {
        // A core that could not hear the backgrounds' music, or Auto
        // normalize's, may hear it on the output Windows has moved to.
        desktopSound.outputChanged();
        apoHeadroom.outputChanged();
        songMemory.outputChanged();
        return profilesIpc.followOutputs(devices, (channel, payload) => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send(channel, payload);
          }
        });
      },
    });
    // Stopped at the first quit pass, before the engine is reset: the
    // helper's last report would otherwise rewrite a config being neutralised.
    app.on('before-quit', () => outputWatch?.stop());
  }
  app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (mainWindow === null) {
      bringBackWindow();
    }
  });
};

app
  .whenReady()
  .then(() => isTheOnlyCopy)
  .then((isOnly) => (isOnly ? onAppReady() : undefined))
  .catch(log.error);
