/* FluidEQ — GPL-3.0-or-later */

/**
 * Another computer's song leaves this one when it ends there, in every way it
 * can end (Ivan, 2026-10-26: "make sure the last status thing works also on
 * the shared audio on all involved computers so there is no ghost last status
 * stuck").
 *
 * Each way arrives as its own event, and nothing here waits on a clock:
 * - its song ends or its tab closes: it says its bar is empty (a now-playing
 *   message with nothing in it, which every FluidEQ with the bar has sent);
 * - it stops sharing, switches Send off for this computer or pauses the link:
 *   it says it sends nothing here (`sends: false`);
 * - its FluidEQ closes, crashes or sleeps, the network drops, or the link is
 *   unlinked: the connection closes — a computer that vanishes without a word
 *   is found by the system's own probe of a quiet link (`probeWhileQuiet`) —
 *   and main reports the link stopped;
 * - this computer's own network fails: every link goes.
 *
 * The control in each case is a computer still playing, which keeps its line.
 */

import '@testing-library/jest-dom';
import { act, render, screen, within } from '@testing-library/react';
import type {
  ILanRemoteAudioSignal,
  IRemoteNowPlaying,
} from 'common/remoteAudio';
import { useLastShown } from 'renderer/audio/lastShown';
import {
  resetTransportSource,
  useTransportSources,
} from 'renderer/audio/transportSource';
import RemoteAudioProvider from 'renderer/remoteAudio/RemoteAudioContext';
import RemoteAudioPanel from 'renderer/remoteAudio/RemoteAudioPanel';
import type {
  IRemoteAudioLink,
  IRemoteAudioValue,
} from 'renderer/remoteAudio/remoteAudioState';
import RemoteAudioContext, {
  useRemoteAudio,
} from 'renderer/remoteAudio/remoteAudioValueContext';
import { setSinglePlayer } from 'renderer/utils/singlePlayer';
import {
  remoteAudioLink,
  remoteAudioValue,
} from '../../utils/remoteAudioValue';

// What plays sound and opens devices; this is about what the page shows.
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
jest.mock('renderer/remoteAudio/RemoteAudioOutput', () => () => null);
jest.mock('renderer/audio/LiveAudioContext', () => ({
  useLiveAudioControl: () => ({ setSharingAudio: jest.fn() }),
}));
jest.mock('renderer/utils/FluidEqContext', () => ({
  useFluidEqShell: () => ({ activeDeviceId: 'default' }),
}));
jest.mock('renderer/dsp/store', () => ({
  ...jest.requireActual('renderer/dsp/store'),
  publishSystemDspChain: jest.fn(),
}));
jest.mock('renderer/utils/I18nContext', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const PRIVATE = 'A private title';

const playing = (title: string): IRemoteNowPlaying => ({
  title,
  subtitle: 'A private channel',
  isPlaying: true,
  positionMs: 0,
  durationMs: 60000,
  canNext: false,
  canPrevious: false,
  canStep: false,
  canStop: false,
});

type TListener<T> = (value: T) => void;
const listeners = {
  signal: new Set<TListener<ILanRemoteAudioSignal>>(),
  error: new Set<TListener<void>>(),
  streaming: new Set<TListener<string>>(),
};
const subscribe =
  <T,>(set: Set<TListener<T>>) =>
  (listener: TListener<T>) => {
    set.add(listener);
    return () => set.delete(listener);
  };

const bridge = {
  hasSavedRemoteAudioLan: jest.fn().mockResolvedValue(false),
  startRemoteAudioLan: jest.fn(),
  retryRemoteAudioLan: jest.fn().mockResolvedValue(undefined),
  sendRemoteAudioLanSignal: jest.fn().mockResolvedValue(undefined),
  setRemoteAudioLinkSwitches: jest.fn().mockResolvedValue(undefined),
  getRemoteAudioLinkSwitches: jest.fn().mockResolvedValue(undefined),
  pauseOtherSystemPlayers: jest.fn().mockResolvedValue(undefined),
  onRemoteAudioLanSignal: subscribe(listeners.signal),
  onRemoteAudioLanError: subscribe(listeners.error),
  onRemoteAudioLanStreaming: subscribe(listeners.streaming),
};

let latest: IRemoteAudioValue | undefined;
let onTheBar: ReturnType<typeof useTransportSources> = {};
let remembered: ReturnType<typeof useLastShown>;
const Probe = () => {
  latest = useRemoteAudio();
  onTheBar = useTransportSources();
  remembered = useLastShown();
  return null;
};
const links = (): IRemoteAudioLink[] => latest?.links ?? [];

/** Lets every promise the provider started settle. */
const settle = async () => {
  for (let step = 0; step < 10; step += 1) {
    // eslint-disable-next-line no-await-in-loop -- one round of promises per step, on purpose
    await act(async () => undefined);
  }
};

const emit = (peerId: string, signal: ILanRemoteAudioSignal['signal']) =>
  act(() =>
    listeners.signal.forEach((listener) => listener({ peerId, signal })),
  );

/** A computer linked, sending its sound here, and playing `title`. */
const plays = (peerId: string, name: string, title: string) => {
  emit(peerId, {
    kind: 'peer-ready',
    deviceName: name,
    computerId: name.toLowerCase(),
    joined: false,
  });
  emit(peerId, {
    kind: 'stream-mode',
    mode: 'video',
    duplex: { sends: true, plays: true },
  });
  act(() => listeners.streaming.forEach((listener) => listener(peerId)));
  emit(peerId, { kind: 'now-playing', playing: playing(title) });
};

/** Every value the window keeps, keys and all. */
const everythingStored = () => {
  const values: string[] = [];
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index) ?? '';
    values.push(`${key}=${window.localStorage.getItem(key) ?? ''}`);
  }
  return values.join('\n');
};

