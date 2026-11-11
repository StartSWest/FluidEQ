/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/
import net from 'net';
import { ipcMain, WebContents } from 'electron';
import log from 'electron-log';
import { normaliseEndpointGuid } from '../common/engineHealth';
import {
  ENGINE_ANALYSIS_CHANNEL,
  IEngineAnalysis,
} from '../common/dsp/engineAnalysis';
import decodeEngineAnalysis from './dspHost/engineAnalysis';
import { ANALYSIS_MAX_FRAME_BYTES } from '../common/dsp/analysisWire';
import { ENGINE_PREAMP_CHANNEL, IEnginePreamp } from '../common/enginePreamp';

const PIPE = '\\\\.\\pipe\\FluidEQ-Engine-Analysis';
const MAX_FRAME = ANALYSIS_MAX_FRAME_BYTES;
const GUID = /^\{?[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}\}?$/i;
/** "FEQS", the process-stats reply's magic in `analysis_link.cpp`. */
const STATS_MAGIC = 0x53514546;
const STATS_SIZE = 24;

/** What the process hosting the FluidEQ Engine costs, as it measured itself. */
export interface IEngineProcessStats {
  pid: number;
  workingSetBytes: number;
  cpuSeconds: number;
}

/** A frame (1) or the preamp (2); the stats request (3) has its own slot. */
type TCommand = 1 | 2;

interface ISource {
  socket: net.Socket;
  endpoint?: string;
  rate: number;
  pending: boolean;
  enabled: boolean;
  active: boolean;
  latest?: IEngineAnalysis;
  supportsPreamp?: boolean;
  preampPending?: boolean;
  preamp?: IEnginePreamp;
  /** Said by the handshake: this engine answers the process-stats request. */
  supportsStats?: boolean;
  statsPending?: boolean;
  /** Stats asked for while another request was on the wire. */
  statsQueued?: boolean;
  /** Everyone waiting for this connection's next stats answer. */
  statsWaiters: ((stats: IEngineProcessStats | undefined) => void)[];
  queued?: TCommand;
}

/** Every engine connection: the DSP page reads them, and `measureEngineProcesses`. */
const sources = new Set<ISource>();

/** One request on the wire; each connection carries one at a time. */
const send = (source: ISource, command: TCommand | 3) => {
  source.pending = true;
  source.preampPending = command === 2;
  source.statsPending = command === 3;
  if (command === 1) {
    source.enabled = true;
  }
  source.socket.write(Buffer.from([command]));
};

const requestFrame = (source: ISource, command: TCommand) => {
  if (source.pending) {
    const inFlight = source.preampPending ? 2 : 1;
    if (source.statsPending || inFlight !== command) {
      source.queued = command;
    }
    return;
  }
  send(source, command);
};

/**
 * Asked in a slot of its own, so a frame or a preamp request already waiting
 * can never push it out. It used to share their one slot and was simply not
 * sent when the DSP page had a frame queued, which left whoever was waiting
 * on the number with the answer to some earlier question.
 */
const requestStats = (source: ISource) => {
  if (source.statsPending || source.statsQueued) {
    return;
  }
  if (source.pending) {
    source.statsQueued = true;
    return;
  }
  send(source, 3);
};

/**
 * What the processes the FluidEQ Engine runs in have cost up to now, one
 * entry per process, answered by each of them when asked.
 *
 * NOW, NOT AT THE PREVIOUS QUESTION. This used to hand back whatever the
 * engine had said the last time it was asked and ask again for next time, so
 * every reading of audiodg's processor time was the one taken at the reading
 * before. The performance log books the difference between two readings to
 * what was on screen between them, which put each stretch's audio service
 * time in the stretch after it: in a 2.4.0 report a 168.9-minute stretch with
 * music playing showed none at all, and the 0.6 minutes after it 1862% of one
 * core — the whole 168.9 minutes, divided by 36 seconds. Over the report as a
 * whole audiodg had used about a quarter of a core.
 *
 * The engine answers on its own thread from lock-free meter reads
 * (`analysis_link.cpp`), so the wait is milliseconds; a connection that
 * closes answers with nothing and is left out.
 *
 * Every output the engine runs on holds a connection, and on an ordinary
 * machine they all live in the one audiodg.exe — so the answers are keyed by
 * process id, or the same audio service would be listed, and its memory
 * added to the total, once per output. Only a connection whose handshake said
 * it can answer is asked: an older engine reads the question as "meters off"
 * and never replies, which would hold that connection's one request slot —
 * the DSP page's measurements with it — and this wait, for good.
 */
