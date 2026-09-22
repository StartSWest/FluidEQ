import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import en from 'common/i18n/en';
import type { ILibraryQueue } from 'common/library/queue';
import type { ILibraryTrack } from 'common/library/types';
import QueueDeck from 'renderer/player/QueueDeck';
import { usePublishedLibraryDeck } from 'renderer/player/libraryDeck';

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
const queue: ILibraryQueue = {
  trackIds: ids,
  order: [0, 1, 2, 3, 4],
  position: 1,
  repeat: 'off',
  isShuffled: false,
};

const moveUpNext = jest.fn();
const addFiles = jest.fn(() => Promise.resolve());

/** Stands in for the Library's provider, which is where the deck comes from. */
const Publisher = () => {
  usePublishedLibraryDeck({
    queue,
    track: trackById.get('b'),
    trackById,
    isShuffled: false,
    repeat: 'off',
    stop: () => undefined,
    setShuffle: () => undefined,
    cycleRepeat: () => undefined,
    jumpToQueuePosition: () => undefined,
    addFiles,
    moveUpNext,
  });
  return null;
};

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

beforeEach(() => {
  moveUpNext.mockClear();
  addFiles.mockClear();
  Object.assign(window, {
    electron: {
      ipcRenderer: {
        getPathForFile: (file: File) => `D:\\music\\${file.name}`,
      },
    },
  });
  render(
    <>
      <Publisher />
      <QueueDeck onOpenLibrary={() => undefined} />
    </>,
  );
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
