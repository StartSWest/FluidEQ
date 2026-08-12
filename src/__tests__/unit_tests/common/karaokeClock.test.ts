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
  findActiveKaraokeLine,
  formatKaraokeTime,
  TrackClock,
} from '../../../common/karaoke/clock';

describe('Karaoke track clock', () => {
  it('reads, clamps, seeks and delegates transport to the media source', async () => {
    const source = {
      currentTime: 2.5,
      duration: 10,
      paused: false,
      ended: false,
      play: jest.fn().mockResolvedValue(undefined),
      pause: jest.fn(),
    };
    const clock = new TrackClock(source);

    expect(clock.read()).toEqual({
      nowMs: 2_500,
      durationMs: 10_000,
      state: 'playing',
    });
    clock.seek(12_000);
    expect(source.currentTime).toBe(10);
    clock.pause();
    await clock.play();
    expect(source.pause).toHaveBeenCalledTimes(1);
    expect(source.play).toHaveBeenCalledTimes(1);
  });

  it('selects the active lyric and formats stable time values', () => {
    const lines = [
      { id: 'a', startMs: 1_000, tokens: [{ text: 'A' }] },
      { id: 'b', startMs: 2_000, tokens: [{ text: 'B' }] },
    ];
    expect(findActiveKaraokeLine(lines, 500)).toBe(-1);
    expect(findActiveKaraokeLine(lines, 1_999)).toBe(0);
    expect(findActiveKaraokeLine(lines, 2_000)).toBe(1);
    expect(formatKaraokeTime(65_999)).toBe('1:05');
  });
});
