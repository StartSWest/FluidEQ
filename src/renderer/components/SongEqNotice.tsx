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

import MenuIcon from '../icons/MenuIcon';
import {
  endSongEqNotice,
  forgetCurrentSongEq,
  undoSongEqLoan,
  useSongEqClock,
  useSongEqNotice,
} from '../audio/songEqSession';
import { useTranslation } from '../utils/I18nContext';
import isOwnAnimationEnd from '../utils/ownAnimationEnd';
import { useNoticeClaim } from '../utils/noticeTurn';
import '../styles/SongEqNotice.scss';

/**
 * Says which song a saved curve was just loaned onto, and offers to undo it.
 *
 * Mounted at the app root beside `SpeechMemoryNotice`, and for the same
 * reason: the match that raises this can land while the user is on any tab,
 * not just the one that shows the Smart EQ tick, and the loan is already
 * audible by the time this draws. A notice that only existed inside that tab
 * would be read by nobody who was not already looking at it.
 *
 * `useSongEqNotice` returns `undefined` for the whole time between one song's
 * fade and the next match — not just at launch — so the guard below is on
 * the render path, not a one-time mount check.
 *
 * It lingers for its own animation (`song-eq-notice-linger`, six seconds)
 * and goes when that ends, reported back by id (`endSongEqNotice`) so a
 * second match while the first is still up keeps its own full six seconds.
 * It used to be a timer in `songEqSession.ts`, which ran whether or not the
 * window was painting, so a match behind a minimised window raised a notice
 * and took it down again unseen.
 *
 * Fading is not undoing. The end of the linger only stops saying it; it
 * never dispatches an `undo`, so the loaned layer keeps playing after the
 * toast is gone exactly as if the user had pressed neither button. Undo and
 * Forget are the only two things that hand the loan back.
 *
 * Neither button is the recommendation: doing nothing is, which is what the
 * auto-fade already expresses. Both therefore wear `button small subtle`
 * (see CLAUDE.md's emphasis rule, and `SpeechMemoryNotice.tsx` for the same
 * class in use) rather than one of them going loud the way a wrongly-styled
 * decline button did elsewhere in this app.
 *
 * Forget is not a milder Undo — it is a strict superset, by design (see
 * `forgetCurrentSongEq`'s own comment in `songEqSession.ts`): deleting a
 * song's memory also hands back whatever of it is currently applied, because
 * leaving a curve running for an entry that no longer exists is the
 * incoherent outcome, not the safe one.
 */
const SongEqNotice = () => {
  const { t } = useTranslation();
  const notice = useSongEqNotice();
  // Shares its corner with the Plus notices, which step aside for it.
  useNoticeClaim('songEq', Boolean(notice));

  if (!notice) {
    return null;
  }

  const { entry } = notice;
  const body =
    entry.plays <= 1
      ? t('songEq.noticeBodyOnce', { title: entry.title })
      : t('songEq.noticeBody', { title: entry.title, plays: entry.plays });

  return (
    <div
      // Keyed on the match, so a second one while this is still up starts its
      // linger over rather than inheriting what was left of the first.
      key={notice.id}
      className="song-eq-notice"
      onAnimationEnd={(event) => {
        if (isOwnAnimationEnd(event, 'song-eq-notice-linger')) {
          endSongEqNotice(notice.id);
        }
      }}
      role="dialog"
      aria-labelledby="song-eq-notice-title"
      aria-describedby="song-eq-notice-body"
    >
      <MenuIcon name="smart" className="song-eq-notice__icon" />
      <div className="song-eq-notice__text">
        <strong id="song-eq-notice-title">{t('songEq.noticeTitle')}</strong>
        <span id="song-eq-notice-body">{body}</span>
      </div>
      <div className="song-eq-notice__actions">
        <button
          type="button"
          className="button small subtle"
          onClick={undoSongEqLoan}
        >
          {t('songEq.undo')}
        </button>
        <button
          type="button"
          className="button small subtle"
          onClick={forgetCurrentSongEq}
        >
          {t('songEq.forget')}
        </button>
      </div>
    </div>
  );
};

/**
 * The song memory's clock, which draws nothing.
 *
 * `useSongEqClock` redraws whatever calls it on every position a player
 * reports, so it has a component that is nothing else. It rides with the
 * notice because the notice is the part of the song memory mounted at the
 * window's root for the whole session, which is the lifetime the clock needs;
 * the host has that lifetime too, but the host is the root itself, where a
 * redraw per position would be the whole window's.
 */
const SongEqClock = () => {
  useSongEqClock();
  return null;
};

const SongEqNoticeWithClock = () => (
  <>
    <SongEqClock />
    <SongEqNotice />
  </>
);

export default SongEqNoticeWithClock;
