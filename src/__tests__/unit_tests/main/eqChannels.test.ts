import { stateToApoFiles } from 'main/flush';
import {
  FilterTypeEnum,
  getDefaultState,
  IFilter,
  IState,
} from 'common/constants';

/**
 * Left and right apart (Ivan, 2026-10-13, "EQ per channel"): what Your EQ's
 * layer file says for a band kept to one ear, under both engines — Equalizer
 * APO reads the `Channel:` lines as its own grammar, and the FluidEQ Engine
 * parses the same text (`config_channels_test.cpp` holds the engine to these
 * very lines).
 */

const band = (
  id: string,
  frequency: number,
  gain: number,
  channel?: 'left' | 'right',
): IFilter => ({
  id,
  frequency,
  gain,
  quality: 1,
  type: FilterTypeEnum.PK,
  ...(channel ? { channel } : {}),
});

const stateWith = (filters: IFilter[], channelsApart: boolean): IState => ({
  ...getDefaultState(),
  isFlat: false,
  isAutoPreAmpOn: true,
  filters: Object.fromEntries(filters.map((filter) => [filter.id, filter])),
  ...(channelsApart ? { channelsApart: true } : {}),
});

const eqLines = (state: IState) =>
  stateToApoFiles(state, undefined)?.features.find(
    (file) => file.feature === 'eq',
  )?.lines ?? [];

const preampOf = (state: IState) =>
  Number(
    /Preamp:\s*(-?[\d.]+)/i.exec(
      stateToApoFiles(state, undefined)?.preAmp ?? '',
    )?.[1] ?? 'NaN',
  );

describe('Your EQ with left and right apart', () => {
  const bands = [
    band('a', 100, 3),
    band('b', 5600, -2.5, 'left'),
    band('c', 3200, 2, 'right'),
  ];

  it('writes both ears first, each ear under its own line, then every channel', () => {
    expect(eqLines(stateWith(bands, true))).toEqual([
      'Channel: all',
      'Filter 1: ON PK Fc 100 Hz Gain 3 dB Q 1',
      'Channel: L',
      'Filter 2: ON PK Fc 5600 Hz Gain -2.5 dB Q 1',
      'Channel: R',
      'Filter 3: ON PK Fc 3200 Hz Gain 2 dB Q 1',
      'Channel: all',
    ]);
  });

  it('plays every band on both ears while linked, the sides kept unplayed', () => {
    // The control: the same bands, linked, are three plain lines.
    expect(eqLines(stateWith(bands, false))).toEqual([
      'Filter 1: ON PK Fc 100 Hz Gain 3 dB Q 1',
      'Filter 2: ON PK Fc 5600 Hz Gain -2.5 dB Q 1',
      'Filter 3: ON PK Fc 3200 Hz Gain 2 dB Q 1',
    ]);
  });

  it('writes no Channel line when no band is kept to an ear', () => {
    expect(
      eqLines(stateWith([band('a', 100, 3), band('b', 1000, 2)], true)),
    ).toEqual([
      'Filter 1: ON PK Fc 100 Hz Gain 3 dB Q 1',
      'Filter 2: ON PK Fc 1000 Hz Gain 2 dB Q 1',
    ]);
  });

  it('reserves the louder ear’s headroom, not both ears’ boosts summed', () => {
    // Two boosts at the same frequency, one per ear: each ear hears 6 dB.
    const apart = stateWith(
      [band('l', 1000, 6, 'left'), band('r', 1000, 6, 'right')],
      true,
    );
    // Linked, the same two bands are one ear's 12 dB: the positive control
    // that the preamp does sum what one ear actually hears.
    const linked = stateWith(
      [band('l', 1000, 6, 'left'), band('r', 1000, 6, 'right')],
      false,
    );
    const oneEar = stateWith([band('l', 1000, 6)], false);
    expect(preampOf(apart)).toBeCloseTo(preampOf(oneEar), 1);
    expect(preampOf(linked)).toBeLessThan(preampOf(apart) - 5);
  });
});
