/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What typing in the Help search, and reading down the guide, costs.
 *
 * Every key re-rendered all thirty-one chapters, captures and call-outs
 * included, and set the reading position's scroll listener and observer up
 * again from nothing; every chapter crossed while reading re-rendered all of
 * them too.
 */

import '@testing-library/jest-dom';
import { fireEvent, render, screen, within } from '@testing-library/react';
import HelpGuide from 'renderer/help/HelpGuide';
import { I18nProvider } from 'renderer/utils/I18nContext';

let mockFigureRenders = 0;

// Every capture a chapter draws, counted rather than drawn.
jest.mock('renderer/help/HelpFigure', () => ({
  __esModule: true,
  default: () => {
    mockFigureRenders += 1;
    return null;
  },
}));

const RealObserver = globalThis.ResizeObserver;
let observersMade = 0;

class CountingObserver extends RealObserver {
  constructor(callback: ResizeObserverCallback) {
    super(callback);
    observersMade += 1;
  }
}

beforeAll(() => {
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.setAttribute('open', '');
      },
    },
    close: {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.removeAttribute('open');
      },
    },
  });
  Object.defineProperties(HTMLElement.prototype, {
    scrollIntoView: { configurable: true, value: () => undefined },
    scrollTo: {
      configurable: true,
      value(this: HTMLElement, options: ScrollToOptions) {
        this.scrollTop = options.top ?? 0;
      },
    },
  });
});

beforeEach(() => {
  mockFigureRenders = 0;
  observersMade = 0;
  Object.assign(globalThis, { ResizeObserver: CountingObserver });
});

afterEach(() => {
  jest.restoreAllMocks();
  Object.assign(globalThis, { ResizeObserver: RealObserver });
});

const openGuide = () => {
  // Inside the provider, as in the app: without one, every call hands out a
  // new `t`, and nothing keyed on it can hold.
  render(
    <I18nProvider>
      <HelpGuide onClose={() => undefined} />
    </I18nProvider>,
  );
  const viewport = document.querySelector('.help-guide__article');
  if (!(viewport instanceof HTMLElement)) {
    throw new Error('The guide has no article');
  }
  return { viewport, search: screen.getByRole('searchbox') };
};

it('re-renders no chapter for a key that changes no answer', () => {
  const { search } = openGuide();
  // The control: the guide drew its captures.
  expect(mockFigureRenders).toBeGreaterThan(30);
  const settled = mockFigureRenders;
  fireEvent.change(search, { target: { value: ' ' } });
  expect(search).toHaveValue(' ');
  expect(mockFigureRenders).toBe(settled);
});

it('re-renders no chapter while reading down the guide', () => {
  const { viewport } = openGuide();
  Object.defineProperties(viewport, {
    clientHeight: { configurable: true, value: 600 },
    scrollHeight: { configurable: true, value: 16000 },
  });
  jest
    .spyOn(viewport, 'getBoundingClientRect')
    .mockReturnValue({ top: 0 } as DOMRect);
  within(viewport)
    .getAllByRole('heading', { level: 2 })
    .forEach((heading, index) => {
      jest
        .spyOn(heading, 'getBoundingClientRect')
        .mockImplementation(
          () => ({ top: index * 1000 - viewport.scrollTop }) as DOMRect,
        );
    });
  const settled = mockFigureRenders;
  viewport.scrollTop = 8100;
  fireEvent.scroll(viewport);
  // The control: the contents followed the reading position.
  const contents = screen.getByRole('navigation', { name: 'In this guide' });
  expect(within(contents).getAllByRole('button')[8]).toHaveAttribute(
    'aria-current',
    'location',
  );
  expect(mockFigureRenders).toBe(settled);
});

it('sets the reading position’s listener and observer up once, not on every key', () => {
  const { viewport, search } = openGuide();
  const listening = jest.spyOn(viewport, 'addEventListener');
  const settled = observersMade;
  ['s', 'su', 'sur', 'surround'].forEach((value) =>
    fireEvent.change(search, { target: { value } }),
  );
  // The control: the search did redraw the guide.
  expect(viewport.querySelectorAll('mark.help-mark').length).toBeGreaterThan(0);
  expect(observersMade).toBe(settled);
  expect(
    listening.mock.calls.filter(([type]) => type === 'scroll'),
  ).toHaveLength(0);
});
