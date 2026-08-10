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
  getGraphCoverageHidden,
  setGraphContents,
  setGraphView,
  toggleGraphCoverage,
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
 * All five values are now kept once per view mode, so the machine is really
 * three machines that share one set of writers. That is where a careless read
 * would show up: a state recognised from one mode's flags while another mode's
 * were being written would be the same contradiction as before, wearing a
 * different hat.
 *
 * One of the five — the coverage wash — has a second writer on purpose, and the
 * cases below are where that is held to its bargain. The menu switch may move
 * it without naming a state only because it is the exact inverse of the stop
 * that does, and nothing but a test says so.
 */
describe('what the plot is showing', () => {
  afterEach(() => {
    // Every mode, not only the one the case left off in. The five values are
    // per view mode, so a state abandoned in full screen would sit there
    // waiting for the next case that happened to switch to it.
    MODES.forEach((mode) => {
      setGraphView(mode);
      setGraphContents('everything');
    });
    setGraphView('normal');
  });

  it('has five stops, each with a name of its own', () => {
    expect(STATES).toHaveLength(5);
    // The caption after a keypress and the View menu's row read the same list,
    // so two states sharing a word would be two states nobody can tell apart.
    expect(new Set(Object.values(GRAPH_CONTENTS_LABEL)).size).toBe(5);
  });

  it('recognises every state it can be put into', () => {
    STATES.forEach((state) => {
      // Back through `everything` between each, rather than straight from the
      // last state. A state that forgets to write one of the five flags would
      // otherwise inherit the right value from its neighbour and pass — which
      // is exactly the drift the machine exists to make impossible.
      setGraphContents('everything');
      setGraphContents(state);
      expect(getGraphContents()).toBe(state);
    });
  });

  it('visits all of them in order and comes back', () => {
    setGraphContents('everything');
    const seen: TGraphContents[] = [];
    for (let step = 0; step < STATES.length; step += 1) {
      cycleGraphContents();
      seen.push(getGraphContents());
    }

    // Every state exactly once, in the order the key walks them, ending where
    // it started.
    expect(seen).toEqual(['layers', 'curves', 'clean', 'wave', 'everything']);
  });

  /**
   * The fourth stop, and the switch that has to be its exact inverse.
   *
   * `clean` is the one state whose flag a menu switch also writes, so that
   * switch has to be able to undo itself from wherever it was pressed —
   * including from `layers`, whose quiet EQ line no control in the app can put
   * back. It works because the switch moves the coverage flag and nothing else,
   * and because `getGraphContents` asks about coverage before it asks about the
   * quiet line. Read the other way round, the trip out would still work and the
   * trip home would land somewhere else.
   */
  it('lets the coverage switch reach clean and come straight back', () => {
    setGraphContents('layers');

    toggleGraphCoverage();
    expect(getGraphCoverageHidden()).toBe(true);
    expect(getGraphContents()).toBe('clean');

    toggleGraphCoverage();
    expect(getGraphCoverageHidden()).toBe(false);
    expect(getGraphContents()).toBe('layers');
  });

  it('takes the wash away at the fourth stop and gives it back round the loop', () => {
    setGraphContents('everything');
    expect(getGraphCoverageHidden()).toBe(false);

    setGraphContents('clean');
    expect(getGraphCoverageHidden()).toBe(true);

    // `wave` keeps it hidden — there are no curves left for it to wash over —
    // and the press after that is back at the top with the columns on. Hidden
    // here used to mean hidden until somebody said otherwise; the cycle writes
    // this flag now, which is the whole of what `clean` cost.
    cycleGraphContents();
    expect(getGraphContents()).toBe('wave');
    expect(getGraphCoverageHidden()).toBe(true);

    cycleGraphContents();
    expect(getGraphContents()).toBe('everything');
    expect(getGraphCoverageHidden()).toBe(false);
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
    setGraphContents('clean');

    setGraphView('normal');
    setGraphContents('everything');
    cycleGraphContents();
    expect(getGraphContents()).toBe('layers');

    // The neighbours were mid-cycle when the key was pressed and are still
    // exactly there. A press that walked all three at once would be five
    // settings pretending to be one again, which is the fault this whole
    // machine exists to make impossible.
    setGraphView('expanded');
    expect(getGraphContents()).toBe('curves');
    setGraphView('fullscreen');
    expect(getGraphContents()).toBe('clean');
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
