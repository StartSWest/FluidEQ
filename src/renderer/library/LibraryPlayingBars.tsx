/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Library's "this is what you are hearing" mark: four bars moving like a
 * level meter (`_libraryList.scss`). The song row draws it in its number cell
 * and the folder tree on the folder the song is in and every folder above it.
 *
 * In a frame of its own: the bars move every frame, and a drawing that moves
 * is laid out again - as an item of a row's grid or flex line it took the
 * row's layout with it (`.library-list__playing-frame`).
 */
const LibraryPlayingBars = ({ isHeld = false }: { isHeld?: boolean }) => (
  <span className={`library-list__playing-frame${isHeld ? ' is-held' : ''}`}>
    <svg viewBox="0 0 14 12" aria-hidden="true">
      <g className="library-list__playing-bars">
        <rect x="0.5" y="1" width="2.2" height="10" rx="1.1" />
        <rect x="4.1" y="1" width="2.2" height="10" rx="1.1" />
        <rect x="7.7" y="1" width="2.2" height="10" rx="1.1" />
        <rect x="11.3" y="1" width="2.2" height="10" rx="1.1" />
      </g>
    </svg>
  </span>
);

export default LibraryPlayingBars;
