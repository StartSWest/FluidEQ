/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Where the visualizers stand, for the Ambient mode's elements and light to
 * stay off: every one on screen, only the part that is on screen, and read
 * again whenever asked, so a page that moved is answered where it is now.
 *
 * jsdom lays nothing out, so each box is given.
 */

import {
  outermostBoxes,
  visualizerBoxes,
} from '../../../renderer/ambient/visualizerSurfaces';

const place = (
  element: Element,
  left: number,
  top: number,
  width: number,
  height: number,
) => {
  // eslint-disable-next-line no-param-reassign -- jsdom lays nothing out; the box is the test's to give
  element.getBoundingClientRect = () =>
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
  return element;
};

const surface = (
  className: string,
  box: [number, number, number, number],
  parent: Element = document.body,
) => {
  const element = document.createElement('div');
  element.className = className;
  parent.appendChild(element);
  return place(element, ...box);
};

beforeEach(() => {
  document.body.innerHTML = '';
});

it('answers every kind of visualizer on screen, and nothing else', () => {
  surface('graph-plot', [10, 20, 300, 100]);
  surface('studio-stage', [400, 20, 200, 100]);
  surface('studio-stage__well--empty', [10, 200, 100, 50]);
  surface('gallery-preview__frame', [200, 200, 100, 50]);
  surface('gallery-picture', [400, 200, 100, 50]);
  surface('studio-card', [600, 200, 100, 50]);
  expect(visualizerBoxes(1000, 800)).toHaveLength(5);
});

it('reads a visualizer where it stands now, not where it stood', () => {
  const picture = surface('gallery-picture', [100, 300, 200, 100]);
  expect(visualizerBoxes(1000, 800)[0]).toMatchObject({ top: 300 });
  place(picture, 100, 120, 200, 100);
  expect(visualizerBoxes(1000, 800)[0]).toMatchObject({ top: 120 });
  picture.remove();
  expect(visualizerBoxes(1000, 800)).toEqual([]);
});

it('keeps only the part on screen: inside the list it scrolls in, and the window', () => {
  const list = document.createElement('div');
  list.style.overflowY = 'auto';
  document.body.appendChild(list);
  place(list, 0, 100, 500, 300);
  // Half scrolled up under the bar above the list.
  surface('gallery-picture', [20, 50, 200, 100], list);
  // Past the window's right edge.
  surface('graph-plot', [900, 500, 300, 100]);
  expect(visualizerBoxes(1000, 800)).toEqual([
    { left: 900, top: 500, width: 100, height: 100 },
    { left: 20, top: 100, width: 200, height: 50 },
  ]);
});

it('leaves out a visualizer with no size, one scrolled wholly away, and one not shown', () => {
  surface('graph-plot', [10, 10, 0, 0]);
  surface('gallery-picture', [10, 900, 100, 100]);
  const hidden = surface('studio-stage', [10, 10, 100, 100]);
  Object.assign(hidden, { checkVisibility: () => false });
  expect(visualizerBoxes(1000, 800)).toEqual([]);
});

it('keeps one hole per place: a box inside another, or the same box twice, is one', () => {
  const frame = { left: 0, top: 0, width: 400, height: 300 };
  const inside = { left: 20, top: 20, width: 100, height: 50 };
  const apart = { left: 500, top: 0, width: 100, height: 100 };
  expect(outermostBoxes([inside, frame, apart, { ...frame }])).toEqual([
    frame,
    apart,
  ]);
});