export const measureEngineProcesses = async (): Promise<
  IEngineProcessStats[]
> => {
  const answers = await Promise.all(
    [...sources]
      .filter((source) => source.endpoint !== undefined && source.supportsStats)
      .map(
        (source) =>
          new Promise<IEngineProcessStats | undefined>((resolve) => {
            source.statsWaiters.push(resolve);
            requestStats(source);
          }),
      ),
  );
  const byPid = new Map<number, IEngineProcessStats>();
  answers.forEach((stats) => {
    const known = stats ? byPid.get(stats.pid) : undefined;
    if (stats && (!known || stats.cpuSeconds > known.cpuSeconds)) {
      byPid.set(stats.pid, stats);
    }
  });
  return [...byPid.values()];
};

/** Hands one answer, or none, to everyone waiting on this connection. */
const answerStats = (
  source: ISource,
  stats: IEngineProcessStats | undefined,
) => {
  source.statsWaiters.splice(0).forEach((resolve) => resolve(stats));
};

// Pull only while the DSP surface is painting. A single outstanding request
// per endpoint bounds both IPC traffic and the pipe's queue under backpressure.
const startEngineAnalysisPipe = (
  getWindow: () => { webContents: WebContents } | null,
): Promise<void> => {
  if (process.platform !== 'win32') {
    return Promise.resolve();
  }
  ipcMain.handle(ENGINE_PREAMP_CHANNEL, (event, endpoint: unknown) => {
    if (
      event.sender !== getWindow()?.webContents ||
      typeof endpoint !== 'string' ||
      !GUID.test(endpoint)
    ) {
      return undefined;
    }
    const target = normaliseEndpointGuid(endpoint);
    let result: IEnginePreamp | undefined;
    sources.forEach((source) => {
      if (source.endpoint !== target || !source.supportsPreamp) {
        return;
      }
      if (
        source.preamp &&
        (!result ||
          (source.preamp.active &&
            (!result.active || source.preamp.gainDb < result.gainDb)))
      ) {
        result = source.preamp;
      }
      requestFrame(source, 2);
    });
    return result;
  });
  let wanted: string | undefined;
  let owner: WebContents | undefined;
  const disable = () => {
    wanted = undefined;
    sources.forEach((source) => {
      if (source.enabled) {
        source.socket.write(Buffer.from([0]));
      }
      source.enabled = false;
      source.active = false;
      source.latest = undefined;
      if (source.queued === 1) {
        source.queued = undefined;
      }
    });
  };
  ipcMain.handle(ENGINE_ANALYSIS_CHANNEL, (event, endpoint: unknown) => {
    if (event.sender !== getWindow()?.webContents) {
      return undefined;
    }
    if (owner !== event.sender) {
      owner = event.sender;
      owner.once('destroyed', disable);
      owner.on('render-process-gone', disable);
      owner.on('did-start-loading', disable);
    }
    if (endpoint === null) {
      disable();
      return undefined;
    }
    if (typeof endpoint !== 'string' || !GUID.test(endpoint)) {
      return undefined;
    }
    const next = normaliseEndpointGuid(endpoint);
    if (wanted !== next) {
      disable();
    }
    wanted = next;
    let result: IEngineAnalysis | undefined;
    let connected = false;
    sources.forEach((source) => {
      if (source.endpoint !== wanted) {
        return;
      }
      connected = connected || source.active;
      // Some drivers instantiate more than one APO on an endpoint. Prefer
      // the stream carrying signal rather than letting an idle one blank it.
      if (
        source.latest &&
        (!result ||
          Math.max(...source.latest.frame.peaks) >
            Math.max(...result.frame.peaks))
      ) {
        result = source.latest;
      }
      source.latest = undefined;
      requestFrame(source, 1);
    });
    return connected ? result : null;
  });

  const server = net.createServer((socket) => {
    const source: ISource = {
      socket,
      rate: 0,
      pending: false,
      enabled: false,
      active: false,
      statsWaiters: [],
    };
    sources.add(source);
    let buffered = Buffer.alloc(0);
    socket.on('data', (data: Buffer) => {
      buffered = Buffer.concat([buffered, data]);
      if (buffered.length > MAX_FRAME + 48) {
        socket.destroy();
        return;
      }
      if (source.endpoint === undefined) {
        if (buffered.length < 44) {
          return;
        }
        const endpoint = buffered
          .subarray(0, 40)
          .toString('ascii')
          .replace(/\0.*$/, '');
        const rate = buffered.readUInt32LE(40);
        if (!GUID.test(endpoint) || rate < 8_000 || rate > 384_000) {
          socket.destroy();
          return;
        }
        source.endpoint = normaliseEndpointGuid(endpoint);
        // A bit per thing the engine can answer, in the byte after the GUID's
        // terminator (`analysis_link.cpp`). Engines before 1.8 send exactly 1.
        const capabilities = buffered[39];
        source.supportsPreamp = capabilities % 2 === 1;
        source.supportsStats = Math.floor(capabilities / 2) % 2 === 1;
        source.rate = rate;
        buffered = buffered.subarray(44);
      }
      while (buffered.length >= 4) {
        const size = buffered.readUInt32LE(0);
        if (source.preampPending) {
          if (size !== 12) {
            socket.destroy();
            return;
          }
          if (buffered.length < 16) {
            return;
          }
          const gainDb = buffered.readFloatLE(8);
          const flags = buffered.readUInt32LE(12);
          if (
            buffered.readUInt32LE(4) !== 0x50414546 ||
            !Number.isFinite(gainDb) ||
            gainDb > 0 ||
            gainDb < -240 ||
            flags > 3
          ) {
            socket.destroy();
            return;
          }
          source.preamp = {
            gainDb,
            enabled: flags % 2 === 1,
            active: flags >= 2,
          };
          source.preampPending = false;
          source.pending = false;
          buffered = buffered.subarray(16);
        } else if (source.statsPending) {
          if (size !== STATS_SIZE) {
            socket.destroy();
            return;
          }
          if (buffered.length < STATS_SIZE + 4) {
            return;
          }
          const pid = buffered.readUInt32LE(8);
          const workingSetBytes = Number(buffered.readBigUInt64LE(12));
          // CPU time arrives in the 100 ns ticks `GetProcessTimes` counts in.
          const cpuSeconds = Number(buffered.readBigUInt64LE(20)) / 1e7;
          if (buffered.readUInt32LE(4) !== STATS_MAGIC || pid === 0) {
            socket.destroy();
            return;
          }
          source.statsPending = false;
          source.pending = false;
          buffered = buffered.subarray(STATS_SIZE + 4);
          answerStats(source, { pid, workingSetBytes, cpuSeconds });
        } else if (size === 0xffffffff && source.pending) {
          source.pending = false;
          source.active = false;
          source.latest = undefined;
          buffered = buffered.subarray(4);
        } else {
          if (size > MAX_FRAME || !source.pending) {
            socket.destroy();
            return;
          }
          if (buffered.length < size + 4) {
            return;
          }
          source.pending = false;
          source.active = true;
          if (size > 0) {
            const payload = buffered.subarray(4, size + 4);
            const frame = decodeEngineAnalysis(payload);
            if (!frame) {
              socket.destroy();
              return;
            }
            if (source.enabled && source.endpoint === wanted) {
              source.latest = { sampleRate: source.rate, frame };
            }
          }
          buffered = buffered.subarray(size + 4);
        }
        // Stats first: somebody is waiting on them, and a frame asked a
        // millisecond later is still the DSP page's next frame.
        if (!source.pending && source.statsQueued) {
          source.statsQueued = false;
          send(source, 3);
        } else if (!source.pending && source.queued) {
          const command = source.queued;
          source.queued = undefined;
          requestFrame(source, command);
        }
      }
    });
    socket.on('error', (error) => {
      log.warn('FluidEQ Engine display connection failed', error.message);
    });
    socket.on('close', () => {
      sources.delete(source);
      answerStats(source, undefined);
    });
  });
  return new Promise((resolve) => {
    server.on('error', (error) => {
      log.warn('FluidEQ Engine display pipe could not start', error.message);
      resolve();
    });
    // audiodg.exe runs as LOCAL SERVICE. Its display connection must be able
    // to write measurements; the default Windows pipe ACL grants only reads.
    // This pipe accepts bounded analysis records and sends only demand bytes.
    server.listen(
      { path: PIPE, readableAll: true, writableAll: true },
      resolve,
    );
  });
};

export default startEngineAnalysisPipe;
