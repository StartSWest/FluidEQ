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
  contentTracing,
  ipcMain,
  screen,
  shell,
} from 'electron';
import log from 'electron-log';
import type { NsisUpdater } from 'electron-updater';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { execFile } from 'child_process';
import { createHash } from 'crypto';
import { redact } from '../common/bugReport';
import {
  checkConfigFile,
  stateToApoFiles,
  getResolvedPreAmp,
  fetchSettings,
  save,
  updateConfig,
  savePreset,
  fetchPreset,
  doesPresetExist,
  PRESETS_DIR,
  PRESET_BASELINES_DIR,
  repairUnusedPreamps,
} from './flush';
import { getConfigPath, isEqualizerAPOInstalled } from './registry';
import { runEqualizerApoSetup } from './equalizerApoSetup';
import { gatherBugReportFacts } from './bugReportFacts';
import ChannelEnum from '../common/channels';
import { compressChainToLimit } from '../common/response';
import {
  AutoEqFormat,
  FilterTypeEnum,
  IState,
  IPresetV2,
  MAX_GAIN,
  WINDOW_HEIGHT,
  WINDOW_HEIGHT_EXPANDED,
  WINDOW_MIN_HEIGHT,
  WINDOW_MIN_WIDTH,
  FixedBandSizeEnum,
  getDefaultFilters,
  IFiltersMap,
  IAudioDevice,
  IDeviceProfileAssignment,
  AUTOMATIC_PRESET_PREFIX,
  APP_UPDATE_EVENT,
  OUTPUT_STATE_CHANGED_EVENT,
  APO_FEATURES,
  TApoFeature,
  TApoLayer,
} from '../common/constants';
import { ErrorCode } from '../common/errors';
import {
  getFixedBandSizeForCount,
  ILayoutSnapshot,
  snapshotFilters,
} from '../common/layouts';
import { TSuccess, TError } from '../renderer/utils/equalizerApi';
import { syncAutoEqDatabase } from './autoeqUpdater';
import { setUpVideoBrowser } from './videoBrowser';
import { createMainWindowFactory } from './mainWindow';
import { createApoAdoption } from './apoAdopt';
import { registerTransferIpc } from './ipc/transfer';
import { registerReferencesIpc } from './ipc/references';
import { registerKaraokeIpc } from './ipc/karaoke';
import { registerWindowIpc } from './ipc/window';
import { registerFiltersIpc } from './ipc/filters';
import { registerLayersIpc } from './ipc/layers';
import { registerPreampIpc } from './ipc/preamp';
import { registerVideoIpc } from './ipc/video';
import { registerProfilesIpc } from './ipc/profiles';
import { registerUpdatesIpc } from './ipc/updates';
import {
  adoptApoFeatureText,
  describeApoFeatureText,
} from '../common/apoFeatureSync';
import { readApoConfigTree, readApoDeviceChain } from './apoConfigReader';
import { IApoConfigLayer, IApoConfigTree } from '../common/apoConfig';
import { APP_ID, PRODUCT_NAME } from '../common/branding';
import {
  assignDeviceProfile,
  flushDeviceProfiles,
  IActiveStateOverride,
  isGeneratedConfigFile,
  loadDeviceProfileSettings,
  saveDeviceProfileSettings,
} from './deviceProfiles';
import { sendMediaTransportKey } from './mediaKeys';
import { POWERSHELL_PATH } from './powershell';
import { hydrateConvolutionAnalysis } from './convolutionAnalysis';
import {
  IAuthorizedAutoUpdater,
  setUpReleaseAutoUpdates,
} from './signedAutoUpdates';

/**
 * The updater exists only after Windows verifies which release channel this
 * process belongs to. An unsigned package uses GitHub Releases; an official
 * signed package uses its pinned HTTPS feed. A source build, differently signed
 * fork, incomplete release configuration, or verification failure leaves this
 * unset, which also closes the install IPC path below.
 *
 * Type-only import above is deliberate. The runtime module is required inside
 * `loadUpdater`, after verification, because reading electron-updater's
 * singleton export constructs the platform updater.
 */
let activeAutoUpdater: IAuthorizedAutoUpdater | undefined;
let hasAttemptedAutoUpdates = false;

/**
 * Which process is which, and how big each one is getting. Development only.
 *
 * Chasing a renderer that grew to two gigabytes, the hard part was not seeing
 * the growth — Task Manager shows that — it was knowing *whose* growth it was.
 * An Electron app playing a video runs half a dozen renderers and the operating
 * system names them all `electron.exe`; picking ours out by process id is a
 * guess, and a guess sends the search into the wrong file.
 *
 * Electron already knows. `getAppMetrics` labels every process by type, and the
 * window's own `getOSProcessId` says which renderer is the app rather than a
 * guest page. Written to the log so a session can be read back afterwards
 * instead of watched live.
 *
 * Never in a shipped build: it is a timer and a log line every fifteen seconds
 * in aid of a question only a developer is asking.
 */
const startMemoryProbe = () => {
  if (process.env.NODE_ENV !== 'development' || !mainWindow) {
    return;
  }
  const appRendererPid = mainWindow.webContents.getOSProcessId();
  log.info(`[mem] app renderer pid=${appRendererPid}`);
  const probe = setInterval(() => {
    const rows = app
      .getAppMetrics()
      .map((metric) => {
        const mb = Math.round(metric.memory.workingSetSize / 1024);
        const mine = metric.pid === appRendererPid ? '*' : '';
        return `${metric.type}${mine}:${metric.pid}=${mb}MB`;
      })
      .join(' ');
    // The JS heap alongside the process size, because the two answer different
    // questions and only the pair narrows anything. A renderer at a gigabyte
    // with a hundred-megabyte heap is not leaking objects — it is leaking
    // something the garbage collector never sees, which means DOM nodes,
    // decoded images, canvas backing stores or retained paint. The opposite
    // points straight back at our own code.
    mainWindow?.webContents
      .executeJavaScript(
        // Node count alongside the heap, because "process grows, heap flat" has
        // two very different explanations and this tells them apart: DOM piling
        // up inside the document, or something the page never sees — detached
        // nodes, retained paint, decoded images.
        '(() => { const m = performance.memory; const h = m ? Math.round(m.usedJSHeapSize / 1048576) + "/" + Math.round(m.totalJSHeapSize / 1048576) : "n/a"; return h + "MB nodes=" + document.getElementsByTagName("*").length; })()',
        true,
      )
      .then((heap) => log.info(`[mem] ${rows} jsHeap*=${heap}`))
      .catch(() => log.info(`[mem] ${rows}`));
  }, 15000);
  // The window can go before the app does, and a probe reporting on a renderer
  // that no longer exists is noise in the one log being read to find a leak.
  mainWindow.on('closed', () => clearInterval(probe));
};

/**
 * Ask Chromium itself where the memory went.
 *
 * The probe above can say the renderer is growing while its JS heap and its
 * DOM are not, which is enough to rule our own objects out and nothing like
 * enough to say what is actually holding it. Only Chromium knows that, and
 * memory-infra is how it will say: every subsystem that tracks its own
 * allocations — cc/tile_memory, skia, partition_alloc, discardable, malloc —
 * reports into a periodic dump, and the row that grows between the first dump
 * and the last is the answer.
 *
 * Bound rather than left running. The dumps are expensive enough that
 * Chromium's own documentation calls the category high-overhead, and a trace
 * left recording would change the thing it is measuring.
 *
 * Toggled from the keyboard rather than started at launch, because the
 * question is never "what does the app allocate" — it is "what does the app
 * allocate *while doing this particular thing*", and only the person driving
 * it knows when that has started.
 */
