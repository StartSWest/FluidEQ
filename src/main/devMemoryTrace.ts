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

import { app, BrowserWindow, contentTracing } from 'electron';
import log from 'electron-log';
import path from 'path';
import ChannelEnum from '../common/channels';
import onWindowMessage from './ipc/windowMessages';
import watchTraceSentinels from './traceSentinels';

/**
 * Ask Chromium itself where the memory went.
 *
 * The probe below can say the renderer is growing while its JS heap and its
 * DOM are not, which is enough to rule our own objects out and nothing like
 * enough to say what is actually holding it. Only Chromium knows that, and
 * memory-infra is how it will say: every subsystem that tracks its own
 * allocations — cc/tile_memory, skia, partition_alloc, discardable, malloc —
 * reports into a periodic dump, and the row that grows between the first dump
 * and the last is the answer.
 *
 * Stopped by whoever started it — the button, the sentinel file below — or by
 * the app quitting, which writes what was recorded rather than losing it
 * (`before-quit`). There used to be a five-minute deadline as well, for a
 * trace nobody remembered to stop; the buffer is a ring (below), so a
 * forgotten one costs its dumps' overhead until it is stopped, and never the
 * disk. The dumps are expensive enough that Chromium's own documentation
 * calls the category high-overhead, which is why it is never started at
 * launch.
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

export interface IDevMemoryTrace {
  /** The window's renderer by pid, and the first reading. */
  startMemoryProbe: () => void;
  /** Writes what a recording still running holds; `before-quit` waits on it. */
  stopMemoryTrace: () => Promise<void>;
  /**
   * The trace's other switch: files dropped next to the log
   * (`traceSentinels.ts`), for when focus is somewhere the button cannot be
   * pressed from.
   */
  setUpMemoryTraceTrigger: () => void;
}

/**
 * The memory probe and the memory trace. Development only, both of them.
 *
 * The window is asked for through a getter because it is replaced over the
 * life of the process. Registers the window's toggle for the trace.
 */
const registerDevMemoryTrace = (
  getMainWindow: () => BrowserWindow | null,
): IDevMemoryTrace => {
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
   * Taken at the moments somebody marks — the window opening, and every start
   * and stop of the memory trace below, which is how a developer says "now" —
   * and never on a clock. It used to be a reading every fifteen seconds, a timer
   * in aid of a question only a developer is asking; the trace is the tool that
   * answers "what grew between here and there", and Chromium takes its dumps
   * on its own cadence.
   */
  const logMemorySnapshot = (moment: string) => {
    const mainWindow = getMainWindow();
    if (
      process.env.NODE_ENV !== 'development' ||
      !mainWindow ||
      mainWindow.isDestroyed()
    ) {
      return;
    }
    const appRendererPid = mainWindow.webContents.getOSProcessId();
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
    mainWindow.webContents
      .executeJavaScript(
        // Node count alongside the heap, because "process grows, heap flat" has
        // two very different explanations and this tells them apart: DOM piling
        // up inside the document, or something the page never sees — detached
        // nodes, retained paint, decoded images.
        '(() => { const m = performance.memory; const h = m ? Math.round(m.usedJSHeapSize / 1048576) + "/" + Math.round(m.totalJSHeapSize / 1048576) : "n/a"; return h + "MB nodes=" + document.getElementsByTagName("*").length; })()',
        true,
      )
      .then((heap) => log.info(`[mem] ${moment}: ${rows} jsHeap*=${heap}`))
      .catch(() => log.info(`[mem] ${moment}: ${rows}`));
  };

  const startMemoryProbe = () => {
    const mainWindow = getMainWindow();
    if (process.env.NODE_ENV !== 'development' || !mainWindow) {
      return;
    }
    log.info(
      `[mem] app renderer pid=${mainWindow.webContents.getOSProcessId()}`,
    );
    logMemorySnapshot('window open');
  };

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
   * Pushed rather than returned, because the recording can also be started and
   * stopped without the button — by the sentinel files below — and a button
   * whose label only updates when it is pressed would sit there claiming to be
   * recording long after the trace had been written.
   */
  const publishTraceState = (detail?: string) => {
    getMainWindow()?.webContents.send(ChannelEnum.TOGGLE_MEMORY_TRACE, {
      result: { isRecording: isTracing, detail },
    });
  };

  const stopMemoryTrace = async () => {
    if (!isTracing || isTraceBusy) {
      return;
    }
    isTraceBusy = true;
    isTracing = false;
    logMemorySnapshot('trace stop');
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
        '[trace] recording memory-infra — press again, or drop trace.stop, to stop',
      );
      logMemorySnapshot('trace start');
      publishTraceState('Recording');
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
  onWindowMessage(ChannelEnum.TOGGLE_MEMORY_TRACE, () => {
    if (process.env.NODE_ENV !== 'development') {
      return;
    }
    startMemoryTrace();
  });

  const setUpMemoryTraceTrigger = () => {
    const mainWindow = getMainWindow();
    if (process.env.NODE_ENV !== 'development' || !mainWindow) {
      return;
    }
    const stopWatching = watchTraceSentinels(
      path.join(app.getPath('userData'), 'logs'),
      {
        start: startMemoryTrace,
        stop: stopMemoryTrace,
        isBusy: () => isTraceBusy,
        log: (line) => log.info(line),
      },
    );
    mainWindow.on('closed', stopWatching);
  };

  return { startMemoryProbe, stopMemoryTrace, setUpMemoryTraceTrigger };
};

export default registerDevMemoryTrace;
