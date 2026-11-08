/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { spawn } from 'child_process';
import { randomBytes, randomUUID } from 'crypto';
import fs from 'fs';
import net from 'net';
import os from 'os';
import path from 'path';
import writeFileAtomically from '../atomicWrite';
import { utf8Command } from '../powershell';
import {
  directLauncher,
  type IChatAdoption,
  type IChatLauncher,
  type IChatProcess,
  type IChatProcessEvents,
} from './chatProcess';
import {
  RELAY_ENV,
  RELAY_FAILED,
  RELAY_READY,
  readRelayChild,
  readRelayReport,
  relayLine,
  type IRelayChild,
  type IRelaySettings,
  type TRelayReport,
  type TRelayRequest,
} from './chatRelayProtocol';
import { createLineReader } from './chatStream';
import { endProcessTreeById } from './endProcessTree';

/**
 * The chats' Claude Code started under the process that holds them across a
 * restart (`chatRelayHost.ts`), for a FluidEQ that a change to its own code
 * restarts: development, where electronmon ends it and starts it again on
 * every save in `src/main` or `src/common` (Ivan, 2026-11-07: "we need to
 * fix that in a way this doesn't affect ai chats while we working on the
 * app"). A FluidEQ that only ever quits has nothing to come back for, and
 * keeps its chats as its own children (`directLauncher`).
 *
 * Holding the restart back instead was ruled out: a main process kept
 * running past a change is the stale-copy trap CLAUDE.md records — a voicing
 * profile refused by a main minutes out of date.
 */

type TAdopt = (adoption: IChatAdoption) => void;

interface IRecord {
  pipe: string;
  token: string;
  /** The host's process, ended with everything under it at a real quit. */
  pid: number;
}

interface IConnection {
  send(request: TRelayRequest): void;
}

interface IRelayed {
  events?: IChatProcessEvents;
  position: number;
  pid?: number;
  done: boolean;
}

const readRecord = (file: string): IRecord | undefined => {
  try {
    const raw: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (typeof raw !== 'object' || raw === null) {
      return undefined;
    }
    const { pipe, token, pid } = raw as Partial<IRecord>;
    return typeof pipe === 'string' &&
      typeof token === 'string' &&
      typeof pid === 'number' &&
      Number.isSafeInteger(pid) &&
      pid > 0
      ? { pipe, token, pid }
      : undefined;
  } catch {
    return undefined;
  }
};

/** What a host that exited with no FluidEQ to collect it left, once. */
const takeLeft = (file: string): IRelayChild[] => {
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return [];
  }
  fs.rmSync(file, { force: true });
  const children =
    typeof raw === 'object' && raw !== null
      ? (raw as { children?: unknown }).children
      : undefined;
  return Array.isArray(children)
    ? children.flatMap((child) => readRelayChild(child) ?? [])
    : [];
};

const pipeName = () =>
  process.platform === 'win32'
    ? `\\\\.\\pipe\\fluideq-chat-relay-${randomUUID()}`
    : path.join(os.tmpdir(), `fluideq-chat-${randomUUID().slice(0, 12)}.sock`);

/**
 * PowerShell's start of the host on Windows: `Start-Process` goes through
 * the shell, which creates the process with no handles inherited. The two
 * paths come from the environment, so nothing here is quoted for a shell.
 */
const START_THROUGH_THE_SHELL = [
  'Start-Process',
  '-FilePath $env:FLUIDEQ_CHAT_RELAY_EXE',
  `-ArgumentList ('"' + $env:FLUIDEQ_CHAT_RELAY_BOOT + '"')`,
  '-WorkingDirectory (Get-Location).Path',
  '-WindowStyle Hidden',
].join(' ');

export interface IRelayLauncherDeps {
  /** The chat's own folder, where the host's address and leftovers are kept. */
  dir: string;
  /** The host's first file (`chatRelayBoot.cjs`), run by Electron as Node. */
  hostEntry?: string;
  /** Told of each restart's 'reset' from electronmon. */
  hostProcess?: Pick<NodeJS.Process, 'prependListener'>;
  logger?: { warn(message: string): void };
}

