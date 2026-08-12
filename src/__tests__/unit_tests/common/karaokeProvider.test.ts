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
  karaokeProviderDisplayName,
  normalizeKaraokeProviderToken,
  providerTimeToMilliseconds,
} from '../../../common/karaoke/provider';

describe('Karaoke provider normalization', () => {
  it('maps common provider clocks onto the song millisecond timeline', () => {
    expect(providerTimeToMilliseconds(750, { unit: 'milliseconds' })).toBe(750);
    expect(providerTimeToMilliseconds(1.5, { unit: 'seconds' })).toBe(1_500);
    expect(
      providerTimeToMilliseconds(2, {
        unit: 'beats',
        bpm: 120,
        offsetMs: 100,
      }),
    ).toBe(1_100);
    expect(
      providerTimeToMilliseconds(8, {
        unit: 'ticks',
        bpm: 120,
        ticksPerBeat: 4,
      }),
    ).toBe(1_000);
  });

  it('normalizes provider timing and pitch without leaking source units', () => {
    expect(
      normalizeKaraokeProviderToken(
        {
          text: 'Sing',
          startsWord: true,
          start: 4,
          duration: 2,
          pitch: 900,
          kind: 'golden',
        },
        { unit: 'ticks', bpm: 120, ticksPerBeat: 4, offsetMs: 100 },
        {
          unit: 'relative-cents',
          relativeCenterMidi: 60,
          octavePolicy: 'nearest-target',
        },
      ),
    ).toEqual({
      text: 'Sing',
      startsWord: true,
      startMs: 600,
      endMs: 850,
      targetMidi: 69,
      kind: 'golden',
    });
  });

  it('provides a readable name for an adapter without localized copy', () => {
    expect(karaokeProviderDisplayName('singstar-xml')).toBe('Singstar XML');
    expect(karaokeProviderDisplayName('open_lyrics.ttml')).toBe(
      'Open Lyrics TTML',
    );
  });
});
