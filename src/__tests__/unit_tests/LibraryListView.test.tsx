import { render, screen } from '@testing-library/react';
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
