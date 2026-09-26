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

import {
  isTitlebarCrowded,
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
