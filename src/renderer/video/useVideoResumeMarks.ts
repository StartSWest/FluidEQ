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

import { type RefObject, useEffect, useRef } from 'react';
import { findSiteForUrl, type IVideoSite } from 'common/videoSites';
import {
  buildResumeSeekScript,
  rememberPlayback,
  type TPlaybackMarks,
} from 'common/videoResume';
import { writeStoredMarks } from './videoBrowserStorage';
import { READ_POSITION } from './videoPlayerScripts';
import { type IWebview } from './videoWebview';

/**
 * How far the playhead moves, in the video's own seconds, before where it is
 * gets written down as this site's resume mark. The five the old sample
 * interval allowed a crash to lose, counted in the video now, not the clock.
 */
const NOTE_PLAYHEAD_EVERY_S = 5;

interface IVideoResumeMarksInput {
  webviewRef: RefObject<IWebview | null>;
  isHidden: boolean;
  isGuestReady: boolean;
  activeSite: IVideoSite | undefined;
  marksRef: RefObject<TPlaybackMarks>;
  notePlayingPositionRef: RefObject<(seconds: number) => void>;
  pageToken: number;
}

/**
 * Where each site was left, noted as the playhead moves while the tab is on
 * screen, and the position put back when a site's player is ready again —
 * so the site buttons behave like tabs rather than like front pages.
 */
const useVideoResumeMarks = ({
  webviewRef,
  isHidden,
  isGuestReady,
  activeSite,
  marksRef,
  notePlayingPositionRef,
  pageToken,
}: IVideoResumeMarksInput) => {
  // A position waiting for a page to grow a player. Consumed once, by the next
  // guest that becomes ready — put in a ref because it is a message to a later
  // effect, not a thing the interface has an opinion about.
  const pendingResumeRef = useRef(0);

  /**
   * Note where this site is, whenever the page says it moved.
   *
   * Kept as it goes rather than captured on the way out, and that is the whole
   * design. Reading the position at the moment of leaving is one call racing a
   * document that is being torn down, and it gets nothing at all when the way
   * out is the window closing or the app crashing — which, for an equalizer
   * that gets restarted to bounce the audio service, is most of the time.
   *
   * It was a sample on a five-second interval. What the interval stood for is
   * the playhead moving, and the page reports exactly that: while a video
   * plays, the bar's own clock reads the position four times a second
   * (`samplePlaybackClock`), and a reading is noted here once the playhead has
   * moved `NOTE_PLAYHEAD_EVERY_S` from the last mark — so a crash loses what it
   * lost before, and nothing waits on a clock. Not every reading: each note is
   * a synchronous address read and a storage write on the window's thread.
   * The moments a video stops or starts, the guest's own `media-paused` and
   * `media-started-playing`, are read and noted directly, which is where
   * somebody leaving a video leaves it; and a page arriving, or this tab
   * coming back, is read once.
   *
   * Only while the tab is on screen. A player left running in the background is
   * still playing and its position still moves, but so does the position of the
   * page somebody has since switched to, and the site whose mark this would
   * overwrite is the one they are not looking at.
   */
  useEffect(() => {
    const view = webviewRef.current;
    if (!view || isHidden || !isGuestReady || !activeSite) {
      return undefined;
    }

    // The site is worked out from the page, at the moment the page is read,
    // and never carried in from outside.
    //
    // It used to be the `activeSite` this effect closed over, which is a
    // different thing by one render: a reading landing between the navigation
    // and the interface noticing filed the new site's page under the old
    // site's name, and the button then went to the wrong site every time from
    // then on. Reading both halves of the pair from the same source at the same
    // instant is what makes them agree — `rememberPlayback` checks the pairing
    // too, but this is where it stops being wrong in the first place.
    let notedSeconds = Number.NEGATIVE_INFINITY;
    const note = (seconds: number) => {
      notedSeconds = seconds;
      try {
        const url = view.getURL();
        const site = findSiteForUrl(url);
        if (!site) {
          return;
        }
        marksRef.current = rememberPlayback(
          marksRef.current,
          site.id,
          url,
          seconds,
        );
        writeStoredMarks(marksRef.current);
      } catch {
        // Throws when the guest has gone. The next reading finds the new one,
        // or there is no next reading.
      }
    };

    const read = () => {
      try {
        view
          .executeJavaScript(READ_POSITION)
          .then((position) => {
            note(typeof position === 'number' ? position : 0);
            return position;
          })
          .catch(() => undefined);
      } catch {
        // Throws rather than rejects when the guest has gone.
      }
    };

    read();
    notePlayingPositionRef.current = (seconds) => {
      if (Math.abs(seconds - notedSeconds) >= NOTE_PLAYHEAD_EVERY_S) {
        note(seconds);
      }
    };
    view.addEventListener('media-paused', read);
    view.addEventListener('media-started-playing', read);
    return () => {
      notePlayingPositionRef.current = () => {};
      view.removeEventListener('media-paused', read);
      view.removeEventListener('media-started-playing', read);
    };
  }, [
    activeSite,
    isGuestReady,
    isHidden,
    marksRef,
    notePlayingPositionRef,
    webviewRef,
  ]);

  /**
   * Hand a waiting position to the page that has just loaded.
   *
   * Keyed on the page token, so it fires exactly once per document — which is
   * what makes a single ref enough to carry the position across a navigation.
   *
   * It moves the playhead and stops there. This used to run with `userGesture`
   * set, which did two things at once: it let the script's own `play()` through,
   * and it handed the guest a user activation — the page's own licence to start
   * playing, under the policy in `VIDEO_WEB_PREFERENCES`. Both halves of that
   * are sound nobody asked for, so the call is now made as what it is, which is
   * a script that seeks. Coming back to a site finds the video where it was,
   * paused, on the frame it was left on.
   */
  useEffect(() => {
    const view = webviewRef.current;
    const position = pendingResumeRef.current;
    if (!view || !pageToken || position <= 0) {
      return;
    }
    pendingResumeRef.current = 0;
    try {
      view
        .executeJavaScript(buildResumeSeekScript(position))
        .catch(() => undefined);
    } catch {
      // No web contents to ask; the page is still where it was.
    }
  }, [pageToken, webviewRef]);

  return { pendingResumeRef };
};

export default useVideoResumeMarks;
