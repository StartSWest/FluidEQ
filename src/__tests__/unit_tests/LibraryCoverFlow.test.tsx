/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { type ComponentProps, type ReactElement, useState } from 'react';
import type {
  ILibraryTrack,
  TLibraryBrowseMode,
} from '../../common/library/types';
import LibraryCoverFlow, {
  COVER_FLOW_NEIGHBOURS,
  coverFlowTransform,
} from '../../renderer/library/LibraryCoverFlow';
import { LibraryProvider } from '../../renderer/library/LibraryContext';
import { shelfQueryFor } from '../../renderer/library/libraryShelfQuery';
import { I18nProvider } from '../../renderer/utils/I18nContext';
import LibraryListOf from '../utils/LibraryListOf';
import {
  type ILibraryStoreBridge,
  installIpcRenderer,
  libraryTrack,
  openLibraryStoreBridge,
} from '../utils/libraryStoreBridge';

// One folder per album, which is what a real library looks like. With every
// album in a single directory `LibraryDetail` — correctly — lists the other
// albums' tracks underneath as "also in this folder", so a fixture that piled
// them together could not tell "the panel shows the right album" from "the
// panel shows everything".
const albumTracks = (count: number): ILibraryTrack[] =>
  Array.from({ length: count }, (_, index) =>
    libraryTrack({
      id: `t${index}`,
      path: `C:\\Music\\album-${index}\\${index}.mp3`,
      title: `Song ${index}`,
      album: `Album ${index}`,
      artist: 'Artist',
    }),
  );

// A distinct set of albums whose titles sort ahead of `albumTracks`' own on
// the title order the shelf uses, so adding them simulates a rescan finding
// albums that land in front of the one already centred — same artist,
// different album keys, different track ids, so nothing here coincides with
// `albumTracks` by accident.
const aheadAlbumTracks = (count: number): ILibraryTrack[] =>
  Array.from({ length: count }, (_, index) =>
    libraryTrack({
      id: `p${index}`,
      path: `C:\\Music\\ahead-${index}\\${index}.mp3`,
      title: `Ahead Song ${index}`,
      album: `Aardvark Album ${index}`,
      artist: 'Artist',
    }),
  );

let bridge: ILibraryStoreBridge | undefined;

afterEach(() => {
  // Unmounted before the store closes, so nothing asks a closed store.
  cleanup();
  bridge?.close();
  bridge = undefined;
});

type TCoverFlowProps = Pick<
  ComponentProps<typeof LibraryCoverFlow>,
  'onPlayTrack' | 'openId' | 'onOpenChange'
> & { browseMode: TLibraryBrowseMode };

/** The row the workspace draws for a shelf in Cover Flow, from the store. */
const ShelfCoverFlow = ({
  browseMode,
  onPlayTrack,
  openId,
  onOpenChange,
}: TCoverFlowProps) => (
  <LibraryListOf
    query={shelfQueryFor({
      browseMode,
      viewMode: 'coverflow',
      folderPath: undefined,
      search: '',
      sort: 'title',
      direction: 'asc',
      isTree: false,
      hasRoots: true,
      folderLevel: undefined,
    })}
  >
    {(list) => (
      <LibraryCoverFlow
        list={list}
        browseMode={browseMode}
        onPlayTrack={onPlayTrack}
        openId={openId}
        onOpenChange={onOpenChange}
      />
    )}
  </LibraryListOf>
);

/**
 * What the workspace does around the row: holds what is open, and closes it
 * from the place bar's Back, which is the Library's one way out of a record
 * (`LibraryPlaceBar`). A stand-in for both, so the row can be tested on its
 * own against the contract the workspace keeps with it.
 */
const WithPlaceBar = ({
  browseMode,
  onPlayTrack,
}: Pick<TCoverFlowProps, 'browseMode' | 'onPlayTrack'>) => {
  const [openId, setOpenId] = useState<string | undefined>(undefined);
  return (
    <>
      <button type="button" onClick={() => setOpenId(undefined)}>
        Back
      </button>
      <ShelfCoverFlow
        browseMode={browseMode}
        onPlayTrack={onPlayTrack}
        openId={openId}
        onOpenChange={setOpenId}
      />
    </>
  );
};

