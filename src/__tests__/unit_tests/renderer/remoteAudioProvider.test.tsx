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
import type {
  ILanPairingOption,
  ILanRemoteAudioSignal,
} from 'common/remoteAudio';
import { readRackGate, resetRackGate } from 'renderer/dsp/rackPlacement';
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

const OPTION: ILanPairingOption = {
  address: '192.168.1.20',
  code: 'FLUIDEQ-LAN-2.saved',
  deviceName: 'GAMING',
};

const bridge = {
  getSavedRemoteAudioLanRole: jest.fn(),
  restoreRemoteAudioLan: jest.fn(),
  startRemoteAudioLanHost: jest.fn(),
  joinRemoteAudioLan: jest.fn(),
  stopRemoteAudioLan: jest.fn(),
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
const Probe = () => {
  latest = useRemoteAudio();
  receivingNow = useRemoteAudioReceiving();
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
  bridge.getSavedRemoteAudioLanRole.mockResolvedValue(undefined);
  bridge.startRemoteAudioLanHost.mockResolvedValue({
    deviceName: 'GAMING',
    options: [OPTION],
  });
  bridge.stopRemoteAudioLan.mockResolvedValue(undefined);
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
  it('shows its code again after a restart, the same code, never a new one', async () => {
    bridge.getSavedRemoteAudioLanRole.mockResolvedValue('listener');
    bridge.restoreRemoteAudioLan.mockResolvedValue({
      role: 'listener',
      details: { deviceName: 'GAMING', options: [OPTION] },
    });
    await renderProvider();
    expect(value().role).toBe('listener');
    expect(value().phase).toBe('waiting');
    expect(value().lanOptions).toEqual([OPTION]);
    expect(bridge.startRemoteAudioLanHost).not.toHaveBeenCalled();
  });

  it('goes back to the computer it joined after a restart', async () => {
    bridge.getSavedRemoteAudioLanRole.mockResolvedValue('sender');
    bridge.restoreRemoteAudioLan.mockResolvedValue({
      role: 'sender',
      listener: { deviceName: 'YOGA', peerId: 'peer' },
    });
    await renderProvider();
    expect(value().role).toBe('sender');
    expect(value().deviceName).toBe('YOGA');
  });

  it('tries again when the network comes back', async () => {
    bridge.getSavedRemoteAudioLanRole.mockResolvedValue('listener');
    bridge.restoreRemoteAudioLan.mockRejectedValueOnce(new Error('offline'));
    await renderProvider();
    expect(value().phase).toBe('disconnected');
    expect(value().error).toBe('connection');

    bridge.restoreRemoteAudioLan.mockResolvedValue({
      role: 'listener',
      details: { deviceName: 'GAMING', options: [OPTION] },
    });
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    await settle();
    expect(value().phase).toBe('waiting');
    expect(value().error).toBeUndefined();
  });

  it('publishes nothing from a restore that finishes after Unlink', async () => {
    let finish: (result: unknown) => void = () => undefined;
    bridge.getSavedRemoteAudioLanRole.mockResolvedValue('listener');
    bridge.restoreRemoteAudioLan.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    await renderProvider();
    await act(() => value().unlink());
    await settle();
    expect(bridge.startRemoteAudioLanHost).toHaveBeenCalledWith(true);

    finish({
      role: 'listener',
      details: { deviceName: 'OLD-NAME', options: [] },
    });
    await settle();
    expect(value().deviceName).toBe('GAMING');
    expect(value().lanOptions).toEqual([OPTION]);
  });
});

describe('the picture of a link', () => {
  const linked = async () => {
    await renderProvider();
    // The page asks for this computer's code as it opens.
    await act(() => value().showCode());
    expect(value().role).toBe('listener');
    emit({
      peerId: 'peer',
      signal: { kind: 'peer-ready', deviceName: 'YOGA', joined: false },
    });
  };

  it('shows a computer that links, what it says it does, and forgets it when it goes', async () => {
    await linked();
    expect(value().links.map((link) => link.name)).toEqual(['YOGA']);
    expect(value().phase).toBe('connected');
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
    expect(value().phase).toBe('waiting');
  });

  it('says another computer is playing here once its sound arrives', async () => {
    await linked();
    expect(receivingNow).toBe(false);
    act(() => listeners.streaming.forEach((listener) => listener('peer')));
    expect(receivingNow).toBe(true);
    expect(value().links[0].receiving).toBe(true);
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
