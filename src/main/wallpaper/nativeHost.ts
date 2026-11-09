import { spawn } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';
import { createInterface } from 'readline';
import { app } from 'electron';
import log from 'electron-log';
import { parsePointerRecord, type TWallpaperPointer } from './pointerRelay';

const EXECUTABLE = 'FluidEQ-Wallpaper.exe';

export const wallpaperHostPath = (): string | undefined => {
  if (process.platform !== 'win32') {
    return undefined;
  }
  return [
    path.join(process.resourcesPath, 'native', EXECUTABLE),
    path.join(app.getAppPath(), 'native/.build/bin', EXECUTABLE),
    path.join(__dirname, '../../../native/.build/bin', EXECUTABLE),
  ].find((candidate) => existsSync(candidate));
};

export interface IWallpaperHost {
  setVisible(visible: boolean): void;
  /**
   * Whether the helper passes the mouse on over its monitor's bare desktop
   * (`native/wallpaper/pointer.h`). It only does while the background is
   * also shown and not covered; this is main's half of that.
   */
  setTouch(touch: boolean): void;
  /**
   * Which key the helper reads as the camera's at each report it passes on
   * (`camera-key`, `native/wallpaper/pointer.h`): `ctrl`, `alt`, `shift`
   * or `scan:0x..`, as `cameraKeyForHelper` names it. Sent only when it
   * changes; Ctrl until told.
   */
  setCameraKey(name: string): void;
  stop(): void;
}

/**
 * What the helper says (`native/wallpaper/README.md`): attached, then whether
 * any of its monitor's desktop is in sight — `paused-owner` when only
 * FluidEQ's own windows keep it out of sight — and a failure.
 */
export type TWallpaperHostEvent =
  'ready' | 'active' | 'paused' | 'paused-owner' | 'error';

const REPORTS: readonly TWallpaperHostEvent[] = [
  'ready',
  'active',
  'paused',
  'paused-owner',
];

/** Windows supplies lifecycle/foreground events; there is no polling clock. */
export const startWallpaperHost = (
  executable: string,
  handle: Buffer,
  onEvent: (event: TWallpaperHostEvent) => void,
  onPointer: (pointer: TWallpaperPointer) => void,
): IWallpaperHost => {
  const hwnd =
    handle.length === 8
      ? handle.readBigUInt64LE().toString()
      : handle.readUInt32LE().toString();
  const child = spawn(executable, [hwnd, String(process.pid)], {
    windowsHide: true,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  let stopped = false;
  let failed = false;
  let touching = false;
  let cameraKey = 'ctrl';
  const fail = (detail: string) => {
    if (stopped || failed) {
      return;
    }
    failed = true;
    log.warn(`Desktop visualizer host: ${detail}`);
    onEvent('error');
  };
  const lines = createInterface({ input: child.stdout });
  lines.on('line', (line) => {
    if (stopped || failed) {
      return;
    }
    // The mouse first: while it is passed on, nearly every line is one. Never
    // logged — where the pointer went is nobody's record.
    if (line.startsWith('pointer:')) {
      const pointer = parsePointerRecord(line);
      if (pointer) {
        onPointer(pointer);
      }
      return;
    }
    const report = REPORTS.find((known) => known === line);
    if (report) {
      onEvent(report);
    } else if (line.startsWith('error:')) {
      fail(line);
    }
  });
  child.stderr.on('data', (chunk: Buffer) => {
    log.warn(
      `Desktop visualizer host: ${chunk.toString('utf8').slice(0, 2048)}`,
    );
  });
  child.stdin.on('error', (error) => fail(error.message));
  child.on('error', (error) => fail(error.message));
  child.on('exit', (code) => fail(`exited (${code})`));
  return {
    setVisible: (visible) => {
      if (!stopped && !failed) {
        child.stdin.write(visible ? 'show\n' : 'hide\n');
      }
    },
    setTouch: (touch) => {
      if (!stopped && !failed && touch !== touching) {
        touching = touch;
        child.stdin.write(touch ? 'touch\n' : 'still\n');
      }
    },
    setCameraKey: (name) => {
      if (!stopped && !failed && name !== cameraKey) {
        cameraKey = name;
        child.stdin.write(`camera-key ${name}\n`);
      }
    },
    stop: () => {
      if (stopped) {
        return;
      }
      stopped = true;
      lines.close();
      // EOF is the helper's shutdown signal, including a main-process crash.
      child.stdin.end();
    },
  };
};
