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

import {
  VIDEO_SITES,
  buildSearchUrl,
  findSiteForUrl,
  isAllowedVideoUrl,
  isNavigableVideoUrl,
} from '../../../common/videoSites';

describe('video site allowlist', () => {
  it('allows the sites it offers, and their subdomains', () => {
    expect(isAllowedVideoUrl('https://www.youtube.com/')).toBe(true);
    expect(isAllowedVideoUrl('https://youtube.com/watch?v=abc')).toBe(true);
    expect(isAllowedVideoUrl('https://music.youtube.com/search?q=x')).toBe(
      true,
    );
    expect(isAllowedVideoUrl('https://youtu.be/abc')).toBe(true);
    // Bandcamp gives every artist their own subdomain, which is the whole
    // reason the match is on a registrable domain rather than an exact host.
    expect(isAllowedVideoUrl('https://someartist.bandcamp.com/album/x')).toBe(
      true,
    );
  });

  /**
   * The one that matters.
   *
   * A plain `endsWith` accepts every name in this list, and each of them is a
   * domain an attacker can register. This is the check that the boundary is a
   * label boundary.
   */
  it('refuses hosts that merely look like the ones it allows', () => {
    expect(isAllowedVideoUrl('https://evil-youtube.com/')).toBe(false);
    expect(isAllowedVideoUrl('https://notyoutube.com/')).toBe(false);
    expect(isAllowedVideoUrl('https://youtube.com.evil.example/')).toBe(false);
    expect(isAllowedVideoUrl('https://myyoutu.be/')).toBe(false);
    expect(isAllowedVideoUrl('https://twitch.tv.attacker.net/')).toBe(false);
  });

  /**
   * A session with no consent cookie is sent to that host before YouTube will
   * serve a page at all. Refusing it is refusing YouTube itself: nothing loads,
   * and the first thing anybody sees is the notice.
   */
  it('allows the consent wall a cookie-less session hits', () => {
    expect(isNavigableVideoUrl('https://consent.google.com/m?continue=x')).toBe(
      true,
    );
    expect(isNavigableVideoUrl('https://consent.youtube.com/m')).toBe(true);
  });

  /**
   * `google.com` is NOT on the list, and this is what says so.
   *
   * Three of its hosts are named individually — consent and the two account
   * front doors — and it would be one careless edit to turn those into the
   * parent domain and hand the player the whole of Google, Drive and Mail
   * included. Every entry in this list is a registrable domain that matches its
   * subdomains, which is exactly why the ones that must not be were left off.
   */
  it('allows only the named Google hosts, never the domain', () => {
    expect(isAllowedVideoUrl('https://accounts.google.com/ServiceLogin')).toBe(
      true,
    );
    expect(isAllowedVideoUrl('https://mail.google.com/')).toBe(false);
    expect(isAllowedVideoUrl('https://drive.google.com/')).toBe(false);
    expect(isAllowedVideoUrl('https://google.com/')).toBe(false);
    expect(isAllowedVideoUrl('https://www.google.com/search?q=x')).toBe(false);
  });

  /**
   * The last hop of a Google sign-in, which is not on `.com`.
   *
   * `accounts.google.<cc>/accounts/SetSID` is the request that plants the
   * session cookie, and Google picks the country domain — observed as
   * `accounts.google.nl` from a machine nowhere near the Netherlands. Refusing
   * it let the whole flow run and then failed on the one navigation that made
   * it count.
   */
  it('allows Google sign-in to finish on any of its country domains', () => {
    expect(
      isAllowedVideoUrl('https://accounts.google.nl/accounts/SetSID'),
    ).toBe(true);
    expect(isAllowedVideoUrl('https://accounts.google.de/')).toBe(true);
    expect(isAllowedVideoUrl('https://accounts.google.co.uk/')).toBe(true);
    expect(isAllowedVideoUrl('https://accounts.google.com.br/')).toBe(true);
  });

  /**
   * The pattern is a wider door than a literal host, so this is where its edges
   * are nailed down. It matches one host label on one domain and a TLD shaped
   * like a country's — not the long vanity TLDs anybody can register, and not
   * anything else under google.
   */
  it('keeps the country-domain pattern to the shape it was written for', () => {
    expect(isAllowedVideoUrl('https://accounts.google.somethinglong/')).toBe(
      false,
    );
    expect(isAllowedVideoUrl('https://mail.google.nl/')).toBe(false);
    expect(isAllowedVideoUrl('https://accounts.google.nl.evil.example/')).toBe(
      false,
    );
    expect(isAllowedVideoUrl('https://evil-accounts.google.nl/')).toBe(false);
    expect(isAllowedVideoUrl('https://accounts.notgoogle.nl/')).toBe(false);
  });

  it('refuses every scheme but https', () => {
    // Plain http is on the list because it is rewritable in transit, and the
    // rest because they reach past the page into the app or the disk.
    expect(isAllowedVideoUrl('http://www.youtube.com/')).toBe(false);
    // eslint-disable-next-line no-script-url -- the point of the assertion
    expect(isAllowedVideoUrl('javascript:alert(1)')).toBe(false);
    expect(isAllowedVideoUrl('data:text/html,<h1>hi</h1>')).toBe(false);
    expect(isAllowedVideoUrl('file:///C:/Windows/System32/')).toBe(false);
  });

  it('refuses anything that is not a URL at all', () => {
    expect(isAllowedVideoUrl('')).toBe(false);
    expect(isAllowedVideoUrl('youtube.com')).toBe(false);
    expect(isAllowedVideoUrl('   ')).toBe(false);
  });

  it('treats a fully-qualified name as the same host', () => {
    // `https://youtube.com./` resolves to YouTube, and every string compare
    // here would miss it if the trailing dot were not stripped.
    expect(isAllowedVideoUrl('https://youtube.com./')).toBe(true);
    expect(isAllowedVideoUrl('https://WWW.YouTube.COM/')).toBe(true);
  });

  /**
   * The two halves of this feature are a list of buttons and a guard, and they
   * are only useful if they agree. A site whose button leads somewhere the
   * guard refuses is a dead button, and nothing else in the app would notice.
   */
  it('allows every site it puts a button on', () => {
    VIDEO_SITES.forEach((site) => {
      expect(`${site.name} home: ${isAllowedVideoUrl(site.home)}`).toBe(
        `${site.name} home: true`,
      );
      expect(
        `${site.name} search: ${isAllowedVideoUrl(buildSearchUrl(site, 'a'))}`,
      ).toBe(`${site.name} search: true`);
    });
  });
});