/**
 * Every five seconds, not every two.
 *
 * A detailed dump is not a number, it is the whole allocator tree — nearly
 * seven thousand nodes per process per dump, most of them individual Blink
 * object buckets. At two seconds across seven processes that is a hundred
 * megabytes a minute of trace, and the growth being measured here is steady
 * enough that five seconds resolves it just as well.
 */
const TRACE_DUMP_INTERVAL_MS = 5000;
const TRACE_MAX_MS = 5 * 60 * 1000;

/**
 * Keep the end of the recording, not the beginning.
 *
 * The default is `record-until-full`, which keeps the earliest events and
 * silently drops everything after the buffer fills. The first recording taken
 * here filled at around two minutes and threw away the entire period the
 * memory was actually climbing — leaving a 371MB file describing the part
 * where nothing happened, with nothing to say it was incomplete.
 *
 * A ring buffer gets this the right way round: whatever else is lost, the
 * dumps nearest the moment recording stopped survive, and those are the ones
 * being compared against.
 */
const TRACE_RECORD_MODE = 'record-continuously' as const;
/** The default is 100MB, and 100MB of this category is about two minutes. */
const TRACE_BUFFER_KB = 800 * 1024;

let traceStopTimer: NodeJS.Timeout | undefined;
let isTracing = false;
/**
 * True while a start or a stop is still in flight.
 *
 * Both are asynchronous, and the flag above is set the moment one begins — so
 * a second press during the await saw a recording that had been declared but
 * not yet begun, and tried to stop it. Chromium's answer to that is "no trace
 * in progress", after which our flag and its reality disagree and the control
 * is stuck until the app restarts.
 */
let isTraceBusy = false;

/**
 * Tell the window what the recording is doing.
 *
 * Pushed rather than returned, because the recording can also end without
 * anybody asking — the five-minute guard below stops it — and a button whose
 * label only updates when it is pressed would sit there claiming to be
 * recording long after the trace had been written.
 */
const publishTraceState = (detail?: string) => {
  mainWindow?.webContents.send(ChannelEnum.TOGGLE_MEMORY_TRACE, {
    result: { isRecording: isTracing, detail },
  });
};

const stopMemoryTrace = async () => {
  if (!isTracing || isTraceBusy) {
    return;
  }
  isTraceBusy = true;
  isTracing = false;
  if (traceStopTimer) {
    clearTimeout(traceStopTimer);
    traceStopTimer = undefined;
  }
  try {
    const target = path.join(
      app.getPath('userData'),
      'logs',
      `memory-trace-${Date.now()}.json`,
    );
    const written = await contentTracing.stopRecording(target);
    log.info(`[trace] written to ${written}`);
    publishTraceState(`Saved ${path.basename(written)}`);
  } catch (e) {
    log.info(`[trace] failed to stop: ${(e as Error).message}`);
    publishTraceState('Failed to save');
  } finally {
    isTraceBusy = false;
  }
};

const startMemoryTrace = async () => {
  if (isTraceBusy) {
    return;
  }
  if (isTracing) {
    await stopMemoryTrace();
    return;
  }
  isTraceBusy = true;
  isTracing = true;
  try {
    await contentTracing.startRecording({
      // Only memory-infra. Everything else in a trace is noise for this
      // question and makes the file large enough to be awkward to load.
      included_categories: ['disabled-by-default-memory-infra'],
      excluded_categories: ['*'],
      recording_mode: TRACE_RECORD_MODE,
      trace_buffer_size_in_kb: TRACE_BUFFER_KB,
      // `detailed` is what breaks the total down per allocator. `light` gives
      // totals only, which is the number we already have.
      memory_dump_config: {
        triggers: [
          { mode: 'detailed', periodic_interval_ms: TRACE_DUMP_INTERVAL_MS },
        ],
      },
    });
    log.info(
      `[trace] recording memory-infra — press again to stop, or it ends in ${
        TRACE_MAX_MS / 1000
      }s`,
    );
    publishTraceState('Recording');
    // A trace nobody remembers to stop is a trace that fills the disk and
    // distorts the measurement it was opened for.
    traceStopTimer = setTimeout(() => {
      stopMemoryTrace();
    }, TRACE_MAX_MS);
  } catch (e) {
    isTracing = false;
    log.info(`[trace] failed to start: ${(e as Error).message}`);
    publishTraceState('Failed to start');
  } finally {
    isTraceBusy = false;
  }
};

// Development only, and checked here as well as at the control that sends it.
// A renderer is the wrong place to enforce anything: the button not being
// rendered is a matter of what the user sees, and this is a matter of what the
// main process will do when asked.
ipcMain.on(ChannelEnum.TOGGLE_MEMORY_TRACE, () => {
  if (process.env.NODE_ENV !== 'development') {
    return;
  }
  startMemoryTrace();
});

/**
 * Started and stopped by dropping a file next to the log.
 *
 * A keyboard shortcut was the obvious way and it does not survive contact with
 * this app. `before-input-event` never fires while focus is inside the video
 * guest, which is one of the two places worth measuring; and on Windows
 * Ctrl+Alt is AltGr, so the key reported for Ctrl+Alt+M is not `m` on every
 * layout. A global shortcut would work and would take the combination away
 * from every other application on the machine, for a developer diagnostic.
 *
 * A sentinel file has none of those problems, works no matter where focus is,
 * and can be driven from a shell — which matters, because the person timing
 * the recording is usually not the person driving the window.
 */
const TRACE_POLL_MS = 1000;

const setUpMemoryTraceTrigger = () => {
  if (process.env.NODE_ENV !== 'development' || !mainWindow) {
    return;
  }
  const logsDir = path.join(app.getPath('userData'), 'logs');
  const startFile = path.join(logsDir, 'trace.start');
  const stopFile = path.join(logsDir, 'trace.stop');

  const poll = setInterval(() => {
    // Consumed rather than merely read, so one file is one recording and a
    // sentinel left behind cannot restart the trace on the next tick.
    if (fs.existsSync(startFile)) {
      fs.rmSync(startFile, { force: true });
      startMemoryTrace();
      return;
    }
    if (fs.existsSync(stopFile)) {
      fs.rmSync(stopFile, { force: true });
      stopMemoryTrace();
    }
  }, TRACE_POLL_MS);

  mainWindow.on('closed', () => clearInterval(poll));
  log.info(`[trace] drop trace.start / trace.stop in ${logsDir}`);
};

const setUpAutoUpdates = async () => {
  if (hasAttemptedAutoUpdates) {
    return;
  }
  hasAttemptedAutoUpdates = true;
  log.transports.file.level = 'info';

  activeAutoUpdater = await setUpReleaseAutoUpdates({
    executablePath: process.execPath,
    isPackaged: app.isPackaged,
    platform: process.platform,
    publisherName: process.env.FLUIDEQ_SIGN_PUBLISHER || '',
    updateUrl: process.env.FLUIDEQ_UPDATE_URL || '',
    logger: log,
    loadUpdater: () =>
      // eslint-disable-next-line global-require
      require('electron-updater').autoUpdater as NsisUpdater,
    sendStatus: (payload) => {
      if (!mainWindow || mainWindow.isDestroyed()) {
        return;
      }
      mainWindow.webContents.send(APP_UPDATE_EVENT, payload);
    },
  });
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
    log.warn('Unable to save the window position', error);
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
    deviceId: session.activeAudioDeviceId,
  });
};

