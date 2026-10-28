/** @jest-environment node */
import { EventEmitter } from 'events';
import fs from 'fs';
import os from 'os';
import path from 'path';
import type { BrowserWindow } from 'electron';

const WORK_AREA = { x: 0, y: 34, width: 1440, height: 792 };
const SCREEN = { x: 0, y: 0, width: 1440, height: 900 };

jest.mock('electron', () => ({
  screen: {
    getDisplayMatching: () => ({ workArea: WORK_AREA }),
    getPrimaryDisplay: () => ({ workArea: WORK_AREA }),
    getAllDisplays: () => [{ bounds: SCREEN, workArea: WORK_AREA }],
  },
}));
jest.mock('../../../main/windowDwm', () => ({
  setWindowTransitions: () => undefined,
}));

/* eslint-disable import/first */
import { flushPendingWrites } from '../../../main/asyncWriter';
import { createWindowModes } from '../../../main/windowMode';
import { createWindowPlacement } from '../../../main/windowPlacement';
import { PLAYER_BOUNDS_RULE } from '../../../common/windowMode';
/* eslint-enable import/first */

interface IRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// At the full app's floor on this screen, which the file never goes under.
const APP = { x: 100, y: 34, width: 1200, height: 792 };
// The amp at its one width, and the two amps as files kept them before.
const AMP = { x: 700, y: 60, width: 480, height: 700 };
const CLASSIC = { x: 700, y: 60, width: 620, height: 700 };
const STAGE = { x: 200, y: 100, width: 900, height: 600 };

/** An ordinary window the listener drags about; nothing maximises it. */
const fakeWindow = () => {
  const events = new EventEmitter();
  let normal: IRect = { ...APP };
  let reportedNormal: IRect | undefined;
  const win = {
    on: events.on.bind(events),
    once: events.once.bind(events),
    isDestroyed: () => false,
    isVisible: () => true,
    isMinimized: () => false,
    isMaximized: () => false,
    isFullScreen: () => false,
    getBounds: () => ({ ...normal }),
    getNormalBounds: () => ({ ...(reportedNormal ?? normal) }),
    getContentSize: () => [normal.width, normal.height],
    setBounds: (next: Partial<IRect>) => {
      // Native frame changes can notify persistence while the old rectangle
      // is still on screen. The mode has already changed at that point.
      events.emit('resize');
      normal = { ...normal, ...next };
      events.emit('resize');
      events.emit('move');
    },
    setMinimumSize: () => undefined,
    setMaximumSize: () => undefined,
    setMaximizable: () => undefined,
    setFullScreenable: () => undefined,
    setAlwaysOnTop: () => undefined,
    setResizable: () => undefined,
    webContents: {
      getZoomFactor: () => 1,
      isDevToolsOpened: () => false,
      send: jest.fn(),
    },
  };
  return {
    win: win as unknown as BrowserWindow,
    drag: (next: IRect) => {
      normal = { ...next };
      events.emit('resize');
      events.emit('resized');
    },
    reportNormal: (next: IRect) => {
      reportedNormal = next;
    },
  };
};

let userDataDir: string;

beforeEach(() => {
  userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-placement-'));
});

afterEach(async () => {
  await flushPendingWrites();
  fs.rmSync(userDataDir, { recursive: true, force: true });
});

const placementFor = (platform: NodeJS.Platform = 'win32') => {
  const modes = createWindowModes(platform);
  const { win, drag, reportNormal } = fakeWindow();
  modes.restore({
    mode: 'app',
    isPinned: false,
    app: {},
    player: {},
  });
  modes.followWindow(win);
  const placement = createWindowPlacement({
    userDataDir,
    getMainWindow: () => win,
    windowModes: modes,
  });
  modes.listen(placement.saveWindowState);
  return { modes, win, drag, reportNormal, ...placement };
};

const statePath = () => path.join(userDataDir, 'window-state.json');

const writeFile = (contents: object) =>
  fs.writeFileSync(statePath(), JSON.stringify(contents));

const readFile = () =>
  JSON.parse(fs.readFileSync(statePath(), 'utf8')) as Record<string, unknown>;

it('announces an early native fullscreen flag as system-owned before the completed entry event', () => {
  const { win, modes, sendWindowState } = placementFor('darwin');
  jest.spyOn(win, 'isFullScreen').mockReturnValue(true);
  // No enter-full-screen event has yet assigned the completed owner.
  expect(modes.isSystemFullScreen()).toBe(false);
  sendWindowState();
  expect(win.webContents.send).toHaveBeenCalledWith(
    'window-state-changed',
    expect.objectContaining({ isFullScreen: true, isSystemFullScreen: true }),
  );
});

