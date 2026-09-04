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
  EUPHORIA_MULTIPLIER,
  SHARE_NETWORKS,
  buildShareText,
  carriesShareText,
  getShareFileName,
  getShareUrl,
  isEuphoricRun,
} from 'common/shareScore';
import { buildSupportConfig } from 'common/support';

const REPO = 'https://github.com/StartSWest/FluidEQ';

describe('buildShareText', () => {
  it('names the rainbow once the ceiling has been reached', () => {
    const text = buildShareText(4200, 10);
    expect(text).toContain('rainbow');
    expect(text).toContain('4200');
    // The app leads and the run follows, in every version: a stranger has to
    // know what this is before a number from it means anything, so the score
    // comes after the sentence that introduces it — never as the headline.
    expect(text.indexOf('equaliser')).toBeLessThan(text.indexOf('4200'));
  });

  it('does not claim euphoria below the ceiling', () => {
    expect(buildShareText(900, 4)).toContain('×4');
    expect(buildShareText(900, 4).toLowerCase()).not.toContain('euphoria');
  });

  it('fits X with the link attached', () => {
    // The tightest limit of the three by a wide margin, and the only one that
    // silently truncates rather than refusing. A t.co link counts as 23.
    // The X version is the one written to a budget; the others are read
    // where there is no counter, and the copy button has no limit at all.
    const text = buildShareText(999999, 10, true, 'x');
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
    expect(getShareFileName(1234, true)).toBe('fluideq-euphoria-1234.png');
  });

  it('does not call an ordinary run euphoria', () => {
    // Told rather than inferred from the multiplier, because the mode can be
    // switched on by someone who reached the ceiling on an earlier run — but
    // an ordinary card still must not be filed as a euphoric one.
    expect(getShareFileName(1234, false)).toBe('fluideq-score-1234.png');
  });

  it('cannot produce a name with a dot or a minus in the number', () => {
    // Both are legal in a filename but neither is legal in a score, and a
    // ".png" that is actually "-1.5.png" looks like a broken download.
    expect(getShareFileName(-3)).toBe('fluideq-score-0.png');
    expect(getShareFileName(12.9)).toBe('fluideq-score-12.png');
  });
});

describe('isEuphoricRun', () => {
  it('agrees with the game about where the ceiling is', () => {
    // The card, the sentence and the button that offers the share all read
    // this. If they ever disagree someone posts a rainbow card under a
    // sentence that does not mention euphoria.
    expect(EUPHORIA_MULTIPLIER).toBe(10);
    expect(isEuphoricRun(9.99)).toBe(false);
    expect(isEuphoricRun(10)).toBe(true);
  });
});

describe('the download destination', () => {
  it('sends strangers to releases, not to the source tree', () => {
    // A share post is read by people who have never seen FluidEQ. Handing them
    // a repository asks them to work out how to build it, which is the whole
    // click wasted.
    const config = buildSupportConfig({
      FLUIDEQ_REPOSITORY_URL: 'https://github.com/example/FluidEQ',
    });
    expect(config.downloadUrl).toBe(
      'https://github.com/example/FluidEQ/releases/latest',
    );
  });

  it('does not double the slash when the repository url has one', () => {
    const config = buildSupportConfig({
      FLUIDEQ_REPOSITORY_URL: 'https://example.com/fluideq/',
    });
    expect(config.downloadUrl).toBe(
      'https://example.com/fluideq/releases/latest',
    );
  });

  it('lets a build point somewhere else entirely', () => {
    // A project with its own download page should not be forced through a
    // GitHub releases URL it does not use.
    const config = buildSupportConfig({
      FLUIDEQ_REPOSITORY_URL: 'https://github.com/example/FluidEQ',
      FLUIDEQ_DOWNLOAD_URL: 'https://fluideq.app/download',
    });
    expect(config.downloadUrl).toBe('https://fluideq.app/download');
  });
});
