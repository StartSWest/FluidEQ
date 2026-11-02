/** @jest-environment node */
import type { BrowserWindow, IpcMainEvent } from 'electron';
import { registerLightingIpc, type ILightingIpcDeps } from 'main/ipc/lighting';
import {
  DEFAULT_LIGHTING_SETTINGS,
  LIGHTING_STATE_CHANGED_CHANNEL,
  LIGHTING_WATCH_CHANNEL,
  type ILightingState,
} from 'common/lighting/lightingModel';
import {
  LIGHTING_PREVIEW_CHANNEL,
  LIGHTING_SCENE_CHANNEL,
  type ILampSceneChoice,
} from 'common/lighting/lampSceneChoice';
import type { ILightingServiceDeps } from 'main/lighting/lightingService';
import type { ILampScenesDeps } from 'main/lighting/lampScenes';
import onWindowMessage from 'main/ipc/windowMessages';

let mockPush: ILightingServiceDeps['push'];
let mockState: ILightingState | undefined;
const mockService = {
  state: () => mockState,
  watch: jest.fn(),
  frame: jest.fn(),
  release: jest.fn(),
  windowGone: jest.fn(),
  dispose: jest.fn(),
};
jest.mock('main/lighting/lightingService', () => ({
  createLightingService: (deps: ILightingServiceDeps) => {
    mockPush = deps.push;
    return mockService;
  },
}));
let mockLampDeps: ILampScenesDeps | undefined;
const mockLamps = {
  choose: jest.fn(),
  stateChanged: jest.fn(),
  watch: jest.fn(),
  pid: jest.fn(),
  dispose: jest.fn(),
};
jest.mock('main/lighting/lampScenes', () => ({
  createLampScenes: (deps: ILampScenesDeps) => {
    mockLampDeps = deps;
    return mockLamps;
  },
}));
jest.mock('main/ipc/windowMessages', () => ({
  __esModule: true,
  default: jest.fn(),
}));
jest.mock('electron', () => ({
  app: { on: jest.fn() },
  ipcMain: { handle: jest.fn() },
  shell: {},
}));

const state: ILightingState = {
  supported: true,
  searching: false,
  settings: DEFAULT_LIGHTING_SETTINGS,
  devices: [],
  synapse: 'running',
  hasRazerDevices: false,
  heldByWindows: [],
  canOpenRazerChroma: true,
  live: false,
};

const lampScenes: ILightingIpcDeps['lampScenes'] = {
  executable: 'C:\\FluidEQ\\FluidEQ-Scenes.exe',
  angleDir: 'C:\\FluidEQ',
  log: { warn: jest.fn() },
  loadScene: () => undefined,
  subscribeScenes: () => () => undefined,
  kept: { read: () => null, keep: jest.fn() },
};

const choice: ILampSceneChoice = {
  scene: {
    lookId: 'premium:aurora',
    identity: 'premium:aurora@3',
    swatch: ['#112233'],
    guarded: false,
  },
  paused: false,
  daylight: { clock: true },
  accent: [0, 0.9, 0.8],
};

const windowWith = (send: jest.Mock, destroyed = () => false) => {
  const contents = {
    isDestroyed: destroyed,
    send,
    on: jest.fn(),
    once: jest.fn(),
  };
  return {
    isDestroyed: () => false,
    webContents: contents,
  } as unknown as BrowserWindow;
};

/** The handler main registered for `channel`, as the window reaches it. */
const handlerOf = (channel: string) => {
  const calls = (onWindowMessage as jest.Mock).mock.calls as [
    string,
    (event: IpcMainEvent, payload: unknown) => void,
  ][];
  const found = [...calls].reverse().find(([name]) => name === channel);
  if (!found) {
    throw new Error(`no handler for ${channel}`);
  }
  return found[1];
};

beforeEach(() => {
  jest.clearAllMocks();
  mockState = state;
});

it('publishes to a live renderer and stops when contents are destroyed before the window', () => {
  let contentsDestroyed = false;
  const send = jest.fn();
  registerLightingIpc({
    userDataDir: 'unused',
    appVersion: '1.0.0',
    getMainWindow: () => windowWith(send, () => contentsDestroyed),
    entitled: () => true,
    lampScenes,
  });
  mockPush(state);
  expect(send).toHaveBeenCalledWith(LIGHTING_STATE_CHANGED_CHANNEL, state);
  send.mockClear();
  contentsDestroyed = true;
  mockPush(state);
  expect(send).not.toHaveBeenCalled();
});

it('hands the lamps to the scene host, which follows the lighting state', () => {
  // The lamps used to be drawn by the window, which a window in the tray was
  // kept loaded for; main's scene host draws them now and hears every state.
  registerLightingIpc({
    userDataDir: 'unused',
    appVersion: '1.0.0',
    getMainWindow: () => null,
    entitled: () => true,
    lampScenes,
  });
  expect(mockLamps.stateChanged).toHaveBeenLastCalledWith(state);
  const off = { ...state, settings: { ...state.settings, enabled: false } };
  mockPush(off);
  expect(mockLamps.stateChanged).toHaveBeenLastCalledWith(off);

  // What the host draws reaches the devices through the service.
  const frame = { width: 48 } as never;
  mockLampDeps?.frame(frame);
  expect(mockService.frame).toHaveBeenCalledWith(frame);
  mockLampDeps?.release();
  expect(mockService.release).toHaveBeenCalled();
});

it('takes the window’s choice of scene, and nothing that is not one', () => {
  const send = jest.fn();
  const window = windowWith(send);
  registerLightingIpc({
    userDataDir: 'unused',
    appVersion: '1.0.0',
    getMainWindow: () => window,
    entitled: () => true,
    lampScenes,
  });
  const fromWindow = { sender: window.webContents } as IpcMainEvent;
  handlerOf(LIGHTING_SCENE_CHANNEL)(fromWindow, choice);
  expect(mockLamps.choose).toHaveBeenCalledWith(choice);

  mockLamps.choose.mockClear();
  handlerOf(LIGHTING_SCENE_CHANNEL)(fromWindow, { ...choice, accent: [2] });
  // Another page than the app's own window is not heard either.
  handlerOf(LIGHTING_SCENE_CHANNEL)({ sender: {} } as IpcMainEvent, choice);
  expect(mockLamps.choose).not.toHaveBeenCalled();
});

it('shows the page the lamps’ frames only while the page is open', () => {
  const send = jest.fn();
  const window = windowWith(send);
  registerLightingIpc({
    userDataDir: 'unused',
    appVersion: '1.0.0',
    getMainWindow: () => window,
    entitled: () => true,
    lampScenes,
  });
  const fromWindow = { sender: window.webContents } as IpcMainEvent;
  handlerOf(LIGHTING_WATCH_CHANNEL)(fromWindow, true);
  expect(mockService.watch).toHaveBeenCalledWith(true);
  expect(mockLamps.watch).toHaveBeenCalledWith(true);

  const preview = { frame: { width: 48 } } as never;
  mockLampDeps?.preview(preview);
  expect(send).toHaveBeenCalledWith(LIGHTING_PREVIEW_CHANNEL, preview);
});

it('ends the scene host with the service', () => {
  const lighting = registerLightingIpc({
    userDataDir: 'unused',
    appVersion: '1.0.0',
    getMainWindow: () => null,
    entitled: () => true,
    lampScenes,
  });
  lighting.dispose();
  expect(mockLamps.dispose).toHaveBeenCalled();
  expect(mockService.dispose).toHaveBeenCalled();
});
