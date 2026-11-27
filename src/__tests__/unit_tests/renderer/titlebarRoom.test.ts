/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * When the titlebar's creature leaves, and when she comes back.
 *
 * She leaves the moment keeping her would cost the wave width — which is
 * both ends down to their content, since the grid gives the wave its whole
 * width before either end gets a pixel beyond its own — and comes back only
 * when the room both ends have spare covers what she would take back, with a
 * pixel over, so a window on the boundary does not flip between the two.
 * The slogan under the name left with her until it left the bar (2026-10-25).
 * The layout itself is measured in the running window; this is the rule.
 */

import { act, renderHook } from '@testing-library/react';
import {
  NAME_METER_FLOOR_PX,
  isNameShedFromTitlebar,
  isShedFromTitlebar,
  isTitlebarCrowded,
  useTitlebarToolsShed,
  watchTitlebarRoom,
} from '../../../renderer/utils/useTitlebarRoom';

// The broad-pen name beside the logo (2026-11-26) goes before the meter
// starves: kept at 1100px it held the meter at 144px.
describe('the name beside the logo giving way to the meter', () => {
  it('stays while the meter keeps its floor and the bar fits', () => {
    expect(
      isNameShedFromTitlebar(false, { meter: 342, cost: 0, overrun: 0 }),
    ).toBe(false);
  });

  it('goes when it would leave the meter under its floor', () => {
    expect(
      isNameShedFromTitlebar(false, {
        meter: NAME_METER_FLOOR_PX - 1,
        cost: 0,
        overrun: 0,
      }),
    ).toBe(true);
  });

  it('goes when the bar runs past its edge, before the meter does', () => {
    expect(
      isNameShedFromTitlebar(false, { meter: 400, cost: 0, overrun: 3 }),
    ).toBe(true);
  });

  it('comes back only when the meter keeps its floor with the name in', () => {
    // At 1000px without it: 293px of meter, and the name would cost 360.
    expect(
      isNameShedFromTitlebar(true, { meter: 293, cost: 360, overrun: 0 }),
    ).toBe(true);
    // A wide window: the meter at its 420 and room to spare for the name.
    expect(
      isNameShedFromTitlebar(true, { meter: 420, cost: 60, overrun: 0 }),
    ).toBe(false);
    // On the boundary it stays out rather than flip between two layouts.
    expect(
      isNameShedFromTitlebar(true, {
        meter: NAME_METER_FLOOR_PX + 100,
        cost: 100,
        overrun: 0,
      }),
    ).toBe(true);
  });
});

describe('the titlebar giving ground before the wave does', () => {
  it('keeps her while either end has room beside its content', () => {
    expect(
      isTitlebarCrowded(false, { leftSpare: 17, rightSpare: 0, comeback: 0 }),
    ).toBe(false);
    expect(
      isTitlebarCrowded(false, { leftSpare: 0, rightSpare: 3, comeback: 0 }),
    ).toBe(false);
  });

  it('lets her go when both ends are down to their content', () => {
    // Measured at 1561px in English: both ends at their content, the wave
    // 22px short of its 420.
    expect(
      isTitlebarCrowded(false, { leftSpare: 0.05, rightSpare: 0, comeback: 0 }),
    ).toBe(true);
  });

  it('brings her back only once the room covers what she takes back', () => {
    // The creature and her gap (40 and 10).
    const comeback = 50;
    expect(
      isTitlebarCrowded(true, { leftSpare: 20, rightSpare: 29, comeback }),
    ).toBe(true);
    expect(
      isTitlebarCrowded(true, { leftSpare: 25, rightSpare: 25, comeback }),
    ).toBe(true);
    expect(
      isTitlebarCrowded(true, { leftSpare: 26, rightSpare: 25, comeback }),
    ).toBe(false);
  });

  it('does not flip on the width where she has just come back', () => {
    // Back with the least room that brings her: what is left beside the
    // content afterwards is the pixel over, split between the ends however
    // the grid splits it, and that is not "no room".
    const comeback = 50;
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
    // She left because the wave was short by some amount; the room that
    // leaving frees is what she would take back less that amount, which is
    // never enough to bring her straight back.
    const comeback = 50;
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
 * Past the creature, the bar's own parts (Ivan, 2026-09-28:
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
    const identity = document.createElement('span');
    left.append(identity);
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
    // The name alone: nothing on the left comes and goes with crowding.
    const leftContent = () => NAME;
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
    stub(identity, () => ({ width: NAME }));
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

  it('gives up the creature, then the meter, then Help and the switch, and takes them back last out first', () => {
    width = 1400;
    const { bar, left, right, parts } = mount();
    const stop = watchTitlebarRoom(bar, left, right);
    const shed = renderHook(() => useTitlebarToolsShed());
    const all = { crowded: false, meter: true, tools: true };
    expect(parts()).toEqual(all);

    // Both ends down to their content: she says least and goes first.
    resizeTo(1136.2);
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
    // Then the meter's 160, and the creature only after it: her 40, with a
    // pixel over.
    resizeTo(1096);
    expect(parts()).toEqual(noMeter);
    resizeTo(1097);
    expect(parts()).toEqual(crowded);
    resizeTo(1136);
    expect(parts()).toEqual(crowded);
    resizeTo(1137);
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

// The window's three buttons stand in the bar's own padding, flush with the
// window's edge (Ivan, 2026-11-27: "too much top and right gap"), by a
// negative margin. That much of them takes nothing from the right end, or the
// creature leaves 18px early on every window.
describe('the window buttons standing in the corner', () => {
  const TABS = 300;
  const BUTTONS = 138;
  const INSET = 18;

  const mount = (reach: number, endWidth: number) => {
    const bar = document.createElement('header');
    const left = document.createElement('div');
    const right = document.createElement('div');
    const tabs = document.createElement('span');
    const buttons = document.createElement('span');
    buttons.style.marginRight = `${-reach}px`;
    right.append(tabs, buttons);
    bar.append(left, right);
    document.body.append(bar);
    const stub = (element: HTMLElement, width: number) => {
      Object.defineProperty(element, 'offsetWidth', {
        configurable: true,
        get: () => width,
      });
      // eslint-disable-next-line no-param-reassign -- a stand-in for layout jsdom does not do
      element.getBoundingClientRect = () =>
        ({ width, right: width, left: 0 }) as DOMRect;
    };
    stub(bar, 2000);
    // The left end down to its content, so only the right one can have room.
    stub(left, 0);
    stub(right, endWidth);
    stub(tabs, TABS);
    stub(buttons, BUTTONS);
    return { bar, left, right };
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

  it('counts the inset they reach into as room the end still has', () => {
    // 10px beside what the end really holds: room, so nothing is crowded.
    const { bar, left, right } = mount(INSET, TABS + BUTTONS - INSET + 10);
    const stop = watchTitlebarRoom(bar, left, right);
    expect(bar.hasAttribute('data-crowded')).toBe(false);
    stop();
  });

  it('is crowded when the same end is short of what it holds', () => {
    // Control: the same 10px short with no inset to stand in.
    const { bar, left, right } = mount(0, TABS + BUTTONS - 10);
    const stop = watchTitlebarRoom(bar, left, right);
    expect(bar.hasAttribute('data-crowded')).toBe(true);
    stop();
  });
});
