/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * @jest-environment node
 */

const handlers = new Map<string, (...args: unknown[]) => unknown>();
jest.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, fn: (...args: unknown[]) => unknown) =>
      handlers.set(channel, fn),
    removeHandler: (channel: string) => handlers.delete(channel),
  },
}));

/* eslint-disable import/first -- the electron mock must be installed first */
import { EventEmitter } from 'events';
import fs from 'fs';
import net from 'net';
import os from 'os';
import path from 'path';
import type { IStudioAgentDoor } from '../../../common/studioAgent';
import { createStudioAgentDoor } from '../../../main/studioAgent/studioAgentDoor';

/**
 * The door's switch: shut until the member opens it, and whatever the
 * member pressed last is what it ends as — a quick on-off must not leave it
 * listening under a switch that says off. Only the app's own window may
 * press it.
 */

const page = { send: jest.fn(), on: jest.fn(), removeListener: jest.fn() };
const window = { isDestroyed: () => false, webContents: page };
const fromWindow = { sender: page };

let folder: string;
let door: ReturnType<typeof createStudioAgentDoor> | undefined;

beforeEach(() => {
  handlers.clear();
  folder = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-door-'));
});

afterEach(async () => {
  await door?.dispose();
  door = undefined;
  fs.rmSync(folder, { recursive: true, force: true });
});

const holdWindow = jest.fn();

const open = () => {
  holdWindow.mockClear();
  door = createStudioAgentDoor({
    userDataDir: folder,
    getMainWindow: () => window as never,
    agentProject: () => ({ ok: false, reason: 'none-open' }),
    appVersion: '1',
    holdWindow,
  });
};

const invoke = async (channel: string, event: unknown, ...args: unknown[]) =>
  (await handlers.get(channel)?.(event, ...args)) as IStudioAgentDoor;

/** Whether anything accepts a connection on `port` of this computer. */
const listening = (port: number) =>
  new Promise<boolean>((resolve) => {
    const socket = net.connect({ host: '127.0.0.1', port });
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => resolve(false));
  });

test('it is shut until the member opens it', async () => {
  open();
  expect(await invoke('studio-agent-door', fromWindow)).toEqual({
    open: false,
  });
});

test('opened, it listens on this computer with a key; shut, nothing listens', async () => {
  open();
  const opened = await invoke('studio-agent-door-set', fromWindow, true);
  expect(opened.open).toBe(true);
  expect(opened.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/mcp$/);
  expect(opened.key).toMatch(/^[A-Za-z0-9_-]{43}$/);
  const port = Number(new URL(opened.url ?? '').port);
  expect(await listening(port)).toBe(true);

  expect(await invoke('studio-agent-door-set', fromWindow, false)).toEqual({
    open: false,
  });
  expect(await listening(port)).toBe(false);
});

test('an open door keeps no window loaded in the tray', async () => {
  // Left open, it used to hold the window for good (2026-11-01).
  open();
  await invoke('studio-agent-door-set', fromWindow, true);
  expect(holdWindow).not.toHaveBeenCalled();
});

/**
 * An ask with no window wakes it: main builds it again, its page says it can
 * answer, and the ask is put to that page. The window is held from the wake
 * until the answer, and never waited on once it is gone.
 */
describe('an ask while the window is let go in the tray', () => {
  const fakePage = () =>
    Object.assign(new EventEmitter(), {
      send: jest.fn(),
      isDestroyed: () => false,
    });
  let shown: { isDestroyed: () => boolean; webContents: unknown } | null;
  /** Every promise the ask has chained so far, run to where it waits. */
  const settled = async () => {
    for (let hop = 0; hop < 20; hop += 1) {
      // eslint-disable-next-line no-await-in-loop -- one microtask per hop
      await Promise.resolve();
    }
  };

  const openLetGo = (wakeWindow: () => Promise<void>) => {
    holdWindow.mockClear();
    shown = null;
    door = createStudioAgentDoor({
      userDataDir: folder,
      getMainWindow: () => shown as never,
      agentProject: () => ({ ok: false, reason: 'none-open' }),
      appVersion: '1',
      wakeWindow,
      holdWindow,
    });
    return door;
  };

  it('wakes the window, waits for its page and asks it', async () => {
    const woken = fakePage();
    const wake = jest.fn(async () => {
      shown = { isDestroyed: () => false, webContents: woken };
    });
    const { hear } = openLetGo(wake);

    const heard = hear('now');
    await settled();
    expect(wake).toHaveBeenCalledTimes(1);
    expect(holdWindow).toHaveBeenLastCalledWith(true);
    // Nothing is asked before the page can answer.
    expect(woken.send).not.toHaveBeenCalled();

    await handlers.get('studio-agent-ready')?.(
      { sender: woken },
      { hears: true },
    );
    await settled();
    const [[channel, ask]] = woken.send.mock.calls as [
      [string, { id: number }],
    ];
    expect(channel).toBe('studio-agent-hear');
    await handlers.get('studio-agent-heard')?.({ sender: woken }, ask.id, {
      ok: false,
      reason: 'no-sound',
      otherSeconds: 0,
    });
    expect(await heard).toEqual({
      ok: false,
      reason: 'no-sound',
      otherSeconds: 0,
    });
    expect(holdWindow).toHaveBeenLastCalledWith(false);
  });

  it('answers that there is no window when none comes', async () => {
    const { hear } = openLetGo(async () => undefined);
    expect(await hear('now')).toBe('no-window');
    expect(holdWindow.mock.calls).toEqual([[true], [false]]);
  });

  it('stops waiting when the woken page goes before it can answer', async () => {
    const woken = fakePage();
    const { hear } = openLetGo(async () => {
      shown = { isDestroyed: () => false, webContents: woken };
    });
    const heard = hear('now');
    await settled();
    woken.emit('destroyed');
    expect(await heard).toBe('no-window');
    expect(woken.send).not.toHaveBeenCalled();
    expect(holdWindow).toHaveBeenLastCalledWith(false);
  });
});

