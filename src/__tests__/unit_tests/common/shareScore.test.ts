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
  SHARE_NETWORKS,
  buildShareText,
  carriesShareText,
  getShareFileName,
  getShareUrl,
} from 'common/shareScore';

const REPO = 'https://github.com/StartSWest/FluidEQ';

describe('buildShareText', () => {
  it('names euphoria mode once it has been reached', () => {
    expect(buildShareText(4200, 10)).toContain('×10 — euphoria mode');
  });

  it('does not claim euphoria below the ceiling', () => {
    expect(buildShareText(900, 4)).toContain('×4');
    expect(buildShareText(900, 4)).not.toContain('euphoria');
  });

  it('fits X with the link attached', () => {
    // The tightest limit of the three by a wide margin, and the only one that
    // silently truncates rather than refusing. A t.co link counts as 23.
    const text = buildShareText(999999, 10);
    expect(text.length + 1 + 23).toBeLessThanOrEqual(280);
  });

  it('never posts a fractional or negative score', () => {
    expect(buildShareText(-5, 1)).toContain('0 points');
    expect(buildShareText(12.7, 1)).toContain('12 points');
  });

  it('never posts a multiplier below one', () => {
    // Zero would be read as having scored nothing, which is not what a run
    // with no streak yet means.
    expect(buildShareText(10, 0)).toContain('×1');
  });
});

describe('getShareUrl', () => {
  it('gives X both the text and the link', () => {
    const url = getShareUrl('x', 'hello world', REPO);
    expect(url).toContain('text=hello%20world');
    expect(url).toContain(encodeURIComponent(REPO));
  });

  it('sends LinkedIn and Facebook the link only', () => {
    // Neither renders passed-in text any more. Including it would be writing
    // something on the user's behalf that they never get to see.
    (['linkedin', 'facebook'] as const).forEach((network) => {
      const url = getShareUrl(network, 'hello world', REPO);
      expect(url).toContain(encodeURIComponent(REPO));
      expect(url).not.toContain('hello');
    });
  });

  it('escapes text that would otherwise break the query', () => {
    const url = getShareUrl('x', 'a&b=c #tag', REPO);
    expect(url).toContain('%26');
    expect(url).not.toMatch(/text=[^&]*&b=/);
  });

  it('has a url for every network offered', () => {
    SHARE_NETWORKS.forEach((network) => {
      expect(getShareUrl(network.id, 'text', REPO)).toMatch(/^https:\/\//);
    });
  });
});

describe('carriesShareText', () => {
  it('is honest about which networks show the words', () => {
    // The UI puts a note on the ones that do not, so this is what decides
    // whether someone is told to paste it themselves.
    expect(carriesShareText('x')).toBe(true);
    expect(carriesShareText('linkedin')).toBe(false);
    expect(carriesShareText('facebook')).toBe(false);
  });
});

describe('getShareFileName', () => {
  it('names the file after the score', () => {
    expect(getShareFileName(1234)).toBe('fluideq-euphoria-1234.png');
  });

  it('cannot produce a name with a dot or a minus in the number', () => {
    // Both are legal in a filename but neither is legal in a score, and a
    // ".png" that is actually "-1.5.png" looks like a broken download.
    expect(getShareFileName(-3)).toBe('fluideq-euphoria-0.png');
    expect(getShareFileName(12.9)).toBe('fluideq-euphoria-12.png');
  });
});
