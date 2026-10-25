/* FluidEQ — GPL-3.0-or-later */
import createGroupMediaTransport, {
  type IGroupMediaSnapshot,
} from '../../../renderer/remoteAudio/groupMediaTransport';
import { isRemoteAudioSignal } from '../../../common/remoteAudio';

let snapshot: IGroupMediaSnapshot;
const local = jest.fn();
const send = jest.fn();
const peer = (id: string, isPlaying: boolean) => ({
  id,
  isPlaying,
  canToggle: true,
});
const create = () => createGroupMediaTransport(() => snapshot, local, send);
beforeEach(() => {
  local.mockClear();
  send.mockClear();
  snapshot = {
    local: { isPlaying: false, canToggle: true },
    peers: [],
    preferLocal: true,
  };
});

it('resolves a headset toggle to Pause for all PCs, without starting paused PCs', () => {
  snapshot.peers = [peer('music-pc', true), peer('paused-pc', false)];
  const router = create();
  router.execute({ command: 'toggle' });
  expect(local).toHaveBeenCalledWith({ command: 'pause' });
  expect(send.mock.calls).toEqual([
    ['music-pc', { command: 'pause' }],
    ['paused-pc', { command: 'pause' }],
  ]);
  snapshot.peers = [peer('music-pc', false), peer('paused-pc', false)];
  send.mockClear();
  router.execute({ command: 'toggle' });
  expect(send.mock.calls).toEqual([['music-pc', { command: 'play' }]]);
  expect(local).toHaveBeenCalledTimes(1);
});

it('retains the whole playing cohort as pause reports arrive at different times', () => {
  snapshot.local.isPlaying = true;
  snapshot.peers = [peer('one', true), peer('two', true)];
  const router = create();
  router.execute({ command: 'pause' });
  snapshot.local.isPlaying = false;
  snapshot.peers = [peer('one', false), peer('two', true)];
  router.observe();
  snapshot.peers = [peer('one', false), peer('two', false)];
  router.observe();
  send.mockClear();
  local.mockClear();
  router.execute({ command: 'play' });
  expect(local).toHaveBeenCalledWith({ command: 'play' });
  expect(send.mock.calls).toEqual([
    ['one', { command: 'play' }],
    ['two', { command: 'play' }],
  ]);
});

it.each(['next', 'previous', 'stop'] as const)(
  'passes %s to the PCs playing audio once each',
  (command) => {
    snapshot.local.isPlaying = true;
    snapshot.peers = [peer('music-pc', true), peer('silent-pc', false)];
    create().execute({ command });
    expect(local).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith('music-pc', { command });
    expect(send).toHaveBeenCalledTimes(command === 'stop' ? 2 : 1);
  },
);

it('keeps next and relative/absolute seeks on the paused source and drops an unlinked PC', () => {
  snapshot.peers = [peer('music-pc', true)];
  const router = create();
  router.observe();
  snapshot.peers = [peer('music-pc', false)];
  router.execute({ command: 'next' });
  router.execute({ command: 'nudge', deltaMs: -5000 });
  router.execute({ command: 'seek', positionMs: 12000 });
  expect(send.mock.calls).toEqual([
    ['music-pc', { command: 'next' }],
    ['music-pc', { command: 'nudge', deltaMs: -5000 }],
    ['music-pc', { command: 'seek', positionMs: 12000 }],
  ]);
  snapshot.peers = [];
  send.mockClear();
  router.execute({ command: 'next' });
  expect(send).not.toHaveBeenCalled();
});

it('replaces old resume targets when a new PC starts playing', () => {
  snapshot.peers = [peer('one', true), peer('two', false)];
  const router = create();
  router.observe();
  snapshot.peers = [peer('one', false), peer('two', true)];
  router.observe();
  snapshot.peers = [peer('one', false), peer('two', false)];
  router.execute({ command: 'play' });
  expect(send.mock.calls).toEqual([['two', { command: 'play' }]]);
});

it('pauses all connected computers even without now-playing metadata', () => {
  snapshot.local.canToggle = false;
  snapshot.peers = [{ id: 'unknown', isPlaying: false, canToggle: false }];
  create().execute({ command: 'pause' });
  expect(local).toHaveBeenCalledWith({ command: 'pause' });
  expect(send).toHaveBeenCalledWith('unknown', { command: 'pause' });
});

it('accepts explicit Play/seek on the wire, rejects volume and malformed seeks', () => {
  expect(isRemoteAudioSignal({ kind: 'transport', command: 'play' })).toBe(
    true,
  );
  expect(
    isRemoteAudioSignal({
      kind: 'transport',
      command: 'seek',
      positionMs: 1200,
    }),
  ).toBe(true);
  [
    -1,
    0.5,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.MAX_SAFE_INTEGER + 1,
  ].forEach((positionMs) => {
    expect(
      isRemoteAudioSignal({ kind: 'transport', command: 'seek', positionMs }),
    ).toBe(false);
  });
  expect(
    isRemoteAudioSignal({ kind: 'transport', command: 'volume', level: 0 }),
  ).toBe(false);
  expect(isRemoteAudioSignal({ kind: 'transport', command: 'mute' })).toBe(
    false,
  );
});
