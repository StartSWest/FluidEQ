/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * When the titlebar's tagline and creature leave, and when they come back.
 *
 * They leave the moment keeping them would cost the wave width — which is
 * both ends down to their content, since the grid gives the wave its whole
 * width before either end gets a pixel beyond its own — and come back only
 * when the room both ends have spare covers what they would take back, with a
 * pixel over, so a window on the boundary does not flip between the two.
 * The layout itself is measured in the running window; this is the rule.
 */

import { act, renderHook } from '@testing-library/react';
import {
  isShedFromTitlebar,
  isTitlebarCrowded,
  useTitlebarToolsShed,
  watchTitlebarRoom,
} from '../../../renderer/utils/useTitlebarRoom';

describe('the titlebar giving ground before the wave does', () => {
  it('keeps the two while either end has room beside its content', () => {
    expect(
      isTitlebarCrowded(false, { leftSpare: 17, rightSpare: 0, comeback: 0 }),
    ).toBe(false);
    expect(
      isTitlebarCrowded(false, { leftSpare: 0, rightSpare: 3, comeback: 0 }),
    ).toBe(false);
  });

  it('lets them go when both ends are down to their content', () => {
    // Measured at 1561px in English: both ends at their content, the wave
    // 22px short of its 420.
    expect(
      isTitlebarCrowded(false, { leftSpare: 0.05, rightSpare: 0, comeback: 0 }),
    ).toBe(true);
  });

  it('brings them back only once the room covers what they take back', () => {
    // The tagline's excess over the name above it (88px in English) and the
    // creature with her gap (50).
    const comeback = 138;
    expect(
      isTitlebarCrowded(true, { leftSpare: 60, rightSpare: 70, comeback }),
    ).toBe(true);
    expect(
      isTitlebarCrowded(true, { leftSpare: 69, rightSpare: 69, comeback }),
    ).toBe(true);
    expect(
      isTitlebarCrowded(true, { leftSpare: 70, rightSpare: 69, comeback }),
    ).toBe(false);
  });

  it('does not flip on the width where they have just come back', () => {
    // Back with the least room that brings them: what is left beside the
    // content afterwards is the pixel over, split between the ends however
    // the grid splits it, and that is not "no room".
    const comeback = 138;
    const spare = comeback + 1;
    expect(
      isTitlebarCrowded(true, { leftSpare: spare, rightSpare: 0, comeback }),
    ).toBe(false);
    [0, 0.5, 1].forEach((leftShare) => {
      const left = leftShare * (spare - comeback);
      expect(
        isTitlebarCrowded(false, {
          leftSpare: left,
          rightSpare: spare - comeback - left,
          comeback: 0,
        }),
      ).toBe(false);
    });
  });

  it('stays crowded after leaving, whatever the leaving freed', () => {
    // They left because the wave was short by some amount; the room that
    // leaving frees is what they would take back less that amount, which is
    // never enough to bring them straight back.
    const comeback = 138;
    [0, 1, 22, 47, 200].forEach((short) => {
      const freed = Math.max(0, comeback - short);
      expect(
        isTitlebarCrowded(true, {
          leftSpare: freed / 2,
          rightSpare: freed / 2,
          comeback,
        }),
      ).toBe(true);
    });
  });
});

/**
 * What the bar is measured again for. Every step of the actions menu's
 * Brightness slider rewrote its percentage inside the right end, and each
 * rewrite measured the bar — five reads of a layout just restyled everywhere,
 * most of what held the slider to 20 frames a second. A menu is out of the
 * flow and changes no end's width.
 */
