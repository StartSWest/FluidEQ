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
  getGraphBandLabelsHidden,
  toggleGraphBandLabels,
} from 'renderer/utils/graphStyle';
import { LOCALES, loadLocale, translate } from 'common/i18n';

const STATES = Object.keys(GRAPH_CONTENTS_LABEL) as TGraphContents[];

const MODES: TGraphView[] = ['normal', 'fullscreen'];

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
 * two machines, the pane's and full screen's, that share one set of writers. That is where a careless read
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
      if (getGraphCoverageHidden()) {
        toggleGraphCoverage();
      }
    });
    setGraphView('normal');
  });

  it('has six stops, including a separate stop for hiding band labels', () => {
    expect(STATES).toHaveLength(6);
  });

  // The caption after a keypress and the View menu's row read the same list,
  // so two states sharing a word would be two states nobody can tell apart —
  // in any language. The list holds keys: it held English words, and the
  // caption showed them in English whatever language was on screen.
  it.each(LOCALES.map(({ code, name }) => [name, code] as const))(
    'names every stop with words of its own in %s',
    async (_name, code) => {
      await loadLocale(code);
      const words = STATES.map((state) =>
        translate(code, GRAPH_CONTENTS_LABEL[state]),
      );
      expect(new Set(words).size).toBe(6);
      words.forEach((word) => expect(word).not.toMatch(/^graph./));
    },
  );

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

  /**
   * Ctrl+W walks three stops forwards and Ctrl+S back: the wave alone, the
   * wave with the curves, the curves alone (Ivan, 2026-11-16: "waves only,
   * then waves with curves, then curves only"). The other states are reached
   * from the View menu, and the walk reads each of them as the middle stop.
   */
  const walk = (direction: 1 | -1, steps: number): TGraphContents[] => {
    const seen: TGraphContents[] = [];
    for (let step = 0; step < steps; step += 1) {
      cycleGraphContents(direction);
      seen.push(getGraphContents());
    }
    return seen;
  };

  it('walks its three stops forwards and back, ending where it started', () => {
    setGraphContents('everything');
    expect(walk(1, 3)).toEqual(['curves', 'wave', 'everything']);
    expect(walk(-1, 3)).toEqual(['wave', 'curves', 'everything']);
  });

  it.each(['layers', 'clean', 'unlabelled'] as const)(
    'reads %s, which is no stop, as the wave with the curves',
    (state) => {
      setGraphContents(state);
      cycleGraphContents();
      expect(getGraphContents()).toBe('curves');
      setGraphContents(state);
      cycleGraphContents(-1);
      expect(getGraphContents()).toBe('wave');
    },
  );

  it('hides labels from their own switch, and the walk keeps them as it has them', () => {
    setGraphContents('everything');
    expect(getGraphBandLabelsHidden()).toBe(false);
    toggleGraphBandLabels();
    expect(getGraphContents()).toBe('unlabelled');
    expect(getGraphBandLabelsHidden()).toBe(true);

    // Round the walk and back to its middle stop: the labels are no stop, so
    // they come back hidden, as the switch left them.
    expect(walk(1, 3)).toEqual(['curves', 'wave', 'unlabelled']);
    expect(getGraphBandLabelsHidden()).toBe(true);

    // Positive control: Everything named outright does show them.
    setGraphContents('everything');
    expect(getGraphBandLabelsHidden()).toBe(false);
    expect(walk(1, 3)).toEqual(['curves', 'wave', 'everything']);
  });

  it('changes the coverage wash without changing the named graph state', () => {
    setGraphContents('layers');
    expect(getGraphCoverageHidden()).toBe(false);

    toggleGraphCoverage();
    expect(getGraphCoverageHidden()).toBe(true);
    expect(getGraphContents()).toBe('layers');

    toggleGraphCoverage();
    expect(getGraphCoverageHidden()).toBe(false);
    expect(getGraphContents()).toBe('layers');
  });

  it('leaves the coverage choice alone while the walk leaves clean', () => {
    setGraphContents('everything');
    expect(getGraphCoverageHidden()).toBe(false);

    setGraphContents('clean');
    expect(getGraphCoverageHidden()).toBe(false);

    // Clean is a presentation override, no longer a stop. The independent
    // wash preference stays where the user left it underneath, through the
    // stops the walk goes on to.
    cycleGraphContents();
    expect(getGraphContents()).toBe('curves');
    expect(getGraphCoverageHidden()).toBe(false);

    cycleGraphContents();
    expect(getGraphContents()).toBe('wave');
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
    // Neither is the default, so a mode that read its neighbour's value, or
    // none, could not pass. The Expanded view went on 2026-11-16, leaving two.
    setGraphView('normal');
    setGraphContents('layers');
    setGraphView('fullscreen');
    setGraphContents('curves');
    expect(getGraphContents()).toBe('curves');

    setGraphView('normal');
    expect(getGraphContents()).toBe('layers');
  });

  it('cycles the mode it is in and leaves the other one where it was', () => {
    setGraphView('normal');
    setGraphContents('layers');

    setGraphView('fullscreen');
    cycleGraphContents();
    expect(getGraphContents()).toBe('everything');

    // The neighbour was mid-cycle when the key was pressed and is still
    // exactly there. A press that walked both at once would be five
    // settings pretending to be one again, which is the fault this whole
    // machine exists to make impossible.
    setGraphView('normal');
    expect(getGraphContents()).toBe('layers');
  });

  /**
   * Full screen opens on the first stop, the wave, whatever it was left on
   * (Ivan, 2026-11-16: "when it turns full screen always show the wave, as if
   * it resets the W / S cycle each time"): a stop of curves alone left there
   * came back as a picture with no wave. The pane keeps what it was left on.
   */
  it('opens full screen on the wave, and leaves the pane as it was left', () => {
    setGraphView('normal');
    setGraphContents('curves');

    setGraphView('fullscreen');
    expect(getGraphContents()).toBe('wave');
    setGraphContents('clean');

    setGraphView('normal');
    expect(getGraphContents()).toBe('curves');
    setGraphView('fullscreen');
    expect(getGraphContents()).toBe('wave');
  });
});
