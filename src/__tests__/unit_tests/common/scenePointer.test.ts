/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  MAX_POINTER_BURST,
  MAX_POINTER_EMITTERS,
  MAX_POINTER_LIFE,
  MAX_POINTER_SIZE,
  MAX_POINTER_TRAIL,
  MIN_POINTER_SIZE,
  readScenePointer,
} from 'common/scenePointer';

/**
 * What a scene throws from the hand is data from somebody's pack: kept in
 * range rather than refused, never more than the engine's ceilings, and an
 * element it names must be one the scene has.
 */
describe("a scene's pointer", () => {
  it('reads a trail of its own element and a burst of a built-in shape', () => {
    expect(
      readScenePointer(
        {
          emitters: [
            { on: 'move', element: 'petals', amount: 3, size: [10, 18] },
            {
              on: 'tap',
              shape: 'spark',
              colours: ['#ffd27a', '#FF8A4C'],
              amount: 14,
              life: 0.9,
              speed: 0.7,
              spread: 1,
              gravity: 0.2,
              spin: 0.2,
            },
          ],
        },
        ['petals'],
      ),
    ).toEqual({
      emitters: [
        {
          on: 'move',
          element: 'petals',
          colours: [],
          amount: 3,
          size: [10, 18],
          life: 1,
          speed: 0.4,
          spread: 0.5,
          gravity: 0,
          spin: 0.3,
        },
        {
          on: 'tap',
          shape: 'spark',
          colours: ['#ffd27a', '#FF8A4C'],
          amount: 14,
          size: [10, 10],
          life: 0.9,
          speed: 0.7,
          spread: 1,
          gravity: 0.2,
          spin: 0.2,
        },
      ],
    });
  });

  it('holds every number to its ceiling and floor', () => {
    const [trail, burst] =
      readScenePointer({
        emitters: [
          {
            on: 'move',
            shape: 'snow',
            amount: 900,
            size: [1, 500],
            life: 60,
            speed: 9,
            spread: -2,
            gravity: -7,
            spin: 3,
          },
          { on: 'tap', shape: 'star', amount: 900, size: [30, 6] },
        ],
      })?.emitters ?? [];

    expect(trail).toMatchObject({
      amount: MAX_POINTER_TRAIL,
      size: [MIN_POINTER_SIZE, MAX_POINTER_SIZE],
      life: MAX_POINTER_LIFE,
      speed: 1,
      spread: 0,
      gravity: -1,
      spin: 1,
    });
    // A burst's own ceiling, and a size given backwards put the right way.
    expect(burst).toMatchObject({ amount: MAX_POINTER_BURST, size: [6, 30] });
  });

  it('throws only an element the scene has, and only real colours', () => {
    const pointer = readScenePointer(
      {
        emitters: [
          { on: 'move', element: 'ghosts' },
          { on: 'move', element: 'Petals' },
          {
            on: 'tap',
            shape: 'petal',
            colours: [
              'red',
              '#12345',
              '#aabbcc',
              3,
              '#010203',
              '#040506',
              '#070809',
            ],
          },
        ],
      },
      ['petals'],
    );

    expect(pointer?.emitters).toHaveLength(1);
    expect(pointer?.emitters[0]?.colours).toEqual([
      '#aabbcc',
      '#010203',
      '#040506',
    ]);
  });

  it(`reads ${MAX_POINTER_EMITTERS} emitters at most`, () => {
    const emitter = { on: 'tap', shape: 'bubble' };
    expect(
      readScenePointer({
        emitters: [emitter, emitter, emitter, emitter, emitter],
      })?.emitters,
    ).toHaveLength(MAX_POINTER_EMITTERS);
  });

  it('is no pointer at all when nothing in it can be thrown', () => {
    expect(readScenePointer(undefined)).toBeUndefined();
    expect(readScenePointer({ emitters: 'petals' })).toBeUndefined();
    expect(
      readScenePointer({
        emitters: [{ on: 'hover', shape: 'petal' }, { on: 'tap' }, null],
      }),
    ).toBeUndefined();
  });
});
