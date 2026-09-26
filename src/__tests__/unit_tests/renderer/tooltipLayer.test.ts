/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The app's own tooltips (`utils/tooltipLayer.ts`), under the pointer.
 *
 * On 2026-09-25 the window stopped showing the system's tooltips, as part of
 * the "open floor" layout Ivan chose that day ("custom nice tooltips instead
 * of system one"): every hint is drawn by one tooltip of the app's, in the
 * menus' surface, after half a second of rest. The page still writes `title`
 * — some four hundred of them, the only words an icon button has — and SVG
 * shapes, which take no such attribute, write `data-tooltip`.
 *
 * What a user sees here is nothing a stylesheet or a role query can check:
 * that Chromium's own tooltip never shows beside the app's (it draws one for
 * any hovered title, so the hovered element lends its title to the layer and
 * gets it back when the pointer leaves), which title is described, and when
 * the tooltip shows — after a rest, at once while the last one is still up,
 * never on a sweep across a toolbar, and not again after a press until the
 * pointer moves on. The page rewriting titles, icon buttons' names, the
 * keyboard and placement are in `tooltipLayerPage.test.tsx`; the browser both
 * run in is modelled in `utils/tooltipBrowser.ts`.
 */

import '@testing-library/jest-dom';
import { applyMotionPreference } from 'renderer/utils/motionPreference';
import installTooltipLayer from 'renderer/utils/tooltipLayer';
import {
  ENTER_MS,
  HOLD_MS,
  LEAVE_MS,
  SHOWN_MS,
  animationCount,
  atPointer,
  build,
  drawnOpacity,
  find,
  isOpen,
  lastEntrance,
  leaveWindow,
  moveTo,
  observersHear,
  pointerEvent,
  pressKey,
  seen,
  setUpTooltipBrowser,
  systemTooltip,
  tabTo,
  tooltip,
  topLayer,
  wait,
} from '../../utils/tooltipBrowser';

setUpTooltipBrowser(installTooltipLayer);

describe('the pointer resting on a titled control', () => {
  it("shows its title after half a second's rest, and the system's tooltip has nothing to show", () => {
    build(
      '<button type="button" title="Loop">Loop</button><p class="gap">…</p>',
    );
    const button = find('button');
    // The control for every "nothing" below: with nothing lent — a touch,
    // which the layer leaves alone — Chromium's tooltip reads the title.
    moveTo(button, undefined, 'touch');
    expect(systemTooltip()).toBe('Loop');
    moveTo(find('.gap'));

    moveTo(button);
    expect(systemTooltip()).toBe('');
    expect(isOpen()).toBe(true);
    expect(seen()).toBeUndefined();
    wait(HOLD_MS - 1);
    expect(seen()).toBeUndefined();
    wait(1 + ENTER_MS / 2);
    expect(drawnOpacity()).toBeGreaterThan(0);
    expect(drawnOpacity()).toBeLessThan(1);
    wait(ENTER_MS / 2);
    expect(seen()).toBe('Loop');
    expect(drawnOpacity()).toBe(1);
    expect(systemTooltip()).toBe('');
  });

  it('puts the title back when the pointer leaves, and fades out rather than vanishing', () => {
    build(
      '<button type="button" title="Loop">Loop</button><p class="gap">…</p>',
    );
    const button = find('button');
    moveTo(button);
    wait(SHOWN_MS);
    expect(button).toHaveAttribute('title', '');

    moveTo(find('.gap'));
    expect(button).toHaveAttribute('title', 'Loop');
    expect(seen()).toBe('Loop');
    wait(LEAVE_MS / 2);
    expect(drawnOpacity()).toBeGreaterThan(0);
    expect(drawnOpacity()).toBeLessThan(1);
    wait(LEAVE_MS / 2);
    expect(isOpen()).toBe(false);
    expect(seen()).toBeUndefined();
  });

  it('shows nothing on a sweep across a toolbar, and shows the control rested on after it', () => {
    build(
      '<button type="button" title="Shuffle">S</button>' +
        '<button type="button" title="Repeat">R</button>' +
        '<button type="button" title="Crossfade">C</button>',
    );
    const [shuffle, repeat, crossfade] = Array.from(
      document.querySelectorAll('main button'),
    );
    moveTo(shuffle);
    wait(200);
    expect(seen()).toBeUndefined();
    moveTo(repeat);
    wait(200);
    expect(seen()).toBeUndefined();
    moveTo(crossfade);
    wait(HOLD_MS - 1);
    expect(seen()).toBeUndefined();
    wait(1 + ENTER_MS);
    expect(seen()).toBe('Crossfade');
  });

  it('moves along a row at once while the last one is still up, and waits again once it has gone', () => {
    build(
      '<button type="button" class="previous" title="Previous">P</button>' +
        '<button type="button" class="next" title="Next">N</button>' +
        '<p class="gap">…</p>',
    );
    const previous = find('.previous');
    const next = find('.next');
    const gap = find('.gap');
    moveTo(previous);
    wait(SHOWN_MS);
    moveTo(next);
    expect(seen()).toBe('Next');
    expect(drawnOpacity()).toBe(1);

    // Off the row and back on before the fade has finished.
    moveTo(gap);
    wait(LEAVE_MS - 10);
    expect(seen()).toBe('Next');
    moveTo(previous);
    expect(seen()).toBe('Previous');
    expect(drawnOpacity()).toBe(1);

    // Off long enough for it to go: the next one rests again.
    moveTo(gap);
    wait(LEAVE_MS);
    expect(isOpen()).toBe(false);
    moveTo(next);
    expect(seen()).toBeUndefined();
    wait(SHOWN_MS);
    expect(seen()).toBe('Next');
  });

  it('is one element for the whole window, a manual popover in the top layer', () => {
    build(
      '<button type="button" class="previous" title="Previous">P</button>' +
        '<button type="button" class="next" title="Next">N</button>',
    );
    moveTo(find('.previous'));
    wait(SHOWN_MS);
    moveTo(find('.next'));
    expect(seen()).toBe('Next');
    expect(document.querySelectorAll('.app-tooltip')).toHaveLength(1);
    const tip = tooltip();
    expect(tip?.parentElement).toBe(document.body);
    expect(tip).toHaveAttribute('role', 'tooltip');
    expect(tip).toHaveAttribute('popover', 'manual');
    expect(topLayer).toContain(tip);
  });

  describe('above a dialog that opened while it waited', () => {
    beforeEach(() =>
      build(
        '<button type="button" class="earlier">Library</button>' +
          '<button type="button" class="behind" title="Open the guide">?</button>' +
          '<div class="guide" popover="manual">' +
          '<button type="button" class="close" title="Close the guide">×</button>' +
          '</div>',
      ),
    );

    /** The pointer resting on a control, and a dialog opening before its tooltip shows. */
    const openWhileItWaits = () => {
      const guide = find('.guide');
      moveTo(find('.behind'));
      wait(HOLD_MS / 2);
      guide.showPopover();
      // The control: as it stands, the dialog is over the tooltip.
      expect(topLayer.indexOf(guide)).toBeGreaterThan(
        topLayer.indexOf(tooltip() ?? guide),
      );
      return guide;
    };

    it('for the control the pointer reaches in it', () => {
      const guide = openWhileItWaits();
      moveTo(find('.close'));
      wait(SHOWN_MS);
      expect(seen()).toBe('Close the guide');
      expect(topLayer[topLayer.length - 1]).toBe(tooltip());
      guide.hidePopover();
    });

    // After the keyboard was last used, a script's focus is the keyboard's
    // too, so the dialog focusing its first control describes it.
    it('for the control the dialog focuses', () => {
      tabTo(find('.earlier'));
      const guide = openWhileItWaits();
      find('.close').focus();
      wait(SHOWN_MS);
      expect(seen()).toBe('Close the guide');
      expect(topLayer[topLayer.length - 1]).toBe(tooltip());
      guide.hidePopover();
    });
  });
});

describe('what the pointer is told about', () => {
  const bandRow = () =>
    build(
      '<div class="band" title="Band 3: 1 kHz">' +
        '<button type="button" class="bypass" title="Bypass this band">' +
        '<svg class="glyph"><path d="M0 0L8 8"></path></svg>' +
        '</button>' +
        '<span class="value">-3 dB</span>' +
        '</div>',
    );

  it('describes a control from anywhere inside it, and moving about inside it changes nothing', () => {
    bandRow();
    const bypass = find('.bypass');
    moveTo(find<SVGPathElement>('.glyph path'));
    wait(SHOWN_MS);
    expect(seen()).toBe('Bypass this band');
    const startedSoFar = animationCount();

    moveTo(find<SVGSVGElement>('.glyph'));
    moveTo(bypass);
    expect(animationCount()).toBe(startedSoFar);
    expect(seen()).toBe('Bypass this band');
    expect(drawnOpacity()).toBe(1);
    expect(bypass).toHaveAttribute('title', '');
    expect(systemTooltip()).toBe('');
  });

  it('describes the innermost title and lends every title around it', () => {
    bandRow();
    const band = find('.band');
    const bypass = find('.bypass');
    moveTo(find<SVGPathElement>('.glyph path'));
    wait(SHOWN_MS);
    expect(seen()).toBe('Bypass this band');
    // An inner title does not stop an outer one's in every engine.
    expect(band).toHaveAttribute('title', '');

    moveTo(find('.value'));
    expect(seen()).toBe('Band 3: 1 kHz');
    expect(drawnOpacity()).toBe(1);
    expect(bypass).toHaveAttribute('title', 'Bypass this band');
    expect(band).toHaveAttribute('title', '');

    leaveWindow();
    expect(band).toHaveAttribute('title', 'Band 3: 1 kHz');
  });

  it('shows nothing under an empty title, which says "nothing here" to it as to the browser', () => {
    build(
      '<div class="row" title="Drag to reorder">' +
        '<span class="quiet" title="">Muted</span>' +
        '<span class="plain">Plain</span>' +
        '</div>',
    );
    const row = find('.row');
    moveTo(find('.quiet'));
    wait(SHOWN_MS);
    expect(seen()).toBeUndefined();
    expect(row).toHaveAttribute('title', 'Drag to reorder');
    expect(systemTooltip()).toBe('');

    moveTo(find('.plain'));
    wait(SHOWN_MS);
    expect(seen()).toBe('Drag to reorder');
  });

  it("leaves an embedded page's title alone", () => {
    build(
      '<iframe title="FluidEQ Plus store"></iframe>' +
        '<webview title="Help centre"></webview>' +
        '<p class="note" title="Prices include tax">Note</p>',
    );
    const frame = find('iframe');
    const view = find('webview');
    moveTo(frame);
    wait(SHOWN_MS);
    expect(seen()).toBeUndefined();
    expect(frame).toHaveAttribute('title', 'FluidEQ Plus store');
    moveTo(view);
    wait(SHOWN_MS);
    expect(seen()).toBeUndefined();
    expect(view).toHaveAttribute('title', 'Help centre');

    moveTo(find('.note'));
    wait(SHOWN_MS);
    expect(seen()).toBe('Prices include tax');
  });

  it("shows an SVG shape's data-tooltip as written, follows it, and goes when it is taken away", async () => {
    build(
      '<svg class="plot">' +
        '<g class="point" data-tooltip="Band 2: 1000 Hz · 3.00 dB">' +
        '<circle r="6"></circle>' +
        '</g>' +
        '</svg>',
    );
    const point = find<SVGGElement>('.point');
    moveTo(find<SVGCircleElement>('circle'));
    wait(SHOWN_MS);
    expect(seen()).toBe('Band 2: 1000 Hz · 3.00 dB');
    // Nothing draws a data-tooltip but the layer, so there is nothing to lend.
    expect(point).toHaveAttribute('data-tooltip', 'Band 2: 1000 Hz · 3.00 dB');

    point.setAttribute('data-tooltip', 'Band 2: 1000 Hz · 4.50 dB');
    await observersHear();
    expect(seen()).toBe('Band 2: 1000 Hz · 4.50 dB');
    expect(drawnOpacity()).toBe(1);

    point.removeAttribute('data-tooltip');
    await observersHear();
    wait(LEAVE_MS);
    expect(isOpen()).toBe(false);
  });
});

describe('put away until the pointer moves on', () => {
  it.each<[string, () => void]>([
    ['a press', () => atPointer(pointerEvent('pointerdown'))],
    ['a cancelled press', () => atPointer(pointerEvent('pointercancel'))],
    ['a key', () => pressKey('Shift')],
    [
      'the wheel',
      () => atPointer(new WheelEvent('wheel', { bubbles: true, deltaY: 100 })),
    ],
    ['the window losing focus', () => window.dispatchEvent(new Event('blur'))],
    [
      'the window being resized',
      () => window.dispatchEvent(new Event('resize')),
    ],
  ])('by %s, at once and without a fade', (_name, putAway) => {
    build(
      '<button type="button" title="Lyrics"><span class="glyph">♪</span></button>' +
        '<p class="gap">…</p>',
    );
    const button = find('button');
    moveTo(button);
    wait(SHOWN_MS);
    expect(seen()).toBe('Lyrics');

    putAway();
    expect(isOpen()).toBe(false);
    // Resting there or moving about inside brings back neither it nor,
    // since the title stays lent, the system's.
    wait(SHOWN_MS);
    moveTo(find('.glyph'));
    wait(SHOWN_MS);
    expect(seen()).toBeUndefined();
    expect(systemTooltip()).toBe('');

    // Onto something else and back: it was put away, not broken.
    moveTo(find('.gap'));
    expect(button).toHaveAttribute('title', 'Lyrics');
    moveTo(button);
    wait(SHOWN_MS);
    expect(seen()).toBe('Lyrics');
  });

  it('by scrolling what it describes, and not by scrolling anything else', () => {
    build(
      '<div class="list"><button type="button" title="Play next">Next</button></div>' +
        '<div class="queue"><p class="entry">Queue</p></div>',
    );
    const button = find('button');
    moveTo(button);
    wait(SHOWN_MS);

    // The control: another list scrolling beside it.
    find('.queue').dispatchEvent(new Event('scroll'));
    expect(seen()).toBe('Play next');

    find('.list').dispatchEvent(new Event('scroll'));
    expect(isOpen()).toBe(false);

    moveTo(find('.entry'));
    moveTo(button);
    wait(SHOWN_MS);
    expect(seen()).toBe('Play next');
    document.dispatchEvent(new Event('scroll'));
    expect(isOpen()).toBe(false);
  });
});

describe('pointers it leaves alone', () => {
  it('shows nothing for a touch, and a touch anywhere hands the title back', () => {
    build(
      '<button type="button" title="Shuffle">S</button><p class="gap">…</p>',
    );
    const button = find('button');
    const gap = find('.gap');
    moveTo(button, undefined, 'touch');
    wait(SHOWN_MS);
    expect(seen()).toBeUndefined();
    expect(button).toHaveAttribute('title', 'Shuffle');

    // The control: the same button under the mouse.
    moveTo(gap);
    moveTo(button);
    wait(SHOWN_MS);
    expect(seen()).toBe('Shuffle');

    moveTo(gap, undefined, 'touch');
    expect(button).toHaveAttribute('title', 'Shuffle');
    wait(LEAVE_MS);
    expect(isOpen()).toBe(false);
  });

  it('lets go when the pointer leaves the window, and not for leaving the control for its own icon', () => {
    build(
      '<button type="button" title="Visualizer"><svg class="glyph"></svg></button>',
    );
    const button = find('button');
    moveTo(button);
    wait(SHOWN_MS);
    // Onto its icon is a pointerout from the button too, naming the icon.
    moveTo(find<SVGSVGElement>('.glyph'));
    expect(seen()).toBe('Visualizer');
    expect(button).toHaveAttribute('title', '');

    leaveWindow();
    expect(button).toHaveAttribute('title', 'Visualizer');
    wait(LEAVE_MS);
    expect(isOpen()).toBe(false);
  });
});

describe('with Animations off', () => {
  it('keeps the rest, but comes without moving and goes without a fade', () => {
    build(
      '<button type="button" title="Loop">Loop</button><p class="gap">…</p>',
    );
    const button = find('button');
    const gap = find('.gap');
    applyMotionPreference('reduced');
    moveTo(button);
    wait(HOLD_MS - 1);
    expect(seen()).toBeUndefined();
    wait(2);
    expect(seen()).toBe('Loop');
    expect(drawnOpacity()).toBe(1);
    expect(
      lastEntrance()?.keyframes.every((frame) => frame.transform === undefined),
    ).toBe(true);
    moveTo(gap);
    expect(isOpen()).toBe(false);

    // The control, with Animations on: it moves as it comes and fades as it
    // goes.
    applyMotionPreference('full');
    moveTo(button);
    wait(SHOWN_MS);
    expect(lastEntrance()?.keyframes[0].transform).toBeDefined();
    moveTo(gap);
    expect(isOpen()).toBe(true);
    wait(LEAVE_MS);
    expect(isOpen()).toBe(false);
  });
});
