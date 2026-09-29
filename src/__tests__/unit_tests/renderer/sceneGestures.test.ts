/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  createSceneInteraction,
  type TSceneGesture,
} from 'renderer/graph/sceneInteraction';
import windowGestures from 'renderer/graph/windowGestures';

/**
 * What the hand does over a scene, for the pieces a scene throws from it
 * (`ScenePointerLayer`): a move with how far it went, a tap where it pressed
 * and let go in place — in page pixels, whichever surface heard it — and
 * never a press on one of the app's controls, which is the control's.
 */

/** jsdom has no PointerEvent: a mouse event that carries a pointer's fields. */
const pointer = (
  type: string,
  x: number,
  y: number,
  init: { button?: number; buttons?: number } = {},
) => {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: x,
    clientY: y,
    button: init.button ?? 0,
    buttons: init.buttons ?? 0,
  });
  Object.defineProperty(event, 'pointerId', { value: 1 });
  return event;
};

const box = { left: 0, top: 0, width: 400, height: 200 } as DOMRect;

describe('gestures over a scene on its own surface', () => {
  let panel: HTMLDivElement;
  let button: HTMLButtonElement;
  let heard: TSceneGesture[];
  let detach: () => void;
  let stop: () => void;

  beforeEach(() => {
    panel = document.createElement('div');
    button = document.createElement('button');
    panel.append(button);
    document.body.append(panel);
    const hands = createSceneInteraction();
    detach = hands.attach(panel, { frame: () => box, turns: () => false });
    heard = [];
    stop = hands.onGesture((gesture) => heard.push(gesture));
  });
  afterEach(() => {
    stop();
    detach();
    panel.remove();
  });

  it('tells each move after the first with how far it went', () => {
    panel.dispatchEvent(pointer('pointermove', 10, 20));
    panel.dispatchEvent(pointer('pointermove', 40, 24));

    expect(heard).toEqual([{ kind: 'move', x: 40, y: 24, dx: 30, dy: 4 }]);
  });

  it('tells a press let go in place as a tap, and a drag as none', () => {
    panel.dispatchEvent(pointer('pointerdown', 100, 50, { buttons: 1 }));
    panel.dispatchEvent(pointer('pointerup', 102, 51));
    panel.dispatchEvent(pointer('pointerdown', 100, 50, { buttons: 1 }));
    panel.dispatchEvent(pointer('pointerup', 160, 50));

    expect(heard.filter((gesture) => gesture.kind === 'tap')).toEqual([
      { kind: 'tap', x: 102, y: 51 },
    ]);
  });

  it('tells nothing that happens on a control', () => {
    button.dispatchEvent(pointer('pointermove', 10, 20));
    button.dispatchEvent(pointer('pointermove', 40, 24));
    button.dispatchEvent(pointer('pointerdown', 40, 24, { buttons: 1 }));
    button.dispatchEvent(pointer('pointerup', 40, 24));

    expect(heard).toEqual([]);
  });

  it('stops telling a listener that has let go', () => {
    stop();
    panel.dispatchEvent(pointer('pointermove', 10, 20));
    panel.dispatchEvent(pointer('pointermove', 40, 24));

    expect(heard).toEqual([]);
  });
});

describe('gestures anywhere over the window, for a scene behind the app', () => {
  let button: HTMLButtonElement;
  let heard: TSceneGesture[];
  let stop: () => void;

  beforeEach(() => {
    button = document.createElement('button');
    document.body.append(button);
    heard = [];
    stop = windowGestures((gesture) => heard.push(gesture));
  });
  afterEach(() => {
    stop();
    button.remove();
  });

  it('trails the hand over anything, controls included', () => {
    document.body.dispatchEvent(pointer('pointermove', 5, 5));
    button.dispatchEvent(pointer('pointermove', 25, 15));

    expect(heard).toEqual([{ kind: 'move', x: 25, y: 15, dx: 20, dy: 10 }]);
  });

  it('bursts where the window is clicked, but not on a control', () => {
    document.body.dispatchEvent(pointer('pointerdown', 300, 200));
    document.body.dispatchEvent(pointer('pointerup', 301, 200));
    button.dispatchEvent(pointer('pointerdown', 20, 20));
    button.dispatchEvent(pointer('pointerup', 20, 20));
    document.body.dispatchEvent(
      pointer('pointerdown', 300, 200, { button: 2 }),
    );
    document.body.dispatchEvent(pointer('pointerup', 300, 200, { button: 2 }));

    expect(heard).toEqual([{ kind: 'tap', x: 301, y: 200 }]);
  });

  it('listens to the window only while somebody is listening', () => {
    const add = jest.spyOn(window, 'addEventListener');
    const remove = jest.spyOn(window, 'removeEventListener');
    const second = windowGestures(() => undefined);
    // Already listening for the first: the second adds nothing.
    expect(add).not.toHaveBeenCalled();
    second();
    expect(remove).not.toHaveBeenCalled();
    stop();
    expect(remove.mock.calls.map(([type]) => type)).toEqual([
      'pointermove',
      'pointerdown',
      'pointerup',
    ]);
    add.mockRestore();
    remove.mockRestore();
    stop = () => undefined;
  });
});
