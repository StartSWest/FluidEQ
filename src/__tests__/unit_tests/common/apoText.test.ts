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

import { parseEqText } from '../../../common/apoText';
import {
  AutoEqFormat,
  FILTER_LINE_PREFIX_REGEX,
  FilterTypeEnum,
} from '../../../common/constants';

/**
 * Bands in frequency order.
 *
 * Deliberately not the map's own iteration order: filter ids come from uid(),
 * which occasionally produces an all-digit string, and JavaScript hoists
 * integer-like keys to the front of an object. Asserting on insertion order
 * therefore fails a few runs in a hundred for reasons that have nothing to do
 * with the parser.
 */
const bands = (text: string) =>
  Object.values(parseEqText(text).filters).sort(
    (left, right) => left.frequency - right.frequency,
  );

describe('parseEqText', () => {
  it('reads a preamp whether or not the unit is written', () => {
    // Requiring `dB` did not reject a bare number, which would at least have
    // been visible. It read 0 and reported a successful import, so a -19 dB
    // export arrived 19 dB too loud with nothing said.
    const band = 'Filter 1: ON PK Fc 60 Hz Gain 2.5 dB Q 2.5';

    expect(parseEqText(`Preamp: -19 dB\n${band}`).preAmp).toBe(-19);
    expect(parseEqText(`Preamp: -19.0 dB\n${band}`).preAmp).toBe(-19);
    expect(parseEqText(`Preamp: -19\n${band}`).preAmp).toBe(-19);
    expect(parseEqText(`Preamp:-19dB\n${band}`).preAmp).toBe(-19);
  });

  it('distinguishes a preamp of zero from no preamp at all', () => {
    // Both leave `preAmp` at 0, and the importer has to tell them apart: one is
    // a decision to keep, the other is a file that said nothing and should let
    // automatic normalization carry on.
    const band = 'Filter 1: ON PK Fc 60 Hz Gain 2.5 dB Q 2.5';

    expect(parseEqText(`Preamp: 0 dB\n${band}`).hasPreAmp).toBe(true);
    expect(parseEqText(band).hasPreAmp).toBe(false);
    expect(parseEqText(`Preamp: -19 dB\n${band}`).hasPreAmp).toBe(true);
  });

  it('reads the shapes AutoEQ writes', () => {
    const result = parseEqText(
      [
        'Preamp: -6.8 dB',
        'Filter 1: ON LSC Fc 105 Hz Gain 5.4 dB Q 0.7',
        'Filter 2: ON PK Fc 2200 Hz Gain -3.1 dB Q 1.41',
        'Filter 3: ON HSC Fc 10000 Hz Gain 2 dB Q 0.7',
      ].join('\r\n'),
    );

    expect(result.preAmp).toBe(-6.8);
    expect(result.eqFormat).toBe(AutoEqFormat.PARAMETRIC);
    const values = Object.values(result.filters).sort(
      (left, right) => left.frequency - right.frequency,
    );
    expect(values.map((f) => f.type)).toEqual([
      FilterTypeEnum.LSC,
      FilterTypeEnum.PK,
      FilterTypeEnum.HSC,
    ]);
    expect(values[1].frequency).toBe(2200);
    expect(values[1].gain).toBe(-3.1);
    expect(values[1].quality).toBeCloseTo(1.41, 2);
  });

  it('reads the pass and notch bands FluidEQ itself writes', () => {
    // These have no Gain token in APO's grammar. The AutoEQ reader drops them,
    // which would silently flatten half of a config FluidEQ produced.
    const values = bands(
      [
        'Filter 1: ON HPQ Fc 30 Hz Q 0.71',
        'Filter 2: ON BP Fc 1000 Hz Q 2',
        'Filter 3: ON NO Fc 6000 Hz Q 8',
        'Filter 4: ON LPQ Fc 16000 Hz Q 0.71',
      ].join('\n'),
    );

    expect(values.map((f) => f.type)).toEqual([
      FilterTypeEnum.HPQ,
      FilterTypeEnum.BP,
      FilterTypeEnum.NO,
      FilterTypeEnum.LPQ,
    ]);
    expect(values.map((f) => f.frequency)).toEqual([30, 1000, 6000, 16000]);
  });

  it('accepts the LS/HS aliases and skips disabled bands', () => {
    const values = bands(
      [
        'Filter 1: ON LS Fc 80 Hz Gain 3 dB Q 0.7',
        'Filter 2: OFF PK Fc 500 Hz Gain 9 dB Q 1',
        'Filter 3: ON HS Fc 8000 Hz Gain -2 dB Q 0.7',
      ].join('\n'),
    );

    expect(values).toHaveLength(2);
    expect(values.map((f) => f.type)).toEqual([
      FilterTypeEnum.LSC,
      FilterTypeEnum.HSC,
    ]);
  });

  it('reads a filter line whether or not it carries an index', () => {
    // OPRA writes `Filter: ON PK …` where Squig.link writes `Filter 2: ON PK …`
    // — APO ignores the index, so both are the same file. Requiring it dropped
    // every band of an OPRA paste while the preamp still parsed, so the import
    // reported success and drew a flat curve.
    const numbered = [
      'Preamp: -6 dB',
      'Filter 1: ON PK Fc 200 Hz Gain -1.4 dB Q 0.6',
      'Filter 2: ON PK Fc 4424 Hz Gain -1 dB Q 6',
    ].join('\n');
    const unnumbered = [
      'Preamp: -6 dB',
      'Filter: ON PK Fc 200 Hz Gain -1.4 dB Q 0.6',
      'Filter: ON PK Fc 4424 Hz Gain -1 dB Q 6',
    ].join('\n');

    const shape = (text: string) =>
      bands(text).map((band) => [
        band.type,
        band.frequency,
        band.gain,
        band.quality,
      ]);

    expect(shape(unnumbered)).toEqual([
      [FilterTypeEnum.PK, 200, -1.4, 0.6],
      [FilterTypeEnum.PK, 4424, -1, 6],
    ]);
    expect(shape(unnumbered)).toEqual(shape(numbered));
  });

  it('converts bandwidth in octaves to Q', () => {
    // One octave is Q ≈ 1.41. Reading the 1 as a Q directly would be a
    // noticeably wider band than the file asked for.
    const [band] = bands('Filter 1: ON PK Fc 1000 Hz Gain 3 dB BW Oct 1');
    expect(band.quality).toBeCloseTo(1.41, 1);
  });

  it('ignores the surrounding config a real APO file carries', () => {
    const result = parseEqText(
      [
        '# Generated by FluidEQ. Changes are overwritten automatically.',
        'Device: {2de2e800-7980-4b45-a318-34276fe3d3b4}',
        'Channel: all',
        'Convolution: fluideq-ir-abc123.wav',
        'Preamp: -3 dB',
        'Filter 1: ON PK Fc 1000 Hz Gain 4 dB Q 1',
        'Include: something-else.txt',
      ].join('\r\n'),
    );

    expect(Object.keys(result.filters)).toHaveLength(1);
    expect(result.preAmp).toBe(-3);
    expect(result.convolutionFileName).toBe('fluideq-ir-abc123.wav');
    expect(result.isEmpty).toBe(false);
  });

  it('projects GraphicEQ points onto editable bands', () => {
    const result = parseEqText('GraphicEQ: 20 -1.2; 25 -1.1; 31.5 -0.9');

    expect(result.eqFormat).toBe(AutoEqFormat.GRAPHIC);
    expect(result.graphicEq).toHaveLength(3);
    // The editor needs something to draw, so the points become peak bands.
    expect(Object.values(result.filters)).toHaveLength(3);
    expect(Object.values(result.filters)[0].type).toBe(FilterTypeEnum.PK);
  });

  it('reports a file with nothing in it rather than inventing an empty EQ', () => {
    const result = parseEqText('hello\nthis is not a config\n');
    expect(result.isEmpty).toBe(true);
  });

  it('counts bands it cannot represent instead of mangling them', () => {
    // The Butterworth and Linkwitz-Riley pass forms have no FluidEQ editor.
    // Turning one into the nearest peak band would change what the user hears
    // without telling them.
    //
    // The all-pass sits here as the control, because it used to be counted
    // among them and is now a type in its own right: a file mixing the two has
    // to keep the bands it can represent and refuse only the rest.
    const result = parseEqText(
      [
        'Filter 1: ON PK Fc 1000 Hz Gain 4 dB Q 1',
        'Filter 2: ON AP Fc 500 Hz Q 1',
        'Filter 3: ON BWLP Fc 12000 Hz',
        'Filter 4: ON LRHP Fc 80 Hz',
      ].join('\n'),
    );

    expect(Object.keys(result.filters)).toHaveLength(2);
    expect(result.unsupported).toBe(2);
  });
});

