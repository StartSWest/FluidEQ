/* FluidEQ — GPL-3.0-or-later */

/**
 * The window's side of Share Audio: the links it shows, kept through
 * restarts and network drops, and what follows from them here.
 *
 * Main does the sending and the playing; the cases here are the window's
 * own decisions — linking again under the saved code, trying again when the
 * network comes back and never after Unlink, the picture of each link as its
 * messages arrive, the Library held untouched while this computer sends, and
 * the one-player switch set from a linked computer.
 */

import { act, render } from '@testing-library/react';
import type { ILanRemoteAudioSignal } from 'common/remoteAudio';
import { readRackGate, resetRackGate } from 'renderer/dsp/rackPlacement';
import {
  isTransportPlaying,
  resetTransportSource,
  useTransportSources,
} from 'renderer/audio/transportSource';
import RemoteAudioProvider from 'renderer/remoteAudio/RemoteAudioContext';
import type { IRemoteAudioValue } from 'renderer/remoteAudio/remoteAudioState';
import {
  useRemoteAudio,
  useRemoteAudioReceiving,
} from 'renderer/remoteAudio/remoteAudioValueContext';
import {
  isSinglePlayerEnabled,
  setSinglePlayer,
} from 'renderer/utils/singlePlayer';

const mockSetSharingAudio = jest.fn();

// What plays sound and opens devices; this is about the decisions alone.
jest.mock('renderer/remoteAudio/useRemoteAudioMixer', () => ({
  __esModule: true,
  default: () => ({
    mixerRef: { current: undefined },
    removePeer: jest.fn(),
    resume: jest.fn(),
  }),
}));
jest.mock('renderer/remoteAudio/useSelectedRemoteAudioOutput', () => ({
  __esModule: true,
  default: () => undefined,
}));
jest.mock('renderer/remoteAudio/useRemoteAudioPcmSender', () => ({
  __esModule: true,
  default: () => undefined,
}));
jest.mock('renderer/audio/LiveAudioContext', () => ({
  useLiveAudioControl: () => ({ setSharingAudio: mockSetSharingAudio }),
}));
jest.mock('renderer/utils/FluidEqContext', () => ({
  useFluidEqShell: () => ({ activeDeviceId: 'default' }),
}));
jest.mock('renderer/dsp/store', () => ({
  ...jest.requireActual('renderer/dsp/store'),
  publishSystemDspChain: jest.fn(),
}));

type TListener<T> = (value: T) => void;
const listeners = {
  signal: new Set<TListener<ILanRemoteAudioSignal>>(),
  sending: new Set<TListener<boolean>>(),
  streaming: new Set<TListener<string>>(),
};
const subscribe =
  <T,>(set: Set<TListener<T>>) =>
  (listener: TListener<T>) => {
    set.add(listener);
    return () => set.delete(listener);
  };

const CODE = 'FLUIDEQ-LAN-2.saved';
const STARTED = {
  details: { deviceName: 'GAMING', code: CODE, computerId: 'g'.repeat(32) },
  joins: [] as { computerId: string; deviceName: string }[],
  links: [] as ILanRemoteAudioSignal[],
};

const bridge = {
  hasSavedRemoteAudioLan: jest.fn(),
  startRemoteAudioLan: jest.fn(),
  joinRemoteAudioLan: jest.fn(),
  unlinkRemoteAudioLan: jest.fn(),
  retryRemoteAudioLan: jest.fn(),
  sendRemoteAudioLanSignal: jest.fn(),
  setRemoteAudioLinkSwitches: jest.fn(),
  getRemoteAudioLinkSwitches: jest.fn(),
  pauseOtherSystemPlayers: jest.fn(),
  onRemoteAudioLanSignal: subscribe(listeners.signal),
  onRemoteAudioLanSending: subscribe(listeners.sending),
  onRemoteAudioLanStreaming: subscribe(listeners.streaming),
};

let latest: IRemoteAudioValue | undefined;
let receivingNow = false;
let onTheBar: ReturnType<typeof useTransportSources> = {};
const Probe = () => {
  latest = useRemoteAudio();
  receivingNow = useRemoteAudioReceiving();
  onTheBar = useTransportSources();
  return null;
};
const value = () => {
  if (!latest) {
    throw new Error('The provider has not rendered.');
  }
  return latest;
};

