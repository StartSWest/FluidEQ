/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The look picker's window, sized and placed by its reader (Ivan,
 * 2026-11-23: "resize it down so it shows below the select or up so it
 * shows on top of the select"): the bottom edge grows it under the select,
 * the top edge over it, both together put it past the select both ways,
 * and it opens as it was left. Held inside the app window, and back to its
 * first size and place on a double press.
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

/** The select, from 500 to 528 and ending at 1200 across. */
const SELECT = { top: 500, bottom: 528, left: 1000, right: 1200 };

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
          SELECT.left,
          SELECT.top,
          SELECT.right - SELECT.left,
          SELECT.bottom - SELECT.top,
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
  const select = document.createElement('div');
  select.dataset.select = '';
  document.body.appendChild(select);
  const view = render(
    <LookPickerWindow anchor={select} isOpen ariaLabel="Styles and scenes">
      <div className="look-picker__body" />
    </LookPickerWindow>,
  );
  return {
    close: () => {
      view.unmount();
      select.remove();
    },
  };
};

const grip = (name: string) =>
  name.includes('-')
    ? menu().querySelector<HTMLElement>(`.look-picker__grip--${name}`)
    : screen.getByRole('separator', { name: `graph.picker.${name}` });

/** A press on a grip, a move by `dy` (and `dx`), and the release. */
const drag = (name: string, dy: number, dx = 0) => {
  const handle = grip(name);
  if (!handle) {
    throw new Error(`no ${name} grip`);
  }
  const at = { clientX: 600, clientY: 600 };
  fireEvent.pointerDown(handle, { button: 0, pointerId: 1, ...at });
  fireEvent.pointerMove(handle, {
    pointerId: 1,
    clientX: at.clientX + dx,
    clientY: at.clientY + dy,
  });
  fireEvent.pointerUp(handle, { pointerId: 1 });
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
    drag('edgeBottom', 50);
    expect(placed()).toMatchObject({ top: 534, bottom: 1184, side: 'down' });
    expect(stored()).toEqual({ width: 880, above: null, below: 650 });
    // Past the app window's foot it stops at the margin.
    drag('edgeBottom', 500);
    expect(placed()).toMatchObject({ top: 534, bottom: 1192 });
    close();
  });

  it('grows over the select as its top edge is dragged up, its bottom staying put', () => {
    const { close } = open();
    drag('edgeTop', -300);
    expect(placed()).toEqual({
      top: 234,
      bottom: 1134,
      height: 900,
      side: 'over',
    });
    expect(stored()).toEqual({ width: 880, above: 260, below: 600 });
    close();
  });

  it('stands wholly over the select once its bottom edge is dragged past it, and opens there again', () => {
    const first = open();
    // Down to the smallest window, then up over the select.
    drag('edgeBottom', -500);
    expect(placed()).toMatchObject({ top: 534, bottom: 934 });
    drag('edgeTop', -490);
    expect(placed()).toMatchObject({ top: 44, bottom: 934, side: 'over' });
    drag('edgeBottom', -454);
    expect(placed()).toEqual({
      top: 44,
      bottom: 494,
      height: 450,
      side: 'up',
    });
    first.close();
    const second = open();
    expect(placed()).toEqual({
      top: 44,
      bottom: 494,
      height: 450,
      side: 'up',
    });
    second.close();
  });

  it('never leaves an edge across the select', () => {
    const { close } = open();
    // From 534 to 520, short of the select's middle: the top stays under it.
    drag('edgeTop', -14);
    expect(placed().top).toBe(534);
    // To 510, past its middle: over it at once.
    drag('edgeTop', -24);
    expect(placed().top).toBe(494);
    close();
  });

  it('is held inside the app window, top and sides', () => {
    const { close } = open();
    drag('edgeBottom', -500);
    drag('edgeTop', -2000);
    expect(placed().top).toBe(8);
    drag('edgeLeft', 0, -2000);
    expect(menu().getBoundingClientRect().left).toBe(8);
    close();
  });

  it('moves by its corners on both axes', () => {
    const { close } = open();
    drag('bottom-left', 40, -60);
    expect(placed()).toMatchObject({ top: 534, bottom: 1174 });
    expect(stored()).toEqual({ width: 940, above: null, below: 640 });
    close();
  });

  it('takes the arrow keys on a focused edge, crossing the select in a step', () => {
    const { close } = open();
    const top = grip('edgeTop');
    if (!top) {
      throw new Error('no top grip');
    }
    act(() => top.focus());
    fireEvent.keyDown(top, { key: 'ArrowUp' });
    expect(placed()).toMatchObject({ top: 494, side: 'over' });
    fireEvent.keyDown(top, { key: 'ArrowUp' });
    expect(placed().top).toBe(470);
    expect(stored()).toEqual({ width: 880, above: 24, below: 600 });
    fireEvent.keyDown(top, { key: 'ArrowDown' });
    fireEvent.keyDown(top, { key: 'ArrowDown' });
    expect(placed()).toMatchObject({ top: 534, side: 'down' });
    close();
  });

  it('goes back to its first size and place on a double press', () => {
    const { close } = open();
    drag('edgeTop', -300);
    expect(stored()).not.toBeNull();
    fireEvent.doubleClick(grip('edgeTop') as HTMLElement);
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
    drag('edgeBottom', 10);
    expect(stored()).toEqual({ width: 900, above: null, below: 510 });
    expect(window.localStorage.getItem(SIZE_KEY)).toBeNull();
    close();
  });
});
