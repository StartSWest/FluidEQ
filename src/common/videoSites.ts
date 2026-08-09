/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>
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
 * The player's own cookie jar, and it now keeps what is put in it.
 *
 * IT USED TO EMPTY ITSELF, and the reasoning was sound as far as it went: a
 * session that cannot outlive a run cannot quietly become the identity a site
 * holds against somebody. What it also could not do was log in — and every one
 * of these sites is better, or only usable at all, from an account. A signed-out
 * YouTube shows ads to a Premium subscriber, a signed-out SoundCloud has no
 * likes, and a signed-out Spotify has nothing whatsoever.
 *
 * So `persist:`, and the guarantee changes from "nothing is kept" to "nothing is
 * kept that you did not ask for, and you can throw all of it away in one press".
 * That press is `CLEAR_VIDEO_SESSION`, wired to a button in the player's own
 * toolbar. A store nobody can empty is the version of this that would have been
 * indefensible.
 *
 * What did NOT change, and is what actually contains the blast radius:
 *
 *  - A separate partition, so none of it shares a cookie store with the app's
 *    own window and the locked-down handlers below apply to the player alone.
 *  - Cookies are encrypted at rest by Chromium, per user, by the OS.
 *  - Nothing reads this jar over IPC. FluidEQ never sees a cookie, a token or a
 *    password; it hands the partition to Chromium and asks no questions of it.
 *  - The guest still runs sandboxed with context isolation and no node, and the
 *    preload exposes nothing through `contextBridge` — so a hostile page in a
 *    logged-in tab still cannot reach the app.
 *
 * The allowlist is what carries the weight now. A logged-in session raises the
 * price of reaching a host we did not intend, which is why sign-in hosts were
 * added to it deliberately and one at a time rather than by loosening the check.
 */
export const VIDEO_BROWSER_PARTITION = 'persist:fluideq-video';

/** Throw away every cookie, token and cache the player has accumulated. */
export const CLEAR_VIDEO_SESSION = 'clear-video-session';

/** Sent back when it is done, so the player can reload onto a clean session. */
export const VIDEO_SESSION_CLEARED = 'video-session-cleared';

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
 * SPOTIFY IS HERE AND ITS PLAYBACK NEEDS A CDM THIS BUILD DOES NOT HAVE.
 * Browsing, search, library and the whole interface work signed in; pressing
 * play does not, and Spotify says so itself in the player rather than failing
 * silently. Its audio is encrypted under Widevine and Electron ships no Widevine
 * CDM, so there is nothing to decrypt it with.
 *
 * That is fixable and the route is known: castLabs publish an Electron fork with
 * the CDM built in, and their EVS service signs a build for production use.
 * Development signatures are not enough — a Widevine server answers those with a
 * 500 and the symptom is exactly "tracks skip and stop", which is the shape of
 * every report of this. It is a change to how the application is built rather
 * than to anything in this file, so it is recorded where build steps are
 * recorded and not here.
 *
 * The same wall stands in front of Netflix, Prime Video and anything else
 * licensed. Everything else in this list plays without it.
 *
 * Vimeo was here and had to go, for a reason worth writing down because it will
 * look like a regression otherwise. Vimeo renders its listings on the client
 * from an API that answers nothing to a session it does not recognise: search,
 * Staff Picks and `/watch` all returned their chrome — tabs, filters, footer —
 * and not one result. A direct video URL still played perfectly; there was
 * simply no way to reach one from inside.
 *
 * That was diagnosed against a session that could not log in, which is no longer
 * the case, so it is worth another look before anybody takes this paragraph as
 * settled. A button leading to a page with nothing on it is worse than no button
 * — the whole promise of this file is that a site in the UI is one that works.
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
    id: 'twitch',
    name: 'Twitch',
    home: 'https://www.twitch.tv/',
    search: 'https://www.twitch.tv/search?term={query}',
  },
  {
    id: 'spotify',
    name: 'Spotify',
    home: 'https://open.spotify.com/',
    search: 'https://open.spotify.com/search/{query}',
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
 * `consent.google.com` is here and has to be: a session with no consent cookie
 * is redirected straight to that host before YouTube will serve a page at all.
 *
 * THE SIGN-IN HOSTS ARE THE NEW ARRIVALS, and they are the reason this list
 * deserves rereading rather than skimming. Each is the host that service uses to
 * take a password, and each was added by name — not by relaxing the check, and
 * not as a wildcard. This list is the whole boundary now: a page in this player
 * can hold a live login, so the cost of a host reaching it that we did not
 * intend went up, and the answer to that is a list that stayed exact.
 *
 * `accounts.google.com` is here at last and comes with a caveat that is not
 * ours to fix: Google decides for itself whether it will complete a sign-in in
 * an embedded view, and often refuses one with "this browser may not be secure".
 * Listing it makes the attempt possible. It does not make it succeed. Everything
 * else on this list signs in normally.
 *
 * The CDN domains serve media rather than pages, so they widen the surface very
 * little, and these sites do navigate to them — a Bandcamp download and a Twitch
 * clip both leave the main domain.
 */
const ALLOWED_HOSTS: string[] = [
  'youtube.com',
  'consent.google.com',
  'accounts.google.com',
  'accounts.youtube.com',
  'youtu.be',
  'youtube-nocookie.com',
  'googlevideo.com',
  'ytimg.com',
  'ggpht.com',
  'soundcloud.com',
  'sndcdn.com',
  'bandcamp.com',
  'bcbits.com',
  'twitch.tv',
  'ttvnw.net',
  'jtvnw.net',
  // Spotify. `open.` is the player, `accounts.` takes the password, and the two
  // CDNs carry cover art and audio — all four are reached in one ordinary
  // listen.
  'spotify.com',
  'scdn.co',
  'spotifycdn.com',
];

/**
 * The sign-in refusal is gone, and what replaced it is worth stating.
 *
 * There used to be a second list here — sign-in hosts and sign-in paths — and a
 * predicate that turned every one of them away. It existed to enforce the
 * in-memory session's promise: if no account can be entered, no account can be
 * kept. The session keeps things now, on purpose, so a rule whose entire job was
 * to prevent that had nothing left to do.
 *
 * It was also never the thing doing the work, and that is the part worth
 * remembering. Its own comment admitted the gap: it saw navigations, so it
 * turned away sign-in *links*, and it never saw an in-page login dialog —
 * Twitch's opens without navigating anywhere. A boundary with a hole in it that
 * is documented in the boundary is a policy, not a defence. `ALLOWED_HOSTS`
 * above is the defence, it has no such hole, and it is checked on all four ways
 * a page can move.
 */

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
 * Whether the player may go here — the question every navigation guard asks.
 *
 * It used to be two refusals in one, the allowlist and the sign-in policy. The
 * policy is gone, so it is one, and this keeps its name rather than the guards
 * being repointed at `isAllowedVideoUrl`: they ask "may the player navigate
 * here", and if a second condition is ever needed again this is where it goes.
 * Four call sites all asking the same question through one name is what stopped
 * the last one from drifting.
 */
export const isNavigableVideoUrl = (url: string): boolean =>
  isAllowedVideoUrl(url);

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
