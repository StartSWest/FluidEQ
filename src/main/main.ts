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
  desktopCapturer,
  dialog,
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
  stateToString,
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
  savePresetBaseline,
  repairUnusedPreamps,
} from './flush';
import MenuBuilder from './menu';
import { resolveHtmlPath, waitForRenderer } from './util';
import { getConfigPath, isEqualizerAPOInstalled } from './registry';
import { runEqualizerApoSetup } from './equalizerApoSetup';
import { gatherBugReportFacts } from './bugReportFacts';
import ChannelEnum from '../common/channels';
import { hasSmartEqLayer, smartEqFromFilters } from '../common/smartEq';
import { parseEqText } from '../common/apoText';
import { parseCustomFx } from '../common/customFx';
import { compressChainToLimit } from '../common/response';
import {
  AutoEqFormat,
  FilterTypeEnum,
  IState,
  ICustomFxSettings,
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
  IOpraUpdateStatus,
  IOpraProduct,
  AUTOMATIC_PRESET_PREFIX,
  APP_UPDATE_EVENT,
  RENDERER_READY_EVENT,
  OUTPUT_STATE_CHANGED_EVENT,
  OPRA_SOURCE_ID,
  APO_FEATURES,
  TApoFeature,
  TApoLayer,
  describeBandShape,
} from '../common/constants';
import { ErrorCode } from '../common/errors';
import {
  getFixedBandSizeForCount,
  ILayoutSnapshot,
  snapshotFilters,
} from '../common/layouts';
import { TSuccess, TError } from '../renderer/utils/equalizerApi';
import { getOpraPreset, getOpraProductList } from './opra';
import {
  checkOpraUpdate,
  syncOpraDatabase,
  updateOpraDatabase,
} from './opraUpdater';
import {
  downloadConvolution,
  getConvolutionCatalog,
} from './convolutionCatalog';
import { importConvolutionFile, importEqFile } from './importSettings';
import { setUpVideoBrowser } from './videoBrowser';
import { openExternalIfSafe } from './safeExternal';
import { registerKaraokeIpc } from './ipc/karaoke';
import { registerWindowIpc } from './ipc/window';
import { registerFiltersIpc } from './ipc/filters';
import { registerLayersIpc } from './ipc/layers';
import { registerPreampIpc } from './ipc/preamp';
import { registerVideoIpc } from './ipc/video';
import { registerProfilesIpc } from './ipc/profiles';
import { registerUpdatesIpc } from './ipc/updates';
import { adoptBlock, hasChainDrifted } from '../common/apoSync';
import {
  adoptApoFeatureText,
  describeApoFeatureText,
} from '../common/apoFeatureSync';
import {
  CHAIN_BUNDLE_EXTENSION,
  IChainBundle,
  IChainImport,
  chainBundleFileName,
  isSafeImportedCustomBlock,
  parseChainBundle,
  serializeChainBundle,
} from '../common/chainBundle';
import { readApoConfigTree, readApoDeviceChain } from './apoConfigReader';
import { IApoConfigLayer, IApoConfigTree } from '../common/apoConfig';
import { APP_ID, PRODUCT_NAME } from '../common/branding';
import {
  assignDeviceProfile,
  flushDeviceProfiles,
  IActiveStateOverride,
  getCustomFileNameForDevice,
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
  /*
   * THE REFERENCE IS NOT CLEARED HERE, BECAUSE THESE ARE NOT ITS BANDS.
   *
   * The other half of the swap recorded on CLEAR_HEADSET. Clearing the bands
   * used to mean clearing the reference, because the reference WAS the bands;
   * now it is a layer of its own and survives this untouched. What did not
   * survive was its name: `state.headphone` stayed applied and audible while
   * `headset` went to undefined, so the picker said "No reference applied" over
   * a correction that was still playing — and the only way back was to clear a
   * reference the screen insisted was not there.
   *
   * `eqImport` still goes, because that one really does describe these bands.
   */
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
let hasAdoptedExistingConfig = false;

/**
 * What we would write for the bands alone, in the shape the reader returns.
 *
 * The comparison has to be like for like. The reader hands back the device's
 * own lines plus the EQ file, so this is the same slice of what the writer
 * would produce — the convolution, the bands, and the whole-chain preamp that
 * sits in the device file beside them. Comparing the state's own fields instead
 * would report drift on FluidEQ's own output every launch, because the preamp
 * is derived, inert bands are dropped and everything is clamped on the way out.
 */
const expectedBandChain = (devicePattern: string) => {
  const files = stateToApoFiles(state, state.convolution?.fileName);
  if (!files) {
    return '';
  }
  return [
    `Device: ${devicePattern}`,
    'Channel: all',
    ...(files.convolution ? [files.convolution] : []),
    ...(files.features.find(({ feature }) => feature === 'eq')?.lines ?? []),
    files.preAmp,
  ].join('\n');
};

/**
 * Believe the config about which layers are switched off.
 *
 * A bypassed layer is one whose settings are all still there and whose
 * `Include:` is simply not written, so the config states it as plainly as it
 * states anything else: this is a feature that would be written, and it is not
 * in the file. That is what lets an A/B comparison survive a restart, which the
 * old session-only stash could not — it had to be session-only precisely
 * because a stash and a config would have been two places disagreeing about
 * what was applied.
 *
 * Compared against what would be written with nothing bypassed, because the
 * question is which of the layers this profile actually has are missing from
 * the file. A feature with nothing to say is absent from both sides and is not
 * switched off, it is empty.
 */
const adoptBypassFromConfig = (
  features: Partial<Record<TApoFeature, string>>,
  shared: string,
): boolean => {
  const wouldWrite = stateToApoFiles(
    { ...state, bypassed: undefined },
    state.convolution?.fileName,
  );
  if (!wouldWrite) {
    return false;
  }
  const bypassed: TApoLayer[] = wouldWrite.features
    .map(({ feature }) => feature)
    .filter((feature) => features[feature] === undefined);

  // The impulse is read the same way, from the one place it can be: it has no
  // file of its own, so what says it is applied is a Convolution line sitting
  // in the device file among the includes.
  if (wouldWrite.convolution && !/^\s*Convolution\s*:/im.test(shared)) {
    bypassed.push('convolution');
  }

  const next = bypassed.length ? bypassed : undefined;

  if (JSON.stringify(next) === JSON.stringify(state.bypassed)) {
    return false;
  }
  log.info(
    `Adopting the switched-off layers from the Equalizer APO config: ${
      next?.join(', ') || 'none'
    }.`,
  );
  state.bypassed = next;
  save(state, userDataDir);
  return true;
};

/**
 * Read the active output's user-owned custom file without modifying it.
 *
 * The custom Include can be bypassed, so reading only the expanded chain would
 * make the layer disappear and remove the very switch that could bring it
 * back. The file name is deterministic from the endpoint id; reading it
 * directly keeps the layer available in both states.
 */
const readCustomFxForDevice = (
  deviceId: string,
): ICustomFxSettings | undefined => {
  if (!session.configPath || !deviceId) {
    return undefined;
  }
  const fileName = getCustomFileNameForDevice(deviceId);
  try {
    const contents = fs.readFileSync(
      path.join(session.configPath, fileName),
      'utf8',
    );
    return parseCustomFx(fileName, contents);
  } catch {
    return undefined;
  }
};

const readCustomFxForActiveDevice = (): ICustomFxSettings | undefined =>
  readCustomFxForDevice(session.activeAudioDeviceId);

/** Refresh the renderer-facing description of the user-owned custom file. */
const syncCustomFxFromConfig = (): boolean => {
  const next = readCustomFxForActiveDevice();
  if (JSON.stringify(next) === JSON.stringify(state.customFx)) {
    return false;
  }
  state.customFx = next;
  return true;
};

const adoptExistingApoConfig = () => {
  if (hasAdoptedExistingConfig || !session.configPath) {
    return;
  }

  // Nothing to read until it is known which output this is about.
  //
  // The health check runs first and used to spend the one attempt here, at the
  // moment the answer was still "no endpoint yet" — which resolved to the
  // neutral `Device: all` block, the one FluidEQ writes precisely to say
  // nothing. So the whole of this ran, found an empty block, and marked itself
  // done. Deferring costs a few hundred milliseconds and is the difference
  // between a config that is read back and one that never is.
  const devicePattern =
    session.activeAudioDevice?.guid || session.activeAudioDevice?.name;
  if (!devicePattern) {
    return;
  }
  hasAdoptedExistingConfig = true;

  try {
    // This is independent of the generated feature files. It must be read
    // before any early return below, including a bypassed custom Include.
    syncCustomFxFromConfig();
    const chain = readApoDeviceChain(session.configPath, devicePattern);
    if (!chain) {
      return;
    }

    // With the features in files of their own, the bands are read on their own:
    // the device's convolution and preamp, plus the EQ file, and none of the
    // layers. Without that attribution the whole block is all there is.
    const { features } = chain;

    // First, and before any of the guards below can return: a bypassed EQ is
    // one with no file at all, so the very case this has to recognise is the
    // one the "no bands, nothing to adopt" check bows out of.
    if (features) {
      adoptBypassFromConfig(features, chain.shared ?? '');
    }

    // The measurement, if the state has lost it and the config still has it.
    //
    // Alone among the layers, Smart EQ can be read back in full: its file is
    // the correction rather than a rendering of settings that produced it. So
    // it is the one place the config-as-truth rule can protect a layer instead
    // of only describing it — whatever it was that made a measurement go
    // missing, it is still in the config and comes back here.
    //
    // Only when there is nothing to lose. A layer already in the state is the
    // newer of the two, and an absent file is not silence: it is how a
    // switched-off layer is written, which the line above has just read.
    if (features?.smart && !hasSmartEqLayer(state.smartEq)) {
      const recovered = smartEqFromFilters(
        Object.values(parseEqText(features.smart).filters),
      );
      if (recovered) {
        log.info(
          'Restoring the Smart EQ correction from the Equalizer APO config.',
        );
        state.smartEq = recovered;
        save(state, userDataDir);
      }
    }

    const adopted = adoptBlock({
      devicePattern: chain.devicePattern,
      text: features
        ? [chain.shared ?? '', features.eq ?? ''].join('\n')
        : chain.text,
    });
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
    // 2. In a flat config the voicing, driver and Smart EQ layers are written
    //    into the same numbered `Filter N:` sequence as the user's own bands,
    //    with nothing distinguishing them. If any of them is active, there is
    //    no way to tell which lines came from where, and adopting would pull
    //    the layers into the band editor as ordinary bands — where the next
    //    flush would then write the layers on top of them again. Smart EQ is
    //    the worst case: it is roughly two dozen bands, so adopting past it
    //    would double a whole measured correction rather than one small curve.
    //    This is the refusal the split exists to lift, and it now applies only
    //    where it still has to.
    const hasBands =
      Object.keys(adopted.filters).length > 0 ||
      (adopted.graphicEq?.length ?? 0) > 0;
    const hasIndistinguishableLayers =
      !features &&
      (!!state.voicing?.profileId ||
        !!state.driver?.profileId ||
        hasSmartEqLayer(state.smartEq));

    if (!hasBands || hasIndistinguishableLayers) {
      return;
    }

    const expected = features
      ? expectedBandChain(chain.devicePattern)
      : stateToString(state, state.convolution?.fileName, chain.devicePattern);
    if (!hasChainDrifted(expected, adopted)) {
      // The file says what we would have written. Nothing happened while we
      // were away.
      return;
    }

    log.info(
      `Adopting the Equalizer APO config for ${chain.devicePattern}: it no longer matches the stored state.`,
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
    state.eqImport = undefined;

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
        response:
          state.convolution?.fileName === adopted.convolutionFileName
            ? state.convolution.response
            : undefined,
        peakGainDb:
          state.convolution?.fileName === adopted.convolutionFileName
            ? state.convolution.peakGainDb
            : undefined,
        sourceId: state.convolution?.sourceId,
        sourceUrl: state.convolution?.sourceUrl,
      };
    } else {
      state.convolution = undefined;
    }

    hydrateActiveConvolution();

    save(state, userDataDir);
  } catch (error) {
    // A config we cannot read is not a reason to refuse to start. FluidEQ will
    // simply write its own over the top, which is the old behaviour.
    log.warn('Unable to read the existing Equalizer APO config', error);
  }
};

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

