/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>

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
 * Where each site was left, so coming back continues rather than restarts.
 *
 * There is one player and it is reused, so choosing another site tears the
 * first one's document down — deliberately, because a media element still
 * running holds its document open and two of them would be two videos in
 * memory. The cost of that is everything the page knew: which track, and how
 * far in. The site would normally remember for you, and cannot here, because
 * the player's session is in-memory and always signed out.
 *
 * So FluidEQ remembers instead. One mark per site, because the sites are the
 * things you switch between: going back to YouTube Music should find the album
 * you were playing and not YouTube's idea of a home page.
 *
 * Kept separate from the player itself and free of the DOM, so the rules about
 * what is worth resuming — and the validation of a value that comes back off
 * disk and turns into a navigation — can be read and tested on their own. The
 * script that carries a position into the page is here for the same reason: it
 * is a string until the guest evaluates it, and what it does — and, after this
 * was once a bug, what it deliberately does not do — is then something a test
 * can hold it to.
 */

import { VIDEO_SITES, findSiteForUrl, isNavigableVideoUrl } from './videoSites';

export interface IPlaybackMark {
  /** The page that was open. */
  url: string;
  /** How far into it, in seconds. Zero when there was nothing worth keeping. */
  position: number;
}

/** One mark per site, keyed by `IVideoSite.id`. */
export type TPlaybackMarks = Record<string, IPlaybackMark>;

/**
 * Below this, a position is not worth restoring.
 *
 * Landing four seconds in is indistinguishable from the start except for the
 * jump, and every page visited briefly would otherwise leave a mark that makes
 * the next visit begin somewhere arbitrary.
 */
export const MIN_RESUME_SECONDS = 5;

/**
 * How far back to step when resuming.
 *
 * Dropping in at the exact frame you left reads as a glitch — the last second
 * you heard is missing, because you heard it while the switch was happening.
 * A few seconds of run-up is what every podcast player does, for the same
 * reason.
 */
export const RESUME_REWIND_SECONDS = 3;

const KNOWN_SITE_IDS = new Set(VIDEO_SITES.map((site) => site.id));

/**
 * Whether this URL is this site's to remember.
 *
 * The check that stops a mark being filed under the wrong button, which is not
 * a hypothetical: the position is sampled on a timer, and one tick landing
 * between navigating away and the interface noticing wrote the new site's page
 * under the old site's name. The YouTube button then went to YouTube Music, and
 * kept going there, because that is what the mark said.
 *
 * A mark is only ever as good as the pairing, so the pairing is checked here —
 * on the way in and on the way back off disk — rather than trusted from a
 * caller that cannot always know.
 */
const belongsToSite = (siteId: string, url: string) =>
  findSiteForUrl(url)?.id === siteId;

/**
 * Whether this is a mark worth keeping.
 *
 * The URL is checked against the same list the main process enforces. This
 * value comes back off disk and is handed to the guest as a navigation, so an
 * edited store is a page nobody chose — the main process would refuse it, but a
 * refused navigation is a blank player, which is a worse answer than the site's
 * home page.
 */
const isUsableMark = (value: unknown): value is IPlaybackMark => {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const { url, position } = value as Partial<IPlaybackMark>;
  return (
    typeof url === 'string' &&
    isNavigableVideoUrl(url) &&
    typeof position === 'number' &&
    Number.isFinite(position) &&
    position >= 0
  );
};

/**
 * Read a stored set of marks, keeping only what is still usable.
 *
 * Never throws and never returns anything but a plain object: this runs at
 * startup, and a store written by an older build — or by hand — must not be the
 * reason the video tab fails to mount.
 */
export const parsePlaybackMarks = (raw: string | null): TPlaybackMarks => {
  if (!raw) {
    return {};
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {};
  }

  return Object.entries(
    parsed as Record<string, unknown>,
  ).reduce<TPlaybackMarks>((marks, [siteId, mark]) => {
    // Unknown ids are dropped rather than carried. It is what keeps the store
    // bounded by the length of the site list without a cap to maintain, and
    // it is how a removed site's mark stops existing.
    if (
      !KNOWN_SITE_IDS.has(siteId) ||
      !isUsableMark(mark) ||
      // Self-healing, and it has to be: a build that wrote mismatched marks has
      // already put them on somebody's disk, and they would otherwise keep
      // sending that button to the wrong site for good.
      !belongsToSite(siteId, mark.url)
    ) {
      return marks;
    }
    return { ...marks, [siteId]: { url: mark.url, position: mark.position } };
  }, {});
};

