/** @jest-environment node */
import type { BrowserWindowConstructorOptions } from 'electron';
import { createWallpaperWindow } from 'main/wallpaper/window';

const mockCreate = jest.fn();
const mockWindow = {
  setIgnoreMouseEvents: jest.fn(),
  webContents: { setWindowOpenHandler: jest.fn(), on: jest.fn() },
};
jest.mock('electron', () => ({
  app: { isPackaged: false, getAppPath: () => '/FluidEQ' },
  BrowserWindow: jest
    .fn()
    .mockImplementation((options: BrowserWindowConstructorOptions) => {
      mockCreate(options);
      return mockWindow;
    }),
  session: {
    fromPartition: () => ({
      setPermissionRequestHandler: jest.fn(),
      setPermissionCheckHandler: jest.fn(),
      webRequest: { onHeadersReceived: jest.fn() },
    }),
  },
}));
jest.mock('main/util', () => ({ resolveHtmlPath: () => 'wallpaper.html' }));

const originalPlatform = process.platform;
afterAll(() =>
  Object.defineProperty(process, 'platform', { value: originalPlatform }),
);

it('uses the native Mac desktop type for all Spaces, passing clicks through on every monitor', () => {
  Object.defineProperty(process, 'platform', { value: 'darwin' });
  const bounds = [
    { x: -1920, y: -200, width: 1920, height: 1080 },
    { x: 0, y: 0, width: 1728, height: 1117 },
  ];
  bounds.forEach((rect) => createWallpaperWindow(rect));
  expect(mockCreate).toHaveBeenCalledTimes(2);
  bounds.forEach((rect, index) => {
    expect(mockCreate.mock.calls[index][0]).toEqual(
      expect.objectContaining({
        ...rect,
        type: 'desktop',
        focusable: false,
        frame: false,
        enableLargerThanScreen: true,
        roundedCorners: false,
        fullscreenable: false,
        show: false,
        webPreferences: expect.objectContaining({
          backgroundThrottling: true,
          sandbox: true,
          nodeIntegration: false,
        }),
      }),
    );
    expect(mockCreate.mock.calls[index][0]).not.toHaveProperty(
      'hiddenInMissionControl',
    );
  });
  expect(mockWindow.setIgnoreMouseEvents.mock.calls).toEqual([[true], [true]]);
});

it('leaves the Windows helper in charge of its desktop placement and occlusion', () => {
  Object.defineProperty(process, 'platform', { value: 'win32' });
  createWallpaperWindow({ x: 0, y: 0, width: 2560, height: 1440 });
  const options = mockCreate.mock.calls[mockCreate.mock.calls.length - 1][0];
  expect(options.type).toBeUndefined();
  expect(options.webPreferences.backgroundThrottling).toBe(false);
});
