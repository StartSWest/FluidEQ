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
 * Which sites the built-in player is allowed to reach.
 *
 * FluidEQ is an equalizer that happens to show a video, not a browser. The
 * difference is this file: there is no address bar, and a page can only send
 * the view somewhere on this list. That is what keeps an embedded Chromium
 * inside an audio utility from being a general-purpose window onto the web,
 * with everything — phishing, downloads, arbitrary permission prompts — that
 * would then have to be defended against.
 *
 * One list, read by both ends. The renderer builds its buttons from it and the
 * main process enforces it on every navigation, so a site that appears in the
 * UI is reachable and one that does not, is not. Two lists would eventually
 * disagree, and the half that disagrees quietly is the security half.
 */

/**
 * The player's own cookie jar.
 *
 * `persist:` so a site stays logged in and remembers its volume between runs;
 * a separate partition so none of that shares a cookie store with the app's
 * own window, and so the locked-down permission handlers below apply to the
 * player alone.
 */
export const VIDEO_BROWSER_PARTITION = 'persist:fluideq-video';

/**
 * A popup the player refused, sent from main to the window so it can say so.
 *
 * The renderer sees a refused *navigation* itself and raises the notice. A
 * 'target="_blank"' is answered in the main process, where the renderer cannot
 * see it — so without this a click that opened a window to somewhere unlisted
 * did nothing at all and looked exactly like a broken page.
 */
export const VIDEO_LINK_BLOCKED = 'video-link-blocked';

export interface IVideoSite {
  id: string;
  /** The brand's own name. Never translated — nobody localises "YouTube". */
  name: string;
  /** Where the button goes. */
  home: string;
  /** The site's own search, with `{query}` standing in for the terms. */
  search: string;
}

/**
 * The sites offered, in the order their buttons appear.
 *
 * Chosen for one thing: playing music or video that somebody wants to hear
 * through their own EQ curve. Adding one here is all it takes to make it
 * reachable — but see `ALLOWED_HOSTS`, which is what actually decides.
 *
 * Spotify is missing, and not for lack of wanting it. Two independent reasons,
 * either of which is on its own decisive:
 *
 *  - Its web player streams under Widevine, and Electron ships no Widevine
 *    CDM. The page would load, the controls would work and every track would
 *    fail at play. Getting one means building on castLabs' Electron fork and
 *    holding one of their VMP signing certificates.
 *  - Spotify's terms do not permit its service being wrapped in a third-party
 *    client, and the blocker below would be stripping the advertising that
 *    pays for the free tier. That is not a grey area worth standing in.
 *
 * The same DRM wall stands in front of Netflix, Prime Video and anything else
 * licensed. What is here plays without it.
 */
export const VIDEO_SITES: IVideoSite[] = [
  {
    id: 'youtube',
    name: 'YouTube',
    home: 'https://www.youtube.com/',
    search: 'https://www.youtube.com/results?search_query={query}',
  },
  {
    id: 'youtube-music',
    name: 'YouTube Music',
    home: 'https://music.youtube.com/',
    search: 'https://music.youtube.com/search?q={query}',
  },
  {
    id: 'soundcloud',
    name: 'SoundCloud',
    home: 'https://soundcloud.com/discover',
    search: 'https://soundcloud.com/search?q={query}',
  },
  {
    id: 'bandcamp',
    name: 'Bandcamp',
    home: 'https://bandcamp.com/',
    search: 'https://bandcamp.com/search?q={query}',
  },
  {
    id: 'vimeo',
    name: 'Vimeo',
    home: 'https://vimeo.com/',
    search: 'https://vimeo.com/search?q={query}',
  },
  {
    id: 'twitch',
    name: 'Twitch',
    home: 'https://www.twitch.tv/',
    search: 'https://www.twitch.tv/search?term={query}',
  },
];

/**
 * Every host the player may navigate to, as registrable domains.
 *
 * A bare entry matches the domain itself and anything under it, which is what
 * makes `music.youtube.com`, the regional `www.youtube.com` redirects and
 * `<artist>.bandcamp.com` all work from one line each.
 *
 * The CDN domains are here because these sites do navigate to them — a
 * Bandcamp download and a Twitch clip both leave the main domain — and a
 * blocked navigation in the middle of ordinary use reads as a broken app.
 * They serve media, not pages, so they widen the surface very little.
 *
 * Notably absent: `accounts.google.com`. Google refuses to complete a sign-in
 * inside an embedded view regardless of what we allow, so listing it would buy
 * a dead-end page rather than a login. Signed-out YouTube plays fine.
 */
const ALLOWED_HOSTS: string[] = [
  'youtube.com',
  'youtu.be',
  'youtube-nocookie.com',
  'googlevideo.com',
  'ytimg.com',
  'ggpht.com',
  'soundcloud.com',
  'sndcdn.com',
  'bandcamp.com',
  'bcbits.com',
  'vimeo.com',
  'vimeocdn.com',
  'twitch.tv',
  'ttvnw.net',
  'jtvnw.net',
];

/**
 * Whether the player may go here.
 *
 * Three things have to hold, and the first two matter as much as the list:
 *
 *  - It has to parse. Anything that does not is not a URL we understand well
 *    enough to judge.
 *  - It has to be `https:`. This is the check that turns away `javascript:`,
 *    `data:` and `file:` — the schemes that would let a page reach back into
 *    the app or the disk rather than merely load something. Plain `http:` goes
 *    too: none of these sites need it, and allowing it would let an attacker
 *    on the network rewrite the page.
 *  - The host has to be one of ours, matched on a label boundary. `endsWith`
 *    alone would accept `evil-youtube.com`, which is precisely the trick this
 *    is guarding against.
 */
export const isAllowedVideoUrl = (url: string): boolean => {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  if (parsed.protocol !== 'https:') {
    return false;
  }

  // A fully-qualified name is the same host with a trailing dot, and every
  // comparison below would miss it. `https://youtube.com./` is a real URL that
  // Chromium resolves to YouTube.
  const host = parsed.hostname.toLowerCase().replace(/\.$/, '');

  return ALLOWED_HOSTS.some(
    (allowed) => host === allowed || host.endsWith(`.${allowed}`),
  );
};

/** A site's search page for these terms, or its home page for empty ones. */
export const buildSearchUrl = (site: IVideoSite, query: string): string => {
  const terms = query.trim();
  if (!terms) {
    return site.home;
  }
  return site.search.replace('{query}', encodeURIComponent(terms));
};

/** The site a URL belongs to, so the UI can light up the matching button. */
export const findSiteForUrl = (url: string): IVideoSite | undefined => {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase().replace(/\.$/, '');
  } catch {
    return undefined;
  }

  return VIDEO_SITES.find((site) => {
    const siteHost = new URL(site.home).hostname.toLowerCase();
    // Compared on the registrable domain so `www.youtube.com` and a bare
    // `youtube.com` are the same site — but `music.youtube.com` is not, since
    // it has a button of its own and should light that one instead.
    if (siteHost.startsWith('www.')) {
      const bare = siteHost.slice(4);
      return host === bare || host === siteHost;
    }
    return host === siteHost;
  });
};
