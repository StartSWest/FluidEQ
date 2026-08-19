import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { ILibraryTrack } from '../../common/library/types';
import LibraryListView from '../../renderer/library/LibraryListView';
import { I18nProvider } from '../../renderer/utils/I18nContext';

const track = (over: Partial<ILibraryTrack>): ILibraryTrack => ({
  id: over.title ?? 'id',
  rootId: 'r',
  path: 'C:\\Music\\a.mp3',
  kind: 'audio',
  isPlayable: true,
  title: 'Untitled',
  sizeBytes: 1,
  mtimeMs: 1,
  addedAt: 1,
  ...over,
});

const wrap = (node: React.ReactNode) =>
  render(<I18nProvider>{node}</I18nProvider>);

describe('the library as a list', () => {
  it('shows a row per song with what the row is for', () => {
    wrap(
      <LibraryListView
        tracks={[
          track({
            title: 'Blue',
            artist: 'Miles',
            album: 'Kind',
            durationMs: 92000,
          }),
        ]}
        browseMode="song"
        onOpenAlbum={jest.fn()}
        onOpenArtist={jest.fn()}
        onPlayTrack={jest.fn()}
      />,
    );
    expect(screen.getByText('Blue')).toBeInTheDocument();
    expect(screen.getByText('Miles')).toBeInTheDocument();
    expect(screen.getByText('1:32')).toBeInTheDocument();
  });

  it('starts the song on a double click', async () => {
    const onPlayTrack = jest.fn();
    wrap(
      <LibraryListView
        tracks={[track({ title: 'Blue' })]}
        browseMode="song"
        onOpenAlbum={jest.fn()}
        onOpenArtist={jest.fn()}
        onPlayTrack={onPlayTrack}
      />,
    );
    await userEvent.dblClick(screen.getByText('Blue'));
    expect(onPlayTrack).toHaveBeenCalledWith('Blue');
  });

  it('marks a format it cannot play instead of pretending it can', async () => {
    wrap(
      <LibraryListView
        tracks={[track({ title: 'Old', isPlayable: false })]}
        browseMode="song"
        onOpenAlbum={jest.fn()}
        onOpenArtist={jest.fn()}
        onPlayTrack={jest.fn()}
      />,
    );
    expect(
      screen.getByTitle('FluidEQ cannot play this format'),
    ).toBeInTheDocument();
  });

  it('marks a file whose tags could not be read, with its own key', () => {
    // Guards against reaching for the nearest existing string instead of a
    // real one — this exact borrowed-string mistake shipped once already.
    wrap(
      <LibraryListView
        tracks={[track({ title: 'Untagged', hasMetadataError: true })]}
        browseMode="song"
        onOpenAlbum={jest.fn()}
        onOpenArtist={jest.fn()}
        onPlayTrack={jest.fn()}
      />,
    );
    expect(
      screen.getByTitle("FluidEQ could not read this file's tags."),
    ).toBeInTheDocument();
  });

  it('dims a track whose root is offline instead of leaving it looking identical (blocker 4)', () => {
    // Spec §10 promises an offline root's tracks are "kept and dimmed" — a
    // comment in `LibraryFolderActions.tsx` asserted this already happened
    // "elsewhere in the library" with nothing anywhere actually reading
    // `isOffline` outside that menu. A row-count or text assertion would
    // pass whether or not this dimming exists at all; only the class itself
    // proves it.
    wrap(
      <LibraryListView
        tracks={[track({ title: 'Ghost', rootId: 'offline-root' })]}
        browseMode="song"
        onOpenAlbum={jest.fn()}
        onOpenArtist={jest.fn()}
        onPlayTrack={jest.fn()}
        offlineRootIds={new Set(['offline-root'])}
      />,
    );
    const row = screen.getByText('Ghost').closest('[role="row"]');
    expect(row).toHaveClass('library-list__row--offline');
  });

  it('leaves a track on a root that is not offline undimmed, right beside it', () => {
    // The positive control the test above needs: proof the class is really
    // conditional on `offlineRootIds`, not applied to every row regardless.
    wrap(
      <LibraryListView
        tracks={[track({ title: 'Live', rootId: 'online-root' })]}
        browseMode="song"
        onOpenAlbum={jest.fn()}
        onOpenArtist={jest.fn()}
        onPlayTrack={jest.fn()}
        offlineRootIds={new Set(['offline-root'])}
      />,
    );
    const row = screen.getByText('Live').closest('[role="row"]');
    expect(row).not.toHaveClass('library-list__row--offline');
  });

  it('opens the reveal menu from the keyboard, not just a right click', () => {
    wrap(
      <LibraryListView
        tracks={[track({ title: 'Blue' })]}
        browseMode="song"
        onOpenAlbum={jest.fn()}
        onOpenArtist={jest.fn()}
        onPlayTrack={jest.fn()}
      />,
    );
    const row = screen.getByText('Blue').closest('[role="row"]');
    expect(row).not.toBeNull();
    // The dedicated Context Menu key — Shift+F10 reaches the same handler.
    fireEvent.keyDown(row as Element, { key: 'ContextMenu' });
    expect(screen.getByText('Show in Explorer')).toBeInTheDocument();
  });

  it('lists albums when that is what is being browsed', () => {
    wrap(
      <LibraryListView
        tracks={[
          track({ title: 'A', album: 'Kind', artist: 'Miles' }),
          track({ title: 'B', album: 'Kind', artist: 'Miles' }),
        ]}
        browseMode="album"
        onOpenAlbum={jest.fn()}
        onOpenArtist={jest.fn()}
        onPlayTrack={jest.fn()}
      />,
    );
    expect(screen.getByText('Kind')).toBeInTheDocument();
    expect(screen.getByText('2 songs')).toBeInTheDocument();
  });
});
