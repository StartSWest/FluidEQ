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
  GRAPH_CONTENTS_LABEL,
  TGraphContents,
  cycleGraphContents,
  getGraphContents,
  setGraphContents,
} from 'renderer/utils/graphStyle';

const STATES = Object.keys(GRAPH_CONTENTS_LABEL) as TGraphContents[];

/**
 * The plot's contents are a state machine, and this is why.
 *
 * They were three independent flags, each added for its own reason, which is how
 * they ended up able to contradict each other and how the legend ended up able
 * to contradict all three: hiding the EQ curve from its chip left the cycle
 * still believing the view was "everything", so the next press moved on to
 * "wave only" and looked like it had done nothing, because what it took away
 * was already gone.
 *
 * The machine only holds while every state can be recognised from the flags it
 * sets. Nothing else here checks that, and it is one careless flag away from
 * being false again.
 */
describe('what the plot is showing', () => {
  afterEach(() => {
    setGraphContents('everything');
  });

  it('recognises every state it can be put into', () => {
    STATES.forEach((state) => {
      setGraphContents(state);
      expect(getGraphContents()).toBe(state);
    });
  });

  it('visits all of them and comes back, without repeating one', () => {
    setGraphContents('everything');
    const seen: TGraphContents[] = [];
    for (let step = 0; step < STATES.length; step += 1) {
      cycleGraphContents();
      seen.push(getGraphContents());
    }

    // Every state exactly once, ending where it started.
    expect(new Set(seen).size).toBe(STATES.length);
    expect(seen[seen.length - 1]).toBe('everything');
  });

  /**
   * The fifth state, and the reason the fourth was renamed.
   *
   * `layers` quiets the EQ curve and leaves the wave running underneath, which
   * is a useful thing to look at and is not what "Layers only" describes. The
   * name now belongs to the state that earns it.
   */
  it('separates layers over the wave from layers alone', () => {
    setGraphContents('layers');
    const overWave = getGraphContents();

    setGraphContents('layersAlone');

    expect(overWave).toBe('layers');
    expect(getGraphContents()).toBe('layersAlone');
    expect(GRAPH_CONTENTS_LABEL.layersAlone).toBe('Layers only');
    expect(GRAPH_CONTENTS_LABEL.layers).not.toBe('Layers only');
  });
});
