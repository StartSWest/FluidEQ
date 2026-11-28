/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The titlebar's places giving way to the window's own buttons.
 *
 * At the largest zoom a 1024px window is 493 CSS px wide, and with the name,
 * the meter, Help and the compact-player switch all gone, the nine places
 * still pushed maximise and close past the window's right edge, where they
 * could not be pressed. The places now go too, one at a time and the least
 * used first, into the actions menu; the equaliser and the place on screen
 * never go. The layout is measured in the running window; this is the rule
 * and its order.
 */

import '@testing-library/jest-dom';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import ActionsMenuPlaces from 'renderer/components/ActionsMenuPlaces';
import {
  nextPlaceToShed,
  PLACE_BAR_ORDER,
  PLACE_SHED_ORDER,
  type TTitlebarPlace,
} from 'renderer/utils/titlebarPlaces';
import { watchTitlebarRoom } from 'renderer/utils/useTitlebarRoom';

describe('which place leaves the bar next', () => {
  const all = [...PLACE_SHED_ORDER];

  it('is the least used one still on the bar', () => {
    expect(nextPlaceToShed([], all, 'community')).toBe('video');
    expect(nextPlaceToShed(['video', 'karaoke'], all, 'community')).toBe(
      'share',
    );
  });

  it('is never the place on screen', () => {
    expect(nextPlaceToShed([], all, 'video')).toBe('karaoke');
  });

  it('skips a place the bar does not have', () => {
    // Scenes is drawn only where an account service is configured.
    const withoutScenes = all.filter((place) => place !== 'community');
    expect(
      nextPlaceToShed(
        ['video', 'karaoke', 'share', 'mic', 'games', 'library'],
        withoutScenes,
        undefined,
      ),
    ).toBe('dsp');
  });

  it('is nothing once every place but the one on screen is out', () => {
    const out = all.filter((place) => place !== 'dsp');
    expect(nextPlaceToShed(out, all, 'dsp')).toBeUndefined();
  });

  // The equaliser is not a place that can go: it is in neither list.
  it('never names the equaliser', () => {
    expect(PLACE_SHED_ORDER).not.toContain('eq');
    expect([...PLACE_BAR_ORDER].sort()).toEqual([...PLACE_SHED_ORDER].sort());
  });
});

/**
 * The whole order on a bar laid out the way its grid lays it out, as in
 * `titlebarRoom.test.ts`: two ends at `minmax(max-content, 1fr)` either side
 * of the wave, which grows to 420 before either end gets spare and shrinks to
 * a floor of 200 before anything runs past the edge. jsdom lays nothing out,
 * so every box is answered from these widths, and a place named in the bar's
 * tab wearing `data-shed` is out of the page, as the stylesheet takes it out.
 */
