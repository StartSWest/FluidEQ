/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Seven standard looks were taken out of the app (Ivan, 2026-11-27):
 * Synthwave, Tide, Invaders, Pulse (`ecg`), Bubbles, Truss and Terrace.
 * Somebody's saved state still names them, and it has to load: a selection
 * of one opens on the Analyzer, and a look made from one keeps its name and
 * colours and draws as the Analyzer. Each case beside the same state on a
 * look that stayed, which must come back exactly as it was saved.
 */

import {
  GRAPH_STYLES,
  GRAPH_STYLE_LABELS,
  SELECTABLE_GRAPH_STYLES,
} from 'common/graphStyles';
import { normalizeCustomLook, normalizeTuning } from 'common/customLooks';
import { isRemovedGraphStyle } from 'common/removedGraphStyles';

const REMOVED = [
  'synthwave',
  'tide',
  'invaders',
  'ecg',
  'bubbles',
  'truss',
  'terrace',
];

const saved = (style: string) => ({
  id: 'custom:saved-1',
  name: 'My look',
  style,
  palette: 'rainbow',
  tuning: { columns: 9, filled: false, attackMs: 40 },
  colours: [],
});

describe('the removed looks', () => {
  it('are in no list a look is chosen from', () => {
    REMOVED.forEach((style) => {
      expect(GRAPH_STYLES).not.toContain(style);
      expect(SELECTABLE_GRAPH_STYLES).not.toContain(style);
      expect(Object.keys(GRAPH_STYLE_LABELS)).not.toContain(style);
      expect(isRemovedGraphStyle(style)).toBe(true);
    });
    // The control: a look that stayed is neither gone nor called removed.
    expect(GRAPH_STYLES).toContain('analyzer');
    expect(isRemovedGraphStyle('analyzer')).toBe(false);
  });
});

describe('a look somebody made from a removed one', () => {
  it.each(REMOVED)(
    'made from %s loads as the Analyzer, keeping its name and colours',
    (style) => {
      const look = normalizeCustomLook(saved(style));
      expect(look).toMatchObject({
        id: 'custom:saved-1',
        name: 'My look',
        style: 'analyzer',
        palette: 'rainbow',
      });
      // The Analyzer's own settings: the stored ones were the removed drawing's.
      expect(look?.tuning).toEqual(normalizeTuning(undefined, 'analyzer'));
    },
  );

  it('made from the Analyzer loads unchanged, tuning and all', () => {
    const look = normalizeCustomLook(saved('analyzer'));
    expect(look).toMatchObject({
      style: 'analyzer',
      name: 'My look',
      palette: 'rainbow',
    });
    expect(look?.tuning).toMatchObject({
      columns: 9,
      filled: false,
      attackMs: 40,
    });
  });

  it('made from a form nobody has heard of is still refused', () => {
    // So the migration is for the seven, not a door for anything.
    expect(normalizeCustomLook(saved('kaleidoscope'))).toBeNull();
  });
});

describe('a selection saved on a removed look', () => {
  const selectionAfterLoad = (stored: string): string => {
    window.localStorage.setItem('fluideq-graph-style', stored);
    let store: typeof import('renderer/utils/graphStyle') | undefined;
    jest.isolateModules(() => {
      // eslint-disable-next-line global-require -- the selection is read when the store loads, so a copy loaded after it was saved is the only way to see it
      store = require('renderer/utils/graphStyle');
    });
    return store?.getGraphLookId() ?? '';
  };

  afterEach(() => window.localStorage.clear());

  it.each(['synthwave', 'synthwave-auto', 'ecg-rainbow', 'terrace-level'])(
    '%s opens on the Analyzer',
    (stored) => {
      expect(selectionAfterLoad(stored)).toBe('analyzer-auto');
    },
  );

  it('on the Analyzer loads unchanged', () => {
    expect(selectionAfterLoad('analyzer-level')).toBe('analyzer-level');
    expect(selectionAfterLoad('skyline-rainbow')).toBe('skyline-rainbow');
  });
});