describe('FILTER_LINE_PREFIX_REGEX', () => {
  it('counts a band whether or not the line carries an index', () => {
    // The config inspector kept its own copy of this and still demanded the
    // index, so an OPRA-shaped or hand-written file showed as holding zero
    // bands in the tree while APO was applying every one of them.
    const lines = [
      'Filter: ON LS Fc 105.0 Hz Gain -2.8 dB Q 0.70',
      'Filter 1: ON PK Fc 20 Hz Gain -2.5 dB Q 0.700',
      'Filter  7 : ON HS Fc 10000 Hz Gain -5.3 dB Q 0.70',
      'filter: ON PK Fc 63.00 Hz Gain 0.4 dB Q 1.75',
    ];

    expect(lines.filter((line) => FILTER_LINE_PREFIX_REGEX.test(line))).toEqual(
      lines,
    );
  });

  it('does not count the other commands a config carries', () => {
    // A null test on its own cannot tell "matches nothing" from "matches
    // everything", so it sits beside the positive case above.
    const lines = [
      'Preamp: -5.4 dB',
      'Device: Speakers',
      'Include: eq.txt',
      'Convolution: room.wav',
      'GraphicEQ: 20 -2; 200 1',
      'Channel: L R',
      '# Filter: ON PK Fc 100 Hz Gain 1 dB Q 1',
    ];

    expect(lines.filter((line) => FILTER_LINE_PREFIX_REGEX.test(line))).toEqual(
      [],
    );
  });
});
