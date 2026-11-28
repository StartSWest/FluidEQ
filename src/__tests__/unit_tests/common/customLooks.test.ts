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
  GraphPalette,
  GraphStyle,
  MAX_GRAPH_COLUMNS,
  MIN_GRAPH_COLUMNS,
  getGraphBallistics,
  getGraphColumnCount,
  isFilledGraphStyle,
} from 'common/graphStyles';
import { ACCENT_STYLES, hasGraphAccent } from 'common/graphShapes';
import type { ILookStop } from 'common/lookGradient';
import {
  MAX_PATTERN_SIZE,
  MAX_TEXTURE_SIZE,
  MIN_PATTERN_SIZE,
  MIN_TEXTURE_SIZE,
} from 'common/graphTextures';
import { DEFAULT_GRAPH_TILT, isGraphTilt } from 'common/graphAnalysis';
import {
  CUSTOM_LOOK_PREFIX,
  DEFAULT_ACCENT_WIDTH,
  DEFAULT_BORDER_WIDTH,
  DEFAULT_GLOW,
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
  lookToKeep,
  rebaseDraftLook,
  recolourDraftLook,
  resolveCustomLook,
  withLookStops,
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
      accentFilled: true,
      connectingLine: false,
      accentBehind: false,
      accentWidth: DEFAULT_ACCENT_WIDTH,
      accentStyle: 'bead',
      glow: 0.5,
      border: false,
      borderWidth: DEFAULT_BORDER_WIDTH,
      texture: 'none',
      textureImage: undefined,
      textureFit: 'tile',
      textureSize: 192,
      patternSize: 16,
      textureMotion: false,
      channels: 'joined',
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

  it('keeps a look saved before a setting existed', () => {
    /**
     * THE GUARD AGAINST LOSING SOMEBODY'S WORK TO A NEW SLIDER.
     *
     * Every setting added to the tuning is a field a look saved yesterday
     * does not have, and the cheapest possible mistake is a validator that
     * treats "absent" as "invalid" and drops the whole look — silently, on
     * launch, with no way back. This is a look written before the texture,
     * the channels and the slope rows existed: it has to come back whole,
     * with the new fields at their defaults and everything the person
     * actually chose untouched.
     */
    const old = JSON.stringify([
      {
        // A real stored id: the prefix is what marks a look as the user's.
        id: 'custom:older-build-1',
        name: 'From an older build',
        style: 'analyzer',
        palette: 'level',
        colours: ['#112233', '#445566'],
        tuning: {
          columns: 40,
          attackMs: 6,
          releaseMs: 200,
          filled: true,
          strokeWidth: 3,
          fillOpacity: 0.4,
          gap: 0.2,
          accents: false,
          glow: 0.5,
        },
      },
    ]);
    const [look] = parseCustomLooks(old);
    expect(look).toBeDefined();
    expect(look.name).toBe('From an older build');
    expect(look.style).toBe('analyzer');
    expect(look.colours).toEqual(['#112233', '#445566']);
    expect(look.tuning.columns).toBe(40);
    expect(look.tuning.releaseMs).toBe(200);
    expect(look.tuning.fillOpacity).toBe(0.4);
    // The rows it never saw, at the values a fresh look starts with.
    expect(look.tuning.texture).toBe('none');
    expect(look.tuning.textureImage).toBeUndefined();
    expect(look.tuning.channels).toBe('joined');
    // The slope is the graph's since 2026-11-16, never a look's.
    expect(look.tuning).not.toHaveProperty('tilt');
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
  it("hands no look colours of its own, so every palette follows the window's", () => {
    // Empty means the window's colours — Normal mode's primary and secondary,
    // Rainbow mode's palette. Level and heat were handed cyan-to-red, which
    // froze them out of every theme and every visualizer's colours.
    (['auto', 'signal', 'rainbow', 'level', 'heat'] as const).forEach(
      (palette) => {
        expect(createDraftLook('ledbars', palette).colours).toEqual([]);
      },
    );
  });

  it('gives a saved look the four colours it was handed back to the window', () => {
    // Those four were written into every level and heat look nobody coloured.
    expect(
      normalizeLookColours(
        ['#00e5cf', '#54ff8a', '#ffcc4d', '#ff4f4f'],
        'level',
      ),
    ).toEqual([]);
    // The control: the same four in another order are somebody's choice.
    expect(
      normalizeLookColours(
        ['#ff4f4f', '#ffcc4d', '#54ff8a', '#00e5cf'],
        'level',
      ),
    ).toEqual(['#ff4f4f', '#ffcc4d', '#54ff8a', '#00e5cf']);
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

  it("falls back to the window's colours when nothing is usable", () => {
    // Losing a look to a bad colour is worse than drawing it in the window's.
    expect(normalizeLookColours(['nonsense'], 'level')).toEqual([]);
    expect(normalizeLookColours([], 'rainbow')).toEqual([]);
    expect(normalizeLookColours('not an array', 'level')).toEqual([]);
  });

  it('stops at the most stops the eye can separate', () => {
    const many = Array.from({ length: MAX_LOOK_COLOURS + 5 }, () => '#123456');
    expect(normalizeLookColours(many, 'level')).toHaveLength(MAX_LOOK_COLOURS);
  });
});

describe('recolourDraftLook', () => {
  // Three points somebody placed by hand: nowhere a seed would put them.
  const PICKED: ILookStop[] = [
    { colour: '#1a2b3c', at: 0 },
    { colour: '#f0a020', at: 0.35 },
    { colour: '#e0e0ff', at: 1 },
  ];
  const picked = (palette: GraphPalette, style: GraphStyle = 'bars') =>
    withLookStops({ ...createDraftLook(style, palette, 'Mine') }, PICKED);

  it("keeps the member's gradient through every Colour by, Flat included", () => {
    // Session 0, 2026-11-28: picking a gradient and choosing what it runs
    // along are two decisions, and the second used to throw the first away.
    const start = picked('rainbow');
    const steps: GraphPalette[] = ['level', 'heat', 'signal', 'rainbow'];
    let draft = start;
    steps.forEach((palette) => {
      draft = recolourDraftLook(draft, palette);
      expect(draft.palette).toBe(palette);
      expect(draft.stops).toEqual(PICKED);
    });
    // Back on a gradient, it is the look it was, colour for colour.
    expect(draft).toEqual(start);
    expect(resolveCustomLook(draft).colours).toEqual(
      resolveCustomLook(start).colours,
    );
  });

  it('draws Flat in the gradient’s first colour, and saves only that', () => {
    const flat = recolourDraftLook(picked('heat'), 'signal');
    expect(flat.colours).toEqual(['#1a2b3c']);
    // The drawing sees one colour, not the gradient held beside it.
    expect(resolveCustomLook(flat).colours).toEqual(['#1a2b3c']);
    // What is kept of it is the colour; the gradient was the editor's.
    const kept = lookToKeep(flat);
    expect(kept.stops).toBeUndefined();
    expect(normalizeCustomLook(JSON.parse(JSON.stringify(kept)))).toEqual(kept);
    // Control: a gradient look keeps its points when it is kept.
    const gradient = picked('level');
    expect(lookToKeep(gradient)).toBe(gradient);
  });

  it('keeps a flat colour picked over the gradient, and the gradient under it', () => {
    const flat = {
      ...recolourDraftLook(picked('level'), 'signal'),
      colours: ['#00ff00'],
    };
    expect(resolveCustomLook(flat).colours).toEqual(['#00ff00']);
    expect(recolourDraftLook(flat, 'level').stops).toEqual(PICKED);
  });

  it('keeps it under Auto, on a form Auto paints flat and back', () => {
    // Bars under Auto are a frequency gradient, an oscilloscope one colour.
    const auto = recolourDraftLook(picked('rainbow'), 'auto');
    expect(auto.stops).toEqual(PICKED);
    expect(resolveCustomLook(auto).colours).toEqual(
      resolveCustomLook(picked('rainbow')).colours,
    );
    const onScope = rebaseDraftLook(auto, 'scope');
    expect(onScope.stops).toEqual(PICKED);
    expect(resolveCustomLook(onScope).colours).toEqual(['#1a2b3c']);
    const backOnBars = rebaseDraftLook(onScope, 'bars');
    expect(backOnBars.stops).toEqual(PICKED);
    expect(backOnBars.colours).toEqual(auto.colours);
    // Saved there with a colour of its own, it reads back as that colour:
    // the points would otherwise rewrite `colours` from themselves.
    const stored = normalizeCustomLook(
      JSON.parse(JSON.stringify({ ...onScope, colours: ['#00ff00'] })),
    );
    expect(stored?.colours).toEqual(['#00ff00']);
    expect(stored?.stops).toBeUndefined();
  });

  it('brings back a gradient saved before points, drawn as it was', () => {
    const legacy = {
      ...createDraftLook('bars', 'level'),
      colours: ['#111111', '#777777', '#eeeeee'],
    };
    const back = recolourDraftLook(recolourDraftLook(legacy, 'signal'), 'heat');
    expect(resolveCustomLook(back).colours).toEqual(legacy.colours);
  });

  it('still follows the window colours on a look whose colours were never touched', () => {
    // The control for all of the above: nothing of the member's to keep, so
    // every palette seeds from the window's set as before.
    let draft = createDraftLook('bars', 'signal');
    (['rainbow', 'level', 'heat', 'signal', 'auto'] as const).forEach(
      (palette) => {
        draft = recolourDraftLook(draft, palette);
        expect(draft.colours).toEqual([]);
        expect(draft.stops).toBeUndefined();
      },
    );
    // A flat colour is not stretched into a gradient of one.
    const coloured = {
      ...createDraftLook('bars', 'signal'),
      colours: ['#123456'],
    };
    expect(recolourDraftLook(coloured, 'rainbow').colours).toEqual([]);
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
    ['textureSize', MIN_TEXTURE_SIZE, MAX_TEXTURE_SIZE],
    ['patternSize', MIN_PATTERN_SIZE, MAX_PATTERN_SIZE],
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

  it.each([
    'filled',
    'accents',
    'accentFilled',
    'accentBehind',
    'border',
    'textureMotion',
  ] as (keyof ILookTuning)[])('refuses a non-boolean for %s', (key) => {
    // A form with no lit tips answers false whatever is asked, so the check
    // is that nothing here ever produces a non-boolean.
    ['yes', 1, 0, null, {}].forEach((value) => {
      expect(typeof normalizeTuning({ [key]: value }, 'stems')[key]).toBe(
        'boolean',
      );
    });
  });

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

  it('refuses a fill pattern it does not have', () => {
    expect(normalizeTuning({ texture: 'scales' }, 'bars').texture).toBe(
      'scales',
    );
    expect(normalizeTuning({ texture: 'plaid' }, 'bars').texture).toBe('none');
    expect(normalizeTuning({ texture: 4 }, 'bars').texture).toBe('none');
  });

  it('keeps only a picture this app wrote', () => {
    // The stored string reaches an `Image` element, so anything that is not
    // one of our own data URIs is dropped rather than loaded: a look file is
    // shareable, and a look somebody was sent must not be able to name a
    // remote address for the app to fetch.
    const tile = `data:image/webp;base64,${'A'.repeat(64)}`;
    expect(normalizeTuning({ textureImage: tile }, 'bars').textureImage).toBe(
      tile,
    );
    expect(
      normalizeTuning({ textureImage: 'https://example.com/a.png' }, 'bars')
        .textureImage,
    ).toBeUndefined();
    expect(
      normalizeTuning({ textureImage: 'data:text/html;base64,AAAA' }, 'bars')
        .textureImage,
    ).toBeUndefined();
    // Longer than a look may carry: the browser store holds every look in it.
    expect(
      normalizeTuning(
        { textureImage: `data:image/png;base64,${'A'.repeat(200000)}` },
        'bars',
      ).textureImage,
    ).toBeUndefined();
  });

  it('draws one figure unless two were asked for', () => {
    expect(normalizeTuning({}, 'bars').channels).toBe('joined');
    expect(normalizeTuning({ channels: 'split' }, 'bars').channels).toBe(
      'split',
    );
    expect(normalizeTuning({ channels: 'quad' }, 'bars').channels).toBe(
      'joined',
    );
  });

  // The analyser's slope moved out of each look into one graph-wide choice in
  // the View menu on 2026-11-16, where people could find it.
  it('reads a look saved with a slope without it', () => {
    expect(normalizeTuning({ tilt: 4.5 }, 'analyzer')).not.toHaveProperty(
      'tilt',
    );
    expect(getDefaultTuning('analyzer')).not.toHaveProperty('tilt');
    // POSITIVE CONTROL: the same reading keeps a field the tuning does have.
    expect(normalizeTuning({ columns: 40 }, 'analyzer').columns).toBe(40);
  });

  it('offers only the graph-wide slopes, off unless asked for', () => {
    expect(isGraphTilt(4.5)).toBe(true);
    expect(isGraphTilt(99)).toBe(false);
    expect(isGraphTilt(-3)).toBe(false);
    // This app is not a mastering tool: the untilted picture is the one a
    // listener expects to see.
    expect(DEFAULT_GRAPH_TILT).toBe(0);
  });

  it('covers every field of the tuning', () => {
    // The guard against adding a setting and forgetting to validate it: the
    // rules above plus the booleans have to account for the whole shape.
    const covered = new Set([
      ...NUMERIC.map(([key]) => key),
      'filled',
      'connectingLine',
      'accents',
      'accentFilled',
      'accentBehind',
      'border',
      // Whether the texture moves with the music (textureMotion.test.ts).
      'textureMotion',
      // Neither a number nor a boolean: one of a fixed list of behaviours,
      // checked by the test below rather than by the tables above.
      'accentStyle',
      // Likewise fixed lists, with their own tests below: the pattern inside
      // a fill, the picture behind the pattern, and one figure or two.
      'texture',
      'textureImage',
      // How a picture lies (customLooksTextureFit.test.ts).
      'textureFit',
      'channels',
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
