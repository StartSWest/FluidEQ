/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { type ReactNode, useEffect, useState } from 'react';
import { isInsideAnchoredMenu } from '../widgets/AnchoredMenu';
import LibraryTrackMenu from './LibraryTrackMenu';

/** The album a tile or a cover stands for, as the menu needs it. */
export interface IAlbumTile {
  id: string;
  title: string;
  artist: string;
  trackCount: number;
}

/**
 * An album's menu from its tile or its cover (the Auto EQ mockup: "right-click
 * an album · grid, list or Cover Flow"): the record header's menu, handed the
 * whole album — its songs asked for as it opens, and its Sound page setting
 * the album's sound (`LibrarySoundMenu`). The grid and Cover Flow call `open`
 * from their own context-menu handler and draw `menu`.
 */
const useAlbumTileMenu = (): {
  open: (anchor: HTMLElement, album: IAlbumTile) => void;
  menu: ReactNode;
} => {
  const [subject, setSubject] = useState<{
    anchor: HTMLElement;
    album: IAlbumTile;
    trackIds: readonly string[];
  }>();

  // Closes on a press elsewhere and on Escape, as every Library menu does.
  useEffect(() => {
    if (!subject) {
      return undefined;
    }
    const onPointerDown = (event: MouseEvent) => {
      if (!isInsideAnchoredMenu(event.target)) {
        setSubject(undefined);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSubject(undefined);
      }
    };
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [subject]);

  const open = (anchor: HTMLElement, album: IAlbumTile) => {
    // Opened once its songs are known: a menu over an album whose songs it
    // does not know yet would act on none of them.
    window.electron.ipcRenderer
      .queryLibrary({
        type: 'ids',
        query: {
          shelf: 'tracks',
          scope: { album: album.id },
          natural: 'disc',
          direction: 'asc',
        },
        offset: 0,
        limit: Math.max(1, album.trackCount),
      })
      .then((trackIds) => {
        setSubject({ anchor, album, trackIds });
        return undefined;
      })
      .catch(() => undefined);
  };

  const menu = subject ? (
    <LibraryTrackMenu
      anchor={subject.anchor}
      isOpen
      trackIds={subject.trackIds}
      heading={subject.album.title}
      album={{
        key: subject.album.id,
        title: subject.album.title,
        artist: subject.album.artist,
      }}
      onClose={() => setSubject(undefined)}
    />
  ) : null;

  return { open, menu };
};

export default useAlbumTileMenu;
