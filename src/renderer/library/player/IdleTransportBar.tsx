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

/**
 * The bar with nothing in it, so that there is always a bar.
 *
 * Every other transport here belongs to a player: the library's queue, the
 * karaoke session, the page in the Media tab, whatever the machine is playing
 * outside. With none of them the foot of the window was simply empty, and the
 * row of controls people reach for was not there to be reached for.
 *
 * Drawn from the same card, the same grid and the same glyphs, with its
 * controls switched off rather than hidden: a transport with the buttons
 * missing reads as broken, and one with them present and quiet reads as
 * waiting, which is what it is. Its title is a button, because the second
 * line of it is an instruction — see the press-target below.
 *
 * Unlike every other bar it floats over the content instead of reserving a
 * strip beside it, for the reason spelled out at `useTransportStrip` below.
 *
 * Never in full screen. There the bar is a thing that appears when the
 * pointer goes looking for it, over a picture — and an empty one appearing
 * over a video would be chrome arriving to say nothing.
 */

import { useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTransportStrip } from '../../audio/useTransportStrip';
import LibraryCoverArt from '../LibraryCoverArt';
import { useTranslation } from '../../utils/I18nContext';
import { TransportIcon } from './NowPlayingBar';
import '../../styles/NowPlayingBar.scss';

const IdleTransportBar = ({ onGoToLibrary }: { onGoToLibrary: () => void }) => {
  const { t } = useTranslation();
  const barRef = useRef<HTMLDivElement | null>(null);

  // OVER THE CONTENT, WHICH IS THE ONE THING THIS BAR DOES DIFFERENTLY.
  //
  // A bar driving a player earns its strip: the panel beneath it has to clear
  // controls somebody is reaching for, and a scroll that ends underneath them
  // ends nowhere. This one drives nothing. Measured in the running window,
  // that strip is 74px — a fourteenth of a 1032px workspace, given up on
  // every tab for a card whose entire content is the word "nothing", and
  // taken off the bottom of whatever is actually being read.
  //
  // The cost is that the workspace does now change height once, when a real
  // bar replaces this one. That is the trade: a shift at the moment something
  // starts playing, against 74px missing from every tab for as long as
  // nothing is.
  useTransportStrip(barRef, true, true);

  return createPortal(
    <div
      ref={barRef}
      className="now-playing-bar is-empty"
      role="region"
      aria-label={t('library.nowPlaying')}
    >
      <div className="now-playing-bar__track">
        {/* "Pick something to play" is an instruction, so it is also the way
            to do it. The same press-target the library's bar uses to reveal
            the playing track, pointed at the place where something can be
            picked — a line telling somebody to choose, that does nothing when
            pressed, is the app declining to answer its own sentence. */}
        <button
          type="button"
          className="now-playing-bar__reveal"
          aria-label={t('library.nothingPlayingHint')}
          onClick={onGoToLibrary}
        >
          {/* The generated tile, from no title at all: the same square in the
              same place, so the bar does not change shape the moment a song
              arrives in it. */}
          <LibraryCoverArt label="" size="row" />
          <span className="now-playing-bar__meta">
            <span className="now-playing-bar__title">
              {t('library.nothingPlaying')}
            </span>
            <span className="now-playing-bar__artist">
              {t('library.nothingPlayingHint')}
            </span>
            <span className="now-playing-bar__format" />
          </span>
        </button>
      </div>

      <div className="now-playing-bar__deck">
        <div className="now-playing-bar__buttons">
          <button
            type="button"
            className="now-playing-bar__control now-playing-bar__play"
            aria-label={t('library.play')}
            title={t('library.play')}
            disabled
          >
            <TransportIcon name="play" />
          </button>
        </div>
      </div>

      <div className="now-playing-bar__aside">
        <div className="now-playing-bar__secondary" />
      </div>
    </div>,
    document.body,
  );
};

export default IdleTransportBar;
