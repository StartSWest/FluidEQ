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
  GRAPH_STYLES,
  GRAPH_STYLE_LABELS,
  GraphStyle,
  MAX_GRAPH_COLUMNS,
  MIN_GRAPH_COLUMNS,
  getGraphBallistics,
  getGraphColumnCount,
  isFilledGraphStyle,
} from 'common/graphStyles';
import { ACCENT_STYLES, hasGraphAccent } from 'common/graphShapes';
import {
  CUSTOM_LOOK_PREFIX,
  DEFAULT_ACCENT_WIDTH,
  DEFAULT_BORDER_WIDTH,
  DEFAULT_GLOW,
  DEFAULT_LEVEL_COLOURS,
  ICustomLook,
  ILookTuning,
  MIN_BAR_GAP,
  MAX_BAR_GAP,
  MIN_ACCENT_WIDTH,
  MAX_ACCENT_WIDTH,
  MIN_BORDER_WIDTH,
  MAX_BORDER_WIDTH,
  getMaxLookColours,
  MAX_ATTACK_MS,
  MAX_LOOK_COLOURS,
  MAX_CUSTOM_LOOKS,
  MAX_FILL_OPACITY,
  MAX_LOOK_NAME_LENGTH,
  MAX_RELEASE_MS,
  MAX_STROKE_WIDTH,
  MIN_ATTACK_MS,
  MIN_FILL_OPACITY,
  MIN_GLOW,
  MAX_GLOW,
  MIN_RELEASE_MS,
  MIN_STROKE_WIDTH,
  createCustomLookId,
  createDraftLook,
  getDefaultPaletteColours,
  getDefaultTuning,
  isCustomLookId,
  isLookColour,
  normalizeCustomLook,
  normalizeLookColours,
  LOOK_FILE_SCHEMA,
  parseLookFile,
  serializeLookFile,
  toLookFileName,
  normalizeLookName,
  normalizeTuning,
  parseCustomLooks,
  rebaseDraftLook,
  recolourDraftLook,
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
        gap: 0.2,
        accents: false,
        accentWidth: DEFAULT_ACCENT_WIDTH,
        accentStyle: 'bead',
        glow: 0.5,
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
      gap: 0.2,
      accents: false,
      accentWidth: DEFAULT_ACCENT_WIDTH,
      accentStyle: 'bead',
      glow: 0.5,
      border: false,
      borderWidth: DEFAULT_BORDER_WIDTH,
    });
  });

  it('leaves the euphoria border off unless it is asked for', () => {
    // It decorates the window rather than the drawing, and a frame nobody chose
    // is furniture.
    expect(getDefaultTuning('bars').border).toBe(false);
    expect(normalizeTuning({ border: true }, 'bars').border).toBe(true);
    expect(normalizeTuning({ border: 'yes' }, 'bars').border).toBe(false);
  });

  it('lets the glow be turned off entirely', () => {
    // Zero has to survive, because it is the setting somebody reaches for when
    // the halo is softening a drawing they wanted sharp — and a floor above it
    // would make that unreachable.
    expect(normalizeTuning({ glow: 0 }, 'bars').glow).toBe(0);
    expect(normalizeTuning({ glow: -3 }, 'bars').glow).toBe(MIN_GLOW);
    expect(normalizeTuning({ glow: 9 }, 'bars').glow).toBe(MAX_GLOW);
  });

  it('keeps the glow low by default, so the figure stays sharp', () => {
    // A drawing read through its own light is not a drawing you can read.
    expect(getDefaultTuning('bars').glow).toBe(DEFAULT_GLOW);
    expect(DEFAULT_GLOW).toBeLessThan(0.5);
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

  it('lets any form be asked for lit peaks, and keeps the answer', () => {
    // This used to refuse them to everything but the stem, which was right
    // when there was one lit-peak drawing and it was a bead on a stalk. There
    // are ten behaviours now and they suit different families, so which form
    // is asking is no longer a reason to say no — the form only decides which
    // behaviour it starts with.
    expect(normalizeTuning({ accents: true }, 'bars').accents).toBe(true);
    expect(normalizeTuning({ accents: false }, 'bars').accents).toBe(false);
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
      colours: [],
      isCustom: true,
    });
  });
});

