import { spawn } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';
import { createInterface } from 'readline';
import { app } from 'electron';
import log from 'electron-log';

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
  stop(): void;
}

/** Windows supplies lifecycle/foreground events; there is no polling clock. */
export const startWallpaperHost = (
  executable: string,
  handle: Buffer,
  onEvent: (event: 'ready' | 'active' | 'paused' | 'error') => void,
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
    if (line === 'ready' || line === 'active' || line === 'paused') {
      onEvent(line);
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
