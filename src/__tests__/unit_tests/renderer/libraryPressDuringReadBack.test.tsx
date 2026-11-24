/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A song pressed while the last session is still being read back is the
 * session from then on.
 *
 * Nothing was written until the read-back answered, so a press in that
 * window lived only in memory: the player rebuilt before the answer (the tab
 * left before the song started, a reload) read the old session back over it,
 * and the press took shuffle off, since the setting rode on the queue the
 * read-back then declined. Each case drives the real Library, player and
 * store, holding the read-back's own question until the case lets it go.
 */
import '@testing-library/jest-dom';
import { useState } from 'react';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LibraryWorkspace from '../../../renderer/library/LibraryWorkspace';
import { LibraryProvider } from '../../../renderer/library/LibraryContext';
import {
  LibraryPlayerProvider,
  useLibraryPlayerSession,
} from '../../../renderer/library/player/LibraryPlayerContext';
import { I18nProvider } from '../../../renderer/utils/I18nContext';
import type { TLibraryRequest } from '../../../common/library/query';
import {
  type ILibraryStoreBridge,
  installIpcRenderer,
  libraryRoot,
  libraryTrack as track,
  openLibraryStoreBridge,
} from '../../utils/libraryStoreBridge';
import { createSourceAnalysisBridge } from '../../utils/sourceAnalysisBridge';

const PLAYBACK_KEY = 'fluideq.library.playback';
const PRESSED = "It's Gonna Be Me";

let bridge: ILibraryStoreBridge | undefined;

beforeAll(() => {
  Object.defineProperty(HTMLMediaElement.prototype, 'play', {
    configurable: true,
    value: jest.fn().mockResolvedValue(undefined),
  });
  Object.defineProperty(HTMLMediaElement.prototype, 'pause', {
    configurable: true,
    value: jest.fn(),
  });
});

beforeEach(() => {
  window.localStorage.clear();
  // The album opens on its covers' shelf; the grid is the quickest way there.
  window.localStorage.setItem('fluideq.library.viewMode', 'grid');
});

afterEach(() => {
  cleanup();
  bridge?.close();
  bridge = undefined;
});

let session: ReturnType<typeof useLibraryPlayerSession> | undefined;
const PlayerProbe = () => {
  session = useLibraryPlayerSession();
  return <output aria-label="Player">{session.track?.id ?? ''}</output>;
};

const albumTracks = [
  'Bye Bye Bye',
  PRESSED,
  'Space Cowboy',
  'Just Got Paid',
  'It Makes Me Ill',
].map((title, index) =>
  track({
    title,
    album: 'No Strings Attached',
    artist: 'NSync',
    trackNo: index + 1,
    path: `C:\\Music\\NSync\\${String(index + 1).padStart(2, '0')} ${title}.mp3`,
  }),
);
const looseTracks = Array.from({ length: 12 }, (_, index) =>
  track({
    title: `Track ${index + 1}`,
    path: `C:\\Music\\Loose\\Track ${index + 1}.mp3`,
  }),
);
const looseIds = looseTracks.map((entry) => entry.id);

/** The last session: loose files, shuffled, on "Track 6". */
const rememberLastSession = () => {
  window.localStorage.setItem(
    PLAYBACK_KEY,
    JSON.stringify({
      trackIds: looseIds,
      order: [5, 2, 9, 0, 1, 3, 4, 6, 7, 8, 10, 11],
      position: 0,
      repeat: 'off',
      isShuffled: true,
      positionMs: 30_000,
      source: JSON.stringify({ shelf: 'tracks', scope: {}, direction: 'asc' }),
    }),
  );
};

const stored = (): { trackIds: string[]; order: number[]; position: number } =>
  JSON.parse(window.localStorage.getItem(PLAYBACK_KEY) ?? 'null');

const storedSong = (): string | undefined => {
  const memory = stored();
  return memory.trackIds[memory.order[memory.position] ?? -1];
};

/** The read-back's own question: every song of the stored queue at once. */
const isReadBack = (request: TLibraryRequest): boolean =>
  request.type === 'tracks' &&
  request.ids.length === looseIds.length &&
  looseIds.every((id) => request.ids.includes(id));