ipcMain.on(ChannelEnum.GET_OPRA_PRODUCT_LIST, async (event) => {
  const channel = ChannelEnum.GET_OPRA_PRODUCT_LIST;
  log.info(`Getting OPRA product list`);

  try {
    const products: IOpraProduct[] = getOpraProductList();
    log.info(`Fetched ${products.length} products`);
    const reply: TSuccess<IOpraProduct[]> = { result: products };
    event.reply(channel, reply);
  } catch (e) {
    log.error('Failed to get products');
    log.error(e);
    handleError(event, channel, ErrorCode.OPRA_READ_ERROR);
  }
});

ipcMain.on(ChannelEnum.LOAD_OPRA_PRESET, async (event, arg) => {
  const channel = ChannelEnum.LOAD_OPRA_PRESET;
  const [productId, curveId] = arg as [string, string, string?];

  try {
    const presetSettings: IPresetV2 = getOpraPreset(productId, curveId);
    /*
     * INTO ITS OWN LAYER, NOT INTO THE USER'S BANDS.
     *
     * This used to replace `state.filters` outright, which meant applying a
     * headphone reference threw away whatever tuning was there, clearing the EQ
     * threw the reference away in turn, and Smart EQ -- which measures the
     * output and cannot hear a transducer -- read the correction as error and
     * flattened it over a few passes. Three problems with one cause.
     *
     * As a layer it survives a clear, it is handed to the solver as something
     * not to correct, and the bands stay whatever the person made them.
     */
    state.headphone = {
      filters: shieldReferenceBands(presetSettings.filters),
      /*
       * No published curve here is a list of points.
       *
       * The GraphicEQ path is not gone — Squiglink exports and pasted APO text
       * still arrive that way, and the writer still prefers the curve to a fit
       * of it. OPRA simply does not publish one: every curve in the library is
       * parametric, so there is never anything to carry.
       */
      graphicEq: undefined,
      // Full strength on arrival. Somebody who wants half of a published
      // correction can say so; somebody who applied one and got half of it
      // would reasonably think it had not worked.
      intensity: 1,
    };
    // The preamp still comes from the measurement, because the correction it
    // belongs to is the one being applied. Everything else about the user's
    // stage is left alone.
    state.preAmp = presetSettings.preAmp;
    /*
     * Which curve these bands came from, and out of which database. Not
     * recoverable from the bands, and the difference between a curve you can
     * reason about and a set of numbers.
     *
     * Ids rather than the names shown on screen, because the names do not
     * identify anything: fifty-six products share a display name with another
     * product, and thirty-nine products have two curves whose descriptions read
     * identically. The picker resolves these back into names through the index
     * it already holds.
     */
    state.headset = productId;
    state.headsetTarget = curveId;
    state.headsetSource = OPRA_SOURCE_ID;
    state.headsetSignature = describeBandShape(state.headphone.filters);
    state.eqImport = undefined;
    applyingLayer('headphone');
    await handleUpdate(event, channel, false, true);
  } catch (ex) {
    log.info(`Failed to load OPRA curve ${curveId} for ${productId}`);
    log.info(ex);
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
    log.error('Failed to get convolution catalogue', error);
    handleError(event, channel, ErrorCode.CONVOLUTION_CATALOG_ERROR);
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
    if (!session.configPath) {
      session.configPath = await getConfigPath();
    }
    applyingLayer('convolution');
    state.convolution = await downloadConvolution(entryId, session.configPath);
    await handleUpdate(event, channel, false, true);
  } catch (error) {
    log.error('Failed to download convolution profile', error);
    handleError(event, channel, ErrorCode.CONVOLUTION_CATALOG_ERROR);
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
  /*
   * CLEARS THE CORRECTION, NOT THE PERSON'S BANDS.
   *
   * It called `resetEqToDefaults`, which was right while a reference WAS the
   * bands: clearing one meant flattening them. Now that the correction is a
   * layer of its own the two have swapped places, and left alone this did
   * exactly the wrong thing in both directions at once — wiped a tuning it no
   * longer owns, and left the correction playing with nothing on screen naming
   * it.
   *
   * Found by the agent moving this button to its new page rather than by
   * anything here, which is worth recording: splitting a layer out leaves every
   * "clear it" path pointing at the old address.
   */
  applyingLayer('headphone');
  state.headphone = undefined;
  state.headset = undefined;
  state.headsetTarget = undefined;
  state.headsetSource = undefined;
  state.headsetSignature = undefined;
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
  applyingLayer('convolution');
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
    state.filters = shieldReferenceBands(imported.filters);
    state.eqFormat = imported.eqFormat;
    state.graphicEq = imported.graphicEq;
    applyingLayer('eq');
    // These bands came from a file, not from a measured model.
    state.headset = undefined;
    state.headsetTarget = undefined;
    state.headsetSource = undefined;
    state.eqImport = undefined;
    // An imported EQ is a tuning, so the flat flag has to come off or the
    // bands would be parsed, stored, and then not written.
    state.isFlat = false;
    await handleUpdateHelper<string>(
      event,
      channel,
      imported.unsupported > 0
        ? `Imported ${Object.keys(imported.filters).length} bands from the ${imported.sourceLabel}. ${imported.unsupported} band(s) used a filter type ${PRODUCT_NAME} cannot edit and were skipped.`
        : `Imported ${Object.keys(imported.filters).length} bands from the ${imported.sourceLabel}.`,
      false,
      true,
    );
  } catch (error) {
    log.error('Failed to import EQ settings', error);
    handleError(
      event,
      channel,
      ErrorCode.IMPORT_ERROR,
      error instanceof Error ? error.message : undefined,
    );
  }
});

