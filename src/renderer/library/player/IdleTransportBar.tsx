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
 * app changed shape depending on whether music had been chosen yet — the
 * workspace grew by sixty pixels the first time somebody pressed play, and
 * the row of controls people reach for was not there to be reached for.
 *
 * Drawn from the same card, the same grid and the same glyphs, with its
 * controls switched off rather than hidden: a transport with the buttons
 * missing reads as broken, and one with them present and quiet reads as
 * waiting, which is what it is.
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

const IdleTransportBar = () => {
  const { t } = useTranslation();
  const barRef = useRef<HTMLDivElement | null>(null);

  // The same strip of window every other bar reserves, reserved the same way
  // — this is that bar, waiting.
  useTransportStrip(barRef, true, false);

  return createPortal(
    <div
      ref={barRef}
      className="now-playing-bar is-empty"
      role="region"
      aria-label={t('library.nowPlaying')}
    >
      <div className="now-playing-bar__track">
        <span className="now-playing-bar__reveal">
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
        </span>
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