/** For writing back. Paired with `parsePlaybackMarks` so the two agree. */
export const serialisePlaybackMarks = (marks: TPlaybackMarks): string =>
  JSON.stringify(marks);

/**
 * Note where a site was left.
 *
 * The URL is kept even when the position is not: returning to the video you
 * were on is most of the value, and it is the half that is always right. A
 * position under the threshold is stored as zero rather than dropping the mark,
 * so the page still comes back.
 */
export const rememberPlayback = (
  marks: TPlaybackMarks,
  siteId: string,
  url: string,
  position: number,
): TPlaybackMarks => {
  if (
    !KNOWN_SITE_IDS.has(siteId) ||
    !isNavigableVideoUrl(url) ||
    !belongsToSite(siteId, url)
  ) {
    return marks;
  }

  const kept =
    Number.isFinite(position) && position >= MIN_RESUME_SECONDS ? position : 0;

  return { ...marks, [siteId]: { url, position: kept } };
};

/** Drop one site's mark, for a page that should not be returned to. */
export const forgetPlayback = (
  marks: TPlaybackMarks,
  siteId: string,
): TPlaybackMarks => {
  if (!(siteId in marks)) {
    return marks;
  }
  const { [siteId]: _dropped, ...rest } = marks;
  return rest;
};

/** Where this site should open, or nothing if it has not been visited. */
export const resumeUrlFor = (
  marks: TPlaybackMarks,
  siteId: string,
): string | undefined => marks[siteId]?.url;

/**
 * How far in to start, with the run-up already taken off.
 *
 * Zero for anything not worth seeking to, which is also what a caller should
 * pass straight through — seeking to zero and not seeking at all are the same
 * thing to a player that has just loaded.
 */
export const resumePositionFor = (
  marks: TPlaybackMarks,
  siteId: string,
): number => {
  const position = marks[siteId]?.position ?? 0;
  if (position < MIN_RESUME_SECONDS) {
    return 0;
  }
  return Math.max(0, position - RESUME_REWIND_SECONDS);
};

/**
 * The script that moves the playhead in a page that has just come back.
 *
 * Waiting rather than assuming, because there is nothing to seek when this
 * runs: the page has only just been asked to load and builds its player from
 * script, which on a slow morning is several seconds after `dom-ready`. The
 * poll is bounded — twenty seconds and then it gives up, so a page that never
 * grows a player does not leave a timer running behind it for the rest of the
 * session.
 *
 * The seek waits again, on the media's own terms: `currentTime` before metadata
 * has arrived is discarded silently, which is the difference between resuming
 * and quietly starting from the beginning. The listener is left in place rather
 * than given up on, so a page that keeps its metadata to itself until somebody
 * presses play still lands on the right second when they do.
 *
 * What it does not do is press play, and that is the whole of the change it
 * once needed. It used to call `play()` straight after the seek, which is why
 * coming back to the tab started making noise over whatever was already on.
 * Restoring the page and restoring the position are worth having on their own;
 * deciding to listen belongs to whoever is sitting there.
 *
 * A string rather than a function because it is handed to another process to
 * evaluate. It lives here, with the rest of the resume rules, so that "restores
 * without playing" is something a test can hold to rather than a line of a
 * component nothing can reach.
 */
export const buildResumeSeekScript = (position: number): string => {
  // Pinned to a number on the way into source. Everything upstream already
  // checks this — `isUsableMark` on the way off disk, `resumePositionFor` on
  // the way out — but this is the point where a value becomes code in someone
  // else's page, and the check costs a line.
  const at = Number.isFinite(position) && position > 0 ? position : 0;

  return `(() => {
  const at = ${at};
  let tries = 0;
  const attempt = () => {
    const media = Array.from(document.querySelectorAll('video, audio'));
    media.sort(
      (a, b) => (b.clientWidth * b.clientHeight) - (a.clientWidth * a.clientHeight)
    );
    const el = media[0];
    if (!el) {
      tries += 1;
      if (tries < 80) { setTimeout(attempt, 250); }
      return;
    }
    const seek = () => {
      try {
        // Past the end is not a resume, it is a video that finished.
        if (at > 0 && (!Number.isFinite(el.duration) || at < el.duration)) {
          el.currentTime = at;
        }
      } catch (e) { /* a server-controlled stream can refuse a seek */ }
    };
    if (el.readyState >= 1) { seek(); } else {
      el.addEventListener('loadedmetadata', seek, { once: true });
    }
  };
  attempt();
  return 'ok';
})()`;
};
