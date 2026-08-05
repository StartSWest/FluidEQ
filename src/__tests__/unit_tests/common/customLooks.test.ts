/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>

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
  GRAPH_STYLES,
  GRAPH_STYLE_LABELS,
  GraphStyle,
  MAX_GRAPH_COLUMNS,
  MIN_GRAPH_COLUMNS,
  getGraphBallistics,
  getGraphColumnCount,
  hasGraphAccent,
  isFilledGraphStyle,
} from 'common/graphStyles';
import {
  CUSTOM_LOOK_PREFIX,
  ICustomLook,
  MAX_ATTACK_MS,
  MAX_CUSTOM_LOOKS,
  MAX_FILL_OPACITY,
  MAX_LOOK_NAME_LENGTH,
  MAX_RELEASE_MS,
  MAX_STROKE_WIDTH,
  MIN_ATTACK_MS,
  MIN_FILL_OPACITY,
  MIN_RELEASE_MS,
  MIN_STROKE_WIDTH,
  createCustomLookId,
  createDraftLook,
  getDefaultTuning,
  isCustomLookId,
  normalizeCustomLook,
  normalizeLookName,
  normalizeTuning,
  parseCustomLooks,
  rebaseDraftLook,
  resolveCustomLook,
  serializeCustomLooks,
} from 'common/customLooks';

const draftOf = (style: GraphStyle = 'bars'): ICustomLook =>
  createDraftLook(style, 'signal', 'A look');

describe('a look starts where its form already is', () => {
  it.each(GRAPH_STYLES)('takes %s settings from the engine itself', (style) => {
    // Read from the tables rather than copied, so retuning a form in
    // graphStyles.ts moves the starting point here too. A copy would drift
    // silently and every new look would be made from last year's numbers.
    const tuning = getDefaultTuning(style);
    const ballistics = getGraphBallistics(style);
    expect(tuning.columns).toBe(getGraphColumnCount(style));
    expect(tuning.attackMs).toBe(ballistics.attackMs);
    expect(tuning.releaseMs).toBe(ballistics.releaseMs);
    expect(tuning.filled).toBe(isFilledGraphStyle(style));
    expect(tuning.accents).toBe(hasGraphAccent(style));
  });

  it.each(GRAPH_STYLES)('leaves %s reachable on the sliders', (style) => {
    // A form whose own settings sit outside the ranges the panel offers is one
    // the user cannot put back after touching it: the Reset button would move
    // to a value no slider can express, and the next save would clamp it to
    // something the form never shipped with.
    const tuning = getDefaultTuning(style);
    expect(tuning.columns).toBeGreaterThanOrEqual(MIN_GRAPH_COLUMNS);
    expect(tuning.columns).toBeLessThanOrEqual(MAX_GRAPH_COLUMNS);
    expect(tuning.attackMs).toBeGreaterThanOrEqual(MIN_ATTACK_MS);
    expect(tuning.attackMs).toBeLessThanOrEqual(MAX_ATTACK_MS);
    expect(tuning.releaseMs).toBeGreaterThanOrEqual(MIN_RELEASE_MS);
    expect(tuning.releaseMs).toBeLessThanOrEqual(MAX_RELEASE_MS);
  });

  it.each(GRAPH_STYLES)('never lets %s fall faster than it rises', (style) => {
    // The same rule the built-in ballistics keep. A meter that drops quicker
    // than it climbs loses the peak before the eye it attracted arrives.
    const tuning = getDefaultTuning(style);
    expect(tuning.releaseMs).toBeGreaterThanOrEqual(tuning.attackMs);
  });
});

