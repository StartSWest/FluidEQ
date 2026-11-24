/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The look picker's window, sized and flipped by its reader (Ivan,
 * 2026-11-23: "it's like a flip: it shows above or below depending on what
 * the user intends"): always hanging from its select and never over it -
 * "the select must always be the anchor and be seen" - grown by its far
 * edge, flipped by dragging that edge back across the select, opened on the
 * side it was put on while that side has room, and back to its first size
 * and side on a double press.
 */

import { act, fireEvent, render, screen } from '@testing-library/react';
import LookPickerWindow from 'renderer/graph/LookPickerWindow';

jest.mock('renderer/utils/I18nContext', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

/**
 * jsdom has no `PointerEvent`, and the events Testing Library makes without
 * one carry no button, pointer or position: a mouse event that names its
 * pointer stands in.
 */
class TestPointerEvent extends MouseEvent {
  readonly pointerId: number;

  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init);
    this.pointerId = init.pointerId ?? 0;
  }
}

const WINDOW_KEY = 'fluideq.lookPicker.window';
const SIZE_KEY = 'fluideq.lookPicker.size';

/**
 * The select, ending at 1200 across; from 500 to 528 unless a case moves
 * it. The app window is 1400 by 1200: room from 8 to 1192.
 */
const select = { top: 500, bottom: 528, left: 1000, right: 1200 };

/** jsdom has no `DOMRect`: what the code reads of one. */
const rectAt = (x: number, y: number, width: number, height: number) =>
  ({
    x,
    y,
    width,
    height,
    left: x,
    top: y,
    right: x + width,
    bottom: y + height,
    toJSON: () => ({}),
  }) as DOMRect;

const menu = () => {
  const found = document.querySelector<HTMLElement>('[data-anchored-menu]');
  if (!found) {
    throw new Error('the picker window is not open');
  }
  return found;
};

/** Where the window stands, read from what it was told: jsdom lays nothing out. */
const placed = () => {
  const { style } = menu();
  const top = Number.parseFloat(style.top);
  const height = Number.parseFloat(style.height);
  return { top, bottom: top + height, height, side: menu().dataset.side };
};

/** The window over any part of the select, which must never happen. */
const coversSelect = () => {
  const { top, bottom } = placed();
  return top < select.bottom && bottom > select.top;
};

const stored = () => {
  const text = window.localStorage.getItem(WINDOW_KEY);
  return text === null ? null : (JSON.parse(text) as Record<string, unknown>);
};

beforeAll(() => {
  Object.defineProperty(window, 'PointerEvent', {
    configurable: true,
    value: TestPointerEvent,
  });
  const captured = new Set<number>();
  HTMLElement.prototype.setPointerCapture = (id: number) => {
    captured.add(id);
  };
  HTMLElement.prototype.hasPointerCapture = (id: number) => captured.has(id);
  HTMLElement.prototype.releasePointerCapture = (id: number) => {
    captured.delete(id);
  };
  // The window's rectangle is the one it was given; the select's is fixed.
  jest
    .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
    .mockImplementation(function rectOf(this: HTMLElement) {
      if (this.dataset.select !== undefined) {
        return rectAt(
          select.left,
          select.top,
          select.right - select.left,
          select.bottom - select.top,
        );
      }
      if (this.dataset.anchoredMenu !== undefined) {
        const right = window.innerWidth - Number.parseFloat(this.style.right);
        const width = Number.parseFloat(this.style.width);
        return rectAt(
          right - width,
          Number.parseFloat(this.style.top),
          width,
          Number.parseFloat(this.style.height),
        );
      }
      return rectAt(0, 0, 0, 0);
    });
});

beforeEach(() => {
  window.localStorage.clear();
  Object.assign(select, { top: 500, bottom: 528 });
  Object.defineProperty(window, 'innerHeight', {
    configurable: true,
    value: 1200,
  });
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    value: 1400,
  });
});

const open = () => {
  const anchor = document.createElement('div');
  anchor.dataset.select = '';
  document.body.appendChild(anchor);
  const view = render(
    <LookPickerWindow anchor={anchor} isOpen ariaLabel="Styles and scenes">
      <div className="look-picker__body" />
    </LookPickerWindow>,
  );
  return {
    close: () => {
      view.unmount();
      anchor.remove();
    },
  };
};

