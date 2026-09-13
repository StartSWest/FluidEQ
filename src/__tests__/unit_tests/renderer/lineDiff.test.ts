/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The line diff behind the Studio code pane's marks. When the member's AI
 * rewrites the scene, the pane lights the lines it added, notches where lines
 * went and brings the first change into view; a wrong line number there
 * points the member at code that did not change.
 */

import {
  describeChange,
  diffLines,
  diffRows,
} from '../../../renderer/studio/lineDiff';

const text = (...lines: string[]) => lines.join('\n');

describe('the line diff', () => {
  it('numbers every line in the text it belongs to', () => {
    expect(diffLines(text('a', 'b', 'c'), text('a', 'x', 'c'))).toEqual([
      { kind: 'same', text: 'a', oldLine: 1, newLine: 1 },
      { kind: 'remove', text: 'b', oldLine: 2 },
      { kind: 'add', text: 'x', newLine: 2 },
      { kind: 'same', text: 'c', oldLine: 3, newLine: 3 },
    ]);
  });

  it('finds lines kept between changes, not only at the top and bottom', () => {
    const lines = diffLines(
      text('head', 'one', 'keep', 'two', 'tail'),
      text('head', 'uno', 'keep', 'dos', 'tail'),
    );
    expect(lines.filter((line) => line.kind === 'same')).toEqual([
      { kind: 'same', text: 'head', oldLine: 1, newLine: 1 },
      { kind: 'same', text: 'keep', oldLine: 3, newLine: 3 },
      { kind: 'same', text: 'tail', oldLine: 5, newLine: 5 },
    ]);
  });

  it('reports a rewrite too large to compare as removed and added whole', () => {
    const before = Array.from({ length: 2100 }, (_, at) => `old ${at}`);
    const after = Array.from({ length: 2100 }, (_, at) => `new ${at}`);
    const lines = diffLines(
      text('same', ...before, 'end'),
      text('same', ...after, 'end'),
    );
    expect(lines.filter((line) => line.kind === 'remove')).toHaveLength(2100);
    expect(lines.filter((line) => line.kind === 'add')).toHaveLength(2100);
    expect(lines[0]).toEqual({
      kind: 'same',
      text: 'same',
      oldLine: 1,
      newLine: 1,
    });
    expect(lines[lines.length - 1]).toEqual({
      kind: 'same',
      text: 'end',
      oldLine: 2102,
      newLine: 2102,
    });
  });
});

describe('a change as the pane marks it', () => {
  it('is nothing when the text is the same', () => {
    expect(describeChange(text('a', 'b'), text('a', 'b'))).toBeUndefined();
  });

  it('marks added lines and the line removed lines sat above, from the first change', () => {
    const change = describeChange(
      text('a', 'b', 'c', 'd'),
      text('a', 'c', 'new', 'd'),
    );
    expect(change).toMatchObject({
      addedCount: 1,
      removedCount: 1,
      firstLine: 2,
    });
    expect([...(change?.added ?? [])]).toEqual([3]);
    // 'b' went from above what is now line 2.
    expect([...(change?.removedAbove ?? [])]).toEqual([2]);
  });

  it('marks lines cut from the end past the last line', () => {
    const change = describeChange(text('a', 'b', 'c'), text('a'));
    expect([...(change?.removedAbove ?? [])]).toEqual([2]);
    expect(change?.firstLine).toBe(2);
    expect(change?.added.size).toBe(0);
  });
});

describe('the diff as it is read', () => {
  it('keeps three lines around each change and folds longer unchanged runs', () => {
    const before = Array.from({ length: 20 }, (_, at) => `line ${at + 1}`);
    const after = [...before];
    after[9] = 'changed';
    const rows = diffRows(diffLines(text(...before), text(...after)));
    expect(rows[0]).toEqual({ kind: 'skip', count: 6 });
    expect(rows[rows.length - 1]).toEqual({ kind: 'skip', count: 7 });
    const shown = rows.filter((row) => row.kind !== 'skip');
    // Lines 7-9, the change as a removal and an addition, lines 11-13.
    expect(shown).toHaveLength(8);
    expect(shown.map((row) => row.kind)).toEqual([
      'same',
      'same',
      'same',
      'remove',
      'add',
      'same',
      'same',
      'same',
    ]);
  });

  it('folds nothing when every line is near a change', () => {
    const rows = diffRows(diffLines(text('a', 'b'), text('x', 'b')));
    expect(rows.some((row) => row.kind === 'skip')).toBe(false);
  });
});