ipcMain.on(ChannelEnum.IMPORT_EQ_TEXT, async (event, arg) => {
  const channel = ChannelEnum.IMPORT_EQ_TEXT;
  try {
    const text = arg?.[0];
    const label =
      typeof arg?.[1] === 'string' ? arg[1].trim().slice(0, 240) : '';
    if (typeof text !== 'string' || !text.trim()) {
      throw new Error('Paste a Squiglink EQ export before importing it.');
    }
    if (Buffer.byteLength(text, 'utf8') > 4 * 1024 * 1024) {
      throw new Error('That EQ export is too large to import.');
    }

    const parsed = parseEqText(text);
    if (parsed.isEmpty) {
      throw new Error(
        'No Equalizer APO filters were found. Copy the exported ParametricEQ or GraphicEQ text from Squiglink.',
      );
    }

    clearCurrentLayoutSettings();
    state.preAmp = parsed.preAmp;
    // A preamp in the file is a decision, and automatic normalization would
    // quietly overrule it: the value lands in `preAmp`, the flush recomputes
    // from the chain, and what plays is FluidEQ's number rather than the one in
    // the export. Nothing said so. Whoever pasted a text that opens with
    // `Preamp: -19 dB` asked for -19, so automatic mode steps aside and the
    // import result says it did. Turning it back on is one click and now keeps
    // its value on the way out.
    if (parsed.hasPreAmp) {
      state.isAutoPreAmpOn = false;
    }
    state.filters = shieldReferenceBands(parsed.filters);
    state.eqFormat = parsed.eqFormat;
    state.graphicEq = parsed.graphicEq;
    state.isFlat = false;
    state.headset = undefined;
    state.headsetTarget = undefined;
    state.headsetSource = undefined;
    state.eqImport = {
      source: 'squiglink',
      sourceUrl: 'https://squig.link/',
      label: label || 'Squiglink export',
      eqFormat: parsed.eqFormat,
      filterCount: Object.keys(parsed.filters).length,
      text,
    };
    applyingLayer('eq');

    await handleUpdateHelper<string>(
      event,
      channel,
      [
        `Imported ${Object.keys(parsed.filters).length} bands from the Squiglink export.`,
        parsed.unsupported > 0
          ? `${parsed.unsupported} band(s) could not be edited in ${PRODUCT_NAME} and were skipped.`
          : '',
        // Said out loud, because a switch changing itself is worse than a
        // switch that did not, unless it tells you.
        parsed.hasPreAmp
          ? `Its ${parsed.preAmp} dB preamp was kept, so Auto normalize is off.`
          : '',
      ]
        .filter(Boolean)
        .join(' '),
      false,
      true,
    );
  } catch (error) {
    log.error('Failed to import Squiglink EQ text', error);
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

    if (!session.configPath) {
      session.configPath = await getConfigPath();
    }
    applyingLayer('convolution');
    state.convolution = importConvolutionFile(sourcePath, session.configPath);
    await handleUpdateHelper<string>(
      event,
      channel,
      `Applied ${state.convolution.name}.`,
      false,
      true,
    );
  } catch (error) {
    log.error('Failed to import a convolution file', error);
    handleError(
      event,
      channel,
      ErrorCode.IMPORT_ERROR,
      error instanceof Error ? error.message : undefined,
    );
  }
});