const linkedTo = async () => {
  render(
    <RemoteAudioProvider>
      <Probe />
    </RemoteAudioProvider>,
  );
  await settle();
  await act(() => latest?.start() ?? Promise.resolve());
  plays('peer-a', 'YOGA', PRIVATE);
  plays('peer-b', 'DEN', 'Still playing');
  await settle();
  // The control for every case below: both are on this computer, and the
  // bar shows the first of them.
  expect(onTheBar.remote?.title).toBe(PRIVATE);
  expect(links().find((link) => link.id === 'peer-a')?.nowPlaying?.title).toBe(
    PRIVATE,
  );
};

/** The ended song is off the bar and kept nowhere, and the computer still
 * playing keeps its line. */
const expectGone = async () => {
  await settle();
  expect(onTheBar.remote?.title).toBe('Still playing');
  expect(remembered).toBeUndefined();
  expect(everythingStored()).not.toContain(PRIVATE);
};

const linkA = () => links().find((link) => link.id === 'peer-a');

beforeEach(() => {
  latest = undefined;
  Object.values(listeners).forEach((set) => set.clear());
  bridge.startRemoteAudioLan.mockResolvedValue({
    details: { deviceName: 'GAMING', code: 'FLUIDEQ-LAN-2.mine' },
    joins: [],
    links: [],
  });
  Object.assign(window, {
    electron: { platform: 'win32', ipcRenderer: bridge },
  });
});

afterEach(() => {
  act(() => {
    setSinglePlayer(true);
    resetTransportSource();
  });
});

describe('another computer’s song on this one', () => {
  it('goes when the song ends or its tab closes there', async () => {
    await linkedTo();
    emit('peer-a', { kind: 'now-playing' });
    await expectGone();
    // Its row has nothing to name either.
    expect(linkA()?.nowPlaying).toBeUndefined();
  });

  it.each([
    [
      'stops sharing or switches Send off for this computer',
      { sends: false, plays: true },
    ],
    ['pauses the link', { sends: false, plays: false, paused: true }],
  ])('goes when that computer %s', async (_case, duplex) => {
    await linkedTo();
    emit('peer-a', { kind: 'stream-mode', mode: 'video', duplex });
    await expectGone();
    // Its row draws a song only while its sound arrives (`RemoteAudioGroup`).
    expect(linkA()?.receiving).toBe(false);
  });

  it('goes when its link closes: FluidEQ closed, asleep or gone, the network down, or unlinked', async () => {
    await linkedTo();
    emit('peer-a', { kind: 'stop' });
    await expectGone();
    expect(links().map((link) => link.id)).toEqual(['peer-b']);
  });

  it('goes with every link when this computer’s network fails', async () => {
    await linkedTo();
    act(() => listeners.error.forEach((listener) => listener()));
    await settle();
    expect(onTheBar.remote).toBeUndefined();
    expect(links()).toEqual([]);
    expect(everythingStored()).not.toContain(PRIVATE);
  });
});

describe('the line a linked computer’s row draws', () => {
  const renderPage = (link: IRemoteAudioLink) =>
    render(
      <RemoteAudioContext.Provider value={remoteAudioValue({ links: [link] })}>
        <RemoteAudioPanel />
      </RemoteAudioContext.Provider>,
    );
  const row = () => within(screen.getByRole('article', { name: 'SWEST-YOGA' }));
  const heard = remoteAudioLink({
    receiving: true,
    nowPlaying: playing(PRIVATE),
  });

  it('names its song while its sound comes here', () => {
    // The control for the cases below.
    renderPage(heard);
    expect(row().getByText(PRIVATE)).toBeVisible();
  });

  it.each<[string, Partial<IRemoteAudioLink>]>([
    ['its song ended', { nowPlaying: undefined }],
    [
      'it stopped sending here',
      { theirs: { sends: false, plays: true }, receiving: false },
    ],
    [
      'it paused the link',
      {
        theirs: { sends: false, plays: false, paused: true },
        receiving: false,
      },
    ],
    [
      'this computer paused the link',
      {
        switches: { send: true, play: true, paused: true, volume: 1 },
        receiving: false,
      },
    ],
  ])('says nothing of it once %s', (_case, change) => {
    renderPage({ ...heard, ...change });
    expect(screen.queryByText(PRIVATE)).toBeNull();
    expect(screen.queryByText('A private channel')).toBeNull();
  });
});
