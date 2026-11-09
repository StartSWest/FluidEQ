/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  DEFAULT_SCENE_CAMERA_CONTROL,
  type ISceneCameraControl,
} from 'common/sceneCameraControl';
import type { ISceneCameraLimits } from 'common/sceneCamera';
import { createSceneInteraction } from 'renderer/graph/sceneInteraction';

/**
 * Two motions the viewer can switch on (Ivan, 2026-11-09): a 3D scene
 * leaning a little towards the pointer with no key or press ("only with mouse
 * moving it tilts the scene but only a bit ... but subtle"), and a scene that
 * turns all the way round circling by itself ("auto rotates smooth like a
 * camera rotation pan"). Both gentle, both giving way to the viewer's own
 * turn, both off where motion is reduced, and neither counted as a turn.
 */

let mockReduced = false;
jest.mock('renderer/utils/bandReveal', () => ({
  prefersReducedMotion: () => mockReduced,
}));

/** jsdom has no PointerEvent: a mouse event that carries a pointer's fields. */
const pointer = (
  type: string,
  x: number,
  y: number,
  init: { buttons?: number; ctrlKey?: boolean; at?: number } = {},
) => {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: x,
    clientY: y,
    buttons: init.buttons ?? 0,
    ctrlKey: init.ctrlKey ?? false,
  });
  Object.defineProperty(event, 'pointerId', { value: 1 });
  if (init.at !== undefined) {
    Object.defineProperty(event, 'timeStamp', { value: init.at });
  }
  return event;
};

const box = { left: 0, top: 0, width: 400, height: 200 } as DOMRect;
const LIMITED: ISceneCameraLimits = {
  yaw: [-1, 1],
  pitch: [-0.5, 0.5],
  zoom: [0.5, 2],
};
const ROUND: ISceneCameraLimits = { ...LIMITED, yaw: [-Math.PI, Math.PI] };

const setUp = (
  choice: Partial<ISceneCameraControl>,
  limits: ISceneCameraLimits = LIMITED,
) => {
  const panel = document.createElement('div');
  document.body.append(panel);
  Object.assign(panel, { setPointerCapture: () => undefined });
  const hands = createSceneInteraction(() => ({
    ...DEFAULT_SCENE_CAMERA_CONTROL,
    ...choice,
  }));
  hands.setLimits(limits);
  const detach = hands.attach(panel, { frame: () => box });
  /** `ms` of drawn frames, sixteen at a time. */
  const frames = (ms: number) => {
    for (let at = 0; at < ms; at += 16) {
      hands.read(16);
    }
    return hands.read(0).camera;
  };
  const at = (x: number, y: number, held = {}) =>
    panel.dispatchEvent(pointer('pointermove', x, y, held));
  return { panel, hands, detach, frames, at };
};

beforeEach(() => {
  mockReduced = false;
});

afterEach(() => {
  document.body.replaceChildren();
});

