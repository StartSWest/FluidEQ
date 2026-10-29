/* FluidEQ — GPL-3.0-or-later */
import { act, render } from '@testing-library/react';
import type { TRemoteTransportCommand } from '../../../common/remoteAudio';
import { resetPlaybackOwner } from '../../../renderer/audio/playbackOwner';
import {
  resetTransportSource,
  setTransportSource,
} from '../../../renderer/audio/transportSource';
import GroupMediaTransportHost from '../../../renderer/remoteAudio/GroupMediaTransportHost';
import { remoteAudioLink } from '../../utils/remoteAudioValue';

const original = window.electron;
const perform = jest.fn();
const sendRemoteAudioLanSignal = jest.fn().mockResolvedValue(undefined);
const watchGroupMediaKeys = jest.fn().mockResolvedValue(undefined);
const off = jest.fn();
let listener: ((command: TRemoteTransportCommand) => void) | undefined;
beforeEach(() => {
  resetPlaybackOwner();
  resetTransportSource();
  jest.clearAllMocks();
  listener = undefined;
  window.electron = {
    ipcRenderer: {
      sendRemoteAudioLanSignal,
      watchGroupMediaKeys,
      onGroupMediaCommand: (next: typeof listener) => {
        listener = next;
        return off;
      },
    },
  } as unknown as typeof original;
});
afterEach(() => {
  window.electron = original;
  resetPlaybackOwner();
  resetTransportSource();
});

it('keeps its external-store hooks stable across joining, player updates and leaving', () => {
  const link = remoteAudioLink({
    nowPlaying: {
      title: 'Remote music',
      isPlaying: true,
      positionMs: 0,
      durationMs: 10000,
      canNext: true,
      canPrevious: true,
      canStep: true,
      canStop: true,
    },
  });
  const view = render(<GroupMediaTransportHost links={[]} perform={perform} />);
  expect(watchGroupMediaKeys).not.toHaveBeenCalled();
  view.rerender(<GroupMediaTransportHost links={[link]} perform={perform} />);
  expect(watchGroupMediaKeys).toHaveBeenCalledWith(true);
  act(() => listener?.({ command: 'next' }));
  expect(sendRemoteAudioLanSignal).toHaveBeenLastCalledWith({
    peerId: link.id,
    signal: { kind: 'transport', command: 'next' },
  });
  act(() =>
    setTransportSource({
      owner: 'library',
      title: 'Local music',
      isPlaying: true,
      positionMs: 0,
      durationMs: 10000,
      toggle: jest.fn(),
    }),
  );
  act(() => listener?.({ command: 'toggle' }));
  expect(perform).toHaveBeenLastCalledWith({ command: 'pause' });
  expect(watchGroupMediaKeys).toHaveBeenCalledTimes(1);
  view.rerender(<GroupMediaTransportHost links={[]} perform={perform} />);
  expect(off).toHaveBeenCalledTimes(1);
  expect(watchGroupMediaKeys).toHaveBeenLastCalledWith(false);
  view.unmount();
});

it('does not capture media keys for a link paused at either computer', () => {
  const link = remoteAudioLink({
    theirs: { sends: true, plays: true, paused: true },
  });
  render(<GroupMediaTransportHost links={[link]} perform={perform} />);
  expect(watchGroupMediaKeys).not.toHaveBeenCalled();
});

it('sends a command once through the newest connection during a reconnect', () => {
  const old = remoteAudioLink({
    id: 'old-socket',
    computerId: 'same-computer',
    nowPlaying: {
      title: 'Music',
      isPlaying: true,
      positionMs: 0,
      durationMs: 1000,
      canNext: true,
      canPrevious: true,
      canStep: true,
      canStop: true,
    },
  });
  const next = remoteAudioLink({
    id: 'new-socket',
    computerId: 'same-computer',
  });
  render(<GroupMediaTransportHost links={[old, next]} perform={perform} />);
  act(() => listener?.({ command: 'next' }));
  expect(sendRemoteAudioLanSignal).toHaveBeenCalledTimes(1);
  expect(sendRemoteAudioLanSignal).toHaveBeenCalledWith({
    peerId: 'new-socket',
    signal: { kind: 'transport', command: 'next' },
  });
});

it('keeps the OS media session registered across play-state changes', () => {
  const previous = Object.getOwnPropertyDescriptor(navigator, 'mediaSession');
  const states: MediaSessionPlaybackState[] = [];
  const session = { setActionHandler: jest.fn() };
  Object.defineProperty(session, 'playbackState', {
    set: (value: MediaSessionPlaybackState) => {
      states.push(value);
    },
  });
  Object.defineProperty(navigator, 'mediaSession', {
    configurable: true,
    value: session,
  });
  try {
    const link = remoteAudioLink({
      nowPlaying: {
        title: 'Music',
        isPlaying: true,
        positionMs: 0,
        durationMs: 1000,
        canNext: true,
        canPrevious: true,
        canStep: true,
        canStop: true,
      },
    });
    const view = render(
      <GroupMediaTransportHost links={[link]} perform={perform} />,
    );
    view.rerender(
      <GroupMediaTransportHost
        links={[
          {
            ...link,
            nowPlaying: link.nowPlaying && {
              ...link.nowPlaying,
              isPlaying: false,
            },
          },
        ]}
        perform={perform}
      />,
    );
    expect(states).toEqual(['playing', 'paused']);
    view.unmount();
    expect(states).toEqual(['playing', 'paused', 'none']);
  } finally {
    if (previous) {
      Object.defineProperty(navigator, 'mediaSession', previous);
    } else {
      Reflect.deleteProperty(navigator, 'mediaSession');
    }
  }
});
