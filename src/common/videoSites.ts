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
 * The player's own cookie jar, and it empties itself.
 *
 * No `persist:`, which makes this an in-memory session: every cookie in it dies
 * with the app. That is the point. Nobody's account should be the identity
 * behind what this player does — an equalizer is not worth putting somebody's
 * YouTube login at risk over, and a session that cannot outlive a run cannot
 * quietly become the one a site holds against them.
 *
 * A separate partition as well, so none of it shares a cookie store with the
 * app's own window and the locked-down permission handlers apply to the player
 * alone.
 *
 * The cost is real and accepted: no subscriptions, no history, and each launch
 * meets the consent banner again. Where you left off is remembered by FluidEQ
 * itself, not by the site, so that much survives.
 */
export const VIDEO_BROWSER_PARTITION = 'fluideq-video';

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
 * `consent.google.com` is here and has to be. The player's session is
 * in-memory, so it arrives at YouTube with no consent cookie every single
 * launch and is redirected straight to that host before it will serve a page.
 * Off the list, the first thing anybody sees is the refusal notice and the
 * player never loads at all — a signed-out session and a consent wall come as a
 * pair, and allowing the first without the second leaves a dead player.
 *
 * Notably absent: `accounts.google.com`. Google refuses to complete a sign-in
 * inside an embedded view regardless of what we allow, so listing it would buy
 * a dead-end page rather than a login. Signed-out YouTube plays fine.
 */
const ALLOWED_HOSTS: string[] = [
  'youtube.com',
  'consent.google.com',
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
 * Hosts that exist to sign somebody in, and nothing else.
 *
 * Most of these sit under domains the list above allows, so the host check
 * passes and only this stops them.
 *
 * `accounts.google.com` is the exception and is already refused for being off
 * the list entirely. It is named here anyway so that pressing Sign in on
 * YouTube is answered by the reason it was refused, rather than by a message
 * about leaving the player.
 */
const SIGN_IN_HOSTS: string[] = [
  'accounts.google.com',
  'secure.soundcloud.com',
  'id.twitch.tv',
  'passport.twitch.tv',
];

/**
 * Where each site keeps its sign-in, by registrable domain.
 *
 * Scoped per domain rather than matched as bare words anywhere, because these
 * paths are only special on the site that owns them: `twitch.tv/login` is a
 * login page, and a channel called `login` on some other site is not.
 *
 * `accounts.google.com` is absent from `ALLOWED_HOSTS` and stays absent, which
 * is what actually stops a YouTube sign-in. `/signin` is here so the refusal
 * happens on the link rather than one redirect later, where all the player can
 * do is stop and go home.
 */
const SIGN_IN_PATHS: Record<string, string[]> = {
  'youtube.com': ['/signin'],
  'soundcloud.com': ['/signin'],
  'bandcamp.com': ['/login', '/signup', '/join'],
  'vimeo.com': ['/log_in', '/join', '/oauth'],
  'twitch.tv': ['/login', '/signup'],
};

/**
 * Whether this URL is a way into an account.
 *
 * Deliberately separate from the host list: that one is a security boundary and
 * this one is a policy, they are refused for different reasons, and the player
 * says something different about each.
 *
 * Honest about its reach. It sees navigations, so it turns away the sign-in
 * links and pages. It does not see an in-page login dialog — Twitch's opens
 * without navigating anywhere — so somebody determined can still sign in for
 * the length of one run. Nothing survives the app closing either way, which is
 * the guarantee that actually matters.
 */
export const isSignInUrl = (url: string): boolean => {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  const host = parsed.hostname.toLowerCase().replace(/\.$/, '');
  if (SIGN_IN_HOSTS.includes(host)) {
    return true;
  }

  // Trailing slash removed so `/login` and `/login/` are one case, and the
  // empty string that leaves for a bare `/` matches no entry.
  const path = parsed.pathname.toLowerCase().replace(/\/$/, '');

  return Object.entries(SIGN_IN_PATHS).some(([domain, paths]) => {
    if (host !== domain && !host.endsWith(`.${domain}`)) {
      return false;
    }
    return paths.some(
      (entry) => path === entry || path.startsWith(`${entry}/`),
    );
  });
};

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

/**
 * Whether the player may go here, for a caller that only needs the answer.
 *
 * Both refusals in one. Every navigation guard asks this rather than having to
 * remember to ask two questions, which is the kind of thing that stays right
 * for exactly as long as nobody adds a fifth place a page can move.
 */
export const isNavigableVideoUrl = (url: string): boolean =>
  isAllowedVideoUrl(url) && !isSignInUrl(url);

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