// The full app and the amp are two windows to the listener, kept apart
// across a restart (Ivan, 2026-09-28: "we should preserve 3 window sizes",
// two of them the amps that were, one amp since 2026-10-25).
describe('the window-state file and the amp', () => {
  it('captures the full app at startup, before any move or mode switch', async () => {
    const { saveWindowState } = placementFor();
    saveWindowState();
    await flushPendingWrites();
    expect(readFile()).toMatchObject({ ...APP, mode: 'app' });
  });

  it('never writes the amp rectangle as the app during a native resize', async () => {
    const { modes, win, saveWindowState, loadWindowState } = placementFor();
    await modes.setMode(win, 'player');
    const duringReturn: object[] = [];
    win.on('resize', () => {
      saveWindowState();
      if (modes.mode() === 'app') {
        duringReturn.push(loadWindowState());
      }
    });
    await modes.setMode(win, 'app');
    await flushPendingWrites();
    expect(duringReturn).toHaveLength(2);
    duringReturn.forEach((state) => expect(state).toMatchObject(APP));
    expect(readFile()).toMatchObject({ ...APP, mode: 'app' });
  });

  it('keeps the app size and position across repeated switches with stale normal bounds', async () => {
    const { modes, win, reportNormal } = placementFor();
    reportNormal(AMP);
    await modes.setMode(win, 'player');
    await modes.setMode(win, 'app');
    expect(win.getBounds()).toEqual(APP);
    await modes.setMode(win, 'player');
    await modes.setMode(win, 'app');
    await flushPendingWrites();
    expect(win.getBounds()).toEqual(APP);
    expect(readFile()).toMatchObject({ ...APP, mode: 'app' });
  });

  it('remembers a new full-app placement before entering the amp', async () => {
    const { modes, win, drag, reportNormal } = placementFor();
    const movedApp = { ...APP, x: 80, width: 1300 };
    reportNormal(AMP);
    drag(movedApp);
    await modes.setMode(win, 'player');
    await flushPendingWrites();
    expect(readFile()).toMatchObject({ ...movedApp, mode: 'player' });
    await modes.setMode(win, 'app');
    expect(win.getBounds()).toEqual(movedApp);
  });

  it('repairs an old amp-sized full-app record before returning to it', async () => {
    const { modes, win, drag } = placementFor();
    modes.restore({
      mode: 'player',
      isPinned: false,
      app: AMP,
      player: AMP,
    });
    drag(AMP);
    await modes.setMode(win, 'app');
    await flushPendingWrites();
    const repaired = { x: 416, y: 34, width: 1024, height: 792 };
    expect(win.getBounds()).toEqual(repaired);
    expect(readFile()).toMatchObject({ ...repaired, mode: 'app' });
  });

  it('keeps the full app, where the amp was left, and that it closed as the amp', async () => {
    const { modes, win, drag, saveWindowState, loadWindowState } =
      placementFor();
    await modes.setMode(win, 'player');
    drag(AMP);
    saveWindowState();
    await flushPendingWrites();
    expect(loadWindowState()).toEqual(
      expect.objectContaining({
        ...APP,
        mode: 'player',
        player: AMP,
        playerRule: PLAYER_BOUNDS_RULE,
      }),
    );
    // Nothing of the two amps there were is written any more.
    expect(readFile()).not.toHaveProperty('amp');
    expect(readFile()).not.toHaveProperty('stagePlayer');
  });

  // A file from when there were two amps kept one of each: the one amp
  // opens where the last of them was left.
  it.each([
    ['the Stage', 'stage', STAGE],
    ['the 2.0 amp', 'classic', CLASSIC],
    ['the 2.0 amp, in a file from before there were two', undefined, CLASSIC],
  ])(
    'opens where %s was left, in a file written while there were two amps',
    (_name, amp, expected) => {
      writeFile({
        ...APP,
        mode: 'player',
        ...(amp ? { amp } : {}),
        player: CLASSIC,
        ...(amp ? { stagePlayer: STAGE } : {}),
        playerRule: PLAYER_BOUNDS_RULE,
      });
      expect(placementFor().loadWindowState().player).toEqual(expected);
    },
  );

  it('takes the other amp’s place where the one it closed as kept none', () => {
    writeFile({
      ...APP,
      mode: 'player',
      amp: 'stage',
      player: CLASSIC,
      playerRule: PLAYER_BOUNDS_RULE,
    });
    expect(placementFor().loadWindowState().player).toEqual(CLASSIC);
  });

  it('drops an amp written down under an older rule', () => {
    writeFile({
      ...APP,
      mode: 'player',
      amp: 'stage',
      player: CLASSIC,
      stagePlayer: STAGE,
      playerRule: PLAYER_BOUNDS_RULE - 1,
    });
    const saved = placementFor().loadWindowState();
    expect(saved.player).toBeUndefined();
    expect(saved.playerRule).toBeUndefined();
  });
});
