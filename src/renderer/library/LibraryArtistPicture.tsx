/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ILibraryList } from './useLibraryList';
import LibraryCoverArt from './LibraryCoverArt';

/** Records looked through for four different covers: the first page's
 * worth, already read for the rail under the header. */
const LOOKED_AT = 12;

/**
 * THE ARTIST'S PICTURE: a circle, where a record's cover is a square — the
 * one shape on the page that says "a person, not a record" before a word is
 * read. Four of their records' covers in quarters when they have four
 * different ones; otherwise their first cover, or their initials on their
 * own colour when there is none. Covers the library already holds, nothing
 * fetched for it.
 */
const LibraryArtistPicture = ({
  name,
  artId,
  albums,
}: {
  name: string;
  /** Their first cover (`ILibraryArtistFacts.artId`). */
  artId: string | undefined;
  /** Their records, newest first, as the rail lists them. */
  albums: ILibraryList;
}) => {
  const covers: string[] = [];
  for (
    let index = 0;
    index < Math.min(albums.count, LOOKED_AT) && covers.length < 4;
    index += 1
  ) {
    const item = albums.at(index);
    if (item?.kind === 'album' && item.artId && !covers.includes(item.artId)) {
      covers.push(item.artId);
    }
  }
  if (covers.length === 4) {
    return (
      <span className="library-artist-art is-mosaic" aria-hidden="true">
        {covers.map((cover) => (
          <LibraryCoverArt key={cover} artId={cover} label={name} size="tile" />
        ))}
      </span>
    );
  }
  return (
    <span className="library-artist-art" aria-hidden="true">
      <LibraryCoverArt artId={covers[0] ?? artId} label={name} size="cover" />
    </span>
  );
};

export default LibraryArtistPicture;
