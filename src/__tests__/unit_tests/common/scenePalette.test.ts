import {
  isWholePaletteColours,
  MAX_PALETTE_STOPS,
  PALETTE_PRESET_IDS,
  PALETTE_PRESETS,
  PALETTE_TEXELS,
  paletteColourAt,
  paletteCss,
  paletteTexels,
  readPaletteValue,
  reversedPalette,
} from 'common/scenePalette';

// A scene's palette (contract 9): read forgivingly as every pack field is,
// checked strictly for its author, and turned into the texels a shader reads.

describe('reading a palette', () => {
  it('keeps two to eight colours in order, lower-cased, evenly spaced when not placed', () => {
    expect(readPaletteValue(['#FF0000', '#00ff00'], undefined)).toEqual({
      stops: ['#ff0000', '#00ff00'],
    });
  });

  it('drops what is not a colour, and the positions with it', () => {
    expect(
      readPaletteValue(['#ff0000', 'red', '#0000ff'], [0, 0.2, 1]),
    ).toEqual({ stops: ['#ff0000', '#0000ff'] });
  });

  it('is nothing with fewer than two colours', () => {
    expect(readPaletteValue(['#ff0000'], undefined)).toBeNull();
    expect(readPaletteValue('#ff0000', undefined)).toBeNull();
  });

  it('keeps eight colours of more', () => {
    const nine = Array.from({ length: 9 }, () => '#ffffff');
    expect(readPaletteValue(nine, undefined)?.stops).toHaveLength(
      MAX_PALETTE_STOPS,
    );
  });

  it('sorts placed stops by their places and says nothing of even spacing', () => {
    expect(
      readPaletteValue(['#000000', '#ffffff', '#ff0000'], [0.8, 0.1, 1]),
    ).toEqual({
      stops: ['#ffffff', '#000000', '#ff0000'],
      positions: [0.1, 0.8, 1],
    });
    expect(
      readPaletteValue(['#000000', '#ffffff', '#ff0000'], [0, 0.5, 1]),
    ).toEqual({ stops: ['#000000', '#ffffff', '#ff0000'] });
  });
});

describe("the author's check", () => {
  it('passes a whole palette and every stock one', () => {
    expect(isWholePaletteColours(['#000000', '#ffffff'], [0, 1])).toBe(true);
    PALETTE_PRESET_IDS.forEach((id) =>
      expect(isWholePaletteColours(PALETTE_PRESETS[id], undefined)).toBe(true),
    );
    expect(PALETTE_PRESET_IDS).toHaveLength(20);
  });

  it('names one stop, a bad colour, nine stops and positions out of order', () => {
    expect(isWholePaletteColours(['#000000'], undefined)).toBe(false);
    expect(isWholePaletteColours(['#000000', 'blue'], undefined)).toBe(false);
    expect(
      isWholePaletteColours(
        Array.from({ length: 9 }, () => '#000000'),
        undefined,
      ),
    ).toBe(false);
    expect(isWholePaletteColours(['#000000', '#ffffff'], [0.9, 0.1])).toBe(
      false,
    );
    expect(isWholePaletteColours(['#000000', '#ffffff'], [0])).toBe(false);
  });
});

describe('the gradient', () => {
  it('starts and ends exactly on the end colours', () => {
    const texels = paletteTexels({ stops: ['#ff0000', '#0000ff'] });
    expect(texels).toHaveLength(PALETTE_TEXELS * 4);
    expect([...texels.slice(0, 4)]).toEqual([255, 0, 0, 255]);
    expect([...texels.slice(-4)]).toEqual([0, 0, 255, 255]);
  });

  it('mixes perceptually: red to blue passes through a purple, not a mud', () => {
    const middle = paletteColourAt({ stops: ['#ff0000', '#0000ff'] }, 0.5);
    const [r, g, b] = [1, 3, 5].map((at) =>
      parseInt(middle.slice(at, at + 2), 16),
    );
    expect(r).toBeGreaterThan(100);
    expect(b).toBeGreaterThan(100);
    expect(g).toBeLessThan(r);
  });

  it('holds a placed stop where it was placed', () => {
    const value = {
      stops: ['#000000', '#ffffff', '#ffffff'],
      positions: [0, 0.2, 1],
    };
    expect(paletteColourAt(value, 0.2)).toBe('#ffffff');
    expect(paletteColourAt(value, 0.6)).toBe('#ffffff');
  });

  it("draws the Studio's strip from the same numbers", () => {
    const value = { stops: ['#ff3030', '#6b4cff'] };
    const css = paletteCss(value);
    expect(css.startsWith('linear-gradient(90deg, #ff3030 0.00%')).toBe(true);
    expect(css.endsWith('#6b4cff 100.00%)')).toBe(true);
  });
});

it('reverses a palette end to end, places and all', () => {
  expect(
    reversedPalette({
      stops: ['#000000', '#ffffff', '#ff0000'],
      positions: [0, 0.2, 1],
    }),
  ).toEqual({
    stops: ['#ff0000', '#ffffff', '#000000'],
    positions: [0, 0.8, 1],
  });
  expect(reversedPalette({ stops: ['#000000', '#ffffff'] })).toEqual({
    stops: ['#ffffff', '#000000'],
  });
});
