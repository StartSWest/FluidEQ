/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * An anchored menu keeps the side of its trigger it opened on for as long as
 * it stays open (Ivan, 2026-11-26, the Auto EQ panel: "this menu grows and
 * swaps top/bottom, not good because it is annoying"). Its content growing or
 * shrinking — a view swapped in, whose animated height ends a transition —
 * scrolls inside it; only a reopening, a window resize or the trigger moving
 * chooses the side again.
 */

import { act, fireEvent, render } from '@testing-library/react';
import { useState } from 'react';
import AnchoredMenu from 'renderer/widgets/AnchoredMenu';

/**
 * A trigger 138px from the bottom of jsdom's 768px window: 124px of room
 * below it (630 + 6 gap + 8 margin) and 586px above.
 */
const ROOM_BELOW = 768 - 630 - 6 - 8;
const triggerAt = (top: number) =>
  ({
    top,
    bottom: top + 30,
    left: 400,
    right: 700,
    width: 300,
    height: 30,
    x: 400,
    y: top,
    toJSON: () => ({}),
  }) as DOMRect;

/** How tall the menu's content is; jsdom lays nothing out. */
let contentHeight = 0;

const Harness = ({ isOpen }: { isOpen: boolean }) => {
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  return (
    <>
      <button type="button" ref={setAnchor}>
        Auto EQ
      </button>
      <AnchoredMenu
        anchor={anchor}
        isOpen={isOpen}
        className="menu"
        role="dialog"
      >
        <p>Content</p>
      </AnchoredMenu>
    </>
  );
};

const menu = () => {
  const found = document.querySelector<HTMLElement>('[data-anchored-menu]');
  if (!found) {
    throw new Error('the menu is not open');
  }
  return found;
};

/** What a view change does: the content's height moves and its transition ends. */
const contentBecomes = (height: number) => {
  contentHeight = height;
  act(() => {
    fireEvent.transitionEnd(menu());
  });
};

let rectSpy: jest.SpyInstance;

beforeEach(() => {
  contentHeight = 0;
  jest
    .spyOn(HTMLElement.prototype, 'scrollHeight', 'get')
    .mockImplementation(function scrollHeight(this: HTMLElement) {
      return this.hasAttribute('data-anchored-menu') ? contentHeight : 0;
    });
  rectSpy = jest
    .spyOn(HTMLButtonElement.prototype, 'getBoundingClientRect')
    .mockReturnValue(triggerAt(600));
});

afterEach(() => {
  jest.restoreAllMocks();
  window.innerHeight = 768;
});

describe('an anchored menu keeps its side while it is open', () => {
  it('opens above when its content does not fit below (the control)', () => {
    contentHeight = 400;
    render(<Harness isOpen />);
    expect(menu().dataset.side).toBe('up');
  });

  it('stays below and scrolls when its content grows past the room there', () => {
    contentHeight = 100;
    render(<Harness isOpen />);
    expect(menu().dataset.side).toBe('down');

    contentBecomes(400);

    expect(menu().dataset.side).toBe('down');
    expect(menu().style.top).not.toBe('');
    // Capped at the room below, so the rest scrolls inside the menu.
    expect(menu().style.maxHeight).toBe(`${ROOM_BELOW}px`);
  });

  it('stays above when its content shrinks to fit below', () => {
    contentHeight = 400;
    render(<Harness isOpen />);
    expect(menu().dataset.side).toBe('up');

    contentBecomes(100);

    expect(menu().dataset.side).toBe('up');
    expect(menu().style.bottom).not.toBe('');
  });

  it('chooses again when it is opened again', () => {
    contentHeight = 100;
    const { rerender } = render(<Harness isOpen />);
    contentBecomes(400);
    expect(menu().dataset.side).toBe('down');

    rerender(<Harness isOpen={false} />);
    rerender(<Harness isOpen />);

    expect(menu().dataset.side).toBe('up');
  });

  it('chooses again when the window is resized', () => {
    contentHeight = 100;
    render(<Harness isOpen />);
    contentBecomes(400);
    expect(menu().dataset.side).toBe('down');

    act(() => {
      window.innerHeight = 760;
      window.dispatchEvent(new Event('resize'));
    });

    expect(menu().dataset.side).toBe('up');
  });

  it('chooses again when its trigger moves', () => {
    contentHeight = 100;
    render(<Harness isOpen />);
    contentBecomes(400);
    expect(menu().dataset.side).toBe('down');

    rectSpy.mockReturnValue(triggerAt(590));
    act(() => {
      fireEvent.scroll(document.body);
    });

    expect(menu().dataset.side).toBe('up');
  });
});
