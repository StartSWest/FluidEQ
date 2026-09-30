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
const CLASSIC = { x: 700, y: 60, width: 620, height: 700 };
const STAGE = { x: 200, y: 100, width: 900, height: 600 };

/** An ordinary window the listener drags about; nothing maximises it. */
const fakeWindow = () => {
  const events = new EventEmitter();
  let normal: IRect = { ...APP };
  const win = {
    on: events.on.bind(events),
    once: events.once.bind(events),
    isDestroyed: () => false,
    isVisible: () => true,
    isMaximized: () => false,
    isFullScreen: () => false,
    getBounds: () => ({ ...normal }),
    getNormalBounds: () => ({ ...normal }),
    setBounds: (next: Partial<IRect>) => {
      normal = { ...normal, ...next };
    },
    setMinimumSize: () => undefined,
    setMaximumSize: () => undefined,
    setMaximizable: () => undefined,
    setAlwaysOnTop: () => undefined,
    webContents: { getZoomFactor: () => 1 },
  };
  return {
    win: win as unknown as BrowserWindow,
    drag: (next: IRect) => {
      normal = { ...next };
      events.emit('resized');
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

const placementFor = () => {
  const modes = createWindowModes('win32');
  const { win, drag } = fakeWindow();
  modes.restore({
    mode: 'app',
    isPinned: false,
    app: {},
    amp: 'classic',
    players: {},
  });
  modes.followWindow(win);
  const placement = createWindowPlacement({
    userDataDir,
    getMainWindow: () => win,
    windowModes: modes,
  });
  return { modes, win, drag, ...placement };
};

const writeFile = (contents: object) =>
  fs.writeFileSync(
    path.join(userDataDir, 'window-state.json'),
    JSON.stringify(contents),
  );

// Ivan, 2026-09-28: "we should preserve 3 window sizes: the full app, the amp
// standard app and the amp backdrop glassy app" — across a restart too.
describe('the window-state file and the two amps', () => {
  it('keeps the full app, the 2.0 amp and the Stage, and which amp it closed as', async () => {
    const { modes, win, drag, saveWindowState, loadWindowState } =
      placementFor();
    await modes.setMode(win, 'player');
    drag(CLASSIC);
    modes.setAmp(win, 'stage');
    drag(STAGE);
    saveWindowState();
    const saved = loadWindowState();
    expect(saved).toEqual(
      expect.objectContaining({
        ...APP,
        mode: 'player',
        amp: 'stage',
        player: CLASSIC,
        stagePlayer: STAGE,
        playerRule: PLAYER_BOUNDS_RULE,
      }),
    );
  });

  it('reads a file from before there were two amps as the 2.0 amp’s', () => {
    writeFile({
      ...APP,
      mode: 'player',
      player: CLASSIC,
      playerRule: PLAYER_BOUNDS_RULE,
    });
    const saved = placementFor().loadWindowState();
    expect(saved.amp).toBe('classic');
    expect(saved.player).toEqual(CLASSIC);
    expect(saved.stagePlayer).toBeUndefined();
  });

  it('drops a Stage written down under an older rule, as it drops the 2.0 amp', () => {
    writeFile({
      ...APP,
      mode: 'player',
      amp: 'stage',
      player: CLASSIC,
      stagePlayer: STAGE,
      playerRule: PLAYER_BOUNDS_RULE - 1,
    });
    const saved = placementFor().loadWindowState();
    expect(saved.amp).toBe('stage');
    expect(saved.player).toBeUndefined();
    expect(saved.stagePlayer).toBeUndefined();
  });
});
