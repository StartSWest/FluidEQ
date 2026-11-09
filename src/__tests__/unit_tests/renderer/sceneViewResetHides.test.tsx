/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A Plus scene's Reset view shows only while the camera's key is held over
 * the scene (Ivan, 2026-11-09: "reset view button only appears when pressing
 * the modifier key that is used for modifying the scene"), and only for a
 * view that was turned. Keyboard focus keeps it, and the window losing focus
 * lets the key go.
 */

import { act, fireEvent, render } from '@testing-library/react';
import type { ISceneCameraControl } from '../../../common/sceneCameraControl';
import { createSceneInteraction } from '../../../renderer/graph/sceneInteraction';
import SceneViewReset from '../../../renderer/graph/SceneViewReset';

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const LIMITS = {
  yaw: [-1, 1] as const,
  pitch: [-0.5, 0.5] as const,
  zoom: [0.5, 2] as const,
};
const box = { left: 0, top: 0, width: 400, height: 200 } as DOMRect;

/** jsdom has no PointerEvent: a mouse event that carries a pointer's fields. */
const pointer = (
  type: string,
  x: number,
  init: { buttons?: number; ctrlKey?: boolean; altKey?: boolean } = {},
) => {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: x,
    clientY: 100,
    buttons: init.buttons ?? 0,
    ctrlKey: init.ctrlKey ?? false,
    altKey: init.altKey ?? false,
  });
  Object.defineProperty(event, 'pointerId', { value: 1 });
  return event;
};

const setUp = (
  control: ISceneCameraControl = { key: 'ctrl', move: 'drag' },
) => {
  const interaction = createSceneInteraction(() => control);
  interaction.setLimits(LIMITS);
  const view = render(
    <div data-testid="surface">
      <SceneViewReset interaction={interaction} className="" />
    </div>,
  );
  const surface = view.getByTestId('surface');
  Object.assign(surface, { setPointerCapture: () => undefined });
  const detach = interaction.attach(surface, { frame: () => box });
  const plate = () =>
    view.container.querySelector('.scene-view-reset') as HTMLElement | null;
  const shown = () => {
    const found = plate();
    return found !== null && !found.classList.contains('is-idle');
  };
  /** Turned with the key held, then let go of and the pointer left on it. */
  const turn = (held: { ctrlKey?: boolean; altKey?: boolean }) =>
    act(() => {
      surface.dispatchEvent(
        pointer('pointerdown', 200, { ...held, buttons: 1 }),
      );
      surface.dispatchEvent(
        pointer('pointermove', 260, { ...held, buttons: 1 }),
      );
      surface.dispatchEvent(pointer('pointerup', 260, held));
      surface.dispatchEvent(pointer('pointermove', 262));
      interaction.read(16);
    });
  const key = (type: 'keydown' | 'keyup', init: KeyboardEventInit) =>
    act(() => {
      document.body.dispatchEvent(
        new KeyboardEvent(type, { bubbles: true, ...init }),
      );
    });
  return { surface, plate, shown, turn, key, detach };
};

describe('the Reset view button on a turned scene', () => {
  // The control: a scene nobody turned has no button, key held or not.
  it('is not there while the view is the scene’s own', () => {
    const { surface, plate, detach } = setUp();
    act(() => {
      surface.dispatchEvent(pointer('pointermove', 200, { ctrlKey: true }));
    });
    expect(plate()).toBeNull();
    detach();
  });

  it('shows only while the camera’s key is held over the scene', () => {
    const { surface, shown, turn, key, detach } = setUp();
    turn({ ctrlKey: true });
    // Turned, the key let go: the view's way home waits out of sight.
    expect(shown()).toBe(false);
    key('keydown', { key: 'Control', ctrlKey: true });
    expect(shown()).toBe(true);
    key('keyup', { key: 'Control' });
    expect(shown()).toBe(false);
    // Held with the pointer gone from the scene: not this scene's moment.
    act(() => {
      surface.dispatchEvent(new MouseEvent('pointerleave'));
    });
    key('keydown', { key: 'Control', ctrlKey: true });
    expect(shown()).toBe(false);
    detach();
  });

  it('follows the key the viewer chose, not Ctrl', () => {
    const { shown, turn, key, detach } = setUp({ key: 'alt', move: 'drag' });
    turn({ altKey: true });
    key('keydown', { key: 'Control', ctrlKey: true });
    expect(shown()).toBe(false);
    key('keyup', { key: 'Control' });
    key('keydown', { key: 'Alt', altKey: true });
    expect(shown()).toBe(true);
    detach();
  });

  it('never stays up after the window loses focus', () => {
    const { shown, turn, key, detach } = setUp();
    turn({ ctrlKey: true });
    key('keydown', { key: 'Control', ctrlKey: true });
    expect(shown()).toBe(true);
    act(() => {
      window.dispatchEvent(new Event('blur'));
    });
    expect(shown()).toBe(false);
    detach();
  });

  it('stays for the keyboard while it has the focus', () => {
    const { plate, shown, turn, detach } = setUp();
    turn({ ctrlKey: true });
    const button = plate()?.querySelector('button');
    expect(button).toBeTruthy();
    act(() => {
      fireEvent.focus(button as HTMLButtonElement);
    });
    expect(shown()).toBe(true);
    detach();
  });
});
