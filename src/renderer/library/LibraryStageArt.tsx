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

import { createPortal } from 'react-dom';
import { libraryMediaUrl } from '../../common/library/mediaUrl';
import LibraryCoverArt from './LibraryCoverArt';
import { useLibraryPlayerSession } from './player/LibraryPlayerContext';
import useStageArtFrame from './useStageArtFrame';
import '../styles/LibraryStageArt.scss';

/**
 * The song, filling the screen behind a full-screen graph.
 *
 * Full screen on the Library tab used to be the plot on the app's own
 * background: a picture of the sound with nothing about the music in it. This
 * is the cover, the title and the album, drawn behind the plot so both are on
 * screen at once.
 *
 * What is PLAYING, never what is being browsed. Following the selection would
 * mean the picture changed under the pointer while somebody scrolled a list
 * they were not listening to, and full screen is the mode where nobody is
 * scrolling anything.
 *
 * Portalled to the body for the reason the transport bar is: it belongs to the
 * window rather than to whichever tab panel happens to be its React ancestor,
 * and the tab panels clip. `pointer-events: none` throughout, so the gestures
 * the graph owns -- a double-click to leave full screen among them — reach it
 * through the picture.
 *
 * The machine's own sound gets the same picture from `SystemStageArt`; the
 * box both stand in is `useStageArtFrame`'s.
 */
const LibraryStageArt = () => {
  const { track, videoTrackId } = useLibraryPlayerSession();

  useStageArtFrame();

  /**
   * No sleeve in front of a video.
   *
   * A video's cover is a still frame the record was never about, and drawing
   * it here put a picture over the thing that is actually moving. The stage
   * takes the window itself in this mode — see `is-behind-graph` — so what is
   * behind the plot is the video.
   *
   * The marker and the measured box above stay published either way: they are
   * what lifts the column and pins the plot to the window, and the plot needs
   * that whichever picture is underneath it.
   */
  if (!track || videoTrackId !== undefined || typeof document === 'undefined') {
    return null;
  }

  const wash = track.artId ? libraryMediaUrl('art', track.artId) : undefined;

  return createPortal(
    <div className="library-stage-art" aria-hidden="true">
      {/* The same picture twice: blown up and blurred to fill the screen, and
          again at its own size in the middle. A cover is square and a screen
          is not, so something has to fill the sides, and a wash of the record
          itself is the only thing that always suits it. */}
      {wash && (
        <img
          className="library-stage-art__wash"
          src={wash}
          alt=""
          aria-hidden
        />
      )}
      <div className="library-stage-art__cover">
        <LibraryCoverArt artId={track.artId} label={track.title} size="cover" />
      </div>
      <div className="library-stage-art__meta">
        <h2>{track.title}</h2>
        <p>{track.artist}</p>
        {track.album && <small>{track.album}</small>}
      </div>
    </div>,
    document.body,
  );
};

export default LibraryStageArt;
