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
 * In a frame of its own: the bars move every frame, and as an item of a row's
 * grid or flex line a moving drawing took the row's layout with it
 * (`.library-list__playing-frame`).
 *
 * Elements of the page, never SVG shapes. An SVG shape that moves is painted
 * again on the main thread on every frame of the display, where a page
 * element's `scale` runs on the compositor: measured in the running window
 * (240 Hz, four marks on screen - the row and three folders), the four marks
 * as SVG kept the main thread 51% busy against 20% held, the renderer at 77%
 * of a core against 28% and the graphics process at 136% against 35%, every
 * frame repainting the document and laying the whole page's layers out again.
 */
const LibraryPlayingBars = ({ isHeld = false }: { isHeld?: boolean }) => (
  <span className={`library-list__playing-frame${isHeld ? ' is-held' : ''}`}>
    <span className="library-list__playing-bars" aria-hidden="true">
      <span />
      <span />
      <span />
      <span />
    </span>
  </span>
);

export default LibraryPlayingBars;