let showPlayer: (value: boolean) => void = () => {};
const Shell = () => {
  const [isShown, setIsShown] = useState(true);
  showPlayer = setIsShown;
  return isShown ? (
    <LibraryProvider>
      <LibraryPlayerProvider>
        <LibraryWorkspace
          isHidden={false}
          isFullScreen={false}
          onToggleFullScreen={() => {}}
        />
        <PlayerProbe />
      </LibraryPlayerProvider>
    </LibraryProvider>
  ) : null;
};

/**
 * The Library with its store, the first read-back held until `answer` (and
 * never answered when a rebuild comes first, as a torn-down player's is not).
 */
const openLibrary = ({ holdReadBack }: { holdReadBack: boolean }) => {
  const opened = openLibraryStoreBridge({
    roots: [libraryRoot('r1', 'C:\\Music')],
    tracks: [...albumTracks, ...looseTracks],
  });
  bridge = opened;
  const query = opened.channels.queryLibrary;
  let waiting: (() => void) | undefined;
  let isHeld = holdReadBack;
  installIpcRenderer({
    ...opened.channels,
    queryLibrary: ((request: TLibraryRequest) => {
      if (!isHeld || !isReadBack(request)) {
        return query(request);
      }
      isHeld = false;
      return new Promise<unknown>((resolve, reject) => {
        waiting = () => {
          query(request).then(resolve, reject);
        };
      });
    }) as typeof query,
    addLibraryRoot: jest.fn(() => Promise.resolve(opened.summary())),
    cancelLibraryScan: jest.fn(),
    libraryTrackSubtitles: () => Promise.resolve({ files: [], looked: [] }),
    onLibraryTagJob: () => () => {},
    ...createSourceAnalysisBridge(),
  });
  render(
    <I18nProvider>
      <Shell />
    </I18nProvider>,
  );
  return {
    answer: async () => {
      await act(async () => {
        waiting?.();
      });
    },
  };
};

const pressInAlbum = async () => {
  await userEvent.click(await screen.findByText('No Strings Attached'));
  await userEvent.click(await screen.findByText(PRESSED));
  await waitFor(() =>
    expect(screen.getByLabelText('Player')).toHaveTextContent(PRESSED),
  );
};

/**
 * The song the player's queue stands on. Not `track`, which a rebuilt player
 * fills from the bar's last-shown song before its queue is read back.
 */
const queuedSong = (): string | undefined => {
  const queue = session?.queue;
  return queue ? queue.trackIds[queue.order[queue.position] ?? -1] : undefined;
};

/** Torn down and built again, as leaving the tab or a reload does. */
const rebuildPlayer = () => {
  act(() => showPlayer(false));
  act(() => showPlayer(true));
};

describe('a song pressed while the last session is read back', () => {
  it('is what a rebuilt player comes back to, not the last session', async () => {
    rememberLastSession();
    openLibrary({ holdReadBack: true });
    await pressInAlbum();
    expect(storedSong()).toBe(PRESSED);

    rebuildPlayer();
    await waitFor(() => expect(queuedSong()).toBe(PRESSED));
    expect(session?.queue?.trackIds).not.toContain('Track 6');
  });

  it('keeps the shuffle the listener left on', async () => {
    rememberLastSession();
    openLibrary({ holdReadBack: true });
    await pressInAlbum();
    expect(session?.queue?.isShuffled).toBe(true);
  });

  it('stays when the read-back answers after it', async () => {
    rememberLastSession();
    const library = openLibrary({ holdReadBack: true });
    await pressInAlbum();
    await library.answer();
    expect(queuedSong()).toBe(PRESSED);
    expect(storedSong()).toBe(PRESSED);
  });
});

describe('the last session with nothing pressed (the controls)', () => {
  it('comes back cued on the song it was on, shuffled as it was', async () => {
    rememberLastSession();
    openLibrary({ holdReadBack: false });
    await waitFor(() => expect(queuedSong()).toBe('Track 6'));
    expect(session?.queue?.isShuffled).toBe(true);
    expect(session?.isPlaying).toBe(false);
    expect(storedSong()).toBe('Track 6');
  });

  it('survives a rebuild before the read-back has answered', async () => {
    rememberLastSession();
    openLibrary({ holdReadBack: true });
    await screen.findByText('No Strings Attached');
    rebuildPlayer();
    expect(storedSong()).toBe('Track 6');
    await waitFor(() => expect(queuedSong()).toBe('Track 6'));
  });
});