describe('normalizeTuning', () => {
  it('keeps a sane tuning as it is', () => {
    const tuning = normalizeTuning(
      {
        columns: 40,
        attackMs: 6,
        releaseMs: 50,
        filled: true,
        strokeWidth: 3,
        fillOpacity: 0.4,
        accents: false,
      },
      'bars',
    );
    expect(tuning).toEqual({
      columns: 40,
      attackMs: 6,
      releaseMs: 50,
      filled: true,
      strokeWidth: 3,
      fillOpacity: 0.4,
      // Bars have no lit tips to switch on, so the stored answer is irrelevant.
      accents: false,
    });
  });

  it('pulls every number back inside its range from above', () => {
    const tuning = normalizeTuning(
      {
        columns: 100000,
        attackMs: 9000,
        releaseMs: 90000,
        strokeWidth: 99,
        fillOpacity: 8,
      },
      'bars',
    );
    expect(tuning.columns).toBe(MAX_GRAPH_COLUMNS);
    expect(tuning.attackMs).toBe(MAX_ATTACK_MS);
    expect(tuning.releaseMs).toBe(MAX_RELEASE_MS);
    expect(tuning.strokeWidth).toBe(MAX_STROKE_WIDTH);
    expect(tuning.fillOpacity).toBe(MAX_FILL_OPACITY);
  });

  it('pulls every number back inside its range from below', () => {
    // Zero and negatives are the interesting end: a column count of zero
    // divides by zero in the drawing loop, and a stroke width of zero is an
    // invisible curve that looks like the live output has stopped.
    const tuning = normalizeTuning(
      {
        columns: -12,
        attackMs: -40,
        releaseMs: 0,
        strokeWidth: 0,
        fillOpacity: -1,
      },
      'bars',
    );
    expect(tuning.columns).toBe(MIN_GRAPH_COLUMNS);
    expect(tuning.attackMs).toBe(MIN_ATTACK_MS);
    // Floored at the minimum, then held at the attack so it cannot be faster.
    expect(tuning.releaseMs).toBe(Math.max(MIN_RELEASE_MS, MIN_ATTACK_MS));
    expect(tuning.strokeWidth).toBe(MIN_STROKE_WIDTH);
    expect(tuning.fillOpacity).toBe(MIN_FILL_OPACITY);
  });

  it('falls back to the form defaults for anything that is not a number', () => {
    // Storage is a file a user can edit and an older build may have written
    // differently, so a string, a null and a NaN all have to land somewhere.
    const defaults = getDefaultTuning('ridge');
    const tuning = normalizeTuning(
      {
        columns: 'forty',
        attackMs: null,
        releaseMs: NaN,
        strokeWidth: undefined,
        fillOpacity: {},
        filled: 'yes',
      },
      'ridge',
    );
    expect(tuning).toEqual(defaults);
  });

  it('is complete even when handed nothing at all', () => {
    expect(normalizeTuning(undefined, 'line')).toEqual(
      getDefaultTuning('line'),
    );
    expect(normalizeTuning(null, 'line')).toEqual(getDefaultTuning('line'));
  });

  it('will not let the release be faster than the attack', () => {
    // The panel stops the sliders crossing; this is the backstop for a file
    // somebody edited by hand.
    const tuning = normalizeTuning({ attackMs: 50, releaseMs: 5 }, 'bars');
    expect(tuning.attackMs).toBe(50);
    expect(tuning.releaseMs).toBe(50);
  });

  it('refuses lit tips to a form that has none', () => {
    expect(normalizeTuning({ accents: true }, 'bars').accents).toBe(false);
    // And keeps them for the one form that does.
    expect(normalizeTuning({ accents: true }, 'stems').accents).toBe(true);
    expect(normalizeTuning({ accents: false }, 'stems').accents).toBe(false);
  });
});

describe('normalizeCustomLook', () => {
  it('reads back a look it wrote', () => {
    const look = draftOf('skyline');
    expect(normalizeCustomLook(look)).toEqual(look);
  });

  it.each([
    ['nothing', null],
    ['a string', 'bars'],
    ['a number', 7],
    ['an empty object', {}],
  ])('refuses %s', (_name, value) => {
    expect(normalizeCustomLook(value)).toBeNull();
  });

  it('refuses an id that is not one of ours', () => {
    // A built-in id in the custom list would give the picker two rows that
    // both claim to be "Bars" and select each other.
    expect(
      normalizeCustomLook({ ...draftOf(), id: 'bars-rainbow' }),
    ).toBeNull();
  });

  it('refuses a form this build does not have', () => {
    // The one thing that cannot be repaired by clamping: the geometry is the
    // look. A form removed in a later version takes its looks with it, and
    // they fall back like any unknown id rather than drawing nothing.
    expect(
      normalizeCustomLook({ ...draftOf(), style: 'holograph' }),
    ).toBeNull();
  });

  it('names an unnamed look after its form', () => {
    const look = normalizeCustomLook({ ...draftOf('skyline'), name: '   ' });
    expect(look?.name).toBe(GRAPH_STYLE_LABELS.skyline);
  });

  it('repairs a broken tuning rather than dropping the look', () => {
    // Losing somebody's saved look over one bad number is a worse outcome than
    // drawing it slightly differently from how they left it.
    const look = normalizeCustomLook({
      ...draftOf('bars'),
      tuning: { columns: -5, attackMs: 'fast' },
    });
    expect(look).not.toBeNull();
    expect(look?.tuning.columns).toBe(MIN_GRAPH_COLUMNS);
    expect(look?.tuning.attackMs).toBe(getDefaultTuning('bars').attackMs);
  });

  it('falls back to the signal palette for an unknown one', () => {
    expect(
      normalizeCustomLook({ ...draftOf(), palette: 'ultraviolet' })?.palette,
    ).toBe('signal');
  });
});