/** Renders inside a library holding `tracks`, and hands back the library. */
const showInLibrary = (
  tracks: ILibraryTrack[],
  ui: ReactElement,
): ILibraryStoreBridge => {
  const opened = openLibraryStoreBridge({ tracks });
  bridge = opened;
  installIpcRenderer(opened.channels);
  render(
    <I18nProvider>
      <LibraryProvider>{ui}</LibraryProvider>
    </I18nProvider>,
  );
  return opened;
};

/** The centre cover, once the row's first page has come back. */
const centre = () => screen.findByRole('option', { selected: true });

describe('the cover flow geometry', () => {
  it('leaves the centre cover facing the viewer', () => {
    expect(coverFlowTransform(0)).toContain('rotateY(0deg)');
  });

  it('turns the two sides towards the middle, not the same way', () => {
    // A right-side cover (positive offset) turns +60deg to present its
    // centre-facing (local left) edge to the viewer as it curls inward; the
    // left side is the mirror image at -60deg. See `coverFlowTransform`'s own
    // comment for the rotation-matrix derivation these numbers come from.
    expect(coverFlowTransform(-1)).toContain('rotateY(-60deg)');
    expect(coverFlowTransform(1)).toContain('rotateY(60deg)');
  });

  it('pushes distant covers back, further the further out they are', () => {
    // Without translateZ the row is a flat fan; without the depth GROWING
    // with distance every side cover sits on one plane, which is a different
    // flat fan. The depth is a `calc()` against `--cover-flow-size` because
    // the cover sizes itself off the stage — see `coverFlowTransform`.
    const depthOf = (offset: number): number => {
      const match =
        /translateZ\(calc\(var\(--cover-flow-size\) \* -([\d.]+)\)\)/.exec(
          coverFlowTransform(offset),
        );
      return match ? Number(match[1]) : Number.NaN;
    };
    expect(depthOf(1)).toBeGreaterThan(0);
    expect(depthOf(3)).toBeGreaterThan(depthOf(1));
    // Both sides recede. A sign that leaked into the depth would pull the
    // left half of the row towards the viewer instead.
    expect(depthOf(-3)).toBe(depthOf(3));
    expect(coverFlowTransform(0)).toContain('translateZ(0)');
  });
});