describe('leaning towards the pointer', () => {
  it('leans a few degrees towards the hand, glides there, and never counts as a turn', () => {
    const { hands, frames, at, detach } = setUp({ follow: true });
    at(200, 100);
    at(400, 0);
    const first = hands.read(16).camera;
    const settled = frames(2_000);
    // Gliding, not jumping: one frame in it has gone a little of the way.
    expect(Math.abs(first[0])).toBeLessThan(Math.abs(settled[0]) / 2);
    // A few degrees at the panel's edge, no more.
    expect(Math.abs(settled[0])).toBeGreaterThan(0.05);
    expect(Math.abs(settled[0])).toBeLessThanOrEqual(0.0701);
    expect(Math.abs(settled[1])).toBeLessThanOrEqual(0.0451);
    expect(hands.moved()).toBe(false);
    detach();
  });

  // The control: the same hand with the switch off leans nothing.
  it('stays still under the same hand with the switch off', () => {
    const { frames, at, detach } = setUp({ follow: false });
    at(200, 100);
    at(400, 0);
    expect(frames(2_000)).toEqual([0, 0, 1]);
    detach();
  });

  it('settles back when the pointer leaves', () => {
    const { panel, frames, at, detach } = setUp({ follow: true });
    at(200, 100);
    at(400, 0);
    frames(2_000);
    panel.dispatchEvent(new MouseEvent('pointerleave'));
    expect(frames(6_000)).toEqual([0, 0, 1]);
    detach();
  });

  it('gives way while the camera’s key is held', () => {
    const { frames, at, detach } = setUp({ follow: true });
    at(200, 100);
    at(400, 0, { ctrlKey: true });
    expect(frames(3_000)).toEqual([0, 0, 1]);
    detach();
  });

  it('starts again from where a turn left the hand, so letting go moves nothing', () => {
    const { panel, hands, frames, detach } = setUp({ follow: true });
    panel.dispatchEvent(pointer('pointermove', 200, 100));
    panel.dispatchEvent(
      pointer('pointerdown', 200, 100, { buttons: 1, ctrlKey: true, at: 0 }),
    );
    panel.dispatchEvent(
      pointer('pointermove', 240, 100, { buttons: 1, ctrlKey: true, at: 100 }),
    );
    // Stopped before letting go: nothing flung against the scene's limits.
    panel.dispatchEvent(pointer('pointerup', 240, 100, { at: 400 }));
    // Wait out the release's own glide, with the hand where it let go.
    const turned = frames(3_000);
    panel.dispatchEvent(pointer('pointermove', 240, 100));
    expect(frames(1_000)[0]).toBeCloseTo(turned[0], 4);
    expect(hands.moved()).toBe(true);
    detach();
  });

  it('starts again from where a turn made by moving alone left the hand', () => {
    const { panel, frames, detach } = setUp({
      follow: true,
      key: 'shift',
      move: 'move',
    });
    const move = (x: number, shiftKey: boolean, at: number) => {
      const event = pointer('pointermove', x, 100, { at });
      Object.defineProperty(event, 'shiftKey', { value: shiftKey });
      panel.dispatchEvent(event);
    };
    move(200, true, 0);
    move(220, true, 50);
    move(240, true, 100);
    // Shift let go well after the hand stopped: no fling, and no lean.
    move(240, false, 400);
    const turned = frames(16);
    expect(frames(2_000)[0]).toBeCloseTo(turned[0], 4);
    detach();
  });

  it('measures from the middle again once the pointer has left after a turn', () => {
    const { panel, frames, detach } = setUp({ follow: true });
    panel.dispatchEvent(pointer('pointermove', 200, 100));
    panel.dispatchEvent(
      pointer('pointerdown', 200, 100, { buttons: 1, ctrlKey: true, at: 0 }),
    );
    panel.dispatchEvent(
      pointer('pointermove', 240, 100, { buttons: 1, ctrlKey: true, at: 100 }),
    );
    // Stopped before letting go: nothing flung against the scene's limits.
    panel.dispatchEvent(pointer('pointerup', 240, 100, { at: 400 }));
    const turned = frames(3_000);
    panel.dispatchEvent(new MouseEvent('pointerleave'));
    // Back at the panel's middle: no lean at all there.
    panel.dispatchEvent(pointer('pointermove', 200, 100));
    panel.dispatchEvent(pointer('pointermove', 200, 100));
    expect(frames(2_000)[0]).toBeCloseTo(turned[0], 4);
    detach();
  });

  it('is off where motion is reduced', () => {
    mockReduced = true;
    const { frames, at, detach } = setUp({ follow: true });
    at(200, 100);
    at(400, 0);
    expect(frames(2_000)).toEqual([0, 0, 1]);
    detach();
  });
});

describe('circling by itself', () => {
  it('circles a scene that turns all the way round, at a steady pace once under way', () => {
    const { hands, frames, detach } = setUp({ orbit: 'normal' }, ROUND);
    expect(hands.turnsRound()).toBe(true);
    const early = frames(16)[0];
    frames(10_000);
    const before = hands.read(0).camera[0];
    const after = frames(1_000)[0];
    // Eased in: the first frame barely moves; a second under way goes a
    // sixtieth of the way round.
    expect(Math.abs(early)).toBeLessThan(1e-3);
    const turned = Math.abs(
      ((after - before + Math.PI) % (2 * Math.PI)) - Math.PI,
    );
    expect(turned).toBeCloseTo((2 * Math.PI) / 60, 2);
    expect(hands.moved()).toBe(false);
    detach();
  });

  // The control: a scene held inside a part of a turn does not circle.
  it('does not circle a scene that cannot go all the way round', () => {
    const { hands, frames, detach } = setUp({ orbit: 'normal' }, LIMITED);
    expect(hands.turnsRound()).toBe(false);
    expect(frames(10_000)).toEqual([0, 0, 1]);
    detach();
  });

  it('stops at once while the camera’s key is held', () => {
    const { frames, at, detach } = setUp({ orbit: 'normal' }, ROUND);
    frames(10_000);
    at(200, 100, { ctrlKey: true });
    frames(1_500);
    const held = frames(0)[0];
    expect(frames(1_000)[0]).toBeCloseTo(held, 4);
    detach();
  });

  it('picks up where it was after the window was hidden, never a jump', () => {
    const { hands, frames, detach } = setUp({ orbit: 'normal' }, ROUND);
    frames(10_000);
    const before = hands.read(0).camera[0];
    // Fifteen seconds unseen arrive as one long step: it counts as 200 ms,
    // not the quarter turn fifteen seconds would be.
    const after = hands.read(15_000).camera[0];
    expect(Math.abs(after - before)).toBeLessThan(0.03);
    detach();
  });

  it('is off where motion is reduced', () => {
    mockReduced = true;
    const { frames, detach } = setUp({ orbit: 'normal' }, ROUND);
    expect(frames(10_000)).toEqual([0, 0, 1]);
    detach();
  });
});