/**
 * One output's whole chain, out to a file somebody can send to somebody else.
 *
 * The profile rather than the generated files — see `common/chainBundle` for
 * why moving the files themselves cannot work. The custom file travels
 * literally, because it is the only part of a chain FluidEQ does not generate
 * and so the only part that cannot be rebuilt at the other end.
 *
 * Named by `devicePattern` rather than by endpoint id, because that is what the
 * config panel has to offer: it reads the config off disk, and what a `Device:`
 * line carries is a GUID or a name, never the id Windows uses internally. Same
 * match the tree handler makes.
 */
ipcMain.on(ChannelEnum.EXPORT_DEVICE_CHAIN, async (event, arg) => {
  const channel = ChannelEnum.EXPORT_DEVICE_CHAIN;
  const devicePattern = arg?.[0];
  if (typeof devicePattern !== 'string' || !devicePattern) {
    handleError(event, channel, ErrorCode.INVALID_PARAMETER);
    return;
  }

  try {
    const assignment = Object.values(deviceProfileSettings.assignments).find(
      (entry) =>
        (entry.deviceGuid || entry.deviceName).toLowerCase() ===
        devicePattern.toLowerCase(),
    );
    if (!assignment) {
      handleError(event, channel, ErrorCode.INVALID_PARAMETER);
      return;
    }

    const preset = fetchPreset(
      assignment.presetName,
      presetDirForDevice(assignment.deviceId),
    );
    let custom: string | undefined;
    try {
      if (!session.configPath) {
        session.configPath = await getConfigPath();
      }
      custom = fs.readFileSync(
        path.join(
          session.configPath,
          getCustomFileNameForDevice(assignment.deviceId),
        ),
        'utf8',
      );
    } catch {
      // An output that has never had one simply exports without it.
    }

    const bundle: IChainBundle = {
      version: 1,
      exportedFrom: assignment.deviceName,
      exportedAt: new Date().toISOString(),
      preset,
      custom,
    };

    const saveOptions = {
      title: 'Export this chain',
      defaultPath: chainBundleFileName(assignment.deviceName),
      filters: [
        { name: `${PRODUCT_NAME} chain`, extensions: [CHAIN_BUNDLE_EXTENSION] },
      ],
    };
    const target = mainWindow
      ? await dialog.showSaveDialog(mainWindow, saveOptions)
      : await dialog.showSaveDialog(saveOptions);

    if (target.canceled || !target.filePath) {
      // Cancelling is a normal outcome rather than a failure.
      const reply: TSuccess<string> = { result: '' };
      event.reply(channel, reply);
      return;
    }

    fs.writeFileSync(target.filePath, serializeChainBundle(bundle), 'utf8');
    const reply: TSuccess<string> = {
      result: `Exported the chain for ${assignment.deviceName}.`,
    };
    event.reply(channel, reply);
  } catch (e) {
    handleError(event, channel, ErrorCode.FAILURE, (e as Error).message);
  }
});

