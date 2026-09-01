/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  VIDEO_SITES,
  buildSearchUrl,
  findSiteForUrl,
  isAllowedVideoUrl,
  isNavigableVideoUrl,
} from '../../../common/videoSites';

/**
 * The whole boundary between an equalizer and a web browser.
 *
 * `videoSites.ts` states the stakes itself: "FluidEQ is an equalizer that
 * happens to show a video, not a browser. The difference is this file." Since
 * the player's session became persistent, a page inside it can hold a live
 * login — so a host reaching it that we did not intend now costs somebody an
 * account rather than a wasted click.
 *
 * None of that was pinned by a test. The logic was correct when this was
 * written; what it lacked was anything that would notice if it stopped being.
 * Every case below is a specific way the check can be got round, and each one
 * is a real technique rather than a permutation for its own sake.
 */
describe('the video player allow-list', () => {
  describe('refuses everything that is not https', () => {
    it.each([
      // The three that would let a page reach back into the app or the disk.
      // A rule that stops this scheme being written here would stop it being tested.
      // eslint-disable-next-line no-script-url -- the scheme is the thing under test
      ['javascript:alert(1)'],
      ['data:text/html,<script>alert(1)</script>'],
      ['file:///C:/Windows/System32/drivers/etc/hosts'],
      // Plain http, which none of these sites need and which anybody on the
      // network can rewrite in flight.
      ['http://www.youtube.com/'],
      // Electron's own scheme, and the app's private media scheme.
      ['chrome://settings'],
      ['fluideq-media://track/abcdef'],
      ['about:blank'],
      ['ws://www.youtube.com/'],
    ])('%s', (url) => {
      expect(isAllowedVideoUrl(url)).toBe(false);
    });

    it('refuses an https URL on an allowed host spelled with a capital scheme', () => {
      // `URL` lower-cases the scheme, so this must still be allowed rather
      // than accidentally refused — the opposite failure, and worth pinning
      // so a future "harden the scheme check" does not break sign-in.
      expect(isAllowedVideoUrl('HTTPS://www.youtube.com/')).toBe(true);
    });
  });

  describe('refuses a host that merely ends with an allowed one', () => {
    /**
     * The trick the label-boundary check exists for.
     *
     * A bare `endsWith('youtube.com')` accepts every one of these, and the
     * comment in `videoSites.ts` names it: "`endsWith` alone would accept
     * `evil-youtube.com`, which is precisely the trick this is guarding
     * against." Anyone can register these.
     */
    it.each([
      ['https://evil-youtube.com/'],
      ['https://notyoutube.com/'],
      ['https://youtube.com.attacker.net/'],
      ['https://xyoutu.be/'],
      ['https://fakebandcamp.com/'],
      ['https://twitch.tv.evil.com/'],
      ['https://suno.com.example.org/'],
    ])('%s', (url) => {
      expect(isAllowedVideoUrl(url)).toBe(false);
    });
  });

  describe('reads the real host, not the part that looks like one', () => {
    /**
     * Userinfo, which is the oldest way of making a URL read as another site.
     *
     * `https://youtube.com@evil.com/` is a request to `evil.com` carrying
     * `youtube.com` as a username. It is correct today because the check uses
     * `URL.hostname`; a future rewrite that reaches for the raw string or for
     * `href.includes` would reintroduce it, and nothing would have said so.
     */
    it.each([
      ['https://youtube.com@evil.com/'],
      ['https://www.youtube.com:pass@evil.com/watch?v=1'],
      ['https://bandcamp.com@127.0.0.1:8080/'],
    ])('%s is refused', (url) => {
      expect(isAllowedVideoUrl(url)).toBe(false);
    });

    it('allows userinfo on a host that really is allowed', () => {
      expect(isAllowedVideoUrl('https://user@www.youtube.com/')).toBe(true);
    });
  });

  describe('normalises the fully-qualified form', () => {
    /**
     * A trailing dot is the same host to Chromium and a different string to
     * every comparison in the file. `videoSites.ts` strips it for exactly this
     * reason, so both spellings must agree — otherwise the allow-list and the
     * browser disagree about where a page is, which is the one disagreement
     * that cannot be safe in either direction.
     */
    it.each([
      ['https://youtube.com./', true],
      ['https://www.youtube.com./watch?v=1', true],
      ['https://evil-youtube.com./', false],
    ])('%s -> %s', (url, allowed) => {
      expect(isAllowedVideoUrl(url as string)).toBe(allowed);
    });
  });

  describe('is case-insensitive about the host', () => {
    it.each([['https://WWW.YouTube.COM/'], ['https://BandCamp.com/']])(
      '%s',
      (url) => {
        expect(isAllowedVideoUrl(url)).toBe(true);
      },
    );
  });

  describe('allows the sites and subdomains the player actually needs', () => {
    const reachable: string[] = [
      // Each site's own home page must be reachable, or its button is dead.
      ...VIDEO_SITES.map((site) => site.home),
      'https://music.youtube.com/search?q=test',
      'https://someartist.bandcamp.com/album/thing',
      'https://youtu.be/dQw4w9WgXcQ',
      // CDN hosts these sites navigate to mid-use.
      'https://rr3---sn-abc.googlevideo.com/videoplayback',
      'https://i.ytimg.com/vi/x/hq.jpg',
      'https://t4.bcbits.com/stream/x/mp3-128/1',
      'https://usher.ttvnw.net/api/channel/hls/x.m3u8',
      // Consent and sign-in hosts, each added deliberately and by name.
      'https://consent.google.com/m?continue=x',
      'https://accounts.google.com/signin',
      'https://appleid.apple.com/auth/authorize',
      'https://login.microsoftonline.com/common/oauth2/authorize',
      'https://login.live.com/oauth20_authorize.srf',
      'https://www.amazon.com/ap/oa',
      'https://discord.com/oauth2/authorize',
      'https://www.facebook.com/dialog/oauth',
    ];

    it.each(reachable)('%s', (url) => {
      expect(isAllowedVideoUrl(url)).toBe(true);
    });
  });

  describe('the auth hosts are exact, not domains', () => {
    /**
     * `ALLOWED_AUTH_HOSTS` is a `Set` of full host names precisely so that an
     * identity provider's front door does not also admit the rest of that
     * company's web estate. If one of these ever starts passing, somebody has
     * moved an entry into `ALLOWED_HOSTS` and turned the player into a browser
     * for Amazon, Facebook or Microsoft.
     */
    it.each([
      ['https://www.discord.com/'],
      ['https://cdn.discordapp.com/'],
      ['https://facebook.com/'],
      ['https://m.facebook.com/'],
      ['https://smile.amazon.com/'],
      ['https://amazon.com/'],
      ['https://outlook.live.com/'],
      ['https://apple.com/'],
    ])('%s is refused', (url) => {
      expect(isAllowedVideoUrl(url)).toBe(false);
    });
  });

  describe("Google's sign-in country domains", () => {
    /**
     * The last hop of a Google sign-in lands on `accounts.google.<cc>`, chosen
     * by Google. The pattern is deliberately tight — two or three letters, then
     * optionally a two-letter second level — so that the long vanity TLDs
     * anybody can buy do not match.
     */
    it.each([
      ['https://accounts.google.com/', true],
      ['https://accounts.google.nl/accounts/SetSID', true],
      ['https://accounts.google.co.uk/', true],
      ['https://accounts.google.com.br/', true],
      // Not the shape of a country domain.
      ['https://accounts.google.somethinglong/', false],
      ['https://accounts.google.attacker/', false],
      // The pattern covers one label on one domain, not the whole company.
      ['https://mail.google.com/', false],
      ['https://accounts.evil.com/', false],
      ['https://accounts.google.com.evil.net/', false],
    ])('%s -> %s', (url, allowed) => {
      expect(isAllowedVideoUrl(url as string)).toBe(allowed);
    });
  });

  it('refuses anything that is not a URL at all', () => {
    ['', 'not a url', '://', 'youtube.com', '//youtube.com'].forEach((url) => {
      expect(isAllowedVideoUrl(url)).toBe(false);
    });
  });

  /**
   * The four navigation guards all ask through this one name, so if it ever
   * stops delegating, every guard changes at once and silently.
   */
  it('is what the navigation guards ask', () => {
    [
      'https://www.youtube.com/',
      'https://evil.com/',
      'file:///etc/passwd',
    ].forEach((url) => {
      expect(isNavigableVideoUrl(url)).toBe(isAllowedVideoUrl(url));
    });
  });
});

