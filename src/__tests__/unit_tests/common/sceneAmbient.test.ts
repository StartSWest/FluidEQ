/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A scene's elements around the window are data written by a member's AI and
 * played among the window's own controls. What these hold: nothing a scene
 * writes can reach past the bounds, a picture is cut only from the scene's
 * own artwork, and a broken layer is dropped without taking the scene with it.
 */

import {
  ambientElementsAt,
  isWholeSceneAmbient,
  MAX_AMBIENT_COUNT,
  MAX_AMBIENT_ELEMENTS,
  MAX_AMBIENT_PARAMS,
  MAX_AMBIENT_SIZE,
  MAX_AMBIENT_TOTAL,
  normalizeSceneAmbient,
  readAmbientFrames,
  readAmbientPath,
} from '../../../common/sceneAmbient';

const ARTWORK = { width: 4096, height: 2048 };

const gulls = {
  id: 'gulls',
  shape: 'bird',
  colours: ['#DFE9FF'],
  count: 6,
  size: [14, 24],
  opacity: 0.7,
  motion: 'fly',
  speed: 0.35,
  area: 'top',
  flap: 0.7,
  turn: 0.3,
  music: 'mid',
  react: 0.3,
};

const birds = {
  id: 'birds',
  shape: 'picture',
  frames: [
    [2802, 1783, 224, 224],
    [3855, 1800, 224, 224],
    [1578, 1783, 224, 224],
  ],
  rest: 2,
  facing: 'right',
  colours: [],
  count: 5,
  size: [40, 60],
  opacity: 0.9,
  motion: 'fly',
  speed: 0.3,
  area: 'top',
  flap: 0.6,
  turn: 0.35,
  music: 'mid',
  react: 0.25,
};

describe('normalizeSceneAmbient', () => {
  it('keeps a layer written within the bounds, as written', () => {
    const raw = {
      elements: [gulls],
      params: [
        {
          id: 'flock',
          names: { en: 'Birds', es: 'Aves' },
          value: 0.6,
          targets: [{ element: 'gulls', field: 'count', min: 2, max: 10 }],
        },
      ],
    };
    const ambient = normalizeSceneAmbient(raw);
    expect(ambient?.elements[0]).toEqual({ ...gulls, colours: ['#dfe9ff'] });
    expect(ambient?.params).toHaveLength(1);
    expect(isWholeSceneAmbient(raw)).toBe(true);
  });

  it('holds counts, sizes and every 0..1 field to the engine’s bounds', () => {
    const ambient = normalizeSceneAmbient({
      elements: [
        {
          ...gulls,
          count: 900,
          size: [1, 4000],
          opacity: 7,
          speed: -3,
          react: Number.NaN,
        },
      ],
    });
    const [element] = ambient?.elements ?? [];
    expect(element.count).toBe(MAX_AMBIENT_COUNT);
    expect(element.size[1]).toBe(MAX_AMBIENT_SIZE);
    expect(element.size[0]).toBeGreaterThanOrEqual(4);
    expect(element.opacity).toBe(1);
    expect(element.speed).toBe(0);
    expect(element.react).toBe(0.3);
  });

  it('keeps at most four elements, and the total within the window’s ceiling', () => {
    const many = Array.from({ length: 7 }, (_, index) => ({
      ...gulls,
      id: `flock_${index}`,
      count: 16,
    }));
    const ambient = normalizeSceneAmbient({ elements: many });
    expect(ambient?.elements).toHaveLength(MAX_AMBIENT_ELEMENTS);
    const total = (ambient?.elements ?? []).reduce(
      (sum, element) => sum + element.count,
      0,
    );
    expect(total).toBeLessThanOrEqual(MAX_AMBIENT_TOTAL);
    expect(isWholeSceneAmbient({ elements: many })).toBe(false);
  });

  it('drops what it cannot draw, and nothing when nothing is left', () => {
    expect(
      normalizeSceneAmbient({
        elements: [{ ...gulls, shape: 'script' }],
      }),
    ).toBeUndefined();
    expect(
      normalizeSceneAmbient({ elements: [{ ...gulls, id: 'Bad Id!' }] }),
    ).toBeUndefined();
    expect(normalizeSceneAmbient('<svg onload=alert(1)>')).toBeUndefined();
    // A duplicate id is one element, not two.
    expect(
      normalizeSceneAmbient({ elements: [gulls, gulls] })?.elements,
    ).toHaveLength(1);
  });

  it('keeps at most five controls, each moving elements that exist', () => {
    const param = (index: number) => ({
      id: `control_${index}`,
      names: { en: `Control ${index}` },
      value: 0.5,
      targets: [
        { element: 'gulls', field: 'speed', min: 0, max: 1 },
        { element: 'ghost', field: 'speed', min: 0, max: 1 },
        { element: 'gulls', field: 'innerHTML', min: 0, max: 1 },
      ],
    });
    const raw = {
      elements: [gulls],
      params: Array.from({ length: 8 }, (_, index) => param(index)),
    };
    const ambient = normalizeSceneAmbient(raw);
    expect(ambient?.params).toHaveLength(MAX_AMBIENT_PARAMS);
    expect(ambient?.params[0].targets).toEqual([
      { element: 'gulls', field: 'speed', min: 0, max: 1 },
    ]);
    expect(isWholeSceneAmbient(raw)).toBe(false);
  });

  it('strips invisible and direction characters from a control’s name', () => {
    const ambient = normalizeSceneAmbient({
      elements: [gulls],
      params: [
        {
          id: 'flock',
          names: { en: 'Bi\u202erds\u200b' },
          value: 0.5,
          targets: [{ element: 'gulls', field: 'count', min: 1, max: 4 }],
        },
      ],
    });
    expect(ambient?.params[0].names.en).toBe('Birds');
  });
});

