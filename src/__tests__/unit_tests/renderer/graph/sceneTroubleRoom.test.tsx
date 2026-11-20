/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The card a scene that cannot be drawn leaves on the graph keeps between
 * the gallery's corner and its reel (session 0's review, 2026-11-19), from
 * where they actually stand (`galleryClearance.ts`), and says itself on one
 * line while the room left is shorter than the card as it is
 * (`troubleCardFit.ts`) - measured, never at a fixed height.
 */

import '@testing-library/jest-dom';
import { act, render } from '@testing-library/react';
import SceneTroubleState from 'renderer/graph/SceneTroubleState';
import type { ISceneTrouble } from 'renderer/graph/sceneTrouble';
import { I18nProvider } from 'renderer/utils/I18nContext';

const TROUBLE: ISceneTrouble = {
  lookId: 'premium:aurora',
  names: { en: 'Aurora' },
  swatch: ['#00e5cf', '#ff3cac'],
  reason: 'unavailable',
};

/** Every observer made, so a test can say "the sizes changed". */
let observers: Array<() => void> = [];
const realObserver = globalThis.ResizeObserver;
beforeEach(() => {
  observers = [];
  globalThis.ResizeObserver = jest.fn((callback: () => void) => {
    observers.push(callback);
    return { observe: jest.fn(), unobserve: jest.fn(), disconnect: jest.fn() };
  }) as unknown as typeof ResizeObserver;
});
afterEach(() => {
  globalThis.ResizeObserver = realObserver;
});
const resized = () => act(() => observers.forEach((observe) => observe()));

/** Puts `element` at `top`..`bottom` on the page, `width` wide. */
const place = (element: Element, top: number, bottom: number, width = 300) => {
  element.getBoundingClientRect = () =>
    ({
      top,
      bottom,
      left: 0,
      right: width,
      width,
      height: bottom - top,
      x: 0,
      y: top,
    }) as DOMRect;
};

/** A graph 400px tall from y=0, with its gallery pieces where they stand. */
const onGraph = () => {
  const graph = document.createElement('div');
  graph.className = 'graph-wrapper';
  const strip = document.createElement('div');
  strip.className = 'live-output-controls';
  const keys = document.createElement('span');
  keys.className = 'graph-gallery-keys';
  const legend = document.createElement('div');
  legend.className = 'graph-corner-legend';
  const reel = document.createElement('div');
  reel.className = 'graph-gallery-reel';
  strip.append(keys, legend, reel);
  graph.append(strip);
  document.body.append(graph);
  place(keys, 9, 41);
  place(legend, 9, 90);
  place(reel, 300, 344);
  const { container } = render(
    <I18nProvider>
      <SceneTroubleState trouble={TROUBLE} />
    </I18nProvider>,
    { container: graph.appendChild(document.createElement('div')) },
  );
  const layer = container.querySelector('.chart-scene-trouble') as HTMLElement;
  place(layer, 0, 400);
  return { graph, layer, reel };
};

describe('the card between the gallery’s corner and its reel', () => {
  it('keeps below the lowest piece at the top and above the reel, with air', () => {
    const { layer } = onGraph();
    resized();
    // The legend reaches lowest at the top (90), the reel highest at the
    // foot (300, of a 400px layer), each plus 4px.
    expect(layer.style.getPropertyValue('--gallery-clear-top')).toBe('94px');
    expect(layer.style.getPropertyValue('--gallery-clear-bottom')).toBe(
      '104px',
    );
  });

  it('follows the reel when it grows', () => {
    const { layer, reel } = onGraph();
    resized();
    // Its switches wrapped under the credit: two lines.
    place(reel, 268, 344);
    resized();
    expect(layer.style.getPropertyValue('--gallery-clear-bottom')).toBe(
      '136px',
    );
  });

  it('writes nothing off the graph, on the player’s stage', () => {
    const { container } = render(
      <I18nProvider>
        <SceneTroubleState trouble={TROUBLE} />
      </I18nProvider>,
    );
    resized();
    const layer = container.querySelector(
      '.chart-scene-trouble',
    ) as HTMLElement;
    // The control: the card is there.
    expect(layer).toBeInTheDocument();
    expect(layer.style.getPropertyValue('--gallery-clear-top')).toBe('');
  });
});

describe('the card on one line', () => {
  const sized = (element: HTMLElement, height: number, key: string) =>
    Object.defineProperty(element, key, { configurable: true, value: height });

  it('only while the room is shorter than the card as it is', () => {
    const { container } = render(
      <I18nProvider>
        <SceneTroubleState trouble={TROUBLE} />
      </I18nProvider>,
    );
    const room = container.querySelector(
      '.chart-scene-trouble__room',
    ) as HTMLElement;
    const card = container.querySelector(
      '.chart-scene-trouble__card',
    ) as HTMLElement;
    sized(card, 110, 'offsetHeight');

    sized(room, 200, 'clientHeight');
    resized();
    expect(room).not.toHaveAttribute('data-fit');

    sized(room, 60, 'clientHeight');
    resized();
    expect(room).toHaveAttribute('data-fit', 'line');

    // On one line the card is short; whether it fits as it was is judged by
    // its height as it was, so a room of 90 keeps it on one line...
    sized(card, 28, 'offsetHeight');
    sized(room, 90, 'clientHeight');
    resized();
    expect(room).toHaveAttribute('data-fit', 'line');

    // ...and one that holds the 110 lets it out.
    sized(room, 120, 'clientHeight');
    resized();
    expect(room).not.toHaveAttribute('data-fit');
  });
});