describe('the titlebar measured again', () => {
  const settle = () =>
    new Promise<void>((resolve) => {
      queueMicrotask(resolve);
    });

  const bar = () => {
    const header = document.createElement('header');
    const left = document.createElement('div');
    const right = document.createElement('div');
    const tab = document.createElement('span');
    tab.textContent = 'Online Media';
    const menu = document.createElement('div');
    menu.setAttribute('role', 'menu');
    const percent = document.createElement('span');
    percent.textContent = '25%';
    menu.append(percent);
    right.append(tab, menu);
    header.append(left, right);
    document.body.append(header);
    return { header, left, right, tab, percent };
  };

  beforeAll(() => {
    // jsdom has no ResizeObserver; the bar's size is not what is tested here.
    window.ResizeObserver = jest.fn(() => ({
      observe: jest.fn(),
      unobserve: jest.fn(),
      disconnect: jest.fn(),
    }));
  });

  it('is not measured for what changes inside an open menu', async () => {
    const { header, left, right, percent } = bar();
    const stop = watchTitlebarRoom(header, left, right);
    const reads = jest.spyOn(right, 'getBoundingClientRect');
    percent.textContent = '26%';
    percent.className = 'is-moving';
    await settle();
    expect(reads).not.toHaveBeenCalled();
    stop();
    header.remove();
  });

  // The control: the same kind of change in the flow is measured.
  it('is measured for what changes in the flow', async () => {
    const { header, left, right, tab } = bar();
    const stop = watchTitlebarRoom(header, left, right);
    const reads = jest.spyOn(right, 'getBoundingClientRect');
    tab.textContent = 'Multimedia en línea';
    await settle();
    expect(reads).toHaveBeenCalled();
    stop();
    header.remove();
  });
});

/**
 * Past the tagline and the creature, the bar's own parts (Ivan, 2026-09-28:
 * "shed small things"): zoomed in, the ends at their content and the meter at
 * its floor ran the window's buttons off its right edge. The meter goes when
 * the right end runs past the bar, then Help and the compact-player switch;
 * each comes back once the ends have spare what it takes back, with a pixel
 * over.
 */
describe('the titlebar shedding its own parts', () => {
  it('lets one go only once the bar runs past its edge', () => {
    const fits = { spare: 0, takesBack: 0 };
    expect(isShedFromTitlebar(false, { ...fits, overrun: 0 })).toBe(false);
    expect(isShedFromTitlebar(false, { ...fits, overrun: 0.5 })).toBe(false);
    expect(isShedFromTitlebar(false, { ...fits, overrun: 0.6 })).toBe(true);
  });

  it('brings it back only once the room covers it with a pixel over', () => {
    const takesBack = 160;
    expect(
      isShedFromTitlebar(true, { overrun: 0, spare: takesBack, takesBack }),
    ).toBe(true);
    expect(
      isShedFromTitlebar(true, { overrun: 0, spare: takesBack + 1, takesBack }),
    ).toBe(false);
    // Out, how far the rest runs past the edge says nothing about coming back.
    expect(
      isShedFromTitlebar(true, {
        overrun: 40,
        spare: takesBack + 1,
        takesBack,
      }),
    ).toBe(false);
  });
});

/**
 * The whole order on a bar laid out the way its grid lays it out: two ends at
 * `minmax(max-content, 1fr)` either side of the wave's `auto` track, the wave
 * growing to its 420px before either end gets spare and shrinking to a 200px
 * floor before anything runs past the edge. The widths are English's, as
 * measured in the window; jsdom lays nothing out, so every box is answered
 * from them.
 */
