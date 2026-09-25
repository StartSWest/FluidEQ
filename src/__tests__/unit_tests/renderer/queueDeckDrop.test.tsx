import '@testing-library/jest-dom';
import { useCallback, useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import en from 'common/i18n/en';
import { currentTrackId, type ILibraryQueue } from 'common/library/queue';
import type { ILibraryTrack } from 'common/library/types';
import {
  resetTransportSource,
  setTransportSource,
  type ITransportSource,
} from 'renderer/audio/transportSource';
import { LibraryProvider } from 'renderer/library/LibraryContext';
import QueueDeck from 'renderer/player/QueueDeck';
import { usePublishedLibraryDeck } from 'renderer/player/libraryDeck';
import createFakeLibraryStore, {
  type IFakeLibraryStore,
} from '../../utils/fakeLibraryStore';

jest.mock('renderer/library/LibraryCoverArt', () => () => null);

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
const addFiles = jest.fn(() => Promise.resolve());
const jumpTo = jest.fn();
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

/** The bars on the row of the song under the playhead. */
const nowBars = () => row('Song B').querySelector('.player-queue__bars');

beforeEach(async () => {
  moveUpNext.mockClear();
  addFiles.mockClear();
  jumpTo.mockClear();
  store = createFakeLibraryStore([], [...trackById.values()]);
  Object.assign(window, {
    electron: {
      ipcRenderer: {
        ...store.bridge,
        getPathForFile: (file: File) => `D:\\music\\${file.name}`,
      },
    },
  });
  render(
    <LibraryProvider>
      <Publisher />
      <QueueDeck onOpenLibrary={() => undefined} />
    </LibraryProvider>,
  );
  // The summary, and then how long is left: the store sums it, since the
  // queue can run past the stretch the deck lists.
  await store.settle();
});

afterEach(() => {
  act(() => resetTransportSource());
});

describe('the head', () => {
  it('reads where the playhead stands and how long is still to come', () => {
    expect(screen.getByTitle('2 of 5')).toHaveTextContent('2/ 5');
    // This song and the three after it: 2 + 3 + 4 + 5 minutes.
    expect(screen.getByTitle('14:00 left in the queue')).toHaveTextContent(
      '14:00',
    );
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
  it('takes the kinds the Library takes and nothing else', () => {
    const deck = screen.getByRole('region', { name: en['library.upNext'] });
    const files = [
      new File([''], 'song.flac'),
      new File([''], 'cover.jpg'),
      new File([''], 'clip.mp4'),
      new File([''], 'notes.txt'),
    ];
    fireEvent.dragOver(deck, { dataTransfer: transfer(files) });
    expect(screen.getByText(en['player.queue.drop'])).toBeInTheDocument();
    fireEvent.drop(deck, { dataTransfer: transfer(files) });
    expect(addFiles).toHaveBeenCalledWith([
      'D:\\music\\song.flac',
      'D:\\music\\clip.mp4',
    ]);
  });

  it('does not light up for a drag that carries no files', () => {
    const deck = screen.getByRole('region', { name: en['library.upNext'] });
    fireEvent.dragOver(deck, { dataTransfer: transfer() });
    expect(screen.queryByText(en['player.queue.drop'])).not.toBeInTheDocument();
  });
});

/**
 * The list is the Library's queue, so it answers to the Library's own
 * transport — never to whichever player the deck above happens to show. A
 * browser tab sounding is not the Library sounding, and a press on a song
 * here is a press on the Library.
 */
describe('the Library’s own transport', () => {
  it('holds the bars still while the Library is paused, whatever else is sounding', () => {
    act(() => {
      setTransportSource(libraryTransport({ isPlaying: false }));
      setTransportSource({
        owner: 'system',
        title: 'A browser tab',
        isPlaying: true,
        positionMs: 0,
        durationMs: 0,
        toggle: jest.fn(),
      });
    });
    expect(nowBars()).toHaveClass('is-still');

    // The control: the same bars move once the Library itself sounds.
    act(() => setTransportSource(libraryTransport({ isPlaying: true })));
    expect(nowBars()).not.toHaveClass('is-still');
  });

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
    act(() => setTransportSource(libraryTransport({ isPlaying: true, seek })));

    await userEvent.dblClick(row('Song B'));

    expect(seek).toHaveBeenCalledWith(0);
  });

  it('does not rewind a song its own first press has just started', async () => {
    // The first press of the two moves the playhead onto this song and
    // starts it from the top; by the second the song IS under the playhead,
    // and seeking it to nought would replay what had already been heard.
    const seek = jest.fn();
    act(() => setTransportSource(libraryTransport({ isPlaying: true, seek })));

    await userEvent.dblClick(row('Song D'));

    expect(jumpTo).toHaveBeenCalledWith(3);
    expect(row('Song D')).toHaveAttribute('aria-current', 'true');
    expect(seek).not.toHaveBeenCalled();
  });
});
