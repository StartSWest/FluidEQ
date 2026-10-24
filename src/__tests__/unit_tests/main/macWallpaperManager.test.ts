/** @jest-environment node */
import {
  connect,
  flush,
  mockElectron,
  mockScreenListeners,
  mockSurfaceModule,
  mockSurfaces,
  request,
  setDisplays,
  setUpWindowsDesk,
  setup,
} from '../../utils/wallpaperManagerHarness';

jest.mock('electron', () => {
  const electron = mockElectron();
  return {
    ...electron,
    screen: {
      ...electron.screen,
      dipToScreenRect: () => {
        throw new Error('Windows-only API');
      },
    },
  };
});
jest.mock('main/wallpaper/surface', () => mockSurfaceModule());

/* eslint-disable import/first -- install Electron and surface mocks before the manager */
import { createWallpaperManager } from '../../../main/wallpaper/manager';
/* eslint-enable import/first */

setUpWindowsDesk();
beforeEach(() =>
  Object.defineProperty(process, 'platform', { value: 'darwin' }),
);

const desk = () => {
  const retina = {
    ...connect(1, 0, 'MacBook Pro', { width: 1728, height: 1117 }),
    scaleFactor: 2,
  };
  const external = connect(2, -1920, 'External', { width: 1920, height: 1080 });
  setDisplays([retina, external]);
  return { retina, external };
};

it('starts a separate background at each Mac monitor’s point bounds, with Retina resolution labels', () => {
  const { retina, external } = desk();
  const { deps, file } = setup();
  const manager = createWallpaperManager(deps);
  expect(manager.state().supported).toBe(true);
  expect(manager.state().displays).toEqual([
    {
      id: 1,
      label: 'MacBook Pro',
      ...retina.bounds,
      primary: true,
      pixelWidth: 3456,
      pixelHeight: 2234,
    },
    {
      id: 2,
      label: 'External',
      ...external.bounds,
      primary: false,
      pixelWidth: 1920,
      pixelHeight: 1080,
    },
  ]);
  manager.start(request({ displayIds: [1, 2] }));
  expect(mockSurfaces).toEqual([
    expect.objectContaining({ displayId: 1, bounds: retina.bounds }),
    expect.objectContaining({ displayId: 2, bounds: external.bounds }),
  ]);
  expect(file().screens).toHaveLength(2);
  manager.stop([1]);
  expect(manager.state().screens.map((entry) => entry.displayId)).toEqual([2]);
  expect(mockSurfaces[0].release).toHaveBeenCalledTimes(1);
  expect(mockSurfaces[1].release).not.toHaveBeenCalled();
  manager.dispose();
});

it('keeps an unplugged monitor’s choice and restores it on reconnect without moving the other background', async () => {
  const { retina, external } = desk();
  const { deps, file } = setup();
  const manager = createWallpaperManager(deps);
  await flush();
  manager.start(request({ displayIds: [1, 2] }));
  setDisplays([retina]);
  mockScreenListeners.get('display-removed')?.({}, external);
  expect(manager.state().screens).toContainEqual(
    expect.objectContaining({ displayId: 2, error: 'missing-display' }),
  );
  expect(file().screens).toHaveLength(2);
  setDisplays([retina, external]);
  mockScreenListeners.get('display-added')?.({}, external);
  expect(manager.state().screens.map((entry) => entry.phase)).toEqual([
    'running',
    'running',
  ]);
  expect(mockSurfaces[0].release).not.toHaveBeenCalled();
  expect(mockSurfaces[2]).toEqual(
    expect.objectContaining({ displayId: 2, bounds: external.bounds }),
  );
  manager.dispose();
});

it('rebuilds a resized or rescaled Mac monitor at its new bounds and restores both choices on relaunch', async () => {
  const { retina, external } = desk();
  const { deps, file } = setup();
  const manager = createWallpaperManager(deps);
  await flush();
  manager.start(request({ displayIds: [1, 2] }));
  const moved = {
    ...external,
    bounds: { ...external.bounds, x: 1728, y: -200 },
    scaleFactor: 2,
  };
  setDisplays([retina, moved]);
  mockScreenListeners.get('display-metrics-changed')?.({}, moved, [
    'bounds',
    'scaleFactor',
  ]);
  expect(mockSurfaces[2]).toEqual(
    expect.objectContaining({ displayId: 2, bounds: moved.bounds }),
  );
  expect(
    file().screens.find((entry) => entry.displayId === 2)?.monitor,
  ).toEqual({
    label: 'External',
    ...moved.bounds,
  });
  expect(mockSurfaces[0].release).not.toHaveBeenCalled();
  manager.dispose();
  const restored = createWallpaperManager(setup(file()).deps);
  restored.restoreSaved();
  expect(
    restored
      .state()
      .screens.map((entry) => entry.displayId)
      .sort(),
  ).toEqual([1, 2]);
  restored.dispose();
});