/**
 * A chain from a file, onto the output being listened on.
 *
 * Onto the ACTIVE output deliberately, rather than onto whichever card was
 * clicked. Importing is the one direction that changes what is heard, and
 * "apply this to what I am listening to" is a sentence somebody can check
 * against their own ears at the moment they say it. Writing a chain onto an
 * output that is not playing is a change nobody can verify.
 *
 * The bundle's own `exportedFrom` is never consulted for this: a chain exported
 * from one person's headphones is meant to be usable on another's.
 */
ipcMain.on(ChannelEnum.IMPORT_DEVICE_CHAIN, async (event) => {
  const channel = ChannelEnum.IMPORT_DEVICE_CHAIN;
  try {
    if (!session.activeAudioDeviceId) {
      handleError(
        event,
        channel,
        ErrorCode.FAILURE,
        'No output is active, so there is nothing to import onto.',
      );
      return;
    }

    const sourcePath = await showImportDialog('Import a chain', [
      { name: `${PRODUCT_NAME} chain`, extensions: [CHAIN_BUNDLE_EXTENSION] },
      { name: 'All files', extensions: ['*'] },
    ]);
    if (!sourcePath) {
      const reply: TSuccess<IChainImport> = {
        result: { note: '', isCustomSkipped: false },
      };
      event.reply(channel, reply);
      return;
    }

    const bundle = parseChainBundle(
      JSON.parse(fs.readFileSync(sourcePath, 'utf8')),
    );
    if (!bundle) {
      handleError(
        event,
        channel,
        ErrorCode.IMPORT_ERROR,
        `That file is not a ${PRODUCT_NAME} chain.`,
      );
      return;
    }

    // Named for where it is going rather than where it came from, because the
    // profile list is indexed by that and it is what the user will look for.
    const name = availableProfileNameForActiveDevice(
      session.activeAudioDevice?.name || session.activeAudioDeviceId,
    );
    savePreset(name, bundle.preset, activePresetDir());
    savePresetBaseline(name, bundle.preset, baselinePath);
    attachPresetToActiveDevice(name);

    // The one part of a bundle that is not a tuning but a program. Everything
    // else here has been through the preset schema; this is text on its way to
    // a file Equalizer APO includes, so it is asked first — see
    // `isSafeImportedCustomBlock` for what is refused and why.
    let isCustomSkipped = false;
    if (bundle.custom !== undefined) {
      if (isSafeImportedCustomBlock(bundle.custom)) {
        if (!session.configPath) {
          session.configPath = await getConfigPath();
        }
        // Over the top of this output's own custom file, which is the only part
        // of an import that destroys something written by hand. It is also the
        // only honest reading of "import this chain": leaving the old one would
        // apply somebody else's chain plus your own additions, which is a third
        // thing neither of you has ever heard.
        fs.writeFileSync(
          path.join(
            session.configPath,
            getCustomFileNameForDevice(session.activeAudioDeviceId),
          ),
          bundle.custom,
          'utf8',
        );
      } else {
        // And a refused block does NOT clear the file it was going to replace.
        // Overwriting is what an accepted import earns; doing it for a refused
        // one would hand a stranger a way to wipe somebody's hand-written file
        // by sending a bundle that was never going to be applied. The chain is
        // a hybrid afterwards — theirs, plus your own last line — and the note
        // below says so, which is better than silently deleting your work.
        isCustomSkipped = true;
      }
    }

    // Field by field, like loading a profile, because `state` is the live one
    // rather than a value to swap: every reader here holds the same object.
    clearCurrentLayoutSettings();
    state.preAmp = bundle.preset.preAmp;
    state.filters = bundle.preset.filters;
    state.eqFormat = bundle.preset.eqFormat;
    state.graphicEq = bundle.preset.graphicEq;
    state.convolution = bundle.preset.convolution;
    hydrateActiveConvolution();
    state.isFlat = bundle.preset.isFlat;
    state.voicing = bundle.preset.voicing;
    state.driver = bundle.preset.driver;
    state.smartEq = bundle.preset.smartEq;
    state.headset = bundle.preset.headset;
    state.headsetTarget = bundle.preset.headsetTarget;
    state.headsetSource = bundle.preset.headsetSource;
    state.headsetSignature = bundle.preset.headsetSignature;
    state.eqImport = bundle.preset.eqImport;
    /*
     * The headphone layer, which this list forgot when the layer was added.
     *
     * Three other sites copy a preset onto the live state and all three carry
     * it; only this one did not, so importing a chain silently dropped the
     * correction it was carrying. Worse than dropped: `headsetSignature` two
     * lines up WAS copied, so the layers strip then described a correction
     * against bands that had never produced it.
     *
     * And it did not stop at this run. `handleUpdateHelper` re-saves the
     * profile from `getCurrentPreset()`, which reads the live state — so the
     * correct file this import had just written to disk was immediately
     * overwritten from a state still holding the PREVIOUS output's correction.
     * The imported profile was destroyed by the act of importing it.
     *
     * The comment above this block names the invariant it broke, and the one on
     * `getCurrentPreset` says a miss of exactly this kind "was missed for
     * months". Both were right and neither was enough; a test is, so there is
     * one now.
     */
    state.headphone = bundle.preset.headphone;
    state.bypassed = bundle.preset.bypassed;

    await handleUpdateHelper<IChainImport>(
      event,
      channel,
      {
        note: `Imported the chain${
          bundle.exportedFrom ? ` from ${bundle.exportedFrom}` : ''
        }.`,
        isCustomSkipped,
      },
      true,
    );
  } catch (e) {
    handleError(
      event,
      channel,
      ErrorCode.IMPORT_ERROR,
      e instanceof Error ? e.message : undefined,
    );
  }
});

