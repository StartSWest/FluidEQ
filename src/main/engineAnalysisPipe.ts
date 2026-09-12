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
import { ENGINE_PREAMP_CHANNEL, IEnginePreamp } from '../common/enginePreamp';

const PIPE = '\\\\.\\pipe\\FluidEQ-Engine-Analysis';
const MAX_FRAME = 32_768;
const GUID = /^\{?[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}\}?$/i;

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
  queued?: 1 | 2;
}

const requestFrame = (source: ISource, command: 1 | 2) => {
  if (source.pending) {
    if (source.preampPending !== (command === 2)) {
      source.queued = command;
    }
    return;
  }
  source.pending = true;
  source.preampPending = command === 2;
  if (command === 1) {
    source.enabled = true;
  }
  source.socket.write(Buffer.from([command]));
};

// Pull only while the DSP surface is painting. A single outstanding request
// per endpoint bounds both IPC traffic and the pipe's queue under backpressure.
const startEngineAnalysisPipe = (
  getWindow: () => { webContents: WebContents } | null,
): Promise<void> => {
  if (process.platform !== 'win32') {
    return Promise.resolve();
  }
  const sources = new Set<ISource>();
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
        source.supportsPreamp = buffered[39] === 1;
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
        if (!source.pending && source.queued) {
          const command = source.queued;
          source.queued = undefined;
          requestFrame(source, command);
        }
      }
    });
    socket.on('error', (error) => {
      log.warn('FluidEQ Engine display connection failed', error.message);
    });
    socket.on('close', () => sources.delete(source));
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
