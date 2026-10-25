/** @jest-environment node */
/* FluidEQ — GPL-3.0-or-later */
import type { TWallpaperPause } from 'common/wallpaper';
import { DEFAULT_SCENE_PERFORMANCE } from 'common/scenePerformance';
import { createDesktopSurface } from 'main/wallpaper/surface';

const mockWindow = {
  showInactive: jest.fn(),
  destroy: jest.fn(),
  isDestroyed: () => false,
  on: jest.fn(),
  loadURL: () => Promise.resolve(),
  webContents: { isDestroyed: () => false, send: jest.fn(), on: jest.fn() },
};
jest.mock('electron', () => ({}));
jest.mock('main/wallpaper/window', () => ({
  createWallpaperWindow: () => mockWindow,
  wallpaperUrl: () => 'wallpaper.html',
}));
const originalPlatform = process.platform;
afterEach(() => {
  Object.defineProperty(process, 'platform', { value: originalPlatform });
  jest.clearAllMocks();
});

it.each([
  ['darwin', true, 1],
  ['win32', false, 0],
])(
  'preserves %s battery visibility while pausing animation and resuming in place',
  (platform, visible, shows) => {
    Object.defineProperty(process, 'platform', { value: platform });
    let reason: TWallpaperPause | undefined = 'battery';
    const host = { setVisible: jest.fn(), stop: jest.fn() };
    const surface = createDesktopSurface({
      displayId: 1,
      bounds: { x: 0, y: 0, width: 1440, height: 900 },
      choice: {
        lookId: 'premium:aurora',
        wave: { height: 1, position: 0 },
        motion: 'music',
      },
      scene: { pack: { id: 'aurora', version: 1 } as never, madeBy: 'fluideq' },
      performance: DEFAULT_SCENE_PERFORMANCE,
      tuning: undefined,
      daylight: () => undefined,
      pauseReason: () => reason,
      attach: (_window, report) => {
        report('ready');
        report('active');
        return host;
      },
      onReady: jest.fn(),
      onChange: jest.fn(),
      onFail: jest.fn(),
    });
    expect(host.setVisible).not.toHaveBeenCalled();
    surface.drawn(1);
    expect(surface.phase()).toBe('paused');
    expect(surface.pauseReason()).toBe('battery');
    expect(host.setVisible).toHaveBeenLastCalledWith(visible);
    expect(mockWindow.showInactive).toHaveBeenCalledTimes(Number(shows));
    expect(mockWindow.webContents.send).toHaveBeenLastCalledWith(
      'wallpaper-surface-changed',
      expect.objectContaining({ phase: 'paused', renderGeneration: 1 }),
    );
    reason = undefined;
    surface.applyPolicy();
    expect(surface.phase()).toBe('running');
    expect(host.setVisible).toHaveBeenLastCalledWith(true);
    reason = 'battery';
    surface.applyPolicy();
    expect(surface.phase()).toBe('paused');
    expect(host.setVisible).toHaveBeenLastCalledWith(visible);
    expect(surface.surfaceState().renderGeneration).toBe(1);
    surface.release();
    expect(host.stop).toHaveBeenCalledTimes(1);
  },
);