const syncDatabasesOnStartup = async () => {
  const autoeqResult = await Promise.resolve(syncAutoEqDatabase())
    .then((value) => ({ status: 'fulfilled' as const, value }))
    .catch((reason) => ({ status: 'rejected' as const, reason }));

  if (autoeqResult.status === 'rejected') {
    log.warn('Unable to synchronize the AutoEq database', autoeqResult.reason);
  }
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  mainWindow.webContents.send(DATABASES_SYNCED_EVENT, {
    autoeq:
      autoeqResult.status === 'fulfilled' ? autoeqResult.value : undefined,
  });
};

if (process.platform !== 'win32') {
  app.setPath('userData', path.join(app.getPath('temp'), 'fluideq-dev'));
  fs.mkdirSync(app.getPath('userData'), { recursive: true });
}

/** How much of the screen the window takes when nothing is remembered. */
const FIRST_RUN_SCREEN_FRACTION = 0.9;

/**
 * Under this, a first run opens maximised instead of at 90%.
 *
 * Nine tenths of a small screen is not a comfortable window, it is a cramped
 * one with a frame of wasted desktop around it — this app puts a band editor, a
 * response graph and a profile column side by side, and below 2K something has
 * to give. The test is against the display's **resolution**, not its work area:
 * a 2560x1440 screen reports 2560x1392 once the taskbar is subtracted, so
 * measuring the work area against 1440 would maximise on exactly the screens
 * meant to get the 90% window.
 */
const MAXIMIZE_BELOW_WIDTH = 2560;
const MAXIMIZE_BELOW_HEIGHT = 1440;

/**
 * Where and how big to open when nothing is remembered.
 *
 * A fixed 1428x625 was a guess at somebody else's monitor, and it was made
 * worse by the graph-view expansion below: the window was centred as a 625-tall
 * one and then grown to 1036 from the same top-left, so it reached 411px
 * further down than the position it had been given. On a 1080p display that put
 * the bottom edge under the taskbar on the very first launch.
 *
 * Nine tenths of the work area is the same proportion of whatever screen it
 * lands on, and — because it is applied when the window is built rather than
 * after — `center: true` centres the size the user actually gets. The size is
 * computed even when the window will be maximised, because it is what the
 * window returns to the first time somebody restores it down.
 */
const firstRunPlacement = () => {
  const display = screen.getPrimaryDisplay();
  const { width, height } = display.workAreaSize;
  return {
    maximize:
      display.bounds.width < MAXIMIZE_BELOW_WIDTH ||
      display.bounds.height < MAXIMIZE_BELOW_HEIGHT,
    width: Math.max(
      WINDOW_MIN_WIDTH,
      Math.round(width * FIRST_RUN_SCREEN_FRACTION),
    ),
    height: Math.max(
      WINDOW_MIN_HEIGHT,
      Math.round(height * FIRST_RUN_SCREEN_FRACTION),
    ),
  };
};

