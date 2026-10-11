/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { answerInvoke, answerSend, type TEmit } from './fakeMain';

/**
 * What the harness bundle gets for `import … from 'electron'`: the real
 * preload (`main/preload.ts`) and every bridge it pulls in run unchanged, and
 * this stands where Electron's renderer half would. Nothing here reaches a
 * main process — `fakeMain.ts` answers each channel with the believable state
 * the captures are taken of.
 */

type TListener = (event: unknown, ...args: unknown[]) => void;

const listeners = new Map<string, Set<TListener>>();
const EVENT = { sender: undefined };

const emit: TEmit = (channel, ...args) => {
  listeners.get(channel)?.forEach((listener) => listener(EVENT, ...args));
};

// The capture script raises main's events with this — a linked computer
// arriving, say — once the page is ready for them.
Object.assign(window, { __harnessEmit: emit });

export const ipcRenderer = {
  on(channel: string, listener: TListener) {
    const set = listeners.get(channel) ?? new Set<TListener>();
    set.add(listener);
    listeners.set(channel, set);
    return ipcRenderer;
  },
  once(channel: string, listener: TListener) {
    const wrapped: TListener = (event, ...args) => {
      ipcRenderer.removeListener(channel, wrapped);
      listener(event, ...args);
    };
    return ipcRenderer.on(channel, wrapped);
  },
  removeListener(channel: string, listener: TListener) {
    listeners.get(channel)?.delete(listener);
    return ipcRenderer;
  },
  removeAllListeners(channel: string) {
    listeners.delete(channel);
    return ipcRenderer;
  },
  send(channel: string, ...args: unknown[]) {
    answerSend(channel, args, emit);
  },
  sendSync(): undefined {
    return undefined;
  },
  invoke(channel: string, ...args: unknown[]): Promise<unknown> {
    return answerInvoke(channel, args, emit);
  },
  postMessage(): void {},
};

export const contextBridge = {
  exposeInMainWorld(name: string, api: unknown) {
    Object.assign(window, { [name]: api });
  },
};

export const webUtils = {
  getPathForFile: (): string => '',
};

export type IpcRendererEvent = typeof EVENT;
