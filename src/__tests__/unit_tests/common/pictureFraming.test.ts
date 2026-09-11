import {
  DEFAULT_FRAMING,
  dragFraming,
  placePicture,
  readFraming,
  zoomFraming,
} from '../../../common/pictureFraming';

describe('picture framing', () => {
  const photo = { width: 400, height: 200 };
  const place = { width: 100, height: 100 };

  it('fills a square by cropping a landscape, or keeps the whole photo with margins', () => {
    expect(placePicture(photo, place, DEFAULT_FRAMING)).toEqual({
      x: -50,
      y: 0,
      width: 200,
      height: 100,
    });
    expect(
      placePicture(photo, place, { ...DEFAULT_FRAMING, fit: 'contain' }),
    ).toEqual({
      x: 0,
      y: 25,
      width: 100,
      height: 50,
    });
  });

  it.each([0, 1])('keeps every edge covered even with focus at %s', (focus) => {
    const drawn = placePicture(photo, place, {
      fit: 'cover',
      zoom: 4,
      focus: [focus, focus],
    });
    expect(drawn.x).toBeLessThanOrEqual(0);
    expect(drawn.y).toBeLessThanOrEqual(0);
    expect(drawn.x + drawn.width).toBeGreaterThanOrEqual(place.width);
    expect(drawn.y + drawn.height).toBeGreaterThanOrEqual(place.height);
  });

  it('stops a contain drag at the edge without losing any of the photo', () => {
    const framing = dragFraming(
      photo,
      place,
      { ...DEFAULT_FRAMING, fit: 'contain' },
      1000,
      -1000,
    );
    expect(placePicture(photo, place, framing)).toEqual({
      x: 0,
      y: 0,
      width: 100,
      height: 50,
    });
  });

  it('zooms from the visible focus after a drag hits the crop boundary', () => {
    const dragged = dragFraming(photo, place, DEFAULT_FRAMING, 1000, 0);
    expect(dragged.focus).toEqual([0.25, 0.5]);
    const zoomed = zoomFraming(photo, place, dragged, 2);
    expect(zoomed.focus).toEqual([0.25, 0.5]);
    expect(placePicture(photo, place, zoomed)).toEqual({
      x: -50,
      y: -50,
      width: 400,
      height: 200,
    });
    expect(DEFAULT_FRAMING.focus).toEqual([0.5, 0.5]);
  });

  it.each([
    [-10, 1],
    [100, 4],
  ])('bounds requested zoom %s at %s', (requested, expected) => {
    expect(readFraming({ zoom: requested }).zoom).toBe(expected);
    expect(zoomFraming(photo, place, DEFAULT_FRAMING, requested).zoom).toBe(
      expected,
    );
  });

  it.each([
    null,
    [0.2],
    [0.2, 0.3, 0.4],
    [-0.1, 0.5],
    [0.5, 1.1],
    [NaN, 0.5],
    ['0.5', 0.5],
  ])('uses the scene framing for malformed focus %j', (focus) => {
    const fallback = {
      fit: 'contain' as const,
      zoom: 2,
      focus: [0.2, 0.7] as const,
    };
    expect(
      readFraming({ fit: 'stretch', zoom: Infinity, focus }, fallback),
    ).toEqual(fallback);
  });

  it('accepts focus endpoints and independently falls back for missing controls', () => {
    expect(readFraming({ fit: 'contain', focus: [0, 1] })).toEqual({
      fit: 'contain',
      zoom: 1,
      focus: [0, 1],
    });
    expect(readFraming(null)).toEqual(DEFAULT_FRAMING);
  });
});
