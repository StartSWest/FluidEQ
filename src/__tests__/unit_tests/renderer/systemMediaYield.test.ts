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

/**
 * Which of two players stops, when both could be making sound.
 *
 * One of them at a time, in both directions: start something here and the
 * machine's player is asked to pause, start something out there and ours
 * stops. The whole difficulty is the second or so in between — a pause has
 * been sent and the next reading of Windows has not caught up — where a rule
 * written on the state rather than on the change had the two take it in turns
 * to stop each other, with no clock involved either way.
 */

import { shouldYieldToSystem } from '../../../renderer/audio/useSystemMediaSource';

describe('yielding to the machine’s own player', () => {
  it('stops ours when something out there starts', () => {
    expect(shouldYieldToSystem(false, true, 'library')).toBe(true);
  });

  it('leaves ours alone while nothing out there is playing', () => {
    expect(shouldYieldToSystem(false, false, 'library')).toBe(false);
  });

  it('does not act twice on one start', () => {
    // The watcher reports every change — a position moving, a queue's next
    // track — and every one of those readings still says "playing". Only the
    // first is somebody pressing play.
    expect(shouldYieldToSystem(true, true, 'library')).toBe(false);
  });

  it('does not stop ours for the pause we just sent', () => {
    // A player of ours starts, the machine's player is asked to pause, and
    // for one reading it is still playing. Read as state, that says "outside
    // is playing and we are playing" and stops the song that just started;
    // read as a change, it says nothing happened.
    expect(shouldYieldToSystem(true, true, 'karaoke')).toBe(false);
  });

  it('has nothing to stop when this app is silent', () => {
    // The ordinary case: a browser starts and the bar simply shows it.
    expect(shouldYieldToSystem(false, true, undefined)).toBe(false);
  });
});
