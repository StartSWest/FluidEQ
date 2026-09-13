/** @jest-environment node */
import type { BrowserWindow } from 'electron';
import { registerLightingIpc } from 'main/ipc/lighting';
import {
  DEFAULT_LIGHTING_SETTINGS,
  LIGHTING_STATE_CHANGED_CHANNEL,
  type ILightingState,
} from 'common/lighting/lightingModel';
import type { ILightingServiceDeps } from 'main/lighting/lightingService';

let mockPush: ILightingServiceDeps['push'];
jest.mock('main/lighting/lightingService', () => ({
  createLightingService: (deps: ILightingServiceDeps) => {
    mockPush = deps.push;
    return {};
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

it('publishes to a live renderer and stops when contents are destroyed before the window', () => {
  let contentsDestroyed = false;
  const send = jest.fn();
  const window = {
    isDestroyed: () => false,
    webContents: { isDestroyed: () => contentsDestroyed, send },
  } as unknown as BrowserWindow;
  registerLightingIpc({
    userDataDir: 'unused',
    appVersion: '1.0.0',
    getMainWindow: () => window,
    entitled: () => true,
  });
  mockPush(state);
  expect(send).toHaveBeenCalledWith(LIGHTING_STATE_CHANGED_CHANNEL, state);
  send.mockClear();
  contentsDestroyed = true;
  mockPush(state);
  expect(send).not.toHaveBeenCalled();
});