/** Lets every promise the provider started settle. */
const settle = async () => {
  for (let step = 0; step < 10; step += 1) {
    // eslint-disable-next-line no-await-in-loop -- one round of promises per step, on purpose
    await act(async () => undefined);
  }
};

const renderProvider = async () => {
  render(
    <RemoteAudioProvider>
      <Probe />
    </RemoteAudioProvider>,
  );
  await settle();
};

const emit = (signal: ILanRemoteAudioSignal) =>
  act(() => listeners.signal.forEach((listener) => listener(signal)));

beforeEach(() => {
  latest = undefined;
  Object.values(listeners).forEach((set) => set.clear());
  Object.values(bridge).forEach((entry) => {
    if (jest.isMockFunction(entry)) {
      entry.mockReset();
    }
  });
  bridge.hasSavedRemoteAudioLan.mockResolvedValue(false);
  bridge.startRemoteAudioLan.mockResolvedValue(STARTED);
  bridge.unlinkRemoteAudioLan.mockResolvedValue(undefined);
  bridge.retryRemoteAudioLan.mockResolvedValue(undefined);
  bridge.sendRemoteAudioLanSignal.mockResolvedValue(undefined);
  bridge.setRemoteAudioLinkSwitches.mockResolvedValue(undefined);
  bridge.getRemoteAudioLinkSwitches.mockResolvedValue(undefined);
  resetRackGate();
  Object.assign(window, {
    electron: { platform: 'win32', ipcRenderer: bridge },
  });
});

afterEach(() => {
  act(() => setSinglePlayer(true));
});

describe('a link kept through restarts', () => {
  it('comes back at launch under the same code, and hears the links already up', async () => {
    bridge.hasSavedRemoteAudioLan.mockResolvedValue(true);
    bridge.startRemoteAudioLan.mockResolvedValue({
      ...STARTED,
      links: [
        {
          peerId: 'peer',
          signal: { kind: 'peer-ready', deviceName: 'YOGA', computerId: 'y' },
        },
      ],
    });
    await renderProvider();
    expect(bridge.startRemoteAudioLan).toHaveBeenCalledWith(true);
    expect(value().phase).toBe('ready');
    expect(value().code).toBe(CODE);
    expect(value().links.map((link) => link.name)).toEqual(['YOGA']);
  });

  it('starts nothing at launch for a computer that never shared', async () => {
    await renderProvider();
    expect(bridge.startRemoteAudioLan).not.toHaveBeenCalled();
    expect(value().phase).toBe('idle');
  });

  it('asks the network again, without restarting, when it comes back', async () => {
    bridge.hasSavedRemoteAudioLan.mockResolvedValue(true);
    await renderProvider();
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    await settle();
    expect(bridge.retryRemoteAudioLan).toHaveBeenCalledTimes(1);
    expect(bridge.startRemoteAudioLan).toHaveBeenCalledTimes(1);
  });

  it('starts again when the network comes back after it failed', async () => {
    bridge.hasSavedRemoteAudioLan.mockResolvedValue(true);
    bridge.startRemoteAudioLan.mockRejectedValueOnce(new Error('offline'));
    await renderProvider();
    expect(value().phase).toBe('error');

    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    await settle();
    expect(value().phase).toBe('ready');
    expect(value().error).toBeUndefined();
  });

  it('keeps a pasted computer it cannot reach as one it is looking for', async () => {
    await renderProvider();
    await act(() => value().start());
    bridge.joinRemoteAudioLan.mockResolvedValue({
      computerId: 'd',
      deviceName: 'DESK',
    });
    await act(async () => {
      await expect(value().link('FLUIDEQ-LAN-2.desk')).resolves.toBe(true);
    });
    expect(value().looking).toEqual([{ computerId: 'd', deviceName: 'DESK' }]);

    emit({
      peerId: 'peer-d',
      signal: {
        kind: 'peer-ready',
        deviceName: 'DESK',
        computerId: 'd',
        joined: true,
      },
    });
    expect(value().looking).toEqual([]);
    expect(value().links.map((link) => link.name)).toEqual(['DESK']);
  });

  it('says so when a pasted code is not one, and links nothing', async () => {
    await renderProvider();
    await act(() => value().start());
    bridge.joinRemoteAudioLan.mockRejectedValue(new Error('Invalid'));
    await act(async () => {
      await expect(value().link('nonsense')).resolves.toBe(false);
    });
    expect(value().error).toBe('code');
    expect(value().looking).toEqual([]);
  });

  it('unlinks one computer and keeps every other', async () => {
    await renderProvider();
    await act(() => value().start());
    emit({
      peerId: 'peer-a',
      signal: { kind: 'peer-ready', deviceName: 'A', computerId: 'a' },
    });
    emit({
      peerId: 'peer-b',
      signal: { kind: 'peer-ready', deviceName: 'B', computerId: 'b' },
    });
    await act(() => value().unlink({ peerId: 'peer-a' }));
    expect(bridge.unlinkRemoteAudioLan).toHaveBeenCalledWith({
      peerId: 'peer-a',
    });
    expect(value().links.map((link) => link.name)).toEqual(['B']);
  });
});

