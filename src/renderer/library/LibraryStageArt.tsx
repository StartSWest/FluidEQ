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

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { libraryMediaUrl } from '../../common/library/mediaUrl';
import LibraryCoverArt from './LibraryCoverArt';
import { useLibraryPlayer } from './player/LibraryPlayerContext';
import '../styles/LibraryStageArt.scss';

/**
 * The box the picture stands in, measured and published to the stylesheet.
 *
 * The graph has two of these modes, not one: expanded keeps the sidebars and
 * takes the middle column, full screen takes the window. A picture fixed to the
 * window is right for the second and covers the sidebars in the first, so the
 * column is measured and both the picture and the card are laid on the result.
 * In full screen the column *is* the window and the numbers come out the same,
 * which is why there is one path rather than a mode flag.
 *
 * Clamped to what is on screen. The library column is as tall as the list
 * inside it — 2618px against a 1440px window is a measured case — so the raw
 * rectangle would centre the record a screen and a half below the fold.
 */
const useStageBox = () => {
  useEffect(() => {
    // On the document, not on `#root`. The picture is portalled to the body
    // and is therefore `#root`'s *sibling*: custom properties inherit down the
    // tree and never sideways, so written there the card read them and the
    // record did not — measured, as the record still covering the sidebars in
    // expanded mode while the card sat correctly in the column.
    const host = document.documentElement;
    const column = document.querySelector('.center-workspace');
    if (!column) {
      return undefined;
    }

    const publish = () => {
      const rect = column.getBoundingClientRect();
      const top = Math.max(rect.top, 0);
      const bottom = Math.min(rect.bottom, window.innerHeight);
      host.style.setProperty('--stage-art-left', `${Math.round(rect.left)}px`);
      host.style.setProperty(
        '--stage-art-width',
        `${Math.round(rect.width)}px`,
      );
      host.style.setProperty('--stage-art-top', `${Math.round(top)}px`);
      // The same clamp, expressed from the column's own top edge. The card is
      // fixed *inside* the column — `.center-workspace` carries `will-change:
      // transform`, which makes it the containing block for fixed children —
      // so it needs the offset, not the viewport coordinate. Zero whenever the
      // column starts on screen, which is both of these modes today.
      host.style.setProperty(
        '--stage-art-shift',
        `${Math.round(top - rect.top)}px`,
      );
      host.style.setProperty(
        '--stage-art-height',
        `${Math.round(Math.max(0, bottom - top))}px`,
      );
    };

    publish();

    // The column, the shell around it and the window: between them they cover
    // entering the mode, opening a side pane and resizing the window, which is
    // every way this rectangle moves.
    const observer = new ResizeObserver(publish);
    observer.observe(column);
    observer.observe(document.documentElement);
    window.addEventListener('resize', publish);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', publish);
      host.style.removeProperty('--stage-art-left');
      host.style.removeProperty('--stage-art-width');
      host.style.removeProperty('--stage-art-top');
      host.style.removeProperty('--stage-art-shift');
      host.style.removeProperty('--stage-art-height');
    };
  }, []);
};

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
 */
const LibraryStageArt = () => {
  const { track, videoTrackId } = useLibraryPlayer();

  // A marker for the one stylesheet rule this view needs from the graph: its
  // plot lifted over the picture. Scoped to this class rather than written
  // into the graph's own full-screen rules, so nothing about the Media tab's
  // full screen changes because of a feature that belongs to the Library.
  useEffect(() => {
    const root = document.getElementById('root');
    root?.classList.add('has-stage-art');
    return () => root?.classList.remove('has-stage-art');
  }, []);

  useStageBox();

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