describe('normalizeLookName', () => {
  it('collapses the whitespace a pasted name arrives with', () => {
    // A name containing a newline renders as a blank row in the picker.
    expect(normalizeLookName('  My   bars \n look  ')).toBe('My bars look');
  });

  it('stops at a length the picker can show', () => {
    const name = normalizeLookName('x'.repeat(200));
    expect(name).toHaveLength(MAX_LOOK_NAME_LENGTH);
  });
});

describe('the stored list', () => {
  it('survives a file that is not JSON at all', () => {
    // Whatever is in storage after a crash or a downgrade, the graph still has
    // to draw. This never throws.
    expect(parseCustomLooks('{ not json')).toEqual([]);
    expect(parseCustomLooks('null')).toEqual([]);
    expect(parseCustomLooks('{"looks":[]}')).toEqual([]);
    expect(parseCustomLooks('')).toEqual([]);
    expect(parseCustomLooks(null)).toEqual([]);
  });

  it('round-trips', () => {
    const looks = [draftOf('bars'), draftOf('stems')];
    expect(parseCustomLooks(serializeCustomLooks(looks))).toEqual(looks);
  });

  it('drops the entries it cannot read and keeps the ones it can', () => {
    const good = draftOf('bars');
    const json = JSON.stringify([{ id: 'nonsense' }, good, null, 42]);
    expect(parseCustomLooks(json)).toEqual([good]);
  });

  it('keeps only the first of a repeated id', () => {
    const look = draftOf('bars');
    const clash = { ...draftOf('stems'), id: look.id };
    expect(parseCustomLooks(JSON.stringify([look, clash]))).toEqual([look]);
  });

  it('stops at the cap', () => {
    const many = Array.from({ length: MAX_CUSTOM_LOOKS + 20 }, () =>
      draftOf('bars'),
    );
    expect(parseCustomLooks(JSON.stringify(many))).toHaveLength(
      MAX_CUSTOM_LOOKS,
    );
  });
});

describe('ids', () => {
  it('marks its own and nobody else’s', () => {
    expect(isCustomLookId(createCustomLookId())).toBe(true);
    expect(isCustomLookId('bars')).toBe(false);
    expect(isCustomLookId('bars-rainbow')).toBe(false);
    expect(createCustomLookId().startsWith(CUSTOM_LOOK_PREFIX)).toBe(true);
  });

  it('does not repeat, even minted in one go', () => {
    const ids = Array.from({ length: 500 }, () => createCustomLookId());
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('rebaseDraftLook', () => {
  it('brings the new form’s own settings with it', () => {
    // Sixty-four columns of stems is not twenty-six of skyline, and a fill on
    // a form drawn as strokes is a different picture. Changing the form is a
    // change of geometry, so the numbers describing the old one go with it.
    const draft = draftOf('bars');
    const rebased = rebaseDraftLook(draft, 'skyline');
    expect(rebased.style).toBe('skyline');
    expect(rebased.tuning).toEqual(getDefaultTuning('skyline'));
  });

  it('keeps the name and the palette, which are not about the shape', () => {
    const draft = { ...draftOf('bars'), palette: 'rainbow' as const };
    const rebased = rebaseDraftLook(draft, 'ridge');
    expect(rebased.name).toBe(draft.name);
    expect(rebased.palette).toBe('rainbow');
    expect(rebased.id).toBe(draft.id);
  });

  it('does nothing at all when the form has not changed', () => {
    // Identity, not just equality: this runs on every dropdown change and a
    // fresh object would throw away an edit in progress.
    const draft = draftOf('bars');
    expect(rebaseDraftLook(draft, 'bars')).toBe(draft);
  });
});

describe('resolveCustomLook', () => {
  it('presents a saved look the same way the chart reads a built-in one', () => {
    const look = draftOf('bars');
    const resolved = resolveCustomLook(look);
    expect(resolved).toEqual({
      id: look.id,
      label: look.name,
      style: 'bars',
      palette: 'signal',
      tuning: look.tuning,
      isCustom: true,
    });
  });
});
