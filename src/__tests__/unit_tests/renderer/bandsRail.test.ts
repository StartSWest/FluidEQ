import { measureBandPlacement } from '../../../renderer/eq/bandsRail';
import { placeBandsEvenly } from '../../../renderer/graph/plotGeometry';

const rect = ({ x = 0, width = 0 }): DOMRect => ({
  x,
  y: 0,
  left: x,
  right: x + width,
  top: 0,
  bottom: 0,
  width,
  height: 0,
  toJSON: () => ({ x, width }),
});

describe('band rail fit at the scrolling boundary', () => {
  const fixture = (width: number) => {
    const scroller = document.createElement('div');
    scroller.className = 'workspace-tab-panel__scroll';
    const rail = document.createElement('div');
    rail.className = 'bands-rail';
    const bands = document.createElement('div');
    bands.className = 'bands';
    rail.append(bands);
    scroller.append(rail);
    const plot = document.createElement('div');
    let rowWidth = 1240;
    let rowLeft = 30;
    jest
      .spyOn(rail, 'getBoundingClientRect')
      .mockImplementation(() => rect({ x: 30, width }));
    jest
      .spyOn(bands, 'getBoundingClientRect')
      .mockImplementation(() => rect({ x: rowLeft, width: rowWidth }));
    jest
      .spyOn(scroller, 'getBoundingClientRect')
      .mockReturnValue(rect({ width: 1400 }));
    Object.defineProperty(scroller, 'clientWidth', { value: 1400 });
    jest
      .spyOn(plot, 'getBoundingClientRect')
      .mockReturnValue(rect({ width: 1400 }));
    return {
      bands,
      geometry: { element: plot, width: 1400 },
      setRow: (nextWidth: number, nextLeft = 30) => {
        rowWidth = nextWidth;
        rowLeft = nextLeft;
      },
    };
  };

  it('keeps scrolling when the overflowing content fits but the available rail does not', () => {
    const { bands, geometry, setRow } = fixture(1239);
    // Positive reproduction of the old self-measurement: the same window
    // alternates between fitting the 1240px content and failing at 1239px.
    expect(
      placeBandsEvenly(31, geometry, -30, { left: 0, right: 1240 }),
    ).toBeDefined();
    expect(
      placeBandsEvenly(31, geometry, -30, { left: 0, right: 1239 }),
    ).toBeUndefined();
    [1240, 1239, 1240, 1239].forEach((rowWidth) => {
      setRow(rowWidth);
      expect(measureBandPlacement(bands, geometry, 31)).toBeUndefined();
    });
  });

  it.each([6, 10, 15, 20, 31])(
    'places %i bands as soon as their actual minimum fits',
    (count) => {
      const { bands, geometry, setRow } = fixture(count * 40);
      const expected = measureBandPlacement(bands, geometry, count);
      expect(expected?.slot).toBe(40);
      // Arrows and horizontal scrolling alter the child, not available space.
      setRow(count * 40 - 34, 64);
      expect(measureBandPlacement(bands, geometry, count)).toEqual(expected);
      setRow(count * 40, -90);
      expect(measureBandPlacement(bands, geometry, count)).toEqual(expected);
    },
  );

  it('still respects the visible page edge when the page clips the rail', () => {
    const { bands, geometry } = fixture(1400);
    const placement = measureBandPlacement(bands, geometry, 31);
    expect(placement).toBeDefined();
    expect(placement?.slot).toBeCloseTo(1370 / 31);
  });
});
