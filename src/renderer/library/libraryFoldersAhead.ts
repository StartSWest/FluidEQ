/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A folder's own folders and its songs as one list, the folders first, the
 * way a file manager lists a directory (Ivan, 2026-11-15, picking option A of
 * the mockups: "lets go with A"). They were two tables, each scrolling in a
 * box of its own with a line between them, and a folder holding both read as
 * two half-screens of something.
 *
 * Both halves stay what they were - two store lists, each asked and paged on
 * its own - and this only lays them end to end. The songs' query is the
 * list's query, so whatever the views ask the store about it (where a song
 * stands, the ids between two rows) answers in the songs' own positions:
 * `lead` is how far down the songs start, for the views to add.
 */

import type { ILibraryList } from './useLibraryList';

const libraryFoldersAhead = (
  folders: ILibraryList,
  songs: ILibraryList,
): ILibraryList => {
  const lead = folders.count;
  return {
    query: songs.query,
    count: lead + songs.count,
    nearCount: songs.nearCount,
    markedCount: songs.markedCount,
    isLoaded: folders.isLoaded && songs.isLoaded,
    hasAnswer: folders.hasAnswer && songs.hasAnswer,
    lead,
    at: (index) => (index < lead ? folders.at(index) : songs.at(index - lead)),
    want: (start, end) => {
      if (start < lead) {
        folders.want(start, Math.min(end, lead));
      }
      if (end > lead) {
        songs.want(Math.max(0, start - lead), end - lead);
      }
    },
    indexOf: (id) => {
      const folder = folders.indexOf(id);
      if (folder >= 0) {
        return folder;
      }
      const song = songs.indexOf(id);
      return song >= 0 ? lead + song : -1;
    },
  };
};

export default libraryFoldersAhead;
