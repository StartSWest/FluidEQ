/* FluidEQ — GPL-3.0-or-later */
import { EventEmitter } from 'events';
import { spawn } from 'child_process';

jest.mock('child_process', () => ({ spawn: jest.fn() }));
jest.mock('electron-log', () => ({ info: jest.fn(), warn: jest.fn() }));

const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
let media: typeof import('../../../main/systemMedia') | undefined;
beforeEach(() => {
  Object.defineProperty(process, 'platform', { value: 'linux' });
  jest.isolateModules(() => {
    media = jest.requireActual<typeof import('../../../main/systemMedia')>(
      '../../../main/systemMedia',
    );
  });
});
afterEach(() => {
  media?.stopWatchingSystemMedia();
  if (originalPlatform) {
    Object.defineProperty(process, 'platform', originalPlatform);
  }
  jest.clearAllMocks();
});

const helper = () => {
  const stdout = Object.assign(new EventEmitter(), { setEncoding: jest.fn() });
  const input = Object.assign(new EventEmitter(), {
    writable: true,
    write: jest.fn((_text: string, callback: () => void) => {
      callback();
      return true;
    }),
    end: jest.fn(),
  });
  const child = Object.assign(new EventEmitter(), { stdin: input, stdout });
  (spawn as jest.Mock).mockReturnValue(child);
  return { stdout, input };
};

it('uses the Linux helper and owning process while sharing snapshot parsing', async () => {
  const test = helper();
  const listener = jest.fn();
  expect(media?.SYSTEM_MEDIA_EXECUTABLE).toBe('FluidEQ-Media');
  media?.watchSystemMedia(listener, () => '/native/FluidEQ-Media');
  expect(spawn).toHaveBeenCalledWith(
    '/native/FluidEQ-Media',
    [String(process.pid)],
    expect.anything(),
  );
  test.stdout.emit(
    'data',
    `${JSON.stringify({
      app: 'org.mpris.MediaPlayer2.test',
      title: 'Track',
      artist: 'Artist',
      isPlaying: true,
      positionMs: 1234,
      durationMs: 180000,
      canSeek: true,
      playing: ['org.mpris.MediaPlayer2.test'],
      artUrl: '',
    })}\n`,
  );
  expect(listener).toHaveBeenLastCalledWith(
    expect.objectContaining({
      title: 'Track',
      artist: 'Artist',
      isPlaying: true,
      positionMs: 1234,
      canSeek: true,
    }),
  );
  await media?.sendSystemMediaCommand('seek', 4000);
  await media?.pauseOtherSystemPlayers('org.mpris.MediaPlayer2.test');
  await media?.sendLinuxSystemMediaCommand('playPause');
  expect(test.input.write.mock.calls.map(([line]) => line)).toEqual([
    'seek 4000\n',
    'pauseOthers org.mpris.MediaPlayer2.test\n',
    'playPause\n',
  ]);
  expect(spawn).toHaveBeenCalledTimes(1);
});

it('bounds seek values and never lets an app id inject a helper command', async () => {
  const test = helper();
  media?.watchSystemMedia(jest.fn(), () => '/native/FluidEQ-Media');
  await media?.sendLinuxSystemMediaCommand('seek', NaN);
  await media?.sendLinuxSystemMediaCommand('seek', -20);
  await media?.pauseOtherSystemPlayers('bad\nnext');
  expect(test.input.write.mock.calls.map(([line]) => line)).toEqual([
    'seek 0\n',
    'pauseOthers\n',
  ]);
});