describe('readAmbientPath', () => {
  it('reads an outline of commands and numbers inside its box', () => {
    expect(readAmbientPath('M-1 0 C-0.5 -1 0.5 -1 1 0 Z')).toBe(
      'M-1 0 C-0.5 -1 0.5 -1 1 0 Z',
    );
  });

  it('refuses anything that is not an outline, or reaches past its box', () => {
    expect(
      readAmbientPath('M0 0 L1 1 url(javascript:alert(1))'),
    ).toBeUndefined();
    expect(readAmbientPath('M0 0 L5 0 Z')).toBeUndefined();
    expect(readAmbientPath('L0 0 L1 1')).toBeUndefined();
    expect(readAmbientPath(`M0 0 ${'L1 1 '.repeat(200)}`)).toBeUndefined();
  });
});

describe('picture elements', () => {
  it('keeps the poses of a picture cut from the scene’s own artwork', () => {
    const raw = { elements: [birds] };
    const ambient = normalizeSceneAmbient(raw, ARTWORK);
    expect(ambient?.elements[0]).toEqual(birds);
    expect(isWholeSceneAmbient(raw, ARTWORK)).toBe(true);
  });

  it('draws nothing from a scene without artwork', () => {
    expect(normalizeSceneAmbient({ elements: [birds] })).toBeUndefined();
    expect(isWholeSceneAmbient({ elements: [birds] })).toBe(false);
  });

  it('refuses a pose outside the artwork, of another size, or not whole pixels', () => {
    expect(readAmbientFrames([[4000, 0, 224, 224]], ARTWORK)).toBeUndefined();
    expect(readAmbientFrames([[-1, 0, 224, 224]], ARTWORK)).toBeUndefined();
    expect(
      readAmbientFrames(
        [
          [0, 0, 224, 224],
          [300, 0, 200, 224],
        ],
        ARTWORK,
      ),
    ).toBeUndefined();
    expect(readAmbientFrames([[0.5, 0, 224, 224]], ARTWORK)).toBeUndefined();
    expect(readAmbientFrames([[0, 0, 2048, 2048]], ARTWORK)).toBeUndefined();
    expect(readAmbientFrames([[0, 0, 4, 4]], ARTWORK)).toBeUndefined();
    expect(
      readAmbientFrames(
        Array.from({ length: 9 }, () => [0, 0, 64, 64]),
        ARTWORK,
      ),
    ).toBeUndefined();
    expect(readAmbientFrames([['0', 0, 64, 64]], ARTWORK)).toBeUndefined();
  });

  it('drops a picture whose resting pose is not one of its frames', () => {
    const raw = { elements: [{ ...birds, rest: 3 }] };
    expect(normalizeSceneAmbient(raw, ARTWORK)).toBeUndefined();
    expect(isWholeSceneAmbient(raw, ARTWORK)).toBe(false);
  });

  it('looks no way in particular unless it says which', () => {
    const { facing, rest, ...plain } = birds;
    const ambient = normalizeSceneAmbient({ elements: [plain] }, ARTWORK);
    expect(facing).toBe('right');
    expect(rest).toBe(2);
    expect(ambient?.elements[0].facing).toBe('none');
    expect(ambient?.elements[0].rest).toBeUndefined();
  });
});

describe('ambientElementsAt', () => {
  it('places each target between its min and max by where its control stands', () => {
    const ambient = normalizeSceneAmbient({
      elements: [gulls],
      params: [
        {
          id: 'flock',
          names: { en: 'Birds' },
          value: 0.5,
          targets: [
            { element: 'gulls', field: 'count', min: 2, max: 10 },
            { element: 'gulls', field: 'size', min: 10, max: 50 },
          ],
        },
      ],
    });
    if (!ambient) {
      throw new Error('the layer should have been kept');
    }
    const [atOwn] = ambientElementsAt(ambient);
    expect(atOwn.count).toBe(6);
    expect(atOwn.size[1]).toBe(30);
    // The smallest keeps its share of the largest.
    expect(atOwn.size[0]).toBeCloseTo((30 * 14) / 24);
    const [atTop] = ambientElementsAt(ambient, { flock: 1 });
    expect(atTop.count).toBe(10);
    const [pushed] = ambientElementsAt(ambient, { flock: 40 });
    expect(pushed.count).toBe(10);
  });
});
