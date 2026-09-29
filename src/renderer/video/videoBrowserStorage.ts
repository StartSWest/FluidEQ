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

import {
  IVideoSite,
  VIDEO_SITES,
  isNavigableVideoUrl,
} from 'common/videoSites';
import {
  TPlaybackMarks,
  parsePlaybackMarks,
  serialisePlaybackMarks,
} from 'common/videoResume';
import {
  VIDEO_AD_BLOCK_DEFAULT,
  VIDEO_AD_BLOCK_STORAGE_KEY,
} from 'common/videoAdBlock';

// What the Media tab keeps in this window's local storage: the page it was
// on, each site's resume mark, and whether ad blocking is on — every read
// checked, and a store that cannot be reached a lost mark, not a broken tab.

export const HOME_SITE: IVideoSite = VIDEO_SITES[0];

/**
 * Where the player was when the window last closed.
 *
 * A restart used to land back on YouTube's home page, whatever had been
 * playing. That is a small loss on a browser and a large one here: FluidEQ gets
 * restarted *because* of what it does — an EQ change that needs the audio
 * service bounced, an update, a crash — and each time it threw away the track
 * somebody was in the middle of tuning against.
 *
 * The URL only. Not the position in the video, which is the site's own business
 * and is generally remembered by the site itself for anyone signed in.
 */
export const VIDEO_LAST_URL_KEY = 'fluideq.videoLastUrl';

/**
 * The stored page, if it is still somewhere the player may go.
 *
 * Checked rather than trusted. localStorage is editable, and this value is
 * handed straight to the guest as its `src` — the one place in this component
 * where a string from disk becomes a navigation. The main process would refuse
 * an unlisted host anyway, but a `src` it refuses is a player that comes up
 * blank, which is a worse answer than the home page.
 */
export const readStoredUrl = () => {
  try {
    const stored = localStorage.getItem(VIDEO_LAST_URL_KEY);
    return stored && isNavigableVideoUrl(stored) ? stored : HOME_SITE.home;
  } catch {
    return HOME_SITE.home;
  }
};

/**
 * Where each site was left, so switching between them is not switching off.
 *
 * Separate from the key above, which is one URL for the whole player and
 * answers a different question — where to come up after a restart. This is one
 * mark per site, and it is what makes the site buttons feel like tabs rather
 * than like six front pages.
 */
const VIDEO_RESUME_KEY = 'fluideq.videoResume';

export const readStoredMarks = (): TPlaybackMarks => {
  try {
    return parsePlaybackMarks(localStorage.getItem(VIDEO_RESUME_KEY));
  } catch {
    // A blocked or full store is a lost mark, not a broken tab.
    return {};
  }
};

export const writeStoredMarks = (marks: TPlaybackMarks) => {
  try {
    localStorage.setItem(VIDEO_RESUME_KEY, serialisePlaybackMarks(marks));
  } catch {
    // As above.
  }
};

export const readStoredAdBlock = () => {
  try {
    const stored = localStorage.getItem(VIDEO_AD_BLOCK_STORAGE_KEY);
    return stored === null ? VIDEO_AD_BLOCK_DEFAULT : stored === 'true';
  } catch {
    return VIDEO_AD_BLOCK_DEFAULT;
  }
};
