/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */
import '@testing-library/jest-dom';
import { useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { type ILookStop, lookStopsFromColours } from 'common/lookGradient';
import { PALETTE_PRESETS } from 'common/scenePalette';
import {
  LookGradientBar,
  LookGradientChips,
} from 'renderer/components/LookGradient';
import { MENU_GAP, MENU_MARGIN } from 'renderer/widgets/menuFrame';
import { I18nProvider } from 'renderer/utils/I18nContext';

// jsdom has no PointerEvent, and the generic event Testing Library falls
// back to carries no button and no coordinates: a mouse event with an id is
// what the bar reads from one.
if (!('PointerEvent' in window)) {
  class PointerEventStandIn extends MouseEvent {
    pointerId: number;

    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 1;
    }
  }
  Object.assign(window, { PointerEvent: PointerEventStandIn });
}

const PANE_WIDTH = 164;

/** Where each point's button is on screen, by its place. */
let stopRects: Record<number, DOMRect> = {};
const rect = (left: number, top: number, width: number, height: number) =>
  ({
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => ({}),
  }) as DOMRect;

const realRect = HTMLElement.prototype.getBoundingClientRect;
const realOffsetWidth = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  'offsetWidth',
);

beforeEach(() => {
  stopRects = {};
  HTMLElement.prototype.getBoundingClientRect = function placed(
    this: HTMLElement,
  ) {
    const stop = this.getAttribute('data-stop');
    if (stop !== null && stopRects[Number(stop)]) {
      return stopRects[Number(stop)];
    }
    if (this.classList.contains('look-gradient__track')) {
      return rect(0, 100, 200, 22);
    }
    return realRect.call(this);
  };
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
    configurable: true,
    get(this: HTMLElement) {
      return this.classList.contains('look-colour-pane') ? PANE_WIDTH : 0;
    },
  });
  HTMLElement.prototype.setPointerCapture = jest.fn();
  HTMLElement.prototype.releasePointerCapture = jest.fn();
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    value: 1024,
  });
});

afterEach(() => {
  HTMLElement.prototype.getBoundingClientRect = realRect;
  if (realOffsetWidth) {
    Object.defineProperty(
      HTMLElement.prototype,
      'offsetWidth',
      realOffsetWidth,
    );
  }
});

const TWO: ILookStop[] = [
  { colour: '#000000', at: 0 },
  { colour: '#ffffff', at: 1 },
];

/** The bar as the editor holds it: its points in state, changed by itself. */
const Editable = ({
  start,
  seen,
}: {
  start: ILookStop[];
  seen?: (stops: ILookStop[]) => void;
}) => {
  const [stops, setStops] = useState(start);
  return (
    <I18nProvider>
      {/* A panel that clips and scrolls, like the look editor's body. */}
      <div data-testid="panel" style={{ overflow: 'auto', width: 250 }}>
        <LookGradientBar
          stops={stops}
          axis="frequency"
          onChange={(next) => {
            setStops(next);
            seen?.(next);
          }}
        />
      </div>
    </I18nProvider>
  );
};

const pane = () => document.querySelector<HTMLElement>('.look-colour-pane');