ipcMain.on(ChannelEnum.CHECK_OPRA_UPDATE, async (event) => {
  const channel = ChannelEnum.CHECK_OPRA_UPDATE;
  try {
    const reply: TSuccess<IOpraUpdateStatus> = {
      result: await checkOpraUpdate(),
    };
    event.reply(channel, reply);
  } catch (error) {
    log.warn('Unable to check for an OPRA database update', error);
    handleError(event, channel, ErrorCode.OPRA_READ_ERROR);
  }
});

ipcMain.on(ChannelEnum.UPDATE_OPRA_DATABASE, async (event) => {
  const channel = ChannelEnum.UPDATE_OPRA_DATABASE;
  try {
    const reply: TSuccess<IOpraUpdateStatus> = {
      result: await updateOpraDatabase(),
    };
    event.reply(channel, reply);
  } catch (error) {
    log.error('Unable to update the OPRA database', error);
    handleError(event, channel, ErrorCode.OPRA_READ_ERROR);
  }
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

const installExtensions = async () => {
  const installer = require('electron-devtools-installer');
  const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
  const extensions = ['REACT_DEVELOPER_TOOLS'];

  return installer
    .default(
      extensions.map((name) => installer[name]),
      forceDownload,
    )
    .catch(log.error);
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
  const isFirstRun = restored.width === undefined;
  const firstRun = firstRunPlacement();

  mainWindow = new BrowserWindow({
    show: false,
    width: restored.width ?? firstRun.width,
    minWidth: WINDOW_MIN_WIDTH,
    height: restored.height ?? firstRun.height,
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

  const rendererUrl = resolveHtmlPath('index.html');
  const appSession = mainWindow.webContents.session;

  // Permission requests from FluidEQ's own renderer are deliberate UI
  // actions. In particular, Karaoke's mic switch must be able to complete the
  // getUserMedia handshake instead of depending on Electron's implicit
  // permission default. Remote Media pages use a different, locked-down
  // session in videoBrowser.ts, so this grant cannot leak into web content.
  const isOwnMainFrame = (
    contents: Electron.WebContents | null,
    details: { isMainFrame: boolean },
  ) => contents === mainWindow?.webContents && details.isMainFrame;
  appSession.setPermissionRequestHandler(
    (contents, _permission, callback, details) => {
      callback(isOwnMainFrame(contents, details));
    },
  );
  appSession.setPermissionCheckHandler(
    (contents, _permission, _origin, details) =>
      isOwnMainFrame(contents, details),
  );

  // Keep the app session's normal Electron media handling. Chromium reports
  // the analyser's display-loopback handshake as a mixed media request even
  // though FluidEQ immediately discards its required video track. Applying an
  // audio-only policy to this session therefore disables the live spectrum.
  // Remote Media pages remain isolated in VIDEO_BROWSER_PARTITION, whose
  // permission and display-capture handlers are default-deny (videoBrowser.ts).
  appSession.setDisplayMediaRequestHandler((request, callback) => {
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
            // The window title, which is the product name. Derived from it
            // rather than spelled out, so a rename does not silently lose
            // the fallback and start capturing an arbitrary window.
            candidate.name.toLowerCase().includes(PRODUCT_NAME.toLowerCase()),
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
  });

  // Nothing to do on a first run any more. This used to force the graph-view
  // height when there was no saved size, which is what pushed the window off
  // the bottom of the screen; the first-run size is now nine tenths of the work
  // area, which has room for the graph without being told. A saved size is a
  // decision the user made and was never overridden here. Toggling the graph
  // in-session still resizes.

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
      // size and then visibly snap outward. A first run on a screen below 2K
      // takes the same path, for the same reason.
      if (restored.isMaximized || (isFirstRun && firstRun.maximize)) {
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

  mainWindow.webContents.on('did-finish-load', sendWindowState);
  // Polling for the dev server is an optimisation, not a gate. Giving up used
  // to throw out of createMainWindow with nothing to catch it, so a slow bundle
  // produced an unhandled rejection and no window at all — while
  // webpack-dev-middleware was perfectly willing to hold the request until the
  // bundle finished. Load either way and let that happen.
  await waitForRenderer(rendererUrl).catch((error) => {
    log.warn(
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
    log.warn('Database startup synchronization failed', error);
  });

  const menuBuilder = new MenuBuilder(mainWindow);
  menuBuilder.buildMenu();

  // Open urls in the user's browser, if they are urls for a browser.
  //
  // `edata.url` is whatever asked for the window — a `target="_blank"` link, a
  // `window.open`. Plenty of what this renderer draws did not originate here:
  // lyrics, profile names, changelog text, rows from a synced measurement
  // database. Handing any of that to the OS unchecked is how `file:` and every
  // registered custom protocol become reachable, so the scheme is checked the
  // same way the Remote Media player has always checked it.
  mainWindow.webContents.setWindowOpenHandler((edata) => {
    openExternalIfSafe(edata.url);
    return { action: 'deny' };
  });

  setUpAutoUpdates().catch((error) => {
    // A setup failure is still a disabled updater. Never recover by loading it
    // without the signature and feed checks that just failed.
    activeAutoUpdater = undefined;
    log.warn('Updates disabled: updater setup failed closed.', error);
  });
  startMemoryProbe();
  setUpMemoryTraceTrigger();
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