test('a quick on and off ends shut', async () => {
  open();
  const [on, off] = await Promise.all([
    invoke('studio-agent-door-set', fromWindow, true),
    invoke('studio-agent-door-set', fromWindow, false),
  ]);
  expect(off).toEqual({ open: false });
  const port = Number(new URL(on.url ?? 'http://127.0.0.1:1/').port);
  expect(await listening(port)).toBe(false);
});

test('the member’s choice and key outlive a restart; a new key replaces it', async () => {
  open();
  const first = await invoke('studio-agent-door-set', fromWindow, true);
  await door?.dispose();

  open();
  // The door opens itself at launch; the window asks once it is up.
  const again = await invoke('studio-agent-door-set', fromWindow, true);
  expect(again.key).toBe(first.key);
  expect(again.url).toBe(first.url);

  const renewed = await invoke('studio-agent-new-key', fromWindow);
  expect(renewed.key).not.toBe(first.key);
});

test('copying the prompt opens it for a member who never chose, and it stays open', async () => {
  // The prompt carries the connection, so the member's AI connects itself
  // and the member types nothing (Ivan, 2026-09-24).
  open();
  const opened = await invoke('studio-agent-door-for-prompt', fromWindow);
  expect(opened.open).toBe(true);
  expect(opened.key).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect(await listening(Number(new URL(opened.url ?? '').port))).toBe(true);
  await door?.dispose();

  // Remembered: the next launch listens with the same key.
  open();
  expect(await invoke('studio-agent-door-for-prompt', fromWindow)).toEqual(
    opened,
  );
});

test('a door the member switched off stays shut when the prompt is copied', async () => {
  open();
  await invoke('studio-agent-door-for-prompt', fromWindow);
  const off = await invoke('studio-agent-door-set', fromWindow, false);
  expect(off).toEqual({ open: false });
  expect(await invoke('studio-agent-door-for-prompt', fromWindow)).toEqual({
    open: false,
  });
  await door?.dispose();

  // And after a restart.
  open();
  expect(await invoke('studio-agent-door-for-prompt', fromWindow)).toEqual({
    open: false,
  });
  // Their switch still opens it.
  expect((await invoke('studio-agent-door-set', fromWindow, true)).open).toBe(
    true,
  );
});

test('a switch used before the prompt could open it keeps its word', async () => {
  // A file from before `chosen` was only ever written by the switch.
  fs.writeFileSync(
    path.join(folder, 'studio-agent.json'),
    JSON.stringify({ open: false, port: 47391, key: 'k'.repeat(43) }),
  );
  open();
  expect(await invoke('studio-agent-door-for-prompt', fromWindow)).toEqual({
    open: false,
  });
});

test('no other page may see or press it', async () => {
  open();
  const stranger = { sender: { send: jest.fn() } };
  expect(await invoke('studio-agent-door-set', stranger, true)).toEqual({
    open: false,
  });
  expect(await invoke('studio-agent-door', fromWindow)).toEqual({
    open: false,
  });
  expect(await invoke('studio-agent-door-for-prompt', stranger)).toEqual({
    open: false,
  });
  expect(await invoke('studio-agent-door', fromWindow)).toEqual({
    open: false,
  });
  await invoke('studio-agent-door-set', fromWindow, true);
  // Open, a stranger still learns nothing about it.
  expect(await invoke('studio-agent-door', stranger)).toEqual({ open: false });
});
