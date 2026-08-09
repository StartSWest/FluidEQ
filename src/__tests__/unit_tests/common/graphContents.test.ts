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
  TGraphView,
  cycleGraphContents,
  getGraphContents,
  setGraphContents,
  setGraphView,
} from 'renderer/utils/graphStyle';

const STATES = Object.keys(GRAPH_CONTENTS_LABEL) as TGraphContents[];

const MODES: TGraphView[] = ['normal', 'expanded', 'fullscreen'];

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
 *
 * All four values are now kept once per view mode, so the machine is really
 * three machines that share one set of writers. That is where a careless read
 * would show up: a state recognised from one mode's flags while another mode's
 * were being written would be the same contradiction as before, wearing a
 * different hat.
 */
describe('what the plot is showing', () => {
  afterEach(() => {
    // Every mode, not only the one the case left off in. The four values are
    // per view mode, so a state abandoned in full screen would sit there
    // waiting for the next case that happened to switch to it.
    MODES.forEach((mode) => {
      setGraphView(mode);
      setGraphContents('everything');
    });
    setGraphView('normal');
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

  /**
   * One state per view mode, which is what the cycle is for.
   *
   * The arrangement somebody wants while editing bands is not the one they want
   * over a video — that is the whole argument — and a shared state meant the
   * cycle had to be re-walked on the way into full screen and again on the way
   * back, every time. A key that has to be pressed four times to undo a Ctrl+F
   * is one nobody finishes learning.
   */
  it('holds a state per view mode', () => {
    setGraphView('normal');
    setGraphContents('everything');
    setGraphView('expanded');
    setGraphContents('layers');
    setGraphView('fullscreen');
    setGraphContents('wave');

    setGraphView('normal');
    expect(getGraphContents()).toBe('everything');
    setGraphView('expanded');
    expect(getGraphContents()).toBe('layers');
    setGraphView('fullscreen');
    expect(getGraphContents()).toBe('wave');
  });

  it('cycles the mode it is in and leaves the other two where they were', () => {
    setGraphView('expanded');
    setGraphContents('curves');
    setGraphView('fullscreen');
    setGraphContents('layersAlone');

    setGraphView('normal');
    setGraphContents('everything');
    cycleGraphContents();
    expect(getGraphContents()).toBe('wave');

    // The neighbours were mid-cycle when the key was pressed and are still
    // exactly there. A press that walked all three at once would be four
    // settings pretending to be one again, which is the fault this whole
    // machine exists to make impossible.
    setGraphView('expanded');
    expect(getGraphContents()).toBe('curves');
    setGraphView('fullscreen');
    expect(getGraphContents()).toBe('layersAlone');
  });

  it('starts each mode from everything, rather than from its neighbour', () => {
    // Switching mode changes the answer without anything being set, so the mode
    // arrived in has to be showing what *it* was left showing — not what the
    // one just left is showing, which is what a single shared value did.
    setGraphView('normal');
    setGraphContents('wave');

    MODES.filter((mode) => mode !== 'normal').forEach((mode) => {
      setGraphView(mode);
      expect(getGraphContents()).toBe('everything');
    });
  });
});
