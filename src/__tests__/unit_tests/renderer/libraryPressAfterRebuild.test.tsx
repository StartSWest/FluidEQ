/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A song pressed once the Library has rebuilt and read the last session
 * back plays, and stays the session.
 *
 * Ivan, 2026-11-24: with shuffle on, after leaving the Library and coming
 * back, he pressed "It's Gonna Be Me" on No Strings Attached and the player
 * started "Track 6 / Unknown artist" — the last session's song, a loose file
 * from elsewhere in the library. `libraryPressDuringReadBack` holds the case
 * where the press lands before the read-back answers; this is the one where
 * it has answered, and the player stands cued on the last session's song,
 * shuffled, when the press comes. Each case drives the real Library, player
 * and store.
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
const LAST_SONG = 'Track 6';

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
const albumIds = albumTracks.map((entry) => entry.id);
// More loose files than Keep playing draws under a queue of one, so a queue
// that moved on to them is told apart from the album's own.
const looseTracks = Array.from({ length: 30 }, (_, index) =>
  track({
    title: `Track ${index + 1}`,
    path: `C:\\Music\\Loose\\Track ${index + 1}.mp3`,
  }),
);
const looseIds = looseTracks.map((entry) => entry.id);

/** The last session: every loose file, shuffled, on "Track 6", half a minute in. */
const rememberLastSession = () => {
  window.localStorage.setItem(
    PLAYBACK_KEY,
    JSON.stringify({
      trackIds: looseIds,
      // "Track 6" first, then the rest of a shuffle.
      order: [5, 2, 9, 0, 1, 3, 4, 6, 7, 8].concat(
        looseIds.slice(10).map((_, index) => index + 10),
      ),
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

/** The song the player's queue stands on. */
const queuedSong = (): string | undefined => {
  const queue = session?.queue;
  return queue ? queue.trackIds[queue.order[queue.position] ?? -1] : undefined;
};

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

const openLibrary = () => {
  const opened = openLibraryStoreBridge({
    roots: [libraryRoot('r1', 'C:\\Music')],
    tracks: [...albumTracks, ...looseTracks],
  });
  bridge = opened;
  installIpcRenderer({
    ...opened.channels,
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
};

/** Torn down and built again, as leaving the Library and coming back does. */
const rebuildPlayer = () => {
  act(() => showPlayer(false));
  act(() => showPlayer(true));
};

/** The Library rebuilt, with the last session read back and cued. */
const openOnLastSession = async () => {
  rememberLastSession();
  openLibrary();
  rebuildPlayer();
  await waitFor(() => expect(queuedSong()).toBe(LAST_SONG));
  expect(session?.queue?.isShuffled).toBe(true);
};

const pressInAlbum = async () => {
  await userEvent.click(await screen.findByText('No Strings Attached'));
  // The song on the album's shelf. The last session's list is the Songs
  // shelf, which takes the album in once the library answers, so Up Next
  // may name the same song further down.
  const onShelf = (await screen.findAllByText(PRESSED)).find(
    (element) => element.closest('.library-up-next') === null,
  );
  if (!onShelf) {
    throw new Error('the album shows no row for the song');
  }
  await userEvent.click(onShelf);
  await waitFor(() =>
    expect(screen.getByLabelText('Player')).toHaveTextContent(PRESSED),
  );
  // Everything the press set going — the album's list arriving, the queue
  // written — has its turn before anything is judged.
  await act(async () => {
    await new Promise<void>((resolve) => {
      queueMicrotask(resolve);
    });
  });
};

describe('a song pressed after the Library rebuilt on a shuffled session', () => {
  it('plays the song pressed, on its album, not the last session', async () => {
    await openOnLastSession();
    await pressInAlbum();
    expect(queuedSong()).toBe(PRESSED);
    // The album's songs are the queue now, and none of the loose files —
    // put there as the list the song was pressed in, not drawn by Keep
    // playing under a queue of one, which can draw the same album.
    expect([...(session?.queue?.trackIds ?? [])].sort()).toEqual(
      [...albumIds].sort(),
    );
    expect(JSON.parse(session?.queue?.source ?? '{}')).toMatchObject({
      scope: { album: expect.any(String) },
    });
    // The listener's shuffle rides on into the new queue.
    expect(session?.queue?.isShuffled).toBe(true);
    expect(storedSong()).toBe(PRESSED);
  });

  it('is what the player comes back to when the Library is left again', async () => {
    await openOnLastSession();
    await pressInAlbum();
    rebuildPlayer();
    await waitFor(() => expect(queuedSong()).toBe(PRESSED));
    expect(session?.queue?.trackIds).not.toContain(LAST_SONG);
    expect(storedSong()).toBe(PRESSED);
  });
});