describe('palette colours', () => {
  it('leaves the palettes that already have colours alone', () => {
    // Empty is not "no colours" — it is "the ones already on screen". Signal
    // keeps taking the curve's own colour and rainbow keeps painting from the
    // chart's full-spectrum gradient, so every look that shipped before any of
    // this existed draws exactly as it did.
    expect(getDefaultPaletteColours('signal')).toEqual([]);
    expect(getDefaultPaletteColours('rainbow')).toEqual([]);
  });

  it('gives the level palette a ramp of its own', () => {
    // The one palette with nothing existing to point at, so it carries stops.
    const colours = getDefaultPaletteColours('level');
    expect(colours).toEqual(DEFAULT_LEVEL_COLOURS);
    expect(colours.length).toBeGreaterThan(1);
  });

  it('ends the level ramp on red, because that is what loud means', () => {
    // Not decoration. The whole reason the palette reads without explanation is
    // that it ends where every level meter ever built ends.
    const [red, green, blue] = (
      DEFAULT_LEVEL_COLOURS[DEFAULT_LEVEL_COLOURS.length - 1].match(
        /[\da-f]{2}/gi,
      ) ?? []
    ).map((pair) => parseInt(pair, 16));
    expect(red).toBeGreaterThan(green);
    expect(red).toBeGreaterThan(blue);
  });

  it('hands back a copy, so a look cannot edit the defaults', () => {
    const first = getDefaultPaletteColours('level');
    first.push('#000000');
    expect(getDefaultPaletteColours('level')).toEqual(DEFAULT_LEVEL_COLOURS);
  });

  it('accepts the hex a colour input actually emits', () => {
    expect(isLookColour('#ff4f4f')).toBe(true);
    expect(isLookColour('#FFF')).toBe(true);
    // A native colour input speaks hex and nothing else, and an `rgb()` string
    // handed to one silently shows black.
    expect(isLookColour('rgb(255, 0, 0)')).toBe(false);
    expect(isLookColour('red')).toBe(false);
    expect(isLookColour('#12345')).toBe(false);
    expect(isLookColour('')).toBe(false);
    expect(isLookColour(null)).toBe(false);
  });
});

describe('normalizeLookColours', () => {
  it('keeps a readable ramp, lowercased', () => {
    expect(normalizeLookColours(['#FF0000', ' #00ff00 '], 'level')).toEqual([
      '#ff0000',
      '#00ff00',
    ]);
  });

  it('drops what it cannot read rather than guessing at it', () => {
    // There is no sensible "nearest colour" to a value that is not one.
    expect(
      normalizeLookColours(['#ff0000', 'chartreuse', 42, null], 'level'),
    ).toEqual(['#ff0000']);
  });

  it('falls back to the palette when nothing is usable', () => {
    // Losing a look to a bad colour is worse than drawing it in the default.
    expect(normalizeLookColours(['nonsense'], 'level')).toEqual(
      DEFAULT_LEVEL_COLOURS,
    );
    expect(normalizeLookColours([], 'rainbow')).toEqual([]);
    expect(normalizeLookColours('not an array', 'level')).toEqual(
      DEFAULT_LEVEL_COLOURS,
    );
  });

  it('stops at the most stops the eye can separate', () => {
    const many = Array.from({ length: MAX_LOOK_COLOURS + 5 }, () => '#123456');
    expect(normalizeLookColours(many, 'level')).toHaveLength(MAX_LOOK_COLOURS);
  });
});

describe('recolourDraftLook', () => {
  it('takes the new palette’s colours rather than carrying the old ones', () => {
    // Four colours running quiet-to-loud up the decibel axis are not four
    // colours running bass-to-treble across the frequency axis. Carried over,
    // a level ramp would silently start reading as a spectrum.
    const level = { ...draftOf('bars'), palette: 'level' as const };
    const coloured = { ...level, colours: ['#111111', '#222222'] };
    const rebased = recolourDraftLook(coloured, 'rainbow');
    expect(rebased.palette).toBe('rainbow');
    expect(rebased.colours).toEqual([]);
  });

  it('leaves the form and its tuning completely alone', () => {
    // A change of colouring, not of shape.
    const draft = draftOf('skyline');
    const rebased = recolourDraftLook(draft, 'level');
    expect(rebased.style).toBe('skyline');
    expect(rebased.tuning).toEqual(draft.tuning);
    expect(rebased.name).toBe(draft.name);
  });

  it('does nothing at all when the palette has not changed', () => {
    // Identity: this runs on every press of the palette buttons, and a fresh
    // object would throw away an edit in progress.
    const draft = draftOf('bars');
    expect(recolourDraftLook(draft, draft.palette)).toBe(draft);
  });
});

describe('the look file', () => {
  it('round-trips a look through a file', () => {
    const look = draftOf('skyline');
    expect(parseLookFile(serializeLookFile([look]))).toEqual([look]);
  });

  it('carries a version, so a later shape is not guessed at', () => {
    const file = JSON.parse(serializeLookFile([draftOf()]));
    expect(file.schema).toBe(LOOK_FILE_SCHEMA);
    expect(file.app).toBe('FluidEQ');
  });

  it('declines a file written by a newer build', () => {
    // Importing the parts that still happen to parse would leave somebody with
    // a look that quietly lost whatever the new version added.
    const file = JSON.parse(serializeLookFile([draftOf()]));
    file.schema = LOOK_FILE_SCHEMA + 1;
    expect(parseLookFile(JSON.stringify(file))).toEqual([]);
  });

  it('survives being handed something that is not a look file at all', () => {
    // This is a file chosen off a disk by a person, and is as likely to be a
    // screenshot they misclicked. Never throws.
    expect(parseLookFile('')).toEqual([]);
    expect(parseLookFile('not json')).toEqual([]);
    expect(parseLookFile('[]')).toEqual([]);
    expect(parseLookFile('{"schema":1}')).toEqual([]);
    expect(parseLookFile('{"looks":[]}')).toEqual([]);
    expect(parseLookFile(JSON.stringify({ schema: 1, looks: 'nope' }))).toEqual(
      [],
    );
  });

  it('validates every look in it exactly as the stored list is', () => {
    // A file is no more trustworthy than local storage; it is rather less.
    const json = JSON.stringify({
      schema: LOOK_FILE_SCHEMA,
      looks: [
        { ...draftOf('bars'), tuning: { columns: -9, glow: 40 } },
        { id: 'not-ours', style: 'bars' },
      ],
    });
    const looks = parseLookFile(json);
    expect(looks).toHaveLength(1);
    expect(looks[0].tuning.columns).toBe(MIN_GRAPH_COLUMNS);
    expect(looks[0].tuning.glow).toBe(MAX_GLOW);
  });

  it('names the file after the look, safely on any platform', () => {
    expect(toLookFileName('My Bars!')).toBe('my-bars.fluideq-look.json');
    expect(toLookFileName('  ///  ')).toBe('look.fluideq-look.json');
  });
});

