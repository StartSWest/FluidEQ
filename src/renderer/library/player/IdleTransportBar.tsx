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
 * It reserves its strip like every other bar; see `useTransportStrip` below
 * for what floating over the content cost when it did not.
 *
 * Never in full screen. There the bar is a thing that appears when the
 * pointer goes looking for it, over a picture — and an empty one appearing
 * over a video would be chrome arriving to say nothing.
 *
 * AND IT SAYS WHAT PLAYED LAST, once anything has. The player that described
 * a song can go — a reload, the browser tab closed, the other computer
 * disconnected, the queue stopped — and "Nothing playing" in its place read
 * as the app having forgotten (Ivan, 2026-09-24: "we need to keep last thing
 * was playing on the bar always unless there is a new thing that plays").
 * The words, the picture and where it came from stay, from `lastShown`; the
 * buttons stay quiet, because there is nothing live behind them to press,
 * and the press on the title goes to the tab that played it.
 */

import { useRef } from 'react';
import { createPortal } from 'react-dom';
import type { ILastShown } from '../../audio/lastShown';
import useTransportStrip from '../../audio/useTransportStrip';
import { sourceLabel } from '../../player/playerText';
import LibraryCoverArt from '../LibraryCoverArt';
import { useTranslation } from '../../utils/I18nContext';
import { TransportIcon } from './NowPlayingBar';
import '../../styles/NowPlayingBar.scss';

interface IIdleTransportBarProps {
  /** The last thing played, when there has been one. */
  remembered: ILastShown | undefined;
  /**
   * Where the press on the title goes: the tab that played the remembered
   * song, the Library when there is none. Absent for another program's sound,
   * which has no tab here — see `SourceTransportBar` for why a press that goes
   * nowhere is not offered.
   */
  onReveal: (() => void) | undefined;
}

const IdleTransportBar = ({ remembered, onReveal }: IIdleTransportBarProps) => {
  const { t } = useTranslation();
  const barRef = useRef<HTMLDivElement | null>(null);

  // BESIDE THE CONTENT, LIKE EVERY OTHER BAR.
  //
  // This floated over it for a while, to keep 74px of every tab that a card
  // saying "nothing" had not earned. What that actually bought was an opaque
  // glass card laid across the foot of the sidebar: the panels are cards with
  // rounded corners that run to the bottom gutter, so the visualiser's meters
  // and the sidebar's own bottom edge were painted underneath it, and the
  // workspace's last row with them.
  //
  // The 74px is the honest price of a bar that is always there. Reserving it
  // always also means the workspace no longer changes height at the moment
  // something starts playing, which was the other half of that trade.
  useTransportStrip(barRef, true, false);

  const contextLabel =
    remembered === undefined ? '' : sourceLabel(remembered, t);

  return createPortal(
    <div
      ref={barRef}
      className={`now-playing-bar ${
        remembered === undefined ? 'is-empty' : 'is-remembered'
      }`}
      role="region"
      aria-label={t('library.nowPlaying')}
    >
      <div className="now-playing-bar__track">
        {remembered === undefined ? (
          /* "Pick something to play" is an instruction, so it is also the
             way to do it. The same press-target the library's bar uses to
             reveal the playing track, pointed at the place where something
             can be picked — a line telling somebody to choose, that does
             nothing when pressed, is the app declining to answer its own
             sentence. */
          <button
            type="button"
            className="now-playing-bar__reveal"
            aria-label={t('library.nothingPlayingHint')}
            onClick={onReveal}
            disabled={onReveal === undefined}
          >
            {/* The generated tile, from no title at all: the same square in
                the same place, so the bar does not change shape the moment a
                song arrives in it. */}
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
        ) : (
          /* The live bar's three lines, from what it said last: the title,
             the artist, and the place it played in — which is also where
             the press goes. */
          <button
            type="button"
            className="now-playing-bar__reveal"
            title={contextLabel}
            aria-label={`${contextLabel} — ${remembered.title}`}
            onClick={onReveal}
            disabled={onReveal === undefined}
          >
            <LibraryCoverArt
              src={remembered.artworkUrl}
              label={remembered.title}
              size="row"
            />
            <span className="now-playing-bar__meta">
              <span className="now-playing-bar__title">{remembered.title}</span>
              {remembered.subtitle && (
                <span className="now-playing-bar__artist">
                  {remembered.subtitle}
                </span>
              )}
              <span className="now-playing-bar__format now-playing-bar__context">
                {contextLabel}
              </span>
            </span>
          </button>
        )}
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
