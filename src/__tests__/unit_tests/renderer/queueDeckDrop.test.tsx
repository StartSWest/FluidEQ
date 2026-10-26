import '@testing-library/jest-dom';
import { useCallback, useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import en from 'common/i18n/en';
import { currentTrackId, type ILibraryQueue } from 'common/library/queue';
import type { ILibraryScanProgress, ILibraryTrack } from 'common/library/types';
import {
  resetTransportSource,
  setTransportSource,
  type ITransportSource,
} from 'renderer/audio/transportSource';
import { LibraryProvider } from 'renderer/library/LibraryContext';
import PlayerAmp from 'renderer/player/PlayerAmp';
import {
  usePublishedLibraryDeck,
  type TDroppedMusic,
} from 'renderer/player/libraryDeck';
import createFakeLibraryStore, {
  type IFakeLibraryStore,
} from '../../utils/fakeLibraryStore';

jest.mock('renderer/library/LibraryCoverArt', () => () => null);
// The amp around its queue, with everything above the queue stood in: the
// queue, and the amp's own handling of what is dropped on it, are real.
jest.mock('renderer/player/PlayerStage', () => () => null);
jest.mock('renderer/player/PlayerTitleStrip', () => () => null);
jest.mock('renderer/player/PlayerHero', () => () => null);
jest.mock('renderer/player/PlayerDock', () => () => null);
jest.mock('renderer/player/PlayerSound', () => () => null);
jest.mock('renderer/player/PlayerFoot', () => () => null);
jest.mock('renderer/player/PlayerHeightGrip', () => () => null);
jest.mock('renderer/player/usePlayerHeightFloor', () => () => undefined);
jest.mock('renderer/player/useGraphScenePack', () => () => ({
  state: 'none',
}));

const ids = ['a', 'b', 'c', 'd', 'e'];
const lengths = [60_000, 120_000, 180_000, 240_000, 300_000];
const trackById = new Map<string, ILibraryTrack>(
  ids.map((id, index) => [
    id,
    {
      id,
      title: `Song ${id.toUpperCase()}`,
      artist: 'Someone',
      durationMs: lengths[index],
    } as unknown as ILibraryTrack,
  ]),
);
// The second song is playing: one behind it, three ahead.
const startQueue: ILibraryQueue = {
  trackIds: ids,
  order: [0, 1, 2, 3, 4],
  position: 1,
  repeat: 'off',
  isShuffled: false,
};

const moveUpNext = jest.fn();
const addFiles = jest.fn(() => Promise.resolve<TDroppedMusic>('added'));
const jumpTo = jest.fn();
const cancelScan = jest.fn();
let reportProgress: (progress: ILibraryScanProgress) => void;
let store: IFakeLibraryStore;

/**
 * Stands in for the Library's provider, which is where the deck comes from.
 * A press moves its playhead, as the Library's own queue does, so a second
 * press lands on a deck that has already moved.
 */
const Publisher = () => {
  const [queue, setQueue] = useState(startQueue);
  const jumpToQueuePosition = useCallback((position: number) => {
    jumpTo(position);
    setQueue((current) => ({ ...current, position }));
  }, []);
  const playing = currentTrackId(queue);
  usePublishedLibraryDeck({
    queue,
    track: playing === undefined ? undefined : trackById.get(playing),
    trackById,
    isShuffled: false,
    repeat: 'off',
    stop: () => undefined,
    setShuffle: () => undefined,
    cycleRepeat: () => undefined,
    jumpToQueuePosition,
    addFiles,
    moveUpNext,
    removeUpNextAt: () => undefined,
    // No song here was drawn by Keep playing.
    isGuess: () => false,
  });
  return null;
};

/** The Library's own transport, as its player describes itself. */
const libraryTransport = (
  over: Partial<ITransportSource> = {},
): ITransportSource => ({
  owner: 'library',
  title: 'Song B',
  isPlaying: false,
  positionMs: 30_000,
  durationMs: 120_000,
  toggle: jest.fn(),
  seek: jest.fn(),
  ...over,
});

/** A drag's transfer, as far as the deck reads it. */
const transfer = (files: File[] = []) => ({
  files,
  items: [],
  types: files.length ? ['Files'] : ['application/x-fluideq-queue-row'],
  effectAllowed: 'uninitialized',
  dropEffect: 'none',
  setData: () => undefined,
  getData: () => '',
});

// By its hover text: the row's accessible name is everything written on it,
// number, title, artist and length together.
const row = (title: string) =>
  screen.getByTitle(en['player.queue.play'].replace('{title}', title));

/** The whole amp, where music from the computer may be let go anywhere. */
const amp = () => screen.getByRole('region', { name: en['player.aria'] });

// The amp's Up next, on the shelf it shares with Playlists (`PlayerQueue`).
describe('the amp’s queue', () => {
  beforeEach(async () => {
    moveUpNext.mockClear();
    addFiles.mockClear();
    jumpTo.mockClear();
    cancelScan.mockClear();
    store = createFakeLibraryStore([], [...trackById.values()]);
    Object.assign(window, {
      electron: {
        ipcRenderer: {
          ...store.bridge,
          onLibraryScanProgress: (listener: typeof reportProgress) => {
            reportProgress = listener;
            return () => undefined;
          },
          cancelLibraryScan: cancelScan,
          getPathForFile: (file: File) => `D:\\music\\${file.name}`,
          // The width the shelf's tabs need, told to the window, and the
          // window's own word on a double press of its caption.
          sendMessage: () => undefined,
          on: () => () => undefined,
        },
      },
    });
    render(
      <LibraryProvider>
        <Publisher />
        <PlayerAmp onOpenPage={() => undefined} />
      </LibraryProvider>,
    );
    // The summary, and then how long is left: the store sums it, since the
    // queue can run past the stretch the deck lists.
    await store.settle();
  });

  afterEach(() => {
    act(() => resetTransportSource());
  });

  describe('the shelf’s tabs', () => {
    // How many songs Up next holds on its tab, and how long is still to come
    // at the end of the row, where the queue's own head used to say it.
    it('read how many songs there are and how long is still to come', () => {
      expect(
        screen.getByRole('tab', { name: `${en['library.upNext']} 5` }),
      ).toHaveAttribute('aria-selected', 'true');
      // This song and the three after it: 2 + 3 + 4 + 5 minutes.
      expect(screen.getByTitle('14:00 left in the queue')).toHaveTextContent(
        '14:00',
      );
    });

    // Folded, the picture takes the room back (Ivan, 2026-10-25: "let's up
    // next section be collapsible too"); a press on a tab opens it again.
    it('fold the queue away, out of the keyboard’s reach, and a tab opens it again', async () => {
      const page = screen.getByRole('tabpanel');
      await userEvent.click(
        screen.getByRole('button', { name: en['player.queue.fold'] }),
      );
      expect(page).toHaveAttribute('inert');
      expect(
        screen.getByRole('button', { name: en['player.queue.unfold'] }),
      ).toHaveAttribute('aria-expanded', 'false');
      await userEvent.click(
        screen.getByRole('tab', { name: `${en['library.upNext']} 5` }),
      );
      expect(page).not.toHaveAttribute('inert');
      expect(
        screen.getByRole('button', { name: en['player.queue.fold'] }),
      ).toHaveAttribute('aria-expanded', 'true');
    });
  });

  describe('reordering what is coming up', () => {
    it('lets only the songs ahead of the playhead be dragged', () => {
      expect(row('Song A')).toHaveAttribute('draggable', 'false');
      expect(row('Song B')).toHaveAttribute('draggable', 'false');
      expect(row('Song C')).toHaveAttribute('draggable', 'true');
      expect(row('Song E')).toHaveAttribute('draggable', 'true');
    });

    it('drops a song before the row it lands on', () => {
      fireEvent.dragStart(row('Song E'), { dataTransfer: transfer() });
      fireEvent.dragOver(row('Song C'), { dataTransfer: transfer() });
      expect(row('Song C')).toHaveClass('is-drop-before');
      fireEvent.drop(row('Song C'), { dataTransfer: transfer() });
      expect(moveUpNext).toHaveBeenCalledWith(4, 2);
    });

    it('drops a song on the list itself to put it last', () => {
      const list = screen.getByRole('list');
      fireEvent.dragStart(row('Song C'), { dataTransfer: transfer() });
      fireEvent.dragOver(list, { dataTransfer: transfer() });
      expect(list).toHaveClass('is-drop-after');
      fireEvent.drop(list, { dataTransfer: transfer() });
      expect(moveUpNext).toHaveBeenCalledWith(2, 5);
    });
  });

  describe('music dropped in from the computer', () => {
    it('shows folder scan progress and lets it be stopped from Amp', async () => {
      act(() =>
        reportProgress({
          rootId: 'folder',
          seen: 20,
          parsed: 5,
          karaokeSkipped: 0,
          current: 'An album',
          isDone: false,
        }),
      );
      expect(screen.getByRole('progressbar')).toHaveAttribute(
        'aria-valuenow',
        '25',
      );
      await userEvent.click(
        screen.getByRole('button', { name: en['library.scan.cancel'] }),
      );
      expect(cancelScan).toHaveBeenCalledTimes(1);
      act(() =>
        reportProgress({
          rootId: 'folder',
          seen: 20,
          parsed: 5,
          karaokeSkipped: 0,
          isDone: true,
        }),
      );
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
    // Anywhere on the amp, not only on the queue's page: in the one amp that
    // is the last stretch of the column, and a file let go over the picture
    // or the sound did nothing (Ivan, 2026-10-25: "still not working").
    it('takes music let go anywhere on the amp, and hands its native paths to main', () => {
      const files = [
        new File([''], 'song.flac'),
        new File([''], 'cover.jpg'),
        new File([''], 'clip.mp4'),
        new File([''], 'notes.txt'),
      ];
      fireEvent.dragOver(amp(), { dataTransfer: transfer(files) });
      expect(screen.getByText(en['player.queue.drop'])).toBeInTheDocument();
      fireEvent.drop(amp(), { dataTransfer: transfer(files) });
      expect(
        screen.queryByText(en['player.queue.drop']),
      ).not.toBeInTheDocument();
      // Main checks which are folders and which the Library plays.
      expect(addFiles).toHaveBeenCalledWith([
        'D:\\music\\song.flac',
        'D:\\music\\cover.jpg',
        'D:\\music\\clip.mp4',
        'D:\\music\\notes.txt',
      ]);
    });

    it('accepts Explorer folders let go on a song, and moves no song for them', () => {
      const dataTransfer = transfer([
        new File([], 'Inna - Various'),
        new File([], 'Album.2026'),
      ]);
      // Before the drop, Chromium protects the file list but exposes its type.
      const hover = { ...dataTransfer, files: [] };
      fireEvent.dragOver(row('Song C'), { dataTransfer: hover });
      expect(hover.dropEffect).toBe('copy');
      expect(screen.getByText(en['player.queue.drop'])).toBeInTheDocument();
      fireEvent.drop(row('Song C'), { dataTransfer });
      expect(addFiles).toHaveBeenCalledWith([
        'D:\\music\\Inna - Various',
        'D:\\music\\Album.2026',
      ]);
      expect(row('Song C')).not.toHaveClass('is-drop-before');
      expect(moveUpNext).not.toHaveBeenCalled();
    });

    it('does not light up for a drag that carries no files', () => {
      fireEvent.dragOver(amp(), { dataTransfer: transfer() });
      expect(
        screen.queryByText(en['player.queue.drop']),
      ).not.toBeInTheDocument();
      // The control: the same drag carrying a file does.
      fireEvent.dragOver(amp(), {
        dataTransfer: transfer([new File([''], 'song.flac')]),
      });
      expect(screen.getByText(en['player.queue.drop'])).toBeInTheDocument();
    });

    // Where what is dropped lands: the queue turns to Up next for it.
    it('turns the shelf to Up next for music dropped while Playlists shows', async () => {
      await userEvent.click(
        screen.getByRole('tab', { name: en['library.browse.playlist'] }),
      );
      expect(
        screen.queryByTitle(
          en['player.queue.play'].replace('{title}', 'Song C'),
        ),
      ).not.toBeInTheDocument();
      fireEvent.drop(amp(), {
        dataTransfer: transfer([new File([''], 'song.flac')]),
      });
      expect(
        screen.getByRole('tab', { name: `${en['library.upNext']} 5` }),
      ).toHaveAttribute('aria-selected', 'true');
      expect(row('Song C')).toBeInTheDocument();
    });
  });

  /**
   * The list is the Library's queue, so it answers to the Library's own
   * transport — never to whichever player the deck above happens to show. A
   * browser tab sounding is not the Library sounding, and a press on a song
   * here is a press on the Library.
   */
  describe('the Library’s own transport', () => {
    it('starts the Library on a press, even with another player sounding', async () => {
      const libraryToggle = jest.fn();
      const tabToggle = jest.fn();
      act(() => {
        setTransportSource(libraryTransport({ toggle: libraryToggle }));
        setTransportSource({
          owner: 'system',
          title: 'A browser tab',
          isPlaying: true,
          positionMs: 0,
          durationMs: 0,
          toggle: tabToggle,
        });
      });

      await userEvent.click(row('Song C'));

      expect(jumpTo).toHaveBeenCalledWith(2);
      expect(libraryToggle).toHaveBeenCalledTimes(1);
      expect(tabToggle).not.toHaveBeenCalled();
    });
  });

  describe('a double press on a song', () => {
    it('starts the song under the playhead again from the top', async () => {
      const seek = jest.fn();
      act(() =>
        setTransportSource(libraryTransport({ isPlaying: true, seek })),
      );

      await userEvent.dblClick(row('Song B'));

      expect(seek).toHaveBeenCalledWith(0);
    });

    it('does not rewind a song its own first press has just started', async () => {
      // The first press of the two moves the playhead onto this song and
      // starts it from the top; by the second the song IS under the playhead,
      // and seeking it to nought would replay what had already been heard.
      const seek = jest.fn();
      act(() =>
        setTransportSource(libraryTransport({ isPlaying: true, seek })),
      );

      await userEvent.dblClick(row('Song D'));

      expect(jumpTo).toHaveBeenCalledWith(3);
      expect(row('Song D')).toHaveAttribute('aria-current', 'true');
      expect(seek).not.toHaveBeenCalled();
    });
  });
});