describe('the titlebar giving up its parts in order, and taking them back', () => {
  const NAME = 120;
  const TAGLINE = 208;
  const PET = 40;
  const TABS = 300;
  const MENU = 32;
  const HELP = 32;
  const SWITCH = 32;
  const METER = 160;
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

  const mount = () => {
    const bar = document.createElement('header');
    const left = document.createElement('div');
    const meter = document.createElement('nav');
    meter.className = 'titlebar-nav';
    const right = document.createElement('div');
    const column = document.createElement('span');
    const tagline = document.createElement('span');
    tagline.className = 'workspace-header__tagline';
    column.append(tagline);
    left.append(column);
    const tabs = document.createElement('span');
    const instrument = document.createElement('span');
    instrument.className = 'titlebar-instrument';
    const help = document.createElement('span');
    help.className = 'help-menu';
    const modeSwitch = document.createElement('span');
    modeSwitch.className = 'window-mode-switch';
    instrument.append(help, modeSwitch);
    const pet = document.createElement('span');
    pet.className = 'support-pet';
    right.append(tabs, instrument, pet);
    bar.append(left, meter, right);
    document.body.append(bar);

    const has = (name: string) => bar.hasAttribute(name);
    const crowded = () => has('data-crowded');
    const leftContent = () => (crowded() ? NAME : TAGLINE);
    const toolsWidth = () => (has('data-shed-tools') ? 0 : HELP + SWITCH);
    const rightContent = () =>
      TABS + MENU + toolsWidth() + (crowded() ? 0 : PET);
    const meterWidth = () => (has('data-shed-meter') ? 0 : METER);
    const grid = () => {
      const ends = leftContent() + meterWidth() + rightContent();
      const spare = Math.max(0, width - ends - WAVE);
      const overrun = Math.max(0, ends + WAVE_FLOOR - width);
      return { spare, overrun };
    };

    stub(bar, () => ({ width }));
    stub(left, () => ({ width: leftContent() + grid().spare / 2 }));
    stub(right, () => ({
      width: rightContent() + grid().spare / 2,
      right: width + grid().overrun,
    }));
    stub(meter, () => ({ width: METER }));
    stub(column, () => ({ width: leftContent() }));
    stub(tagline, () => ({ width: TAGLINE }));
    stub(tabs, () => ({ width: TABS }));
    stub(instrument, () => ({ width: MENU + toolsWidth() }));
    stub(help, () => ({ width: HELP }));
    stub(modeSwitch, () => ({ width: SWITCH }));
    // Out of the page while the bar is crowded, as the app takes her out.
    stub(pet, () => ({ width: crowded() ? 0 : PET }));

    const parts = () => ({
      crowded: crowded(),
      meter: !has('data-shed-meter'),
      tools: !has('data-shed-tools'),
    });
    return { bar, left, right, parts };
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

  it('gives up the tagline and creature, then the meter, then Help and the switch, and takes them back last out first', () => {
    width = 1400;
    const { bar, left, right, parts } = mount();
    const stop = watchTitlebarRoom(bar, left, right);
    const shed = renderHook(() => useTitlebarToolsShed());
    const all = { crowded: false, meter: true, tools: true };
    expect(parts()).toEqual(all);

    // Both ends down to their content: the two that say least go first.
    resizeTo(1224.2);
    const crowded = { crowded: true, meter: true, tools: true };
    expect(parts()).toEqual(crowded);
    // The wave narrowing to its floor takes nothing more.
    resizeTo(900);
    expect(parts()).toEqual(crowded);
    // Past the edge by 6px: the meter.
    resizeTo(870);
    const noMeter = { crowded: true, meter: false, tools: true };
    expect(parts()).toEqual(noMeter);
    expect(shed.result.current).toBe(false);
    // Past it again: Help and the switch, which the actions menu takes in.
    resizeTo(700);
    const noTools = { crowded: true, meter: false, tools: false };
    expect(parts()).toEqual(noTools);
    expect(shed.result.current).toBe(true);

    // Back the other way: the 64px they take back, with a pixel over.
    resizeTo(936);
    expect(parts()).toEqual(noTools);
    resizeTo(937);
    expect(parts()).toEqual(noMeter);
    expect(shed.result.current).toBe(false);
    // Then the meter's 160, and the tagline and creature only after it.
    resizeTo(1096);
    expect(parts()).toEqual(noMeter);
    resizeTo(1097);
    expect(parts()).toEqual(crowded);
    resizeTo(1224);
    expect(parts()).toEqual(crowded);
    resizeTo(1225);
    expect(parts()).toEqual(all);

    stop();
    shed.unmount();
  });

  it('opens at its narrowest already down to the tabs and the window buttons, and comes back whole in one measure', () => {
    width = 600;
    const { bar, left, right, parts } = mount();
    const stop = watchTitlebarRoom(bar, left, right);
    expect(parts()).toEqual({ crowded: true, meter: false, tools: false });

    resizeTo(1400);
    expect(parts()).toEqual({ crowded: false, meter: true, tools: true });

    // Stopped, the bar is left as it was found, and the menu gives Help back.
    resizeTo(600);
    stop();
    expect(bar.hasAttribute('data-shed-tools')).toBe(false);
    expect(renderHook(() => useTitlebarToolsShed()).result.current).toBe(false);
  });
});