describe('the places giving way, and coming back', () => {
  const NAME = 120;
  const PET = 40;
  const TAB = 40;
  const MENU = 32;
  const HELP = 32;
  const SWITCH = 32;
  const KEYS = 102;
  const WAVE = 420;
  const WAVE_FLOOR = 200;

  let width = 0;
  let resize: (() => void) | undefined;

  const stub = (
    element: HTMLElement,
    box: () => { width: number; right?: number },
  ) => {
    Object.defineProperty(element, 'offsetWidth', {
      configurable: true,
      get: () => box().width,
    });
    // eslint-disable-next-line no-param-reassign -- a stand-in for layout jsdom does not do
    element.getBoundingClientRect = () => {
      const { width: w, right = w } = box();
      return { width: w, right, left: right - w } as DOMRect;
    };
  };

  const mount = (onScreen: TTitlebarPlace | 'eq') => {
    const bar = document.createElement('header');
    const left = document.createElement('div');
    const meter = document.createElement('nav');
    meter.className = 'titlebar-nav';
    const right = document.createElement('div');
    const identity = document.createElement('span');
    left.append(identity);

    const strip = document.createElement('div');
    const tabs = (['eq', ...PLACE_BAR_ORDER] as const).map((place) => {
      const tab = document.createElement('button');
      tab.className = 'workspace-tab';
      if (place !== 'eq') {
        tab.dataset.place = place;
      }
      tab.setAttribute('aria-selected', String(place === onScreen));
      strip.append(tab);
      return { place, tab };
    });
    const instrument = document.createElement('span');
    instrument.className = 'titlebar-instrument';
    const help = document.createElement('span');
    help.className = 'help-menu';
    const modeSwitch = document.createElement('span');
    modeSwitch.className = 'window-mode-switch';
    instrument.append(help, modeSwitch);
    const pet = document.createElement('span');
    pet.className = 'support-pet';
    const keys = document.createElement('span');
    right.append(strip, pet, instrument, keys);
    bar.append(left, meter, right);
    document.body.append(bar);

    const has = (name: string) => bar.hasAttribute(name);
    // In the order they go, whatever order they stand in on the bar.
    const out = () =>
      PLACE_SHED_ORDER.filter((place) =>
        tabs.some(
          ({ place: each, tab }) =>
            each === place && tab.hasAttribute('data-shed'),
        ),
      );
    const crowded = () => has('data-crowded');
    const tabWidth = (place: string) =>
      out().some((each) => each === place) ? 0 : TAB;
    const stripWidth = () =>
      tabs.reduce((total, { place }) => total + tabWidth(place), 0);
    const toolsWidth = () => (has('data-shed-tools') ? 0 : HELP + SWITCH);
    const leftContent = () => NAME;
    const rightContent = () =>
      stripWidth() + MENU + toolsWidth() + KEYS + (crowded() ? 0 : PET);
    // The wave's track goes with the meter.
    const grid = () => {
      const ends = leftContent() + rightContent();
      const meterOut = has('data-shed-meter');
      const spare = Math.max(0, width - ends - (meterOut ? 0 : WAVE));
      const overrun = Math.max(0, ends + (meterOut ? 0 : WAVE_FLOOR) - width);
      return { spare, overrun };
    };

    stub(bar, () => ({ width }));
    stub(left, () => ({ width: leftContent() + grid().spare / 2 }));
    stub(right, () => ({
      width: rightContent() + grid().spare / 2,
      right: width + grid().overrun,
    }));
    stub(meter, () => ({ width: WAVE_FLOOR }));
    stub(identity, () => ({ width: NAME }));
    stub(strip, () => ({ width: stripWidth() }));
    tabs.forEach(({ place, tab }) =>
      stub(tab, () => ({ width: tabWidth(place) })),
    );
    stub(instrument, () => ({ width: MENU + toolsWidth() }));
    stub(help, () => ({ width: HELP }));
    stub(modeSwitch, () => ({ width: SWITCH }));
    stub(keys, () => ({ width: KEYS }));
    stub(pet, () => ({ width: crowded() ? 0 : PET }));

    const choose = (place: TTitlebarPlace | 'eq') =>
      tabs.forEach(({ place: each, tab }) => {
        tab.setAttribute('aria-selected', String(each === place));
        // The bar is measured again for a class change, as a chosen tab's is.
        tab.classList.toggle('is-active', each === place);
      });
    return {
      bar,
      left,
      right,
      out,
      choose,
      overrun: () => grid().overrun,
    };
  };

  const resizeTo = (next: number) => {
    width = next;
    act(() => resize?.());
  };

  beforeAll(() => {
    window.ResizeObserver = jest.fn((callback: () => void) => {
      resize = callback;
      return {
        observe: jest.fn(),
        unobserve: jest.fn(),
        disconnect: jest.fn(),
      };
    }) as unknown as typeof ResizeObserver;
  });

  afterEach(() => {
    document.body.innerHTML = '';
    resize = undefined;
  });

  // Everything at its narrowest: the name, the 9 x 40 places, the menu and
  // the window's keys. The places give way first, so the keys stay inside.
  const ALL_IN = NAME + 9 * TAB + MENU + KEYS;

  it('keeps every place while the bar fits, with Help and the switch gone', () => {
    width = ALL_IN;
    const { bar, left, right, out, overrun } = mount('eq');
    const stop = watchTitlebarRoom(bar, left, right);
    expect(bar.hasAttribute('data-shed-tools')).toBe(true);
    expect(out()).toEqual([]);
    expect(overrun()).toBe(0);
    stop();
  });

  it('lets the places go least used first, so the window keys always fit', () => {
    width = ALL_IN;
    const { bar, left, right, out, overrun } = mount('eq');
    const stop = watchTitlebarRoom(bar, left, right);

    // One place short, then three: as many go as the bar needs, no more.
    resizeTo(ALL_IN - 1);
    expect(out()).toEqual(['video']);
    expect(overrun()).toBe(0);
    resizeTo(ALL_IN - 2 * TAB - 1);
    expect(out()).toEqual(['video', 'karaoke', 'share']);
    expect(overrun()).toBe(0);

    // Narrower than any window can be: every place but the equaliser.
    resizeTo(NAME + TAB + MENU + KEYS);
    expect(out()).toEqual([...PLACE_SHED_ORDER]);
    expect(overrun()).toBe(0);
    stop();
  });

  it('brings them back last out first, each with a pixel over, and Help after them', () => {
    width = ALL_IN - 2 * TAB - 1;
    const { bar, left, right, out } = mount('eq');
    const stop = watchTitlebarRoom(bar, left, right);
    expect(out()).toEqual(['video', 'karaoke', 'share']);

    // Exactly the room for Share Audio is not enough: it stays out rather
    // than flip between two layouts.
    resizeTo(ALL_IN - 2 * TAB);
    expect(out()).toEqual(['video', 'karaoke', 'share']);
    resizeTo(ALL_IN - 2 * TAB + 1);
    expect(out()).toEqual(['video', 'karaoke']);
    resizeTo(ALL_IN - TAB);
    expect(out()).toEqual(['video', 'karaoke']);
    resizeTo(ALL_IN - TAB + 1);
    expect(out()).toEqual(['video']);
    resizeTo(ALL_IN + 1);
    expect(out()).toEqual([]);
    expect(bar.hasAttribute('data-shed-tools')).toBe(true);
    // Help and the switch only once every place is back.
    resizeTo(ALL_IN + HELP + SWITCH + 1);
    expect(bar.hasAttribute('data-shed-tools')).toBe(false);
    stop();
  });

  it('never takes the place on screen, and brings it back when it is chosen from the menu', async () => {
    width = ALL_IN - 2 * TAB - 1;
    const { bar, left, right, out, choose, overrun } = mount('video');
    const stop = watchTitlebarRoom(bar, left, right);
    expect(out()).toEqual(['karaoke', 'share', 'mic']);

    // Karaoke chosen from the menu: back on the bar, lit, and the next in
    // line goes in its place — Online Media, no longer on screen.
    choose('karaoke');
    await new Promise<void>((resolve) => {
      queueMicrotask(resolve);
    });
    expect(out()).toEqual(['video', 'share', 'mic']);
    expect(overrun()).toBe(0);
    stop();
  });

  it('gives every place back when the watch ends', () => {
    width = NAME + TAB + MENU + KEYS;
    const { bar, left, right, out } = mount('eq');
    const stop = watchTitlebarRoom(bar, left, right);
    expect(out()).not.toEqual([]);
    stop();
    expect(out()).toEqual([]);
  });
});

