/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

/**
 * The one-copy rule, extended across builds.
 *
 * `app.requestSingleInstanceLock` is keyed on the user data directory, and
 * development and the installed build do not share one: the installed build
 * resolves its name from `release/app/package.json`, which has no
 * `productName`, and lands in `%APPDATA%\fluideq-app`, while development runs
 * from the root package, whose `productName` puts it in `%APPDATA%\FluidEQ`.
 * (Measured from both builds' data; this said the reverse, and setup wrote the
 * engine choice into the wrong one.) So Electron's lock stops two copies of
 * the same build and nothing else — while the thing it exists to prevent does
 * not care which build did it. Two processes write the same Equalizer APO
 * config, each sees the other's write as somebody editing the file from
 * outside, and they spend the session adopting each other.
 *
 * HELD AS SOMETHING THE OPERATING SYSTEM TAKES AWAY WHEN THE PROCESS ENDS: a
 * named pipe on Windows, a Unix socket beside both data directories
 * elsewhere, served for as long as this copy runs. A second copy that finds
 * it answering is not alone; End task, a crash or a power cut end the server
 * with the process, so nothing is left to go stale.
 *
 * It was a marker file with a pid and a time, rewritten every twenty seconds
 * so that a crashed copy's marker would read as stale within the minute —
 * a heartbeat on a timer, and a guess: a machine too busy to write it in time
 * was taken for a crashed one, and a crashed copy kept the next one out for
 * up to a minute. An open file handle, the usual answer, proves nothing here:
 * Node opens files on Windows with share-delete, so a second process can
 * unlink a file the first still holds. A listening pipe cannot be taken over
 * while its server lives: libuv asks Windows for the first instance of the
 * name, which a second server is refused, and a Unix socket's path answers
 * `EADDRINUSE` while it is bound.
 *
 * FAILS OPEN BY CONSTRUCTION. Only an answer from the other copy's server
 * refuses a start; a pipe that cannot be served or asked, for any reason,
 * means "start". The cost of a wrong start is the confusion this prevents;
 * the cost of a wrong refusal is an equaliser that will not open, and those
 * are not the same size.
 */

import { createHash } from 'crypto';
import fs from 'fs';
import net from 'net';
import path from 'path';

/**
 * Where the lock lives for the user whose application-data folder is
 * `appDataDir` — the folder both builds' data directories share.
 *
 * On Windows a pipe's name is machine-wide, so it carries a digest of that
 * folder: two people signed in to one machine each run their own FluidEQ.
 * Elsewhere the socket is a file in that folder, which is per user already.
 */
export const instanceLockPath = (
  appDataDir: string,
  platform: NodeJS.Platform = process.platform,
): string =>
  platform === 'win32'
    ? `\\\\.\\pipe\\FluidEQ-Instance-${createHash('sha256')
        .update(appDataDir.toLowerCase())
        .digest('hex')
        .slice(0, 16)}`
    : path.join(appDataDir, 'fluideq-instance.sock');

export type TInstanceClaim =
  | {
      status: 'claimed';
      /** Stops serving the lock. Safe to call more than once. */
      release: () => void;
    }
  | {
      status: 'taken';
      /** Who holds it, as one sentence for the log. */
      holder: string;
    };

type TProbe =
  | { status: 'answered'; pid: number | undefined }
  | { status: 'nobody'; code: string | undefined };

/**
 * Ask the lock whether anybody is serving it. The server answers every
 * connection with its pid and closes it, so the answer is the connection
 * itself, and the pid is only there for the log.
 */
const probe = (lockPath: string): Promise<TProbe> =>
  new Promise((resolve) => {
    let said = '';
    let isConnected = false;
    const socket = net.connect(lockPath);
    socket.setEncoding('utf8');
    socket.on('connect', () => {
      isConnected = true;
    });
    socket.on('data', (chunk: string) => {
      said += chunk;
    });
    socket.on('error', (error: NodeJS.ErrnoException) => {
      resolve({ status: 'nobody', code: error.code });
    });
    socket.on('close', () => {
      if (!isConnected) {
        // `error` already answered.
        return;
      }
      const pid = Number.parseInt(said, 10);
      resolve({
        status: 'answered',
        pid: Number.isInteger(pid) && pid > 0 ? pid : undefined,
      });
    });
  });

/** Who answered, as one sentence for the log. */
const describeProbe = (answer: TProbe): string =>
  answer.status === 'answered'
    ? `The copy holding the instance lock answered${
        answer.pid === undefined ? '' : ` as pid ${answer.pid}`
      }.`
    : `Nothing answered on the instance lock (${answer.code ?? 'no reason given'}).`;

/**
 * Who holds the lock now, as one sentence for the log.
 *
 * Both of the one-copy refusals used to end the process without a word, so a
 * launch that ended there left nothing behind at all: no line, no file
 * touched, and the only evidence was a window somebody saw appear and go.
 * That is what made "it opens and closes again after an installer" impossible
 * to answer from a bug report, and this is what turns it into a fact. Never
 * rejects: a sentence about a lock is not worth failing a launch over.
 */
export const describeInstanceHolder = (lockPath: string): Promise<string> =>
  probe(lockPath).then(describeProbe);

const serve = (lockPath: string): Promise<net.Server | NodeJS.ErrnoException> =>
  new Promise((resolve) => {
    const server = net.createServer((socket) => {
      // A probe, told who is here. It never writes; an error on it — a probe
      // that went away first — ends that connection and nothing else.
      socket.on('error', () => undefined);
      socket.end(String(process.pid));
    });
    server.once('error', (error: NodeJS.ErrnoException) => resolve(error));
    server.listen(lockPath, () => {
      // From here on an error must not reach the event loop unhandled.
      server.on('error', () => undefined);
      resolve(server);
    });
  });

const released = (server: net.Server, lockPath: string) => {
  let isReleased = false;
  return () => {
    if (isReleased) {
      return;
    }
    isReleased = true;
    server.close();
    if (process.platform !== 'win32') {
      // A Unix socket's file outlives its server unless it is taken away.
      // Left behind it costs nothing — the next claim finds nobody answering
      // and replaces it — so a refusal to remove it is not worth a quit.
      try {
        fs.rmSync(lockPath, { force: true });
      } catch {
        // See above.
      }
    }
  };
};

const NOTHING_TO_RELEASE = () => undefined;

/**
 * Claim the lock for this process, for as long as it runs.
 *
 * Taken only when another copy's server answers. A Unix socket left by a copy
 * that crashed answers nothing — its file is there with no server behind it
 * — and is replaced; a Windows pipe goes with its process by itself.
 */
export const claimInstance = async (
  lockPath: string,
): Promise<TInstanceClaim> => {
  const first = await serve(lockPath);
  if (first instanceof net.Server) {
    return { status: 'claimed', release: released(first, lockPath) };
  }
  if (first.code !== 'EADDRINUSE') {
    return { status: 'claimed', release: NOTHING_TO_RELEASE };
  }
  const answer = await probe(lockPath);
  if (answer.status === 'answered') {
    return { status: 'taken', holder: describeProbe(answer) };
  }
  if (process.platform !== 'win32') {
    try {
      fs.rmSync(lockPath, { force: true });
    } catch {
      return { status: 'claimed', release: NOTHING_TO_RELEASE };
    }
    const second = await serve(lockPath);
    if (second instanceof net.Server) {
      return { status: 'claimed', release: released(second, lockPath) };
    }
  }
  return { status: 'claimed', release: NOTHING_TO_RELEASE };
};
