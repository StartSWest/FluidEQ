/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A NAME YOU CAN PRESS (Ivan, 2026-11-22: "in the library I want to click on
 * the artist and show more of that artist"). An artist's name on an album's
 * header, in a table's Artist column and on the now-playing card opens that
 * artist's page; an album on the artist's page opens the album. Both are
 * steps of the Library's own trail (`useLibrarySteps`), so Back returns.
 *
 * The way there is handed down by the workspace. A name drawn anywhere else
 * — a table outside the Library, a test that mounts one view — has no
 * workspace above it, and is drawn as plain text.
 */

import { createContext, useContext } from 'react';

export interface ILibraryRecordLinks {
  /** The artist's page, by `artistKeyOf`. */
  openArtist: (artistId: string) => void;
  /** The album's page, by `albumKey`. */
  openAlbum: (albumId: string) => void;
}

const RecordLinksContext = createContext<ILibraryRecordLinks | undefined>(
  undefined,
);

export const LibraryRecordLinksProvider = RecordLinksContext.Provider;

export const useLibraryRecordLinks = (): ILibraryRecordLinks | undefined =>
  useContext(RecordLinksContext);