const grip = (name: string) => {
  const found = name.includes('-')
    ? menu().querySelector<HTMLElement>(`.look-picker__grip--${name}`)
    : screen.getByRole('separator', { name: `graph.picker.${name}` });
  if (!found) {
    throw new Error(`no ${name} grip`);
  }
  return found;
};

/**
 * A press on a grip, moves through each of `steps` (offsets from the press),
 * and the release. `each` runs after every move.
 */
const drag = (
  name: string,
  steps: { dx?: number; dy?: number }[],
  each: () => void = () => undefined,
) => {
  const handle = grip(name);
  const at = { clientX: 600, clientY: 600 };
  fireEvent.pointerDown(handle, { button: 0, pointerId: 1, ...at });
  steps.forEach(({ dx = 0, dy = 0 }) => {
    fireEvent.pointerMove(handle, {
      pointerId: 1,
      clientX: at.clientX + dx,
      clientY: at.clientY + dy,
    });
    each();
  });
  fireEvent.pointerUp(handle, { pointerId: 1 });
};

const key = (name: string, which: 'ArrowUp' | 'ArrowDown' | 'ArrowLeft') => {
  const handle = grip(name);
  act(() => handle.focus());
  fireEvent.keyDown(handle, { key: which });
};

describe('the look picker’s window', () => {
  it('opens under its select at its first size', () => {
    const { close } = open();
    expect(placed()).toEqual({
      top: 534,
      bottom: 1134,
      height: 600,
      side: 'down',
    });
    close();
  });

  it('grows under the select as its bottom edge is dragged down, held to the app window', () => {
    const { close } = open();
    drag('edgeBottom', [{ dy: 50 }]);
    expect(placed()).toMatchObject({ top: 534, bottom: 1184, side: 'down' });
    expect(stored()).toEqual({ width: 880, side: 'down', height: 650 });
    drag('edgeBottom', [{ dy: 500 }]);
    expect(placed()).toMatchObject({ top: 534, bottom: 1192 });
    close();
  });

  it('flips above the select when its bottom edge is dragged up past it, its top where the pointer is', () => {
    const { close } = open();
    // From 1134 to 34.
    drag('edgeBottom', [{ dy: -1100 }]);
    expect(placed()).toEqual({
      top: 34,
      bottom: 494,
      height: 460,
      side: 'up',
    });
    expect(stored()).toEqual({ width: 880, side: 'up', height: 460 });
    // And grows above it by its top edge, now the far one.
    drag('edgeTop', [{ dy: -20 }]);
    expect(placed()).toMatchObject({ top: 14, bottom: 494, side: 'up' });
    close();
  });

  it('never covers its select at any moment of a drag, across and back', () => {
    const { close } = open();
    let flips = 0;
    let { side } = placed();
    const check = () => {
      expect(coversSelect()).toBe(false);
      // Attached: its near edge on the select's gap, on one side or the other.
      const { top, bottom } = placed();
      expect(top === 534 || bottom === 494).toBe(true);
      if (placed().side !== side) {
        flips += 1;
        ({ side } = placed());
      }
    };
    const there = Array.from({ length: 121 }, (_, index) => ({
      dy: -index * 10,
    }));
    // Up across the select, back, and up again: it ends above.
    drag('edgeBottom', [...there, ...[...there].reverse(), ...there], check);
    expect(placed().side).toBe('up');
    // The far edge is the top one now: down across, back, and down again.
    const down = Array.from({ length: 121 }, (_, index) => ({
      dy: index * 10,
    }));
    drag('edgeTop', [...down, ...[...down].reverse(), ...down], check);
    expect(placed().side).toBe('down');
    // A far corner, up and sideways at once.
    drag(
      'bottom-left',
      there.map(({ dy }) => ({ dy, dx: dy / 10 })),
      check,
    );
    // A positive control: the drags did take it across, both ways, often.
    expect(flips).toBeGreaterThanOrEqual(7);
    close();
  });

  it('moves nothing by the edge beside its select', () => {
    const { close } = open();
    drag('edgeTop', [{ dy: -300 }]);
    expect(placed()).toMatchObject({ top: 534, bottom: 1134, side: 'down' });
    // The control: the far edge does move.
    drag('edgeBottom', [{ dy: -100 }]);
    expect(placed().bottom).toBe(1034);
    close();
  });

  it('opens on the side it was put on, at the size it was left', () => {
    const first = open();
    drag('edgeBottom', [{ dy: -1100 }]);
    first.close();
    const second = open();
    expect(placed()).toEqual({
      top: 34,
      bottom: 494,
      height: 460,
      side: 'up',
    });
    second.close();
  });

  it('keeps the side it was put on while that side has room for it, though the other side has more', () => {
    window.localStorage.setItem(
      WINDOW_KEY,
      JSON.stringify({ width: 880, side: 'down', height: 600 }),
    );
    // 458 below the select, 686 above.
    Object.assign(select, { top: 700, bottom: 728 });
    const { close } = open();
    expect(placed()).toEqual({
      top: 734,
      bottom: 1192,
      height: 458,
      side: 'down',
    });
    close();
  });

  it('opens on the other side when its own is too short, and keeps the side it was put on for the next time', () => {
    window.localStorage.setItem(
      WINDOW_KEY,
      JSON.stringify({ width: 880, side: 'down', height: 600 }),
    );
    // 258 below the select, 886 above.
    Object.assign(select, { top: 900, bottom: 928 });
    const first = open();
    expect(placed()).toMatchObject({ top: 294, bottom: 894, side: 'up' });
    // A sideways resize there changes the width, not the side it was put on.
    drag('edgeLeft', [{ dx: -20 }]);
    expect(stored()).toEqual({ width: 900, side: 'down', height: 600 });
    first.close();
    // With room again, it is back where it was put.
    Object.assign(select, { top: 500, bottom: 528 });
    const second = open();
    expect(placed()).toMatchObject({ top: 534, height: 600, side: 'down' });
    second.close();
  });

  it('takes the arrow keys on its far edge, flipping from its smallest size', () => {
    const { close } = open();
    key('edgeBottom', 'ArrowDown');
    expect(placed()).toMatchObject({ top: 534, height: 624 });
    drag('edgeBottom', [{ dy: -500 }]);
    expect(placed().height).toBe(400);
    key('edgeBottom', 'ArrowUp');
    expect(placed()).toEqual({
      top: 94,
      bottom: 494,
      height: 400,
      side: 'up',
    });
    expect(stored()).toEqual({ width: 880, side: 'up', height: 400 });
    key('edgeTop', 'ArrowDown');
    expect(placed()).toMatchObject({ top: 534, height: 400, side: 'down' });
    // Sideways too.
    key('edgeLeft', 'ArrowLeft');
    expect(stored()).toMatchObject({ width: 904 });
    close();
  });

  it('goes back to its first size and side on a double press', () => {
    const { close } = open();
    drag('edgeBottom', [{ dy: -1100 }]);
    fireEvent.doubleClick(grip('edgeTop'));
    expect(placed()).toEqual({
      top: 534,
      bottom: 1134,
      height: 600,
      side: 'down',
    });
    expect(stored()).toBeNull();
    close();
  });

  it('opens a size kept under the older name under its select, and keeps it under the new one once moved', () => {
    window.localStorage.setItem(SIZE_KEY, '900x500');
    const { close } = open();
    expect(placed()).toMatchObject({ top: 534, height: 500, side: 'down' });
    drag('edgeBottom', [{ dy: 10 }]);
    expect(stored()).toEqual({ width: 900, side: 'down', height: 510 });
    expect(window.localStorage.getItem(SIZE_KEY)).toBeNull();
    close();
  });

  it('opens at its first size from a value of the reverted window that could cover its select', () => {
    window.localStorage.setItem(
      WINDOW_KEY,
      JSON.stringify({ width: 900, above: 200, below: 400 }),
    );
    const { close } = open();
    expect(placed()).toMatchObject({ top: 534, height: 600, side: 'down' });
    close();
  });
});
