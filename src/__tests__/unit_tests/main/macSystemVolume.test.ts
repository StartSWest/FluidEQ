/** @jest-environment node */
/* FluidEQ — GPL-3.0-or-later */
import { existsSync } from 'fs';
import { parseSystemVolumeLine } from 'common/systemVolume';

jest.mock('fs', () => ({ existsSync: jest.fn(() => true) }));
jest.mock('electron-log', () => ({ info: jest.fn(), warn: jest.fn() }));
jest.mock('main/ipc/windowMessages', () => jest.fn());
const original = process.platform;
afterEach(() =>
  Object.defineProperty(process, 'platform', { value: original }),
);

it.each([
  ['darwin', 'FluidEQ-Volume'],
  ['win32', 'FluidEQ-Volume.exe'],
  ['linux', undefined],
])('locates the actual native system-volume helper on %s', (platform, name) => {
  Object.defineProperty(process, 'platform', { value: platform });
  jest.mocked(existsSync).mockClear();
  jest.isolateModules(() => {
    const backend =
      jest.requireActual<typeof import('main/systemVolume')>(
        'main/systemVolume',
      );
    expect(backend.SYSTEM_VOLUME_EXECUTABLE).toBe(name);
    const executable = backend.findSystemVolumeExecutable();
    expect(executable?.split(/[\\/]/).pop()).toBe(name);
  });
});

it('keeps unknown hardware values unknown and reports each capability independently', () => {
  expect(parseSystemVolumeLine('volume\t-\t1\t0\t1\t73')).toEqual({
    isMuted: true,
    canSetLevel: false,
    canMute: true,
    deviceId: '73',
  });
  expect(parseSystemVolumeLine('volume\t0.5000\t-\t1\t0\t74')).toEqual({
    level: 0.5,
    canSetLevel: true,
    canMute: false,
    deviceId: '74',
  });
  expect(parseSystemVolumeLine('volume\t-\t-\t0\t0\t74')).toEqual({
    canSetLevel: false,
    canMute: false,
    deviceId: '74',
  });
  expect(parseSystemVolumeLine('volume\t-\t-\t1\t1\t74')).toBeUndefined();
  expect(parseSystemVolumeLine('volume\t1.1\t0\t1\t1\t74')).toBeUndefined();
});