describe('a point’s colour pane', () => {
  it('opens beside a point at the right edge, inside the window and outside the panel', () => {
    stopRects = { 0: rect(20, 300, 16, 20), 1: rect(1000, 300, 16, 20) };
    render(<Editable start={TWO} />);
    fireEvent.click(screen.getByRole('slider', { name: /Colour 2/ }));
    const opened = pane();
    expect(opened).not.toBeNull();
    // Drawn over everything, not inside the panel that clipped it.
    expect(opened?.parentElement).toBe(document.body);
    expect(screen.getByTestId('panel')).not.toContainElement(opened);
    expect(opened?.style.position).toBe('fixed');
    // Kept inside the window: its right edge at the margin, not past it.
    const left = parseFloat(opened?.style.left ?? 'NaN');
    expect(left + PANE_WIDTH).toBeLessThanOrEqual(1024 - MENU_MARGIN);
    expect(left).toBe(1024 - MENU_MARGIN - PANE_WIDTH);
    // And under its point.
    expect(opened?.style.top).toBe(`${320 + MENU_GAP}px`);
  });

  it('hangs from the point itself where there is room (the control for the clamp above)', () => {
    stopRects = { 0: rect(400, 300, 16, 20), 1: rect(600, 300, 16, 20) };
    render(<Editable start={TWO} />);
    fireEvent.click(screen.getByRole('slider', { name: /Colour 1/ }));
    expect(pane()?.style.left).toBe('400px');
  });

  it('follows its point while the panel scrolls', () => {
    stopRects = { 0: rect(400, 300, 16, 20), 1: rect(600, 300, 16, 20) };
    render(<Editable start={TWO} />);
    fireEvent.click(screen.getByRole('slider', { name: /Colour 1/ }));
    expect(pane()?.style.top).toBe(`${320 + MENU_GAP}px`);
    stopRects[0] = rect(400, 180, 16, 20);
    act(() => {
      fireEvent.scroll(screen.getByTestId('panel'));
    });
    expect(pane()?.style.top).toBe(`${200 + MENU_GAP}px`);
  });

  it('finds its point again when the panel it is in finishes animating', () => {
    stopRects = { 0: rect(400, 300, 16, 20), 1: rect(600, 300, 16, 20) };
    render(<Editable start={TWO} />);
    fireEvent.click(screen.getByRole('slider', { name: /Colour 1/ }));
    // The editor was still growing in when the point was pressed.
    stopRects[0] = rect(400, 338, 16, 20);
    // Control: nothing has said the point moved, so the pane has not.
    expect(pane()?.style.top).toBe(`${320 + MENU_GAP}px`);
    act(() => {
      fireEvent.animationEnd(screen.getByTestId('panel'));
    });
    expect(pane()?.style.top).toBe(`${358 + MENU_GAP}px`);
  });

  it('closes on Escape without the Escape reaching the graph, which would close the editor', () => {
    stopRects = { 0: rect(400, 300, 16, 20), 1: rect(600, 300, 16, 20) };
    const graphHeard = jest.fn();
    window.addEventListener('keydown', graphHeard);
    try {
      render(<Editable start={TWO} />);
      // Control: with nothing open, the graph hears Escape.
      fireEvent.keyDown(document.body, { key: 'Escape' });
      expect(graphHeard).toHaveBeenCalledTimes(1);
      fireEvent.click(screen.getByRole('slider', { name: /Colour 1/ }));
      expect(pane()).not.toBeNull();
      fireEvent.keyDown(document.body, { key: 'Escape' });
      expect(graphHeard).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('slider', { name: /Colour 1/ })).not.toHaveClass(
        'is-open',
      );
    } finally {
      window.removeEventListener('keydown', graphHeard);
    }
  });

  it('closes on a press anywhere else', () => {
    stopRects = { 0: rect(400, 300, 16, 20), 1: rect(600, 300, 16, 20) };
    render(<Editable start={TWO} />);
    const first = screen.getByRole('slider', { name: /Colour 1/ });
    fireEvent.click(first);
    expect(first).toHaveClass('is-open');
    fireEvent.pointerDown(document.body);
    expect(first).not.toHaveClass('is-open');
  });

  it('recolours its point', () => {
    stopRects = { 0: rect(400, 300, 16, 20), 1: rect(600, 300, 16, 20) };
    const seen = jest.fn();
    render(<Editable start={TWO} seen={seen} />);
    fireEvent.click(screen.getByRole('slider', { name: /Colour 2/ }));
    fireEvent.click(screen.getByRole('button', { name: '#ff4f4f' }));
    expect(seen).toHaveBeenLastCalledWith([
      { colour: '#000000', at: 0 },
      { colour: '#ff4f4f', at: 1 },
    ]);
  });
});

