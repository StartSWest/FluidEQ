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

import {
  VIDEO_SITES,
  buildSearchUrl,
  findSiteForUrl,
  isAllowedVideoUrl,
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