describe('cover flow', () => {
  it('mounts a window of covers, not the whole library', async () => {
    // 400 albums must animate like 20. Everything past the window is not
    // rendered at all.
    showInLibrary(albumTracks(400), <ShelfCoverFlow browseMode="album" />);
    await centre();
    const covers = screen.getAllByRole('option');
    expect(covers.length).toBeGreaterThan(1);
    expect(covers.length).toBeLessThanOrEqual(COVER_FLOW_NEIGHBOURS * 2 + 1);
  });

  it('moves with the arrow keys', async () => {
    showInLibrary(albumTracks(5), <ShelfCoverFlow browseMode="album" />);
    await centre();
    screen.getByRole('listbox').focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('option', { selected: true })).toHaveTextContent(
      'Album 1',
    );
  });

  it('opens the centred album under the row instead of navigating away', async () => {
    // The row is the whole reason to be in this view, so pressing a cover
    // shows its songs beneath the carousel and the carousel stays. Asserted
    // on the right songs being on screen AND the listbox still being there:
    // either alone would pass a version that swapped one for the other.
    showInLibrary(
      [
        ...albumTracks(3),
        libraryTrack({
          id: 'extra',
          path: 'C:\\Music\\album-0\\extra.mp3',
          title: 'Second Track',
          album: 'Album 0',
          artist: 'Artist',
        }),
      ],
      <ShelfCoverFlow browseMode="album" onPlayTrack={jest.fn()} />,
    );
    await centre();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();

    screen.getByRole('listbox').focus();
    await userEvent.keyboard('{Enter}');

    const shown = () =>
      screen.queryAllByRole('row').map((row) => row.textContent ?? '');
    await waitFor(() =>
      expect(shown().some((text) => text.includes('Second Track'))).toBe(true),
    );
    expect(shown().some((text) => text.includes('Song 0'))).toBe(true);
    // Album 1's track belongs to a different cover and must not be listed.
    expect(shown().some((text) => text.includes('Song 1'))).toBe(false);
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  it('holds its contents while the row is turned, and only Back closes it', async () => {
    // Turning the row and choosing something are two different acts. Arrow
    // keys move the row and must leave the panel alone — it neither closes
    // nor follows along, because browsing the fan with one album open is the
    // point of putting the detail here at all.
    const shows = (title: string) =>
      screen.queryAllByRole('row').some((r) => r.textContent?.includes(title));

    showInLibrary(
      albumTracks(5),
      <WithPlaceBar browseMode="album" onPlayTrack={jest.fn()} />,
    );
    await centre();
    screen.getByRole('listbox').focus();

    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(shows('Song 0')).toBe(true));

    await userEvent.keyboard('{ArrowRight}');
    // Open, unchanged, and the row really did move underneath it.
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(shows('Song 0')).toBe(true);
    expect(shows('Song 1')).toBe(false);
    expect(screen.getByRole('option', { selected: true })).toHaveTextContent(
      'Album 1',
    );

    // The control: it is not simply stuck. Back closes it.
    await userEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('jumps the row to the first cover under a letter', async () => {
    // A thirteen-cover window over thousands of albums needs a way across
    // the whole collection that is not scrolling. Asserted on landing at the
    // right album, and on a letter with nothing under it being disabled
    // rather than silently doing nothing.
    showInLibrary(
      [
        ...albumTracks(2),
        libraryTrack({
          id: 'z1',
          path: 'C:\\Music\\zebra\\z1.mp3',
          title: 'Stripes',
          album: 'Zebra Sessions',
          artist: 'Artist',
        }),
      ],
      <ShelfCoverFlow browseMode="album" />,
    );
    await centre();
    const zebra = screen.getByRole('button', { name: 'Z' });
    await waitFor(() => expect(zebra).toBeEnabled());
    await userEvent.click(zebra);
    expect(screen.getByRole('option', { selected: true })).toHaveTextContent(
      'Zebra Sessions',
    );
    expect(screen.getByRole('button', { name: 'Q' })).toBeDisabled();
  });

  it('plays the centred song on Enter in song mode (blocker 5)', async () => {
    // Before this fix, `activateCurrent` handled 'album' and 'artist' with
    // no `else` and the component had no `onPlayTrack` prop at all — Enter
    // or a click on the centre cover was silently inert for every track in
    // song mode, the one cell of the view/browse matrix Cover Flow left dead.
    const onPlayTrack = jest.fn();
    showInLibrary(
      albumTracks(5),
      <ShelfCoverFlow browseMode="song" onPlayTrack={onPlayTrack} />,
    );
    await centre();
    screen.getByRole('listbox').focus();
    await userEvent.keyboard('{Enter}');
    expect(onPlayTrack).toHaveBeenCalledWith('t0');
  });

  it('does nothing when song mode is shown with no onPlayTrack at all, right beside it', async () => {
    // The positive control: proof the optional prop is genuinely optional
    // (no test of the other browse modes accidentally relies on it) rather
    // than something that would throw if a future caller forgot it.
    showInLibrary(albumTracks(5), <ShelfCoverFlow browseMode="song" />);
    await centre();
    screen.getByRole('listbox').focus();
    await expect(userEvent.keyboard('{Enter}')).resolves.not.toThrow();
  });

  it('keeps the same album centred when new albums are inserted ahead of it', async () => {
    // A rescan finding new albums does not only append: on the title order
    // an album discovered later can land ahead of the ones already showing.
    // The centre must follow the album it was showing, not the numeric
    // position that album used to be at.
    //
    // Asserted on the selected option's own `id` (`library-coverflow-option-`
    // plus the album's own key), not on visible text: a text assertion is a
    // substring match, and "Album 1" is a substring of "Aardvark Album 1" —
    // the cover that lands at the old position — so it would pass whether or
    // not identity tracking worked.
    const library = showInLibrary(
      albumTracks(5),
      <ShelfCoverFlow browseMode="album" />,
    );
    await centre();
    screen.getByRole('listbox').focus();
    await userEvent.keyboard('{ArrowRight}');
    const centredOption = screen.getByRole('option', { selected: true });
    expect(centredOption).toHaveTextContent('Album 1');
    const centredOptionId = centredOption.id;

    // The scan's batch lands in the store and main announces it.
    library.store.upsertTracks(aheadAlbumTracks(3), 0);
    act(() => library.announce());
    // The row has been read again: the new albums are in it.
    await screen.findByText('Aardvark Album 2');

    expect(screen.getByRole('option', { selected: true }).id).toBe(
      centredOptionId,
    );
  });
});