describe('every stored setting is validated', () => {
  // The stored list, a look file and a resumed draft all arrive through
  // `normalizeCustomLook`, so this is the one gate a bad value has to pass. A
  // field added to the tuning without a rule here is a field a hand-edited file
  // can set to anything at all.
  const NUMERIC: [keyof ILookTuning, number, number][] = [
    ['columns', MIN_GRAPH_COLUMNS, MAX_GRAPH_COLUMNS],
    ['attackMs', MIN_ATTACK_MS, MAX_ATTACK_MS],
    ['releaseMs', MIN_RELEASE_MS, MAX_RELEASE_MS],
    ['strokeWidth', MIN_STROKE_WIDTH, MAX_STROKE_WIDTH],
    ['fillOpacity', MIN_FILL_OPACITY, MAX_FILL_OPACITY],
    ['glow', MIN_GLOW, MAX_GLOW],
    ['borderWidth', MIN_BORDER_WIDTH, MAX_BORDER_WIDTH],
    ['gap', MIN_BAR_GAP, MAX_BAR_GAP],
    ['accentWidth', MIN_ACCENT_WIDTH, MAX_ACCENT_WIDTH],
  ];

  it.each(NUMERIC)('clamps %s to its range', (key, min, max) => {
    expect(normalizeTuning({ [key]: -99999 }, 'bars')[key]).toBe(min);
    expect(normalizeTuning({ [key]: 99999 }, 'bars')[key]).toBe(max);
  });

  it.each(NUMERIC)('refuses a non-number for %s', (key) => {
    const fallback = getDefaultTuning('bars')[key];
    ['', 'loud', null, undefined, NaN, Infinity, {}, []].forEach((value) => {
      expect(normalizeTuning({ [key]: value }, 'bars')[key]).toBe(fallback);
    });
  });

  it.each(['filled', 'accents', 'border'] as (keyof ILookTuning)[])(
    'refuses a non-boolean for %s',
    (key) => {
      // A form with no lit tips answers false whatever is asked, so the check
      // is that nothing here ever produces a non-boolean.
      ['yes', 1, 0, null, {}].forEach((value) => {
        expect(typeof normalizeTuning({ [key]: value }, 'stems')[key]).toBe(
          'boolean',
        );
      });
    },
  );

  it('refuses a lit-peak behaviour it does not have', () => {
    // It is written to disk as a string, so a hand-edited file or a look
    // saved by a later build can name one this build has never drawn. Falling
    // through to the form's own default is what keeps that a stale setting
    // rather than a blank accent.
    expect(normalizeTuning({ accentStyle: 'bead' }, 'stems').accentStyle).toBe(
      'bead',
    );
    expect(
      ACCENT_STYLES.includes(
        normalizeTuning({ accentStyle: 'from-the-future' }, 'stems')
          .accentStyle,
      ),
    ).toBe(true);
    expect(
      ACCENT_STYLES.includes(
        normalizeTuning({ accentStyle: 7 }, 'stems').accentStyle,
      ),
    ).toBe(true);
  });

  it('covers every field of the tuning', () => {
    // The guard against adding a setting and forgetting to validate it: the
    // rules above plus the booleans have to account for the whole shape.
    const covered = new Set([
      ...NUMERIC.map(([key]) => key),
      'filled',
      'accents',
      'border',
      // Neither a number nor a boolean: one of a fixed list of behaviours,
      // checked by the test below rather than by the tables above.
      'accentStyle',
    ]);
    Object.keys(getDefaultTuning('bars')).forEach((key) => {
      expect(covered.has(key)).toBe(true);
    });
  });

  it('holds a flat look to a single colour', () => {
    // A flat fill has no axis to run a ramp along, so a second stop is not an
    // option that does nothing — it is not an option. Stored ones are trimmed
    // so an old look, or a hand-edited file, cannot smuggle one in.
    expect(getMaxLookColours('signal')).toBe(1);
    expect(
      normalizeLookColours(['#111111', '#222222', '#333333'], 'signal'),
    ).toEqual(['#111111']);
    expect(normalizeLookColours(['#111111', '#222222'], 'level')).toHaveLength(
      2,
    );
  });
});
