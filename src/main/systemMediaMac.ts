/* FluidEQ — GPL-3.0-or-later */
import { spawn } from 'child_process';
import type { ChildProcessWithoutNullStreams } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';
import log from 'electron-log';
import { parseSystemMediaLine } from './systemMedia';
import type { ISystemMediaSnapshot, TSystemMediaCommand } from './systemMedia';
import { macBroadcastMediaSource } from './systemMediaMacBroadcast';

interface IMacReading extends ISystemMediaSnapshot {
  pid: number;
  bundleId: string;
  canToggle: boolean;
}
interface IMediaFiles {
  script: string;
  framework: string;
}

/** The packaged helper and the native development build use identical files. */
export const findMacMediaFiles = (): IMediaFiles | undefined => {
  const { resourcesPath } = process as NodeJS.Process & {
    resourcesPath?: string;
  };
  const roots = [
    path.join(__dirname, '../../native/.build/bin/mac-media'),
    path.join(__dirname, '../../../native/.build/bin/mac-media'),
  ];
  // Frameworks is signed as nested code. The loader and its licence are data
  // in Resources; keeping the framework there would hide it from that pass.
  const packaged = resourcesPath
    ? [
        {
          script: path.join(resourcesPath, 'native/mac-media/media-host.pl'),
          framework: path.join(
            resourcesPath,
            '../Frameworks/FluidEQMedia.framework',
          ),
        },
      ]
    : [];
  return [
    ...packaged,
    ...roots.map((root) => ({
      script: path.join(root, 'media-host.pl'),
      framework: path.join(root, 'FluidEQMedia.framework'),
    })),
  ].find(
    ({ script, framework }) =>
      existsSync(script) && existsSync(path.join(framework, 'FluidEQMedia')),
  );
};

/** Capability flags come from the player's enabled commands, never its type. */
export const readMacMedia = (line: string): IMacReading | undefined => {
  const snapshot = parseSystemMediaLine(line);
  if (!snapshot) {
    return undefined;
  }
  const value = JSON.parse(line) as Record<string, unknown>;
  const { pid } = value;
  if (
    typeof pid !== 'number' ||
    !Number.isSafeInteger(pid) ||
    pid <= 0 ||
    typeof value.bundleId !== 'string' ||
    !value.bundleId ||
    value.bundleId.length > 256
  ) {
    return undefined;
  }
  return {
    ...snapshot,
    pid,
    bundleId: value.bundleId,
    canToggle: value.canToggle === true,
  };
};

let child: ChildProcessWithoutNullStreams | undefined;
let notify: ((snapshot: ISystemMediaSnapshot | undefined) => void) | undefined;
let last: IMacReading | undefined;
// FluidEQ can become the current session before its owner effect pauses the
// previous external player. Keep that observed PID for explicit pause; native
// rechecks bundle and liveness, so nothing is launched or sent to FluidEQ.
let lastExternal: IMacReading | undefined;
let fallback = false;
let serial = 0;
const waiting = new Map<number, (accepted: boolean) => void>();

const finishCommands = () => {
  waiting.forEach((resolve) => resolve(false));
  waiting.clear();
};
const startBroadcasts = () => {
  fallback = true;
  macBroadcastMediaSource.watch((snapshot) => notify?.(snapshot));
};

const start = (files: IMediaFiles) => {
  // Absolute system host, no shell, no signed-binary or security changes.
  const started = spawn('/usr/bin/perl', [files.script, files.framework], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, FLUIDEQ_MEDIA_SELF_PID: String(process.pid) },
  });
  child = started;
  let pending = '';
  let diagnostics = '';
  started.stderr.setEncoding('utf8');
  started.stderr.on('data', (chunk: string) => {
    diagnostics = (diagnostics + chunk).slice(-2048);
  });
  const ended = () => {
    if (child !== started) {
      return;
    }
    child = undefined;
    last = undefined;
    lastExternal = undefined;
    finishCommands();
    log.info(
      'The Mac now-playing adapter stopped; using player broadcasts.',
      diagnostics.trim(),
    );
    if (notify) {
      startBroadcasts();
    }
  };
  started.stdout.setEncoding('utf8');
  started.stdout.on('data', (chunk: string) => {
    if (child !== started) {
      return;
    }
    pending += chunk;
    if (pending.length > 256 * 1024) {
      started.kill();
      ended();
      return;
    }
    const lines = pending.split('\n');
    pending = lines.pop() ?? '';
    lines.forEach((line) => {
      let value: unknown;
      try {
        value = JSON.parse(line);
      } catch {
        return;
      }
      if (typeof value === 'object' && value !== null) {
        const record = value as Record<string, unknown>;
        if (typeof record.ack === 'number') {
          waiting.get(record.ack)?.(record.ok === true);
          waiting.delete(record.ack);
          return;
        }
        if (record.unavailable === true) {
          started.stdin.end();
          ended();
          return;
        }
      }
      if (child !== started) {
        return;
      }
      last = readMacMedia(line);
      if (last) {
        lastExternal = last;
      }
      notify?.(last);
    });
  });
  started.stdin.on('error', finishCommands);
  started.on('error', ended);
  started.on('exit', ended);
};

const watch = (
  onSnapshot: (snapshot: ISystemMediaSnapshot | undefined) => void,
) => {
  notify = onSnapshot;
  if (fallback) {
    startBroadcasts();
    return;
  }
  onSnapshot(last);
  if (child) {
    return;
  }
  const files = findMacMediaFiles();
  if (files) {
    start(files);
  } else {
    startBroadcasts();
  }
};

const stopWatching = () => {
  const stopped = child;
  child = undefined;
  notify = undefined;
  last = undefined;
  lastExternal = undefined;
  fallback = false;
  finishCommands();
  macBroadcastMediaSource.stopWatching();
  // EOF releases native observers and the run loop, including on parent death.
  stopped?.stdin.end();
};

const send = (
  command: string,
  target: IMacReading | undefined,
  positionMs?: number,
): Promise<boolean> => {
  const running = child;
  if (!running || !target || running.stdin.destroyed) {
    return Promise.resolve(false);
  }
  serial += 1;
  const id = serial;
  return new Promise((resolve) => {
    waiting.set(id, resolve);
    running.stdin.write(
      `${JSON.stringify({ id, command, pid: target.pid, positionMs })}\n`,
      (error) => {
        if (error) {
          waiting.delete(id);
          resolve(false);
        }
      },
    );
  });
};

const sendCommand = async (
  command: TSystemMediaCommand,
  positionMs?: number,
): Promise<void> => {
  if (fallback) {
    await macBroadcastMediaSource.sendCommand(command);
    return;
  }
  await send(command, last, positionMs);
};
const pauseOthers = async (exceptApp: string): Promise<void> => {
  if (fallback) {
    await macBroadcastMediaSource.pauseOthers(exceptApp);
    return;
  }
  if (lastExternal?.isPlaying && lastExternal.app !== exceptApp) {
    await send('pause', lastExternal);
  }
};
const sendTransportKey = async (action: unknown): Promise<void> => {
  if (fallback) {
    await macBroadcastMediaSource.sendTransportKey(action);
    return;
  }
  if (action === 'playPause') {
    await send('toggle', last);
  } else if (action === 'next' || action === 'previous') {
    await send(action, last);
  }
};

/** Mac-only implementation of the shared system media contract. */
export const macSystemMediaSource = {
  watch,
  stopWatching,
  sendCommand,
  pauseOthers,
  sendTransportKey,
  cover: (): string | undefined => undefined,
};
