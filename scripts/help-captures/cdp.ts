/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { spawn, type ChildProcess } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

/**
 * Just enough of the Chrome DevTools Protocol to drive one page: start a
 * headless Chrome or Edge, attach to its page, send commands and wait for
 * their answers. Node's own WebSocket, so the captures need nothing installed
 * beyond the repository's packages and a browser the machine already has.
 */

interface IPending {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
}

export interface IPage {
  send<T = unknown>(method: string, params?: object): Promise<T>;
  /** Hears every event of one method, for as long as the page is open. */
  on(method: string, listener: (params: unknown) => void): void;
  /** Evaluates an expression in the page, awaiting it if it is a promise. */
  evaluate<T = unknown>(expression: string): Promise<T>;
  close(): Promise<void>;
}

/** Where a browser usually is, for each system the guide is captured on. */
const BROWSERS: Partial<Record<NodeJS.Platform, string[]>> = {
  win32: [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ],
  darwin: ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'],
  linux: [
    '/opt/pw-browsers/chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ],
};

export const findBrowser = (asked?: string): string => {
  const candidates = [
    asked,
    process.env.CHROME_PATH,
    ...(BROWSERS[process.platform] ?? []),
  ].filter((candidate): candidate is string => Boolean(candidate));
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) {
    throw new Error(
      'No Chrome or Edge found. Pass --chrome <path> or set CHROME_PATH.',
    );
  }
  return found;
};

/** Chrome says where its DevTools listen on stderr; that line is the wait. */
const devToolsUrl = (browser: ChildProcess): Promise<string> =>
  new Promise((resolve, reject) => {
    let seen = '';
    const onData = (chunk: Buffer) => {
      seen += chunk.toString();
      const found = /DevTools listening on (ws:\/\/\S+)/.exec(seen);
      if (found) {
        browser.stderr?.off('data', onData);
        resolve(found[1]);
      }
    };
    browser.stderr?.on('data', onData);
    browser.once('exit', (code) =>
      reject(
        new Error(`The browser exited (${code}) before it listened:\n${seen}`),
      ),
    );
  });

const connect = (url: string): Promise<WebSocket> =>
  new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    socket.addEventListener('open', () => resolve(socket), { once: true });
    socket.addEventListener(
      'error',
      () => reject(new Error(`Could not reach ${url}`)),
      { once: true },
    );
  });

/**
 * One headless browser with one page of the given size, one CSS pixel to one
 * device pixel, as the guide's pictures were always taken.
 */
export const openPage = async (
  executable: string,
  width: number,
  height: number,
): Promise<IPage> => {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-captures-'));
  const browser = spawn(
    executable,
    [
      '--headless=new',
      '--remote-debugging-port=0',
      `--user-data-dir=${profile}`,
      `--window-size=${width},${height}`,
      '--force-device-scale-factor=1',
      '--hide-scrollbars',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-extensions',
      '--mute-audio',
      '--autoplay-policy=no-user-gesture-required',
      // Chromium refuses to start as root with its sandbox on, which is
      // how a Linux container runs it; anywhere else the sandbox stays.
      ...(process.getuid?.() === 0 ? ['--no-sandbox'] : []),
      'about:blank',
    ],
    { stdio: ['ignore', 'ignore', 'pipe'] },
  );
  const socket = await connect(await devToolsUrl(browser));

  let lastId = 0;
  let session: string | undefined;
  const pending = new Map<number, IPending>();
  const listeners = new Map<string, ((params: unknown) => void)[]>();
  socket.addEventListener('message', (event: MessageEvent<string>) => {
    const message = JSON.parse(event.data) as {
      id?: number;
      method?: string;
      params?: unknown;
      result?: unknown;
      error?: { message: string };
    };
    if (message.method) {
      listeners
        .get(message.method)
        ?.forEach((listener) => listener(message.params));
    }
    const waiting =
      message.id === undefined ? undefined : pending.get(message.id);
    if (!waiting || message.id === undefined) {
      return;
    }
    pending.delete(message.id);
    if (message.error) {
      waiting.reject(new Error(message.error.message));
    } else {
      waiting.resolve(message.result);
    }
  });

  const send = <T>(method: string, params: object = {}): Promise<T> => {
    lastId += 1;
    const id = lastId;
    socket.send(JSON.stringify({ id, method, params, sessionId: session }));
    return new Promise<T>((resolve, reject) => {
      pending.set(id, { resolve: resolve as (value: unknown) => void, reject });
    });
  };

  const { targetInfos } = await send<{
    targetInfos: { targetId: string; type: string }[];
  }>('Target.getTargets');
  const target = targetInfos.find((info) => info.type === 'page');
  if (!target) {
    throw new Error('The browser opened no page.');
  }
  const attached = await send<{ sessionId: string }>('Target.attachToTarget', {
    targetId: target.targetId,
    flatten: true,
  });
  session = attached.sessionId;
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: false,
  });

  const evaluate = async <T>(expression: string): Promise<T> => {
    const answer = await send<{
      result: { value?: T };
      exceptionDetails?: { text: string; exception?: { description?: string } };
    }>('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
      userGesture: true,
    });
    if (answer.exceptionDetails) {
      throw new Error(
        answer.exceptionDetails.exception?.description ??
          answer.exceptionDetails.text,
      );
    }
    return answer.result.value as T;
  };

  const close = async () => {
    const exited = new Promise<void>((resolve) => {
      browser.once('exit', () => resolve());
    });
    socket.close();
    browser.kill();
    await exited;
    fs.rmSync(profile, { recursive: true, force: true });
  };

  const on = (method: string, listener: (params: unknown) => void) => {
    listeners.set(method, [...(listeners.get(method) ?? []), listener]);
  };

  return { send, on, evaluate, close };
};