describe('the gradient bar', () => {
  it('adds a point where it is pressed, in the colour already there, and opens its colours', () => {
    const seen = jest.fn();
    render(<Editable start={TWO} seen={seen} />);
    const track = document.querySelector('.look-gradient__track') as Element;
    fireEvent.pointerDown(track, { button: 0, clientX: 50, pointerId: 1 });
    expect(seen).toHaveBeenLastCalledWith([
      TWO[0],
      { colour: '#404040', at: 0.25 },
      TWO[1],
    ]);
    stopRects = { 1: rect(42, 122, 16, 20) };
    fireEvent.pointerUp(track, { button: 0, clientX: 50, pointerId: 1 });
    expect(screen.getByRole('slider', { name: /Colour 2/ })).toHaveClass(
      'is-open',
    );
  });

  it('moves a point by dragging, never past its neighbour', () => {
    const three = [TWO[0], { colour: '#808080', at: 0.5 }, TWO[1]];
    const seen = jest.fn();
    render(<Editable start={three} seen={seen} />);
    const middle = screen.getByRole('slider', { name: /Colour 2/ });
    fireEvent.pointerDown(middle, { button: 0, clientX: 100, pointerId: 1 });
    fireEvent.pointerMove(middle, { clientX: 150, pointerId: 1 });
    expect(seen).toHaveBeenLastCalledWith([
      TWO[0],
      { colour: '#808080', at: 0.75 },
      TWO[1],
    ]);
    fireEvent.pointerMove(middle, { clientX: 400, pointerId: 1 });
    expect(seen.mock.lastCall?.[0][1].at).toBeCloseTo(59 / 60);
    // A drag is not a click: the pane stays shut.
    fireEvent.click(middle, { detail: 1 });
    expect(middle).not.toHaveClass('is-open');
  });

  it('moves a point from the keyboard and removes it with Delete, never below two', () => {
    const three = [TWO[0], { colour: '#808080', at: 0.5 }, TWO[1]];
    const seen = jest.fn();
    render(<Editable start={three} seen={seen} />);
    fireEvent.keyDown(screen.getByRole('slider', { name: /Colour 2/ }), {
      key: 'ArrowRight',
    });
    expect(seen.mock.lastCall?.[0][1].at).toBeCloseTo(31 / 60);
    fireEvent.keyDown(screen.getByRole('slider', { name: /Colour 2/ }), {
      key: 'Delete',
    });
    expect(seen).toHaveBeenLastCalledWith(TWO);
    expect(screen.getAllByRole('slider')).toHaveLength(2);
    fireEvent.keyDown(screen.getByRole('slider', { name: /Colour 1/ }), {
      key: 'Delete',
    });
    expect(screen.getAllByRole('slider')).toHaveLength(2);
  });
});

describe('the ready-made gradients', () => {
  it('offer the window’s colours first and lay a picked one on the bar', () => {
    const onPick = jest.fn();
    const onFollowWindow = jest.fn();
    const { rerender } = render(
      <I18nProvider>
        <LookGradientChips
          windowStops={TWO}
          stops={undefined}
          onFollowWindow={onFollowWindow}
          onPick={onPick}
        />
      </I18nProvider>,
    );
    const chips = screen.getAllByRole('button');
    expect(chips[0]).toHaveAccessibleName("Window's colours");
    expect(chips[0]).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Magma' }));
    const magma = lookStopsFromColours(PALETTE_PRESETS.magma);
    expect(onPick).toHaveBeenCalledWith(magma);
    rerender(
      <I18nProvider>
        <LookGradientChips
          windowStops={TWO}
          stops={magma}
          onFollowWindow={onFollowWindow}
          onPick={onPick}
        />
      </I18nProvider>,
    );
    expect(screen.getByRole('button', { name: 'Magma' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(chips[0]).toHaveAttribute('aria-pressed', 'false');
  });
});