export const relayLauncher = ({
  dir,
  hostEntry = path.join(__dirname, 'chatRelayBoot.cjs'),
  hostProcess = process,
  logger,
}: IRelayLauncherDeps): IChatLauncher => {
  const recordFile = path.join(dir, 'relay.json');
  const leftFile = path.join(dir, 'relay-left.json');
  const relayed = new Map<string, IRelayed>();
  let restarting = false;
  /**
   * The host this FluidEQ is connected to now. Only that one is ever ended
   * by its id: an address left from a host that exited may name an id
   * Windows has since given to somebody else's program.
   */
  let live: IRecord | undefined;
  /** The connection to it, being made or made; none once it is lost. */
  let connected: Promise<IConnection> | undefined;
  // electronmon restarts FluidEQ by sending 'reset' and then quitting it;
  // any other quit is the member's, and ends the chats as it always did.
  hostProcess.prependListener('message', (message: unknown) => {
    if (message === 'reset') {
      restarting = true;
    }
  });

  /**
   * Every chat the host held is gone with it, and the next chat started
   * starts a new host.
   */
  const lost = () => {
    connected = undefined;
    relayed.forEach((one) => {
      if (!one.done) {
        one.done = true;
        one.events?.closed();
      }
    });
  };

  const onReport = (report: TRelayReport) => {
    if (report.type === 'welcome') {
      return;
    }
    const one = relayed.get(report.id);
    if (!one || one.done) {
      return;
    }
    switch (report.type) {
      case 'started':
        one.pid = report.pid;
        return;
      case 'line':
        one.position = report.seq + 1;
        one.events?.line(report.line);
        return;
      case 'errors':
        one.events?.errors(report.chunk);
        return;
      default:
        one.done = true;
        relayed.delete(report.id);
        if (report.type === 'failed') {
          one.events?.failed();
        } else {
          one.events?.closed();
        }
    }
  };

  const connectTo = (record: IRecord) =>
    new Promise<{ connection: IConnection; children: IRelayChild[] }>(
      (resolve, reject) => {
        const socket = net.connect(record.pipe);
        socket.setEncoding('utf8');
        let welcomed = false;
        const send = (request: TRelayRequest) => {
          socket.write(relayLine(request));
        };
        const reader = createLineReader((line) => {
          const report = readRelayReport(line);
          if (!report) {
            return;
          }
          if (!welcomed) {
            if (report.type === 'welcome') {
              welcomed = true;
              live = record;
              resolve({ connection: { send }, children: report.children });
            }
            return;
          }
          onReport(report);
        });
        socket.on('connect', () =>
          send({ type: 'hello', token: record.token }),
        );
        socket.on('data', (chunk: string) => reader.push(chunk));
        socket.on('error', (error) => {
          if (!welcomed) {
            reject(error);
          }
        });
        socket.on('close', () => {
          if (welcomed) {
            if (live === record) {
              live = undefined;
            }
            lost();
          } else {
            reject(new Error('The chat relay closed before it welcomed us.'));
          }
        });
      },
    );

  /**
   * A new host, started apart from FluidEQ so that FluidEQ's end is not its
   * and none of FluidEQ's open handles are its either. A process Node starts
   * inherits every handle FluidEQ has marked inheritable - Chromium's
   * DevTools socket among them - and the first host, started that way, held
   * port 9222 after its FluidEQ was gone, so no FluidEQ after it could open
   * DevTools. On Windows a short-lived PowerShell starts it through the
   * shell (`Start-Process`), which hands a new process no handles; elsewhere
   * Node marks every descriptor close-on-exec and a detached spawn is
   * enough. Either way the host calls this FluidEQ back on a pipe of its own
   * (`chatRelayBoot.cjs`) to say it is ready, or why it is not.
   */
  const startHost = () =>
    new Promise<IRecord>((resolve, reject) => {
      const ready = pipeName();
      const pipe = pipeName();
      const token = randomBytes(32).toString('base64url');
      const settings: IRelaySettings = { ready, pipe, token, left: leftFile };
      let settled = false;
      const starterLine = net.createServer();
      const fail = (error: Error) => {
        if (!settled) {
          settled = true;
          starterLine.close();
          reject(error);
        }
      };
      starterLine.on('connection', (socket) => {
        // The one call this line takes. It stays open: its closing tells
        // the host this FluidEQ is gone.
        starterLine.close();
        socket.setEncoding('utf8');
        socket.on('error', () => undefined);
        const reader = createLineReader((line) => {
          const [word, ...rest] = line.split(' ');
          const pid = Number(rest[0]);
          if (word === RELAY_READY && Number.isSafeInteger(pid) && pid > 0) {
            settled = true;
            const record = { pipe, token, pid };
            writeFileAtomically(recordFile, JSON.stringify(record), 0o600);
            resolve(record);
          } else if (word === RELAY_FAILED) {
            fail(
              new Error(`The chat relay could not start: ${rest.join(' ')}`),
            );
          }
        });
        socket.on('data', (chunk: string) => reader.push(chunk));
        socket.on('close', () =>
          fail(new Error('The chat relay hung up before it was ready.')),
        );
      });
      starterLine.on('error', fail);
      starterLine.listen(ready, () => {
        const env = {
          ...process.env,
          ELECTRON_RUN_AS_NODE: '1',
          [RELAY_ENV]: JSON.stringify(settings),
          FLUIDEQ_CHAT_RELAY_EXE: process.execPath,
          FLUIDEQ_CHAT_RELAY_BOOT: hostEntry,
        };
        const launcher =
          process.platform === 'win32'
            ? spawn(
                'powershell.exe',
                [
                  '-NoProfile',
                  '-NonInteractive',
                  '-Command',
                  // The paths come from the environment, never this line.
                  utf8Command(START_THROUGH_THE_SHELL),
                ],
                { cwd: process.cwd(), env, stdio: 'ignore', windowsHide: true },
              )
            : spawn(process.execPath, [hostEntry], {
                cwd: process.cwd(),
                env,
                stdio: 'ignore',
                detached: true,
              });
        launcher.unref();
        launcher.on('error', fail);
        launcher.on('exit', (code) => {
          if (process.platform === 'win32' && code !== 0) {
            fail(
              new Error(`The chat relay was not started (${String(code)}).`),
            );
          }
        });
      });
    });

  let adopting: TAdopt | undefined;

  // Requests in the order they were made, each once the host is there. The
  // host is found or started by `connection` below, which adopts what it
  // holds through `processOf`, which sends: the three refer to one another
  // only when called.
  let sending: Promise<unknown> = Promise.resolve();
  let connection: () => Promise<IConnection> = () =>
    Promise.reject(new Error('Not ready.'));
  const send = (request: TRelayRequest) => {
    sending = sending
      .then(() => connection())
      .then((found) => found.send(request))
      .catch(() => undefined);
  };

  const processOf = (id: string, one: IRelayed): IChatProcess => ({
    write: (text) => {
      if (!one.done) {
        send({ type: 'write', id, text });
      }
    },
    end: () => {
      if (one.done) {
        return;
      }
      send({ type: 'end', id });
      // Also by its id, which reaches it while FluidEQ is quitting and a
      // request to the host may never leave.
      if (one.pid !== undefined) {
        endProcessTreeById(one.pid);
      }
    },
    position: () => one.position,
  });

  const adoptAll = (children: IRelayChild[]) => {
    children.forEach((child) => {
      const one: IRelayed = {
        position: child.lines[0]?.seq ?? child.next,
        ...(child.pid === undefined ? {} : { pid: child.pid }),
        done: child.ended,
      };
      if (!child.ended) {
        relayed.set(child.id, one);
      }
      adopting?.({
        child,
        process: processOf(child.id, one),
        attach: (events) => {
          child.lines.forEach(({ seq, line }) => {
            one.position = seq + 1;
            events.line(line);
          });
          one.position = Math.max(one.position, child.next);
          if (!child.ended) {
            one.events = events;
          } else if (child.failed) {
            events.failed();
          } else {
            events.closed();
          }
        },
      });
    });
  };

  /** The host this FluidEQ talks to: the one already running, else a new one. */
  connection = () => {
    if (!connected) {
      connected = (async () => {
        const known = readRecord(recordFile);
        if (known) {
          try {
            const { connection: found, children } = await connectTo(known);
            adoptAll(children);
            return found;
          } catch {
            // Gone with the machine, or ended with nothing left to hold.
            fs.rmSync(recordFile, { force: true });
          }
        }
        const { connection: fresh, children } = await connectTo(
          await startHost(),
        );
        adoptAll(children);
        return fresh;
      })();
      connected.catch((error: unknown) => {
        logger?.warn(`The Studio chat's relay did not start: ${String(error)}`);
        connected = undefined;
      });
    }
    return connected;
  };

  return {
    start: (id, { executable, args, cwd }, events) => {
      // The host ends a process started before under the same id; what it
      // says as it goes is no longer the chat's.
      const before = relayed.get(id);
      if (before) {
        before.done = true;
      }
      const one: IRelayed = { events, position: 0, done: false };
      relayed.set(id, one);
      send({ type: 'start', id, executable, args, cwd });
      connection().catch(() => {
        if (!one.done) {
          one.done = true;
          relayed.delete(id);
          events.failed();
        }
      });
      return processOf(id, one);
    },
    restarting: () => restarting,
    close: () => {
      // The host and every Claude Code under it, by the host's id: a request
      // over the pipe may never leave a FluidEQ that is quitting, and this
      // reaches them even so. The address goes with them.
      if (live) {
        endProcessTreeById(live.pid);
        live = undefined;
        fs.rmSync(recordFile, { force: true });
      }
    },
    takeUp: async (adopt) => {
      adopting = adopt;
      adoptAll(takeLeft(leftFile));
      if (readRecord(recordFile)) {
        await connection().catch(() => undefined);
      }
    },
  };
};

/**
 * How this FluidEQ starts its chats' Claude Code: held across restarts when
 * something restarts it on a change to its own code - electronmon, which
 * starts it with a channel to send it 'reset' over - and as its own
 * children otherwise, which is every installed FluidEQ.
 */
export const chatLauncherFor = (
  dir: string,
  logger?: { warn(message: string): void },
): IChatLauncher =>
  typeof process.send === 'function'
    ? relayLauncher({ dir, ...(logger ? { logger } : {}) })
    : directLauncher();