const setWindowDimension = (isExpanded: boolean) => {
  if (mainWindow) {
    const currWidth = mainWindow.getSize()[0];
    const currHeight = mainWindow.getSize()[1];
    if (isExpanded) {
      mainWindow.setMinimumSize(WINDOW_MIN_WIDTH, WINDOW_MIN_HEIGHT);
      // Never taller than the screen it is on. Growing to a fixed 1036 is fine
      // on a large monitor and runs off the bottom of a small one, and the
      // window keeps its top-left when it grows, so the part that disappears is
      // the part with the graph in it.
      mainWindow.setSize(
        currWidth,
        Math.min(
          Math.max(currHeight, WINDOW_HEIGHT_EXPANDED),
          screen.getPrimaryDisplay().workAreaSize.height,
        ),
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

/**
 * What the process currently has open, in one place a module can be handed.
 *
 * These four were module-level `let`s, and being `let`s is exactly what kept
 * the IPC handlers that reassign them stuck in this file: a reassignment
 * cannot travel across a function boundary. Extracting the device handlers
 * would have meant passing four setters so a module could reach back and
 * rewrite this file's variables — which is harder to follow than leaving them
 * inline, and is why `presets` and `devices` could not be merged even though
 * they are plainly one subject.
 *
 * As fields on an object the reassignment goes with the object, so a module
 * receives `session` and mutates it directly. The mutability is unchanged and
 * deliberately so; what changes is that it now has a name and a place, and a
 * handler's access to it is visible in a signature.
 *
 * Deliberately not `state`. That is the audio chain — the filters, the preamp,
 * the layers — and is persisted. This is which output is selected and where
 * the config lives, none of which outlives the process.
 */
const session: {
  /** Equalizer APO's config directory, resolved once and cached. */
  configPath: string;
  activeAudioDeviceId: string;
  activeAudioDevice: IAudioDevice | undefined;
  /** The user opened a device explicitly, so its profile wins over the default. */
  hasActiveSessionOverride: boolean;
} = {
  configPath: '',
  activeAudioDeviceId: '',
  activeAudioDevice: undefined,
  hasActiveSessionOverride: false,
};
// The live APO reader must never observe the half-state between an app edit
// mutating memory and that edit reaching the generated files. Otherwise it can
// read the old file back as an external change and undo actions such as Clear
// EQ. Nested because a few higher-level operations reuse the update helper.
let apoAppWriteDepth = 0;
let apoSyncDeferredByAppWrite = false;

/** Backfill measured WAV metadata for profiles created before strict
 * convolution normalization existed. The file analyzer caches by mtime, so
 * repeated state reads do not repeat the FFT.
 */
const hydrateActiveConvolution = () => {
  if (!session.configPath || !state.convolution?.fileName) {
    return false;
  }
  try {
    const hydrated = hydrateConvolutionAnalysis(
      state.convolution,
      session.configPath,
    );
    if (hydrated !== state.convolution) {
      state.convolution = hydrated;
      return true;
    }
  } catch (error) {
    log.warn('Unable to analyze the active convolution WAV', error);
  }
  return false;
};

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

// Deferred until after the per-output folders exist, since that is where the
// profiles it repairs now live. See runStartupProfileMaintenance.

const layoutSettings = loadLayoutSettings();

const saveLayoutSettings = () => {
  try {
    fs.writeFileSync(
      layoutSettingsPath,
      JSON.stringify(layoutSettings, null, 2),
      'utf8',
    );
  } catch (error) {
    log.warn('Unable to save per-layout frequencies', error);
  }
};

const getLayoutDeviceKey = () => session.activeAudioDeviceId || 'global';

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
 * Where one output's profiles live.
 *
 * Profiles belong to an output, not to the app. A pair of headphones and a set
 * of speakers want different tunings, and the name the user picks for one has
 * nothing to say about the other — "Bass boost" on the headphones and "Bass
 * boost" on the speakers are two different profiles that happen to share a
 * word.
 *
 * A folder each is what makes that true on disk. They used to share one flat
 * directory, where a profile *was* its filename, so two outputs could not both
 * hold a "Bass boost" and saving on one silently overwrote the other. The old
 * defence was to rename the second one "Bass boost 2" — a name the user never
 * typed, attached to an output they were not looking at.
 *
 * The directory is named by hashing the device id rather than using it: device
 * ids are long, contain characters Windows will not accept in a path, and are
 * not something anybody should have to look at. The same hash already names
 * the automatic profile, so both agree on what identifies an output.
 */
const presetDirForDevice = (deviceId: string) => {
  const dir = path.join(
    presetPath,
    createHash('sha1').update(deviceId).digest('hex').slice(0, 12),
  );
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
};

/** The folder for whichever output is playing now. */
const activePresetDir = () => presetDirForDevice(session.activeAudioDeviceId);

/**
 * Move profiles saved before outputs owned them into the folder of the output
 * that was using them.
 *
 * An assignment is the only record of who a profile belonged to, so it is the
 * only thing that can answer the question. A profile no assignment mentions has
 * no owner to deduce and is left exactly where it is — not deleted, not guessed
 * at, still readable on disk if it turns out to matter. It stops appearing in
 * the list, which is the point: an unowned profile has no output to appear
 * under.
 *
 * Runs once per profile by construction — the second run finds the file gone
 * from the root and does nothing.
 */
const migrateProfilesToPerOutputFolders = () => {
  Object.values(deviceProfileSettings.assignments).forEach((assignment) => {
    const from = path.join(presetPath, assignment.presetName);
    // Directories are the new layout; only a file at the root is unmigrated.
    if (!fs.existsSync(from) || !fs.statSync(from).isFile()) {
      return;
    }
    const to = path.join(
      presetDirForDevice(assignment.deviceId),
      assignment.presetName,
    );
    // Never clobber a profile the new layout already holds.
    if (fs.existsSync(to)) {
      return;
    }
    try {
      fs.renameSync(from, to);
      log.info(
        `Moved profile "${assignment.presetName}" to its output's folder`,
      );
    } catch (e) {
      // A profile that will not move stays where it is and stays readable.
      log.error(`Could not move profile "${assignment.presetName}"`);
      log.error(e);
    }
  });
};

/**
 * Put the profile store in order before anything reads from it.
 *
 * The move has to come first: the repair looks inside each output's folder, and
 * before the move there are no folders to look in. Running them the other way
 * round would quietly skip every profile that still needed repairing.
 *
 * Automatic profiles that carry makeup gain but no EQ to make up for are
 * leftovers from when switching outputs copied the previous device's state
 * across; the effect is an output several dB down for no reason, which is not
 * something a user would ever notice as a setting.
 */
const runStartupProfileMaintenance = () => {
  migrateProfilesToPerOutputFolders();

  const repaired = Object.values(deviceProfileSettings.assignments).flatMap(
    (assignment) =>
      repairUnusedPreamps(presetDirForDevice(assignment.deviceId)),
  );
  if (repaired.length > 0) {
    log.info(
      `Cleared unused preamp on ${repaired.length} automatic profile(s):`,
      repaired.join(', '),
    );
  }
};

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
  // Without these the device-profile block is rendered from a preset that has
  // no idea they exist, and every one of the layers vanishes from the config
  // the moment a profile is attached — which is always, since every output is
  // given one.
  //
  // Any layer added later belongs in this list, and one of them was missed for
  // months: it could be switched on, drawn and reasoned about, and it reached
  // Equalizer APO exactly never, because the session override rendered it from
  // the state while the profile was written without it — and the profile is
  // what the config is built from.
  voicing: state.voicing,
  driver: state.driver,
  smartEq: state.smartEq,
  headphone: state.headphone,
  eqImport: state.eqImport,
  isAutoPreAmpOn: state.isAutoPreAmpOn,
  headset: state.headset,
  headsetTarget: state.headsetTarget,
  headsetSource: state.headsetSource,
  headsetSignature: state.headsetSignature,
  // Which layers are switched off is part of what this profile sounds like, so
  // it travels with it — otherwise switching outputs and back would bring every
  // bypassed layer roaring back in.
  bypassed: state.bypassed,
});

/**
 * The shield in front of every reference this app applies on somebody's behalf.
 *
 * A published measurement is a claim, and some of them are wrong. A model with
 * no flat baseline to subtract from can arrive as a negated raw SPL curve —
 * read literally, a correction of fifty decibels of cut across the whole
 * midrange. It was applied, it was written to Equalizer APO, and the output
 * went silent.
 *
 * Nothing downstream could have caught it. The per-band ceiling did fire: it
 * trimmed eleven separate bands to -12 dB, and eleven legal bands still summed
 * to -50, because a limit on each band is not a limit on the chain. The preamp
 * could not catch it either — it only ever attenuates, so a chain that has
 * already thrown away fifty decibels is not something it can give back.
 *
 * So the chain itself is bounded here, once, before any of it is applied.
 * Compressed rather than clipped, so a correction that is merely strong keeps
 * the shape the measurement asked for and only gets gentler; one already inside
 * the range is passed through untouched and costs nothing.
 *
 * Deliberately not applied to a profile the user loads. Their own tuning is
 * theirs, however extreme, and quietly rescaling a saved profile on load would
 * change a sound they chose and kept.
 */
const shieldReferenceBands = (filters: IFiltersMap) =>
  compressChainToLimit(filters, MAX_GAIN);

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
 * owns. Only this output's own folder is consulted, because that is the only
 * place the name can collide — what the speakers call their profiles has no
 * bearing on what the headphones may call theirs.
 *
 * A number is still appended when the name is taken *here*, the way a file
 * manager does it, because two profiles on one output really would be the same
 * file. That is the user's own duplicate, though, not one invented by another
 * output they were not looking at.
 */
const availableProfileNameForActiveDevice = (requestedName: string) => {
  const dir = activePresetDir();
  if (!doesPresetExist(requestedName, dir)) {
    return requestedName;
  }
  let index = 2;
  while (doesPresetExist(`${requestedName} ${index}`, dir)) {
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
/**
 * A layer applied afresh is applied, whatever was switched off before it.
 *
 * Called where a layer's settings arrive or are taken away, not where they are
 * edited. Choosing a voicing, finishing a measurement, applying a reference
 * model — each of those is somebody asking to hear something, and handing them
 * silence because the previous occupant of that slot was switched off is the
 * one thing an applied layer must never do. Clearing one has to do it too: the
 * chip goes with the layer, and a list still naming it would leave nothing on
 * screen able to switch it back on.
 *
 * Moving a band while its layer is bypassed is a different act. The chip is
 * visibly off, and preparing a tuning before switching it in is a reasonable
 * thing to want.
 */
const applyingLayer = (layer: TApoLayer) => {
  if (!state.bypassed?.includes(layer)) {
    return;
  }
  const rest = state.bypassed.filter((entry) => entry !== layer);
  state.bypassed = rest.length ? rest : undefined;
};

const resetEqToDefaults = () => {
  switchToParametricEditing();
  clearCurrentLayoutSettings();
  state.filters = getDefaultFilters();
  state.preAmp = 0;
  state.isFlat = true;
  state.headset = undefined;
  state.headsetTarget = undefined;
  state.headsetSource = undefined;
  state.eqImport = undefined;
  // The bands are gone, so the switch that was holding them out of the config
  // has nothing left to hold. Without this, clearing a bypassed EQ takes the
  // chip off the row — no shaped bands, no reference, nothing to draw it — and
  // leaves the feature on the bypass list, so the next tuning somebody builds
  // is written nowhere and there is no control left to explain why.
  applyingLayer('eq');
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
  // Nothing is left to be switched off. Keeping the list would leave the next
  // layer applied here silent for a reason nothing on screen accounts for.
  state.bypassed = undefined;
};

/**
 * Give the active output an empty named profile.
 *
 * Every output keeps at least one, so there is always somewhere for an edit to
 * land and always something in the list to select. The number counts only this
 * output's own profiles, so each output starts again at "Untitled profile 1" —
 * a second output has no reason to open on "Untitled profile 4" because three
 * unrelated ones exist on the speakers.
 */
const UNTITLED_PROFILE_PREFIX = 'Untitled profile';

/**
 * One profile mutation at a time, in the order they arrived.
 *
 * These handlers are `async` and every `await` in them is a place another one
 * can start. They share three things — `deviceProfileSettings`, the equaliser
 * `state`, and the config on disk — so two that overlap are not two operations
 * but one interleaved mess.
 *
 * Deleting several profiles quickly is where it shows, because delete is the
 * longest of them. Two deletes that both removed the profile their output was
 * playing each reach `createEmptyProfileForActiveDevice`, and each counts the
 * catalogue *before* the other has written to it, so both pick the same number
 * and one silently loses. Meanwhile both are part-way through
 * `removeAssignmentsForPreset` on the same object and both call `handleUpdate`,
 * so the config is rewritten from a state that is halfway between two edits.
 * Nothing throws. The list simply comes back wrong.
 *
 * A chain rather than a lock, because a lock needs releasing on every path out
 * — including the ones that throw — and this cannot be forgotten. The failure
 * handler on the tail is what keeps the queue alive: without it, one rejected
 * mutation would leave every later one waiting on a promise that never settles,
 * which turns a wrong list into a dead panel.
 *
 * It does NOT serialise the whole application. Reads are untouched, and so is
 * everything that does not write to these three things.
 */
let profileMutations: Promise<unknown> = Promise.resolve();

const runProfileMutation = (work: () => Promise<void>): Promise<void> => {
  const next = profileMutations.then(work, work);
  profileMutations = next.catch(() => undefined);
  return next;
};

const createEmptyProfileForActiveDevice = () => {
  if (!session.activeAudioDeviceId) {
    return;
  }
  const dir = activePresetDir();
  let index = 1;
  while (doesPresetExist(`${UNTITLED_PROFILE_PREFIX} ${index}`, dir)) {
    index += 1;
  }
  const name = `${UNTITLED_PROFILE_PREFIX} ${index}`;
  savePreset(name, getCurrentPreset(), dir);
  attachPresetToActiveDevice(name);
};

const attachPresetToActiveDevice = (presetName: string) => {
  if (!session.activeAudioDeviceId) {
    return false;
  }

  const device = session.activeAudioDevice;
  assignDeviceProfile(deviceProfileSettings, {
    deviceId: session.activeAudioDeviceId,
    deviceName: device?.name || session.activeAudioDeviceId,
    deviceGuid: device?.guid || session.activeAudioDeviceId,
    presetName,
  });
  saveDeviceProfileSettings(deviceProfileSettings, userDataDir);
  session.hasActiveSessionOverride = false;
  return true;
};

try {
  // create presets dir if it doesn't exist
  if (!fs.existsSync(presetPath)) {
    fs.mkdirSync(presetPath, { recursive: true });
  }
} catch (e) {
  log.error('Failed to make presets directory!!');
  log.error(e);
  throw e;
}

// Only once the root exists, since every output's folder is made inside it.
runStartupProfileMaintenance();

// spawn child process to update presets folder so that it can support case-sensitive files
if (process.platform === 'win32') {
  // `execFile`, not `exec`: the path goes across as an argument rather than
  // being pasted into a command line for a shell to re-parse. It comes from
  // `app.getPath('userData')` so there is nothing hostile in it today, but the
  // quoting was the only thing standing between that and a shell, and this
  // needs no shell at all.
  execFile(
    'fsutil.exe',
    ['file', 'SetCaseSensitiveInfo', presetPath],
    (err, stdout, stderr) => {
      // Error handling should occur in this callback function
      if (err) {
        log.error(err.message.trim());
        log.error(stdout.trim());
        log.error(stderr.trim());
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
  // And what to do about it. Pass this whenever `detail` describes a rule
  // rather than a fault, or the canned "reach out to the developers" is left
  // underneath a message that needs no developer at all.
  action?: string,
) => {
  const reply: TError = {
    errorCode,
    ...(detail ? { detail } : {}),
    ...(action ? { action } : {}),
  };
  log.info(channel);
  event.reply(channel, reply);
};

const updateConfigPath = async (
  event: Electron.IpcMainEvent,
  channel: ChannelEnum | string,
) => {
  try {
    // Retrive session.configPath assuming EqualizerAPO is installed
    session.configPath = await getConfigPath();
    // Overwrite the config file if necessary
    if (!checkConfigFile(session.configPath)) {
      updateConfig(session.configPath);
    }
    startApoConfigWatcher();
  } catch (e) {
    handleError(event, channel, ErrorCode.CONFIG_NOT_FOUND);
    return false;
  }
  return true;
};

const handleUpdateHelperCore = async <T>(
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
    if (!session.configPath) {
      session.configPath = await getConfigPath();
    }
    startApoConfigWatcher();
    if (!checkConfigFile(session.configPath)) {
      updateConfig(session.configPath);
    }
    // Keep the root state, the disabled slider and the generated APO line on
    // the same automatic value. The writer derives this independently as its
    // final safety check; synchronizing here prevents the stored manual preamp
    // from surviving underneath an enabled Auto normalize switch.
    if (state.isAutoPreAmpOn) {
      state.preAmp = getResolvedPreAmp(state);
    }
    const shouldPersistProfile = syncActiveProfile || useActiveSessionOverride;
    let assignment =
      deviceProfileSettings.assignments[session.activeAudioDeviceId];
    if (shouldPersistProfile && !assignment && session.activeAudioDeviceId) {
      const automaticPresetName = getAutomaticPresetName(
        session.activeAudioDeviceId,
      );
      attachPresetToActiveDevice(automaticPresetName);
      assignment =
        deviceProfileSettings.assignments[session.activeAudioDeviceId];
    }
    if (shouldPersistProfile && assignment) {
      // Every edit lands in the attached profile, named or automatic. The
      // user's manually saved copy is kept separately (see savePresetBaseline
      // in the SAVE_PRESET handler), so auto-saving here can always be undone
      // and never costs them the version they chose to keep.
      savePreset(
        assignment.presetName,
        getCurrentPreset(),
        presetDirForDevice(assignment.deviceId),
      );
      session.hasActiveSessionOverride = false;
    } else if (
      shouldPersistProfile &&
      !assignment &&
      session.activeAudioDeviceId
    ) {
      // An output without a profile still needs edits applied immediately.
      // Keep this override scoped to the current endpoint until it gets
      // assigned by explicit profile load or manual save.
      session.hasActiveSessionOverride = true;
      assignment =
        deviceProfileSettings.assignments[session.activeAudioDeviceId];
    }
    if (assignment) {
      // A loaded/saved profile clears the temporary override. A subsequent
      // edit recreates it and remains live-only until the user saves.
      if (syncActiveProfile) {
        session.hasActiveSessionOverride = false;
      }
    }
    const activeDevicePattern =
      session.activeAudioDevice?.guid ||
      session.activeAudioDevice?.name ||
      session.activeAudioDeviceId;
    const activeOverride: IActiveStateOverride | undefined =
      session.hasActiveSessionOverride && activeDevicePattern
        ? {
            deviceId: session.activeAudioDeviceId,
            deviceName: session.activeAudioDevice?.name,
            devicePattern: activeDevicePattern,
            state,
          }
        : undefined;
    // Flush changes to EqualizerAPO with a retry in case several requests to write are occuring at the same time
    await retryHelper(5, () => {
      flushDeviceProfiles(
        deviceProfileSettings,
        presetDirForDevice,
        session.configPath,
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

const handleUpdateHelper = async <T>(
  event: Electron.IpcMainEvent,
  channel: ChannelEnum | string,
  response: T,
  syncActiveProfile = false,
  useActiveSessionOverride = false,
) => {
  apoAppWriteDepth += 1;
  try {
    return await handleUpdateHelperCore(
      event,
      channel,
      response,
      syncActiveProfile,
      useActiveSessionOverride,
    );
  } finally {
    apoAppWriteDepth -= 1;
    if (apoAppWriteDepth === 0 && apoSyncDeferredByAppWrite) {
      apoSyncDeferredByAppWrite = false;
      queueApoDiskSync();
    }
  }
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
  hydrateActiveConvolution,
  session,
  state,
  userDataDir,
});

/**
 * Live two-way synchronization with the generated Equalizer APO files.
 *
 * `fs.watch` is only a wake-up signal. A single FluidEQ update touches more
 * than one file and APO itself may also cause duplicate notifications, so the
 * callback never treats an event as a change. After a short debounce it reads
 * the complete active chain and compares each feature's parsed audible shape
 * with what the current state would write. FluidEQ's own writes therefore
 * compare equal and stop here; an external edit is adopted once, persisted,
 * canonicalized, and the canonical write compares equal on the next event.
 */
const APO_WATCH_DEBOUNCE_MS = 180;
let apoConfigWatcher: fs.FSWatcher | undefined;
let watchedApoConfigPath = '';
let apoWatchTimer: ReturnType<typeof setTimeout> | undefined;
let apoSyncQueue: Promise<void> = Promise.resolve();

const persistExternallyAdoptedState = () => {
  save(state, userDataDir);
  const assignment =
    deviceProfileSettings.assignments[session.activeAudioDeviceId];
  if (assignment) {
    savePreset(
      assignment.presetName,
      getCurrentPreset(),
      presetDirForDevice(assignment.deviceId),
    );
  }
};

const syncActiveApoFilesFromDisk = async () => {
  if (apoAppWriteDepth > 0) {
    apoSyncDeferredByAppWrite = true;
    return;
  }
  if (!session.configPath || !session.activeAudioDeviceId) {
    return;
  }
  const devicePattern =
    session.activeAudioDevice?.guid ||
    session.activeAudioDevice?.name ||
    session.activeAudioDeviceId;
  const chain = readApoDeviceChain(session.configPath, devicePattern);
  let changed = syncCustomFxFromConfig();
  let generatedChanged = false;
  let containsUnsupportedCommands = false;

  if (chain?.features) {
    const expected = stateToApoFiles(state, state.convolution?.fileName);
    const expectedByFeature = new Map<TApoFeature, string>(
      (expected?.features ?? []).map(({ feature, lines }) => [
        feature,
        lines.join('\n'),
      ]),
    );

    generatedChanged = adoptBypassFromConfig(
      chain.features,
      chain.shared ?? '',
    );

    APO_FEATURES.forEach((feature) => {
      const actual = chain.features?.[feature];
      if (actual === undefined) {
        return;
      }
      const expectedText = expectedByFeature.get(feature) ?? '';
      if (
        describeApoFeatureText(actual) === describeApoFeatureText(expectedText)
      ) {
        return;
      }
      const adoption = adoptApoFeatureText(state, feature, actual);
      if (adoption.unsupported) {
        containsUnsupportedCommands = true;
        log.warn(
          `Not adopting ${feature}: its generated APO file contains ${adoption.unsupported} unsupported command(s).`,
        );
        return;
      }
      generatedChanged = generatedChanged || adoption.changed;
      if (adoption.changed) {
        log.info(
          `Adopted an external Equalizer APO edit for the ${feature} layer.`,
        );
      }
    });
  }

  changed = changed || generatedChanged;
  if (!changed) {
    return;
  }

  persistExternallyAdoptedState();

  // Recompute automatic headroom and normalize the generated text after a
  // supported external edit. Never rewrite a file containing commands the app
  // cannot represent: preserving the user's APO work is more important than
  // normalizing the other files in that same pass.
  if (generatedChanged && !containsUnsupportedCommands) {
    await retryHelper(5, () => {
      flushDeviceProfiles(
        deviceProfileSettings,
        presetDirForDevice,
        session.configPath,
        undefined,
        state.isEnabled,
      );
    });
  }

  notifyOutputStateChanged();
};

const queueApoDiskSync = () => {
  if (apoWatchTimer !== undefined) {
    clearTimeout(apoWatchTimer);
  }
  apoWatchTimer = setTimeout(() => {
    apoWatchTimer = undefined;
    apoSyncQueue = apoSyncQueue
      .then(syncActiveApoFilesFromDisk)
      .catch((error) =>
        log.warn('Unable to synchronize Equalizer APO file edits', error),
      );
  }, APO_WATCH_DEBOUNCE_MS);
};

function startApoConfigWatcher() {
  if (!session.configPath || watchedApoConfigPath === session.configPath) {
    return;
  }
  apoConfigWatcher?.close();
  watchedApoConfigPath = session.configPath;
  try {
    apoConfigWatcher = fs.watch(
      session.configPath,
      { persistent: false },
      (_eventType, fileName) => {
        if (
          !fileName ||
          /^fluideq(?:-device)?-[0-9a-f]{12}(?:-(?:driver|headphone|eq|voicing|smart|custom))?\.txt$/i.test(
            fileName.toString(),
          )
        ) {
          queueApoDiskSync();
        }
      },
    );
    apoConfigWatcher.on('error', (error) => {
      log.warn('Equalizer APO config watcher stopped', error);
      apoConfigWatcher?.close();
      apoConfigWatcher = undefined;
      watchedApoConfigPath = '';
    });
  } catch (error) {
    apoConfigWatcher = undefined;
    watchedApoConfigPath = '';
    log.warn('Unable to watch the Equalizer APO config directory', error);
  }
}

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

// Fifteen dependencies, and the list is worth reading rather than skipping:
// most of them are about audio devices, not files. A profile only means
// anything relative to the output it is attached to, so this and the device
// handlers are one subject with two names — which the extraction made visible
// rather than fixed.
registerProfilesIpc({
  state,
  userDataDir,
  baselinePath,
  deviceProfileSettings,
  session,
  handleUpdate,
  handleUpdateHelper,
  handleError,
  runProfileMutation,
  attachPresetToActiveDevice,
  clearCurrentLayoutSettings,
  createEmptyProfileForActiveDevice,
  getCurrentPreset,
  hydrateActiveConvolution,
  isAutomaticPresetName,
  availableProfileNameForActiveDevice,
  presetDirForDevice,
  activePresetDir,
  resetStateToDefaults,
  adoptExistingApoConfig,
  applyDeviceState,
  captureCurrentLayout,
  notifyOutputStateChanged,
  retryHelper,
});

/**
 * Write one config file back to disk.
 *
 * Editing the config from inside the app means text out of a window ends up in
 * the audio engine's directory, so the name is checked rather than trusted. It
 * has to be one FluidEQ itself generates — the same list the stale sweep uses —
 * which rules out APO's own config.txt, its sample configs, anything carrying a
 * path, and anything at all outside that directory. The contents are the user's
 * business; the destination is not.
 *
 * Nothing is adopted back into the state. Equalizer APO reloads when a file in
 * its config directory changes, which is the same route a text editor takes and
 * makes the edit audible at once. What FluidEQ generates it will generate again
 * on the next change, and the panel says as much beside the file.
 */
ipcMain.on(ChannelEnum.WRITE_APO_CONFIG_FILE, async (event, arg) => {
  const channel = ChannelEnum.WRITE_APO_CONFIG_FILE;
  const fileName = arg?.[0];
  const contents = arg?.[1];

  if (
    typeof fileName !== 'string' ||
    typeof contents !== 'string' ||
    fileName !== path.basename(fileName) ||
    !isGeneratedConfigFile(fileName)
  ) {
    handleError(event, channel, ErrorCode.INVALID_PARAMETER);
    return;
  }

  try {
    if (!session.configPath) {
      session.configPath = await getConfigPath();
    }
    fs.writeFileSync(path.join(session.configPath, fileName), contents, 'utf8');
    const reply: TSuccess<void> = { result: undefined };
    event.reply(channel, reply);
  } catch (e) {
    handleError(event, channel, ErrorCode.FAILURE, (e as Error).message);
  }
});

/**
 * The config as it stands on disk, for the panel that shows it.
 *
 * Read every time rather than cached. The whole reason this view exists is
 * that the files can say something the app did not put there — a hand edit,
 * another tool, a write that failed — and a cached answer would be the app
 * telling you what it believes, which is what every other panel already does.
 */
/**
 * Which layers an output has, and which of them the config is applying.
 *
 * The files cannot answer this on their own. A switched-off layer has no file,
 * so absence in the config is just absence: nothing there distinguishes an
 * output with no voicing from one whose voicing is switched off, and the panel
 * would simply stop showing a layer the moment somebody bypassed it — which is
 * the opposite of what a bypass switch wants to be able to say. Reading the
 * profile beside the config is the only way to report "this exists, and it is
 * off".
 *
 * Built by asking the writer what it would produce with nothing bypassed, so
 * the list is exactly the layers with something to say. A layer that is empty
 * is not switched off, it is empty, and it belongs on this list no more than it
 * belongs in the config.
 */
const describeDeviceLayers = (
  assignment: IDeviceProfileAssignment,
): IApoConfigLayer[] | undefined => {
  let preset: IPresetV2;
  try {
    preset = fetchPreset(
      assignment.presetName,
      presetDirForDevice(assignment.deviceId),
    );
  } catch {
    return undefined;
  }

  const bypassed: string[] = preset.bypassed ?? [];
  const customFx = readCustomFxForDevice(assignment.deviceId);
  // Any truthy name will do: it only has to make the convolution count as
  // present, and nothing here is written to disk.
  const everything = stateToApoFiles(
    {
      isEnabled: true,
      isGraphViewOn: false,
      isCaseSensitiveFs: false,
      ...preset,
      isAutoPreAmpOn: preset.isAutoPreAmpOn ?? true,
      bypassed: undefined,
    },
    preset.convolution ? 'impulse' : undefined,
  );
  if (!everything) {
    return undefined;
  }

  return [
    ...(everything.convolution
      ? [
          {
            feature: 'convolution',
            isApplied: !bypassed.includes('convolution'),
          },
        ]
      : []),
    ...everything.features.map(({ feature }) => ({
      feature: feature as string,
      isApplied: !bypassed.includes(feature),
    })),
    ...(customFx
      ? [{ feature: 'custom', isApplied: !bypassed.includes('custom') }]
      : []),
  ];
};

ipcMain.on(ChannelEnum.GET_APO_CONFIG_TREE, async (event) => {
  const channel = ChannelEnum.GET_APO_CONFIG_TREE;
  try {
    if (!session.configPath) {
      session.configPath = await getConfigPath();
    }
    const tree = readApoConfigTree(session.configPath);
    const reply: TSuccess<IApoConfigTree | undefined> = {
      result: tree && {
        ...tree,
        devices: tree.devices.map((device) => {
          const assignment = Object.values(
            deviceProfileSettings.assignments,
          ).find(
            (entry) =>
              (entry.deviceGuid || entry.deviceName).toLowerCase() ===
              device.devicePattern.toLowerCase(),
          );
          const layers = assignment
            ? describeDeviceLayers(assignment)
            : undefined;
          return layers ? { ...device, layers } : device;
        }),
      },
    };
    event.reply(channel, reply);
  } catch (e) {
    handleError(event, channel, ErrorCode.FAILURE, (e as Error).message);
  }
});

registerReferencesIpc({
  applyingLayer,
  handleError,
  handleUpdate,
  handleUpdateHelper,
  session,
  shieldReferenceBands,
  state,
});

registerTransferIpc({
  activePresetDir,
  applyingLayer,
  attachPresetToActiveDevice,
  availableProfileNameForActiveDevice,
  baselinePath,
  clearCurrentLayoutSettings,
  deviceProfileSettings,
  getMainWindow: () => mainWindow,
  handleError,
  handleUpdateHelper,
  hydrateActiveConvolution,
  presetDirForDevice,
  session,
  shieldReferenceBands,
  state,
});

ipcMain.on(ChannelEnum.GET_STATE, async (event) => {
  const channel = ChannelEnum.GET_STATE;
  const res = await updateConfigPath(event, channel);
  if (res) {
    if (hydrateActiveConvolution()) {
      save(state, userDataDir);
    }
    // The custom file is user-editable and intentionally not part of the
    // generated profile. Re-read it whenever the renderer asks for state so a
    // Config inspector edit is reflected in the graph without a restart.
    syncCustomFxFromConfig();
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

ipcMain.on(ChannelEnum.SET_GRAPH_VIEW, async (event, arg) => {
  // eslint-disable-next-line prefer-destructuring
  state.isGraphViewOn = arg[0];
  await handleUpdate(event, ChannelEnum.SET_GRAPH_VIEW);
});

registerPreampIpc({
  state,
  handleUpdate,
  handleUpdateHelper,
  handleError,
});

registerVideoIpc();

// The EQ chain, in two files rather than five hundred lines of this one.
//
// What each list names is what that half of the chain is able to reach. The
// bands need the layout machinery because changing the band count has to
// remember where the old ones were; the layers do not, and now cannot.
registerFiltersIpc({
  state,
  handleUpdate,
  handleUpdateHelper,
  handleError,
  doesFilterIdExist,
  captureCurrentLayout,
  getStoredLayout,
  resetEqToDefaults,
  switchToParametricEditing,
});

registerLayersIpc({
  state,
  handleUpdate,
  handleError,
  applyingLayer,
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

// What changed, and installing it. The updater goes across as a getter: it is
// built asynchronously at startup and stays unset when its signature or feed
// checks fail, so a reference captured here would be undefined forever.
registerUpdatesIpc({ getActiveAutoUpdater: () => activeAutoUpdater });

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
    // `$PSHOME` and not `'powershell.exe'`, for the reason the constant below
    // is used instead of a bare name: `Start-Process -Verb RunAs` goes through
    // ShellExecute, which searches the working directory first — and the
    // working directory here is inherited from the app, which a shortcut sets
    // to the install directory. A `powershell.exe` dropped there would be the
    // one the user is asked to approve for administrator rights.
    //
    // `Join-Path` and not a quoted `"$PSHOME\powershell.exe"`: this whole
    // string is one `-Command` argument, and a double quote inside one has to
    // survive libuv escaping it and then PowerShell re-reading the raw command
    // line. That round trip is the classic way an elevation prompt starts
    // failing for no visible reason, so there are no double quotes here at all.
    "$process = Start-Process -FilePath (Join-Path $PSHOME 'powershell.exe')",
    '-Verb RunAs -WindowStyle Hidden',
    `-ArgumentList '-NoProfile','-EncodedCommand','${restartCommand}'`,
    '-Wait -PassThru;',
    'exit $process.ExitCode',
  ].join(' ');

  return new Promise<string>((resolve) => {
    execFile(
      // Absolute, because a bare `'powershell.exe'` is resolved by libuv
      // against the CURRENT DIRECTORY before PATH — and a shortcut-launched
      // Electron app has its install directory as the current directory. This
      // particular call then asks Windows to elevate whatever it found.
      POWERSHELL_PATH,
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

/**
 * The titlebar's transport buttons, pressed on behalf of the whole machine.
 *
 * Takes a name and nothing else. The renderer never says which key to press —
 * see `mediaKeys`, where the three names are turned into the only three codes
 * this app will send, and an unrecognised name is dropped without a word.
 *
 * Returns nothing on purpose. Windows gives no answer to a media key, so there
 * is nothing honest to hand back and nothing for the window to wait on.
 */
ipcMain.handle('media-transport', async (_event, action: unknown) => {
  await sendMediaTransportKey(action);
});

const sendWindowState = () => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }
  mainWindow.webContents.send('window-state-changed', {
    isMaximized: mainWindow.isMaximized(),
    isFullScreen: mainWindow.isFullScreen(),
  });
};

// Handlers that own a subject rather than a slice of this file's scope.
//
// Everything each one can reach is in its `register` argument, so the answer to
// "what does the Karaoke tab touch in the main process" is a type signature
// instead of a reading of four thousand lines. `mainWindow` goes across as a
// getter because it is replaced over the life of the process.
registerWindowIpc({
  getMainWindow: () => mainWindow,
  sendWindowState,
});

registerKaraokeIpc({
  userDataDir,
  getMainWindow: () => mainWindow,
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

/*
 * WINDOWS' OWN DRM WAS TRIED HERE AND DOES NOT WORK. DO NOT TRY IT AGAIN.
 *
 * Spotify in the Video tab fails at play with `EMEError: No supported keysystem
 * was found`, which everyone reads as "Electron ships no Widevine CDM". True,
 * and its log shows Widevine is not the only thing it asks for on Windows: it
 * probes `com.microsoft.playready.recommendation` and `.recommendation.3000` as
 * well. PlayReady is part of Windows and nobody has to ship it, so that looked
 * like a way to the same place without a forked Electron.
 *
 * It is not, and the experiment is recorded rather than repeated:
 * `app.commandLine.appendSwitch('enable-features', 'HardwareSecureDecryption')`
 * on Chromium 150 changed nothing. Same EMEError, same `local_player_disabled`
 * after it, and the PlayReady console warnings that look like progress were
 * already there before the switch — Chromium emits those when a page *asks*
 * for the key system, not when it has one.
 *
 * The reason is the same shape as FedCM two paragraphs down. Registering the
 * PlayReady key system happens in Chrome's browser layer, not in the Chromium
 * content layer Electron builds on, so there is no switch in this process that
 * can conjure it. The upstream request to add it is open, and open is the
 * answer: castLabs' fork with production VMP signing remains the only route to
 * Spotify playback, and that is a decision about how this is built.
 */

/*
 * SAY WE DO NOT HAVE FEDCM, BECAUSE WE DO NOT REALLY HAVE FEDCM.
 *
 * Signing in to SoundCloud with a Google account fails in the player, and the
 * page's own log gives the reason: `FedCM get() rejects with NetworkError`.
 *
 * FedCM is browser-mediated by design. `navigator.credentials.get({identity})`
 * hands the whole exchange to the browser, which fetches the provider's
 * endpoints and shows its own account chooser — and that chooser lives in
 * Chrome's browser layer, not in the Chromium content layer Electron is built
 * on. So the API is present, answers, and cannot ever succeed.
 *
 * Which is the worst of the three possibilities. A site feature-detects: absent
 * means "use the old flow", working means "use this one", and present-but-
 * broken means it takes the new path and dies there — with an error that reads
 * like the network, so nobody looks at the browser.
 *
 * Turning it off is not giving something up. It is the same lesson as the user
 * agent one file over: claiming a capability we do not have is worse than
 * admitting the one we do. Google's identity library has a non-FedCM path, it
 * warns on every load that sites have not migrated to FedCM yet, and that path
 * needs a popup — which this build now allows.
 *
 * It has a shelf life. Google intend to make FedCM mandatory, and when they do
 * this stops helping and the answer becomes Electron implementing FedCM. The
 * warning in the page log is the countdown.
 */
app.commandLine.appendSwitch('disable-features', 'FedCm');

if (isDebug) {
  /*
   * SHORTCUTS AND THE INSPECT MENU, BUT NOT AN INSPECTOR ON EVERY WINDOW.
   *
   * `showDevTools` defaults to true and means "open DevTools on each created
   * BrowserWindow" — every one, including the sign-in popups the video player
   * now opens. That is worse than untidy on those: Google's abuse page lists
   * "use of developer or inspection tools" among its reasons for refusing a
   * sign-in, so the inspector opening by itself was helping to cause the
   * failure it was there to diagnose.
   *
   * Turning it off costs nothing at all, which is what makes this the right
   * place to fix it rather than closing the window's DevTools after the fact.
   * The main window opens its own further down, explicitly, in this same debug
   * branch — so this option was only ever duplicating that for the one window
   * that wanted it, and supplying it to every window that did not.
   *
   * F12 and the context menu are untouched; they come from the rest of the
   * package and still work on any window.
   */
  require('electron-debug').default({ showDevTools: false });
}

const createMainWindow = createMainWindowFactory({
  firstRunPlacement,
  isDebug,
  loadWindowState,
  saveWindowState,
  sendWindowState,
  setActiveAutoUpdater: (next) => {
    activeAutoUpdater = next;
  },
  setMainWindow: (next) => {
    mainWindow = next;
  },
  setUpAutoUpdates,
  setUpMemoryTraceTrigger,
  startMemoryProbe,
  syncDatabasesOnStartup,
});

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

app.on('before-quit', () => {
  if (apoWatchTimer !== undefined) {
    clearTimeout(apoWatchTimer);
    apoWatchTimer = undefined;
  }
  apoConfigWatcher?.close();
  apoConfigWatcher = undefined;
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
    app.setName(PRODUCT_NAME);
    if (process.platform === 'win32') {
      // Without this the taskbar attributes the window to Electron itself,
      // which is also why notifications and pinning misbehave in development.
      // Must stay equal to electron-builder's `appId`, which is why it is
      // written once, in branding.
      app.setAppUserModelId(APP_ID);
    }
    // Before any window exists, so the player's session and the rules its web
    // contents run under are in place by the time one can be attached.
    setUpVideoBrowser();
    createMainWindow().catch((error) => {
      log.error(`Failed to create the ${PRODUCT_NAME} window`, error);
    });
    app.on('activate', () => {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (mainWindow === null) {
        createMainWindow().catch((error) => {
          log.error(`Failed to create the ${PRODUCT_NAME} window`, error);
        });
      }
    });
  })
  .catch(log.error);