describe('the actions menu listing the places that left the bar', () => {
  afterEach(cleanup);

  const shedOnABar = (onScreen: TTitlebarPlace | 'eq') => {
    // A real bar's watch publishes what the menu lists.
    const bar = document.createElement('header');
    const left = document.createElement('div');
    const right = document.createElement('div');
    const strip = document.createElement('div');
    (['eq', ...PLACE_BAR_ORDER] as const).forEach((place) => {
      const tab = document.createElement('button');
      tab.className = 'workspace-tab';
      if (place !== 'eq') {
        tab.dataset.place = place;
      }
      tab.setAttribute('aria-selected', String(place === onScreen));
      strip.append(tab);
    });
    right.append(strip);
    bar.append(left, right);
    bar.setAttribute('data-shed-tools', '');
    document.body.append(bar);
    // Always past the edge with no room spare: everything that can go, goes.
    Object.defineProperty(bar, 'getBoundingClientRect', {
      value: () => ({ width: 100, right: 100, left: 0 }) as DOMRect,
    });
    Object.defineProperty(right, 'getBoundingClientRect', {
      value: () => ({ width: 0, right: 400, left: 400 }) as DOMRect,
    });
    Object.defineProperty(left, 'getBoundingClientRect', {
      value: () => ({ width: 0, right: 0, left: 0 }) as DOMRect,
    });
    return watchTitlebarRoom(bar, left, right);
  };

  beforeAll(() => {
    window.ResizeObserver = jest.fn(() => ({
      observe: jest.fn(),
      unobserve: jest.fn(),
      disconnect: jest.fn(),
    })) as unknown as typeof ResizeObserver;
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('lists nothing while every place is on the bar', () => {
    const { container } = render(<ActionsMenuPlaces onPlace={jest.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('lists each place that left, in the order the bar draws them, and opens the one chosen', () => {
    let stop: () => void = () => undefined;
    act(() => {
      stop = shedOnABar('dsp');
    });
    const onPlace = jest.fn();
    render(<ActionsMenuPlaces onPlace={onPlace} />);
    const rows = screen.getAllByRole('menuitem');
    expect(rows.map((row) => row.textContent)).toEqual([
      'Scenes',
      'Share Audio',
      'Mic',
      'Gaming Lab',
      'Library',
      'Karaoke',
      'Online Media',
    ]);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Karaoke' }));
    expect(onPlace).toHaveBeenCalledWith('karaoke');
    act(() => stop());
  });
});
