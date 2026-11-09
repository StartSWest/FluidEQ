/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  DEFAULT_SCENE_CAMERA_CONTROL,
  type ISceneCameraControl,
} from 'common/sceneCameraControl';
import { createSceneInteraction } from 'renderer/graph/sceneInteraction';

/**
 * The camera's key and the way it turns are the viewer's to choose (Ivan,
 * 2026-11-09: "they can change the control or if to click and drag to move
 * or just move mouse with that control or what ever key pressed"): Ctrl, Alt,
 * Shift or any key, with a drag or with the mouse moving alone, and the wheel
 * with the same key. A plain press stays the surface's whatever is chosen.
 */

/** jsdom has no PointerEvent: a mouse event that carries a pointer's fields. */
const pointer = (
  type: string,
  x: number,
  y: number,
  init: {
    buttons?: number;
    ctrlKey?: boolean;
    altKey?: boolean;
    shiftKey?: boolean;
  } = {},
) => {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: x,
    clientY: y,
    button: 0,
    buttons: init.buttons ?? 0,
    ctrlKey: init.ctrlKey ?? false,
    altKey: init.altKey ?? false,
    shiftKey: init.shiftKey ?? false,
  });
  Object.defineProperty(event, 'pointerId', { value: 1 });
  return event;
};

const box = { left: 0, top: 0, width: 400, height: 200 } as DOMRect;
const LIMITS = {
  yaw: [-1, 1] as const,
  pitch: [-0.5, 0.5] as const,
  zoom: [0.5, 2] as const,
};

const setUp = (control: Partial<ISceneCameraControl>) => {
  const panel = document.createElement('div');
  document.body.append(panel);
  Object.assign(panel, {
    setPointerCapture: () => undefined,
    releasePointerCapture: () => undefined,
  });
  const chosen = { ...DEFAULT_SCENE_CAMERA_CONTROL, ...control };
  const hands = createSceneInteraction(() => chosen);
  hands.setLimits(LIMITS);
  const detach = hands.attach(panel, { frame: () => box });
  const panelHeard: string[] = [];
  panel.addEventListener('pointerdown', () => panelHeard.push('pointerdown'));
  /** A drag across the panel, with what is held. */
  const drag = (held: Parameters<typeof pointer>[3] = {}) => {
    panel.dispatchEvent(
      pointer('pointerdown', 200, 100, { ...held, buttons: 1 }),
    );
    panel.dispatchEvent(
      pointer('pointermove', 260, 120, { ...held, buttons: 1 }),
    );
    panel.dispatchEvent(pointer('pointerup', 260, 120, held));
    hands.read(16);
  };
  /** The mouse moved across the panel with no button down. */
  // Always onwards from where the last moves left it, in small steps so the
  // turn stays inside the scene's limits.
  let x = 200;
  const glideOver = (held: Parameters<typeof pointer>[3] = {}) => {
    [0, 6, 12].forEach((step) =>
      panel.dispatchEvent(pointer('pointermove', x + step, 100, held)),
    );
    x += 18;
    hands.read(16);
  };
  // Sent where a real key goes with nothing focused: the page's body, on its
  // way up to the window.
  const key = (type: 'keydown' | 'keyup', init: KeyboardEventInit) => {
    const event = new KeyboardEvent(type, {
      bubbles: true,
      cancelable: true,
      ...init,
    });
    document.body.dispatchEvent(event);
    return event;
  };
  return { panel, hands, detach, panelHeard, drag, glideOver, key };
};

const cameraOf = (hands: ReturnType<typeof createSceneInteraction>) =>
  hands.read(0).camera;

afterEach(() => {
  document.body.replaceChildren();
});

describe('a camera key other than Ctrl', () => {
  it('turns with Alt and a drag, and leaves a Ctrl drag to the surface', () => {
    const { hands, drag, panelHeard, detach } = setUp({
      key: 'alt',
      move: 'drag',
    });
    drag({ ctrlKey: true });
    expect(hands.moved()).toBe(false);
    expect(panelHeard).toEqual(['pointerdown']);
    drag({ altKey: true });
    expect(hands.moved()).toBe(true);
    // The turning press was the scene's alone.
    expect(panelHeard).toEqual(['pointerdown']);
    detach();
  });

  it('turns with a key of its own, held as its key down and up say', () => {
    const { hands, drag, key, detach } = setUp({
      key: 'code:KeyZ',
      move: 'drag',
    });
    drag();
    expect(hands.moved()).toBe(false);
    key('keydown', { code: 'KeyZ', key: 'z' });
    drag();
    expect(hands.moved()).toBe(true);
    detach();
  });

  it('is typing, not the camera, in a field', () => {
    const { panel, hands, drag, detach } = setUp({
      key: 'code:KeyZ',
      move: 'drag',
    });
    const field = document.createElement('input');
    document.body.append(field);
    field.dispatchEvent(
      new KeyboardEvent('keydown', { code: 'KeyZ', key: 'z', bubbles: true }),
    );
    drag();
    expect(hands.moved()).toBe(false);
    expect(panel.dataset.sceneHand).toBeUndefined();
    detach();
  });

  it("keeps a key's shortcut away while the pointer is over a turnable scene, and only then", () => {
    const { panel, glideOver, key, detach } = setUp({
      key: 'code:KeyQ',
      move: 'drag',
    });
    const shortcut: string[] = [];
    window.addEventListener('keydown', (event) => shortcut.push(event.code));
    // Not over the scene: the key is the window's, as always.
    expect(key('keydown', { code: 'KeyQ', key: 'q' }).defaultPrevented).toBe(
      false,
    );
    key('keyup', { code: 'KeyQ', key: 'q' });
    glideOver();
    const over = key('keydown', { code: 'KeyQ', key: 'q' });
    expect(over.defaultPrevented).toBe(true);
    expect(shortcut).toEqual(['KeyQ']);
    expect(panel.dataset.sceneHand).toBe('grab');
    detach();
  });
});

