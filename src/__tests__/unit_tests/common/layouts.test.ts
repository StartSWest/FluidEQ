import {
  adaptLayoutSnapshot,
  adaptLayoutToFixedFrequencies,
  getFixedBandSizeForCount,
} from '../../../common/layouts';
import {
  FIXED_BAND_FREQUENCIES,
  FilterTypeEnum,
  FixedBandSizeEnum,
} from '../../../common/constants';

const band = (frequency: number, gain = 0) => ({
  frequency,
  gain,
  quality: 1,
  type: FilterTypeEnum.PK,
});

describe('layout frequency preservation', () => {
  it('detects fixed layouts by their band count', () => {
    expect(getFixedBandSizeForCount(6)).toBe(FixedBandSizeEnum.SIX);
    expect(getFixedBandSizeForCount(31)).toBe(FixedBandSizeEnum.THIRTY_ONE);
    expect(getFixedBandSizeForCount(7)).toBeUndefined();
  });

  it('keeps representative high-resolution bands when reducing a layout', () => {
    const source = Array.from({ length: 31 }, (_value, index) =>
      band(20 + index * 660, index),
    );
    const result = adaptLayoutSnapshot(source, FixedBandSizeEnum.SIX);

    expect(result).toHaveLength(6);
    expect(result.map(({ frequency }) => frequency)).toEqual([
      20, 3980, 7940, 11900, 15860, 19820,
    ]);
  });

  it('preserves the current bands and fills new resolution with neutral bands', () => {
    const source = [100, 500, 2000].map((frequency, index) =>
      band(frequency, index + 1),
    );
    const result = adaptLayoutSnapshot(source, FixedBandSizeEnum.SIX);

    expect(result).toHaveLength(6);
    source.forEach((savedBand) => {
      expect(result).toContainEqual(savedBand);
    });
  });

  it("maps adapted tuning values onto each layout's predefined frequencies", () => {
    const source = FIXED_BAND_FREQUENCIES[FixedBandSizeEnum.TEN].map(
      (frequency, index) => band(frequency, index + 1),
    );

    const result = adaptLayoutToFixedFrequencies(source, FixedBandSizeEnum.SIX);

    expect(result.map(({ frequency }) => frequency)).toEqual(
      FIXED_BAND_FREQUENCIES[FixedBandSizeEnum.SIX],
    );
    expect(result.map(({ gain }) => gain)).toEqual([1, 3, 5, 6, 8, 10]);
  });
});