/**
 * The list is read by both ends, and the promise is that a site with a button
 * is a site that can be reached. A home page that the allow-list refuses is a
 * dead button, and nothing else in the app would notice.
 */
describe('the sites offered in the UI', () => {
  it('every home page is reachable', () => {
    expect(VIDEO_SITES.length).toBeGreaterThan(0);
    VIDEO_SITES.forEach((site) => {
      expect(isAllowedVideoUrl(site.home)).toBe(true);
    });
  });

  it('every search page is reachable, for a real query', () => {
    VIDEO_SITES.forEach((site) => {
      expect(isAllowedVideoUrl(buildSearchUrl(site, 'aphex twin'))).toBe(true);
    });
  });

  it('has no duplicate ids', () => {
    const ids = VIDEO_SITES.map((site) => site.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('building a search URL', () => {
  const youtube = VIDEO_SITES[0];

  it('escapes the query rather than pasting it in', () => {
    // A query is user text going into a URL. `&` and `#` would otherwise end
    // the parameter early, and a space would make the URL unparseable.
    const url = buildSearchUrl(youtube, 'drum & bass #1');
    expect(url).toContain('drum%20%26%20bass%20%231');
    expect(isAllowedVideoUrl(url)).toBe(true);
  });

  it('falls back to the home page for an empty or blank query', () => {
    expect(buildSearchUrl(youtube, '')).toBe(youtube.home);
    expect(buildSearchUrl(youtube, '   ')).toBe(youtube.home);
  });

  it('cannot be steered off the site by the query', () => {
    const url = buildSearchUrl(youtube, 'https://evil.com/?x=');
    expect(isAllowedVideoUrl(url)).toBe(true);
    expect(new URL(url).hostname).toBe('www.youtube.com');
  });
});

describe('matching a URL back to its site button', () => {
  it('treats www and the bare domain as the same site', () => {
    expect(findSiteForUrl('https://www.youtube.com/watch?v=1')?.id).toBe(
      'youtube',
    );
    expect(findSiteForUrl('https://youtube.com/watch?v=1')?.id).toBe('youtube');
  });

  it('gives YouTube Music its own button rather than YouTube s', () => {
    expect(findSiteForUrl('https://music.youtube.com/')?.id).toBe(
      'youtube-music',
    );
  });

  it('answers nothing for a host with no button', () => {
    expect(findSiteForUrl('https://accounts.google.com/')).toBeUndefined();
    expect(findSiteForUrl('not a url')).toBeUndefined();
  });
});
