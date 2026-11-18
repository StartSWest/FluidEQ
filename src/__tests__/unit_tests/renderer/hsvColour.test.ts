/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The colour picker's arithmetic (`ColourPickerPopover`, 2026-11-18): a hex
 * typed in any of its usual shapes, and the hue, saturation and value the
 * field and the hue bar stand at, there and back without a colour drifting.
 */

import { hexOfHsv, hsvOfHex, readHexColour } from 'renderer/utils/hsvColour';

describe('a hex as it is typed', () => {
  it('reads six digits or three, with or without the hash, in any case', () => {
    expect(readHexColour('#FF8800')).toBe('#ff8800');
    expect(readHexColour('ff8800')).toBe('#ff8800');
    expect(readHexColour(' #f80 ')).toBe('#ff8800');
  });

  it('refuses anything else', () => {
    ['', '#ff88', '#ff88001', 'orange', '#gg0000'].forEach((text) =>
      expect([text, readHexColour(text)]).toEqual([text, undefined]),
    );
  });
});

describe('hue, saturation and value', () => {
  it('stand where the primaries and the greys put them', () => {
    expect(hsvOfHex('#ff0000')).toEqual({ h: 0, s: 1, v: 1 });
    expect(hsvOfHex('#00ff00')).toEqual({ h: 120, s: 1, v: 1 });
    expect(hsvOfHex('#0000ff')).toEqual({ h: 240, s: 1, v: 1 });
    expect(hsvOfHex('#000000')).toEqual({ h: 0, s: 0, v: 0 });
    expect(hsvOfHex('#808080').s).toBe(0);
  });

  it('go there and back to the same colour', () => {
    [
      '#000000',
      '#ffffff',
      '#ff8800',
      '#1d3a33',
      '#f3a6e5',
      '#3f7fd0',
      '#7dffb0',
      '#123456',
      '#fe01fd',
    ].forEach((hex) => {
      expect([hex, hexOfHsv(hsvOfHex(hex))]).toEqual([hex, hex]);
    });
  });

  it('wrap a hue past a full turn', () => {
    expect(hexOfHsv({ h: 360, s: 1, v: 1 })).toBe('#ff0000');
    expect(hexOfHsv({ h: -120, s: 1, v: 1 })).toBe('#0000ff');
  });
});