/**
 * Signing in is the point now, and these are what say so.
 *
 * There used to be a `isSignInUrl` predicate here refusing all of this, to keep
 * a throwaway session's promise that no account could be entered. The session
 * persists on purpose, so the promise changed and the refusal went with it.
 * These tests exist so that a revert would be loud rather than quiet.
 */
describe('sign-in', () => {
  it('lets each site reach its own front door', () => {
    expect(isNavigableVideoUrl('https://www.youtube.com/signin')).toBe(true);
    expect(
      isNavigableVideoUrl('https://accounts.google.com/ServiceLogin'),
    ).toBe(true);
    expect(isNavigableVideoUrl('https://secure.soundcloud.com/sign-in')).toBe(
      true,
    );
    expect(isNavigableVideoUrl('https://bandcamp.com/login')).toBe(true);
    expect(isNavigableVideoUrl('https://www.twitch.tv/login')).toBe(true);
    expect(isNavigableVideoUrl('https://id.twitch.tv/oauth2/authorize')).toBe(
      true,
    );
    expect(isNavigableVideoUrl('https://accounts.spotify.com/en/login')).toBe(
      true,
    );
  });

  /**
   * Dropping the sign-in rule must not have dropped the host check with it.
   *
   * This is the assertion that would catch someone "fixing" a refused login by
   * loosening `isNavigableVideoUrl` rather than by naming a host — the whole
   * boundary now rests on that list, and a session holding five live logins is
   * a worse thing to widen than one holding none.
   */
  it('did not become a predicate that allows everything', () => {
    expect(isNavigableVideoUrl('https://login.evil.example/')).toBe(false);
    expect(
      isNavigableVideoUrl('https://accounts.google.com.evil.example/'),
    ).toBe(false);
    expect(isNavigableVideoUrl('https://spotify.com.attacker.net/login')).toBe(
      false,
    );
    // eslint-disable-next-line no-script-url -- the point of the assertion
    expect(isNavigableVideoUrl('javascript:alert(1)')).toBe(false);
  });

  it('reaches Spotify at every host one listen touches', () => {
    expect(isNavigableVideoUrl('https://open.spotify.com/')).toBe(true);
    expect(isNavigableVideoUrl('https://accounts.spotify.com/en/login')).toBe(
      true,
    );
    // Cover art and audio, which the player fetches without navigating.
    expect(isNavigableVideoUrl('https://i.scdn.co/image/abc')).toBe(true);
    expect(isNavigableVideoUrl('https://encore.spotifycdn.com/x.css')).toBe(
      true,
    );
  });

  it('still allows every site it puts a button on', () => {
    VIDEO_SITES.forEach((site) => {
      expect(`${site.name} home: ${isNavigableVideoUrl(site.home)}`).toBe(
        `${site.name} home: true`,
      );
      expect(
        `${site.name} search: ${isNavigableVideoUrl(
          buildSearchUrl(site, 'a'),
        )}`,
      ).toBe(`${site.name} search: true`);
    });
  });
});

describe('video site helpers', () => {
  it('encodes the search terms', () => {
    const youtube = VIDEO_SITES[0];
    expect(buildSearchUrl(youtube, 'miles davis & co')).toBe(
      'https://www.youtube.com/results?search_query=miles%20davis%20%26%20co',
    );
  });

  it('falls back to the home page for an empty search', () => {
    const youtube = VIDEO_SITES[0];
    expect(buildSearchUrl(youtube, '   ')).toBe(youtube.home);
  });

  it('tells YouTube and YouTube Music apart', () => {
    // They share a registrable domain but have a button each, so the lit one
    // has to follow the subdomain rather than the domain.
    expect(findSiteForUrl('https://www.youtube.com/watch?v=x')?.id).toBe(
      'youtube',
    );
    expect(findSiteForUrl('https://youtube.com/watch?v=x')?.id).toBe('youtube');
    expect(findSiteForUrl('https://music.youtube.com/watch?v=x')?.id).toBe(
      'youtube-music',
    );
  });

  it('lights nothing for somewhere it does not know', () => {
    expect(findSiteForUrl('https://example.com/')).toBeUndefined();
    expect(findSiteForUrl('not a url')).toBeUndefined();
  });
});