describe('turning by moving the mouse alone', () => {
  it('turns while Shift is held, and not without it', () => {
    const { hands, glideOver, panelHeard, detach } = setUp({
      key: 'shift',
      move: 'move',
    });
    glideOver();
    expect(hands.moved()).toBe(false);
    glideOver({ shiftKey: true });
    expect(hands.moved()).toBe(true);
    // No press at all: the surface heard nothing.
    expect(panelHeard).toEqual([]);
    detach();
  });

  // The control beside it: the same moves under a drag-to-turn choice do not
  // turn, so it is the choice that turns them.
  it('does not turn on movement alone where the choice is a drag', () => {
    const { hands, glideOver, detach } = setUp({ key: 'shift', move: 'drag' });
    glideOver({ shiftKey: true });
    expect(hands.moved()).toBe(false);
    detach();
  });

  it('glides on when the key is let go mid-move, and stops when it was still', () => {
    const { hands, glideOver, key, detach } = setUp({
      key: 'code:KeyZ',
      move: 'move',
    });
    key('keydown', { code: 'KeyZ', key: 'z' });
    glideOver();
    // The camera holds while the key is held and the mouse still.
    const held = cameraOf(hands);
    hands.read(50);
    expect(cameraOf(hands)).toEqual(held);
    key('keyup', { code: 'KeyZ', key: 'z' });
    const letGo = cameraOf(hands);
    hands.read(50);
    expect(cameraOf(hands)[0]).not.toBe(letGo[0]);
    detach();
  });

  it('shows the closed hand while it turns, the open one before', () => {
    const { panel, glideOver, detach } = setUp({ key: 'shift', move: 'move' });
    panel.dispatchEvent(pointer('pointermove', 200, 100, { shiftKey: true }));
    expect(panel.dataset.sceneHand).toBe('grab');
    glideOver({ shiftKey: true });
    expect(panel.dataset.sceneHand).toBe('grabbing');
    detach();
  });
});

describe('the wheel', () => {
  const wheel = (panel: HTMLElement, ctrlKey: boolean, altKey = false) => {
    const event = new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      clientX: 200,
      clientY: 100,
      deltaY: -300,
      ctrlKey,
      altKey,
    });
    panel.dispatchEvent(event);
    return event;
  };

  it('moves in with the chosen key, and not with Ctrl pressed instead', () => {
    const { panel, hands, key, detach } = setUp({ key: 'alt', move: 'drag' });
    key('keydown', { key: 'Control', code: 'ControlLeft', ctrlKey: true });
    expect(wheel(panel, true).defaultPrevented).toBe(false);
    expect(hands.moved()).toBe(false);
    key('keyup', { key: 'Control', code: 'ControlLeft' });
    expect(wheel(panel, false, true).defaultPrevented).toBe(true);
    hands.read(16);
    expect(hands.moved()).toBe(true);
    detach();
  });

  // A touchpad's pinch arrives as Ctrl and the wheel with no Ctrl pressed:
  // it zooms whatever the key.
  it("takes a touchpad's pinch as the zoom whatever the key", () => {
    const { panel, hands, detach } = setUp({ key: 'shift', move: 'drag' });
    expect(wheel(panel, true).defaultPrevented).toBe(true);
    hands.read(16);
    expect(hands.moved()).toBe(true);
    detach();
  });
});

describe('whether the scene can be turned', () => {
  it('says so, and tells when it changes', () => {
    const { hands, detach } = setUp({ key: 'ctrl', move: 'drag' });
    const told = jest.fn();
    hands.subscribe(told);
    expect(hands.turns()).toBe(true);
    hands.setLimits(undefined);
    expect(hands.turns()).toBe(false);
    expect(told).toHaveBeenCalled();
    detach();
  });
});