describe('the picture of a link', () => {
  const linked = async () => {
    await renderProvider();
    // The page asks for this computer's code as it opens.
    await act(() => value().start());
    expect(value().phase).toBe('ready');
    emit({
      peerId: 'peer',
      signal: { kind: 'peer-ready', deviceName: 'YOGA', joined: false },
    });
  };

  it('shows a computer that links, what it says it does, and forgets it when it goes', async () => {
    await linked();
    expect(value().links.map((link) => link.name)).toEqual(['YOGA']);
    expect(value().phase).toBe('ready');
    emit({
      peerId: 'peer',
      signal: {
        kind: 'stream-mode',
        mode: 'video',
        duplex: { sends: true, plays: false },
      },
    });
    expect(value().links[0].theirs).toEqual({ sends: true, plays: false });
    emit({ peerId: 'peer', signal: { kind: 'stop' } });
    expect(value().links).toEqual([]);
    expect(value().phase).toBe('ready');
  });

  it('says another computer is playing here once its sound arrives', async () => {
    await linked();
    expect(receivingNow).toBe(false);
    act(() => listeners.streaming.forEach((listener) => listener('peer')));
    expect(receivingNow).toBe(true);
    expect(value().links[0].receiving).toBe(true);
  });

  it('gives the bar back when the other computer stops sharing', async () => {
    await linked();
    const theySend = (sends: boolean) =>
      emit({
        peerId: 'peer',
        signal: {
          kind: 'stream-mode',
          mode: 'video',
          duplex: { sends, plays: true },
        },
      });
    theySend(true);
    emit({
      peerId: 'peer',
      signal: {
        kind: 'now-playing',
        playing: {
          title: 'NAYEON "ABCD" M/V',
          isPlaying: true,
          positionMs: 0,
          durationMs: 0,
          canNext: false,
          canPrevious: false,
          canStep: false,
          canStop: false,
        },
      },
    });
    await settle();
    expect(isTransportPlaying('remote')).toBe(true);

    // Its Share switched off: it still describes its player, and none of
    // its sound comes here any more.
    theySend(false);
    await settle();
    expect(isTransportPlaying('remote')).toBe(false);
    expect(onTheBar.remote).toBeUndefined();
    act(() => resetTransportSource());
  });

  it('takes the one-player switch from a linked computer', async () => {
    await linked();
    emit({
      peerId: 'peer',
      signal: { kind: 'now-playing', singlePlayer: false },
    });
    expect(isSinglePlayerEnabled()).toBe(false);
  });

  it('takes nothing from a computer it is not linked with', async () => {
    await renderProvider();
    await act(() => value().start());
    emit({
      peerId: 'stranger',
      signal: { kind: 'now-playing', singlePlayer: false },
    });
    expect(isSinglePlayerEnabled()).toBe(true);
  });
});

describe('while this computer sends its sound', () => {
  it('holds the Library untouched, and gives it back when sending ends', async () => {
    await renderProvider();
    act(() => listeners.sending.forEach((listener) => listener(true)));
    expect(readRackGate().sendingRawAudio).toBe(true);
    expect(value().sending).toBe(true);
    act(() => listeners.sending.forEach((listener) => listener(false)));
    expect(readRackGate().sendingRawAudio).toBe(false);
  });
});
