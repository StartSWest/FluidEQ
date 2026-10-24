/* FluidEQ — GPL-3.0-or-later */
import performLocalTransport from '../../../renderer/remoteAudio/localTransportCommand';
import {
  registerPlayer,
  resetPlaybackOwner,
} from '../../../renderer/audio/playbackOwner';
import type { ITransportSource } from '../../../renderer/audio/transportSource';

const original = window.electron;
const pauseOtherSystemPlayers = jest.fn().mockResolvedValue(undefined);
const sendSystemMediaCommand = jest.fn().mockResolvedValue(undefined);
const sendMediaTransport = jest.fn();
const source = (
  owner: ITransportSource['owner'],
  isPlaying = false,
): ITransportSource => ({
  owner,
  title: 'Music',
  isPlaying,
  positionMs: 2000,
  durationMs: 10000,
  toggle: jest.fn(),
  stop: jest.fn(),
  next: jest.fn(),
  previous: jest.fn(),
  seek: jest.fn(),
});
beforeEach(() => {
  resetPlaybackOwner();
  jest.clearAllMocks();
  window.electron = {
    ipcRenderer: {
      pauseOtherSystemPlayers,
      sendSystemMediaCommand,
      sendMediaTransport,
    },
  } as unknown as typeof original;
});
afterEach(() => {
  window.electron = original;
  resetPlaybackOwner();
});

it('pauses all local players even without a bar, sparing the remote relay', () => {
  const library = jest.fn();
  const media = jest.fn();
  const relay = jest.fn();
  registerPlayer('library', library);
  registerPlayer('media', media);
  registerPlayer('remote', relay);
  performLocalTransport(undefined, { command: 'pause' });
  expect(library).toHaveBeenCalledTimes(1);
  expect(media).toHaveBeenCalledTimes(1);
  expect(pauseOtherSystemPlayers).toHaveBeenCalledTimes(1);
  expect(relay).not.toHaveBeenCalled();
  expect(sendMediaTransport).not.toHaveBeenCalled();
});

it('uses explicit OS commands, avoiding the globally captured media key', () => {
  performLocalTransport(source('system', false), { command: 'play' });
  performLocalTransport(source('system', true), { command: 'toggle' });
  expect(sendSystemMediaCommand.mock.calls).toEqual([['play'], ['pause']]);
  expect(sendMediaTransport).not.toHaveBeenCalled();
});

it('never toggles an already playing or unavailable source for explicit Play', () => {
  const playing = source('library', true);
  const disabled = { ...source('media'), canToggle: false };
  performLocalTransport(playing, { command: 'play' });
  performLocalTransport(disabled, { command: 'play' });
  expect(playing.toggle).not.toHaveBeenCalled();
  expect(disabled.toggle).not.toHaveBeenCalled();
});

it('does not send an incoming command back to its remote source', () => {
  const remote = source('remote');
  performLocalTransport(remote, { command: 'next' });
  performLocalTransport(remote, { command: 'toggle' });
  performLocalTransport(remote, { command: 'stop' });
  expect(remote.next).not.toHaveBeenCalled();
  expect(remote.toggle).not.toHaveBeenCalled();
  expect(remote.stop).not.toHaveBeenCalled();
});

it('resolves relative and absolute seeks against the local playhead and duration', () => {
  const local = source('library');
  performLocalTransport(local, { command: 'nudge', deltaMs: -5000 });
  performLocalTransport(local, { command: 'seek', positionMs: 50000 });
  expect(local.seek).toHaveBeenNthCalledWith(1, 0);
  expect(local.seek).toHaveBeenNthCalledWith(2, 10000);
});
