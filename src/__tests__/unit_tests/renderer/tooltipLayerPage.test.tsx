/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The app's own tooltips (`utils/tooltipLayer.ts`), and the page around them.
 *
 * The tooltips that replaced the system's on 2026-09-25 (the "open floor"
 * layout; see `tooltipLayer.test.ts`) borrow the hovered element's `title`
 * while the pointer is on it, and React still owns that attribute: it may
 * rename a play button to pause, or take a hint away, while the title is
 * lent. An icon button's title is also its only name, so the name is lent
 * along with it. The keyboard reaches the same tooltips by Tab, and each
 * stands where it can be read. The browser all of this runs in is modelled
 * in `utils/tooltipBrowser.ts`.
 */

import '@testing-library/jest-dom';
import { act, render, screen } from '@testing-library/react';
import { useState } from 'react';
import installTooltipLayer from 'renderer/utils/tooltipLayer';
import {
  ENTER_MS,
  HOLD_MS,
  LEAVE_MS,
  SHOWN_MS,
  TIP,
  VIEW,
  build,
  drawnOpacity,
  find,
  isOpen,
  lastEntrance,
  layOut,
  leaveWindow,
  moveTo,
  observersHear,
  pressKey,
  pressPointer,
  seen,
  setUpTooltipBrowser,
  systemTooltip,
  tabTo,
  tooltip,
  wait,
} from '../../utils/tooltipBrowser';

setUpTooltipBrowser(installTooltipLayer);

/** A play button named by its state, as the player's is. */
const PlayButton = ({ isPlaying }: { isPlaying: boolean }) => (
  // eslint-disable-next-line jsx-a11y/control-has-associated-label -- named by its title, as the app's icon buttons are
  <button type="button" title={isPlaying ? 'Pause' : 'Play'}>
    <svg aria-hidden="true" />
  </button>
);

/** A play button that turns into pause when pressed. */
const TogglePlay = () => {
  const [isPlaying, setPlaying] = useState(false);
  return (
    // eslint-disable-next-line jsx-a11y/control-has-associated-label -- named by its title, as the app's icon buttons are
    <button
      type="button"
      title={isPlaying ? 'Pause' : 'Play'}
      onClick={() => setPlaying((was) => !was)}
    >
      <svg aria-hidden="true" />
    </button>
  );
};

/**
 * The Gallery card's Add button: named by its words, and titled only once it
 * has been pressed, when pressing it again removes the scene.
 */
const AddButton = () => {
  const [isAdded, setAdded] = useState(false);
  return (
    <button
      type="button"
      title={isAdded ? 'Remove' : undefined}
      onClick={() => setAdded(true)}
    >
      {isAdded ? 'Added' : 'Add'}
    </button>
  );
};

/** A chip whose hint the page may take away. */
const Chip = ({ hint }: { hint?: string }) => (
  <button type="button" title={hint}>
    Tape
  </button>
);

/** A list whose rows the page may take away. */
const Rows = ({ names }: { names: string[] }) => (
  <ul>
    {names.map((name) => (
      <li key={name}>
        <button type="button" title={`Remove ${name}`}>
          ×
        </button>
      </li>
    ))}
  </ul>
);

describe("an icon button's name", () => {
  it('is lent with its title, so the button keeps its name while the pointer is on it', () => {
    build(
      '<button type="button" class="icon" title="Mute"><svg></svg></button>' +
        '<button type="button" class="worded" title="Save under a new name">Save as</button>' +
        '<button type="button" class="named" title="Loudness" aria-label="Loudness meter"><svg></svg></button>' +
        '<label>Gain <input class="field" title="Gain in decibels"></label>' +
        '<p class="gap">…</p>',
    );
    const icon = find('.icon');
    const gap = find('.gap');
    moveTo(icon);
    expect(icon).toHaveAttribute('title', '');
    expect(icon).toHaveAttribute('aria-label', 'Mute');
    expect(screen.getByRole('button', { name: 'Mute' })).toBe(icon);
    moveTo(gap);
    expect(icon).toHaveAttribute('title', 'Mute');
    expect(icon).not.toHaveAttribute('aria-label');
    expect(screen.getByRole('button', { name: 'Mute' })).toBe(icon);

    // Words, a label of its own, a field's label: each keeps what it had.
    const worded = find('.worded');
    moveTo(worded);
    expect(worded).not.toHaveAttribute('aria-label');
    expect(screen.getByRole('button', { name: 'Save as' })).toBe(worded);
    const named = find('.named');
    moveTo(named);
    expect(named).toHaveAttribute('aria-label', 'Loudness meter');
    const field = find('.field');
    moveTo(field);
    expect(field).not.toHaveAttribute('aria-label');
    expect(screen.getByRole('textbox', { name: 'Gain' })).toBe(field);
    moveTo(gap);
    expect(named).toHaveAttribute('aria-label', 'Loudness meter');
  });

  it('is left to the page once the page names the button itself', async () => {
    build(
      '<button type="button" class="icon" title="Mute"><svg></svg></button>' +
        '<p class="gap">…</p>',
    );
    const icon = find('.icon');
    moveTo(icon);
    expect(icon).toHaveAttribute('aria-label', 'Mute');
    icon.setAttribute('aria-label', 'Unmute');
    await observersHear();
    moveTo(find('.gap'));
    expect(icon).toHaveAttribute('aria-label', 'Unmute');
    expect(icon).toHaveAttribute('title', 'Mute');
  });
});

describe('the page rewriting a title under the pointer', () => {
  it('follows the new title, keeps it lent, and puts back the one written last', async () => {
    const { rerender } = render(<PlayButton isPlaying={false} />);
    const button = screen.getByRole('button', { name: 'Play' });
    moveTo(button);
    wait(SHOWN_MS);
    expect(seen()).toBe('Play');

    await act(async () => {
      rerender(<PlayButton isPlaying />);
    });
    expect(seen()).toBe('Pause');
    expect(drawnOpacity()).toBe(1);
    expect(button).toHaveAttribute('title', '');
    expect(systemTooltip()).toBe('');
    expect(screen.getByRole('button', { name: 'Pause' })).toBe(button);

    moveTo(document.body);
    expect(button).toHaveAttribute('title', 'Pause');
    expect(button).not.toHaveAttribute('aria-label');
  });

  it('never puts back a title the page took away while it was lent', async () => {
    const { rerender } = render(<Chip hint="Clears this layer" />);
    const chip = screen.getByRole('button', { name: 'Tape' });
    // The control: a title the page kept comes back.
    moveTo(chip);
    wait(SHOWN_MS);
    moveTo(document.body);
    expect(chip).toHaveAttribute('title', 'Clears this layer');
    wait(LEAVE_MS);

    moveTo(chip);
    wait(SHOWN_MS);
    expect(seen()).toBe('Clears this layer');
    await act(async () => {
      rerender(<Chip />);
    });
    wait(LEAVE_MS);
    expect(isOpen()).toBe(false);
    moveTo(document.body);
    expect(chip).not.toHaveAttribute('title');
  });

  it('stays away after a press that renames the button, and shows the new name next time', async () => {
    render(<TogglePlay />);
    const button = screen.getByRole('button', { name: 'Play' });
    moveTo(button);
    wait(SHOWN_MS);
    expect(seen()).toBe('Play');

    await act(async () => {
      pressPointer();
    });
    expect(isOpen()).toBe(false);
    expect(screen.getByRole('button', { name: 'Pause' })).toBe(button);
    wait(SHOWN_MS);
    expect(seen()).toBeUndefined();
    expect(button).toHaveAttribute('title', '');
    expect(systemTooltip()).toBe('');

    moveTo(document.body);
    expect(button).toHaveAttribute('title', 'Pause');
    moveTo(button);
    wait(SHOWN_MS);
    expect(seen()).toBe('Pause');
  });

  // A title arriving with the pointer already resting there was heard by
  // nothing, and the system's tooltip read it on the next move of the mouse:
  // "Remove" on the Gallery's Add button, in Windows' own box.
  it('takes a title that arrives while the pointer rests there', async () => {
    const { rerender } = render(<Chip />);
    const chip = screen.getByRole('button', { name: 'Tape' });
    moveTo(chip);
    wait(SHOWN_MS);
    // The control: with no title there is nothing to show.
    expect(seen()).toBeUndefined();

    await act(async () => {
      rerender(<Chip hint="Tape saturation" />);
    });
    await observersHear();
    expect(systemTooltip()).toBe('');
    wait(SHOWN_MS);
    expect(seen()).toBe('Tape saturation');

    moveTo(document.body);
    expect(chip).toHaveAttribute('title', 'Tape saturation');
  });

  it('keeps a title that arrives with a press away until the pointer moves on', async () => {
    render(<AddButton />);
    const add = screen.getByRole('button', { name: 'Add' });
    moveTo(add);
    wait(SHOWN_MS);
    expect(seen()).toBeUndefined();

    await act(async () => {
      pressPointer();
    });
    await observersHear();
    expect(add).toHaveAttribute('title', '');
    expect(systemTooltip()).toBe('');
    wait(SHOWN_MS);
    expect(seen()).toBeUndefined();

    moveTo(document.body);
    expect(add).toHaveAttribute('title', 'Remove');
    moveTo(add);
    wait(SHOWN_MS);
    expect(seen()).toBe('Remove');
  });

  it('lets the tooltip go with an element taken out from under the pointer', async () => {
    const { rerender } = render(<Rows names={['Bass', 'Treble']} />);
    const bass = screen.getByTitle('Remove Bass');
    moveTo(bass);
    wait(SHOWN_MS);
    expect(seen()).toBe('Remove Bass');

    // The control: the list changing around the row leaves it up.
    await act(async () => {
      rerender(<Rows names={['Bass', 'Treble', 'Mid']} />);
    });
    expect(seen()).toBe('Remove Bass');
    expect(drawnOpacity()).toBe(1);

    await act(async () => {
      rerender(<Rows names={['Treble', 'Mid']} />);
    });
    expect(bass.isConnected).toBe(false);
    wait(LEAVE_MS);
    expect(isOpen()).toBe(false);
  });
});

describe('the keyboard', () => {
  it('shows a control Tab reaches, under it, after the same rest, and lets it go when focus leaves', () => {
    build(
      '<button type="button" class="previous" title="Previous track">‹</button>' +
        '<button type="button" class="next" title="Next track">›</button>',
    );
    const next = find('.next');
    layOut(next, 200, 100, 32, 32);
    tabTo(next);
    expect(seen()).toBeUndefined();
    wait(HOLD_MS - 1);
    expect(seen()).toBeUndefined();
    wait(1 + ENTER_MS);
    expect(seen()).toBe('Next track');
    expect(tooltip()?.style.left).toBe('156px');
    expect(tooltip()?.style.top).toBe('138px');
    // No system tooltip is drawn for focus, so nothing is lent for it.
    expect(next).toHaveAttribute('title', 'Next track');

    next.blur();
    expect(seen()).toBe('Next track');
    wait(LEAVE_MS);
    expect(isOpen()).toBe(false);
  });

  it('shows nothing for focus a click put there', () => {
    build(
      '<button type="button" class="open">Guide</button>' +
        '<button type="button" class="close" title="Close the guide">×</button>' +
        '<button type="button" class="search" title="Search the guide">⌕</button>',
    );
    // A click that opens something whose script focuses its first control.
    moveTo(find('.open'));
    pressPointer();
    find('.close').focus();
    wait(SHOWN_MS);
    expect(seen()).toBeUndefined();

    // The control: a control the keyboard reaches.
    tabTo(find('.search'));
    wait(SHOWN_MS);
    expect(seen()).toBe('Search the guide');
  });

  it("puts a focused control's tooltip away at a key until focus moves on", () => {
    build(
      '<button type="button" class="karaoke" title="Karaoke">K</button>' +
        '<button type="button" class="lyrics" title="Lyrics">L</button>',
    );
    tabTo(find('.karaoke'));
    wait(SHOWN_MS);
    expect(seen()).toBe('Karaoke');
    pressKey('Escape');
    expect(isOpen()).toBe(false);
    wait(SHOWN_MS);
    expect(seen()).toBeUndefined();

    tabTo(find('.lyrics'));
    wait(SHOWN_MS);
    expect(seen()).toBe('Lyrics');
  });

  it('gives way to the pointer arriving on another titled control, and not to the pointer arriving on nothing', () => {
    build(
      '<button type="button" class="karaoke" title="Karaoke">K</button>' +
        '<button type="button" class="lyrics" title="Lyrics">L</button>' +
        '<p class="gap">…</p>',
    );
    const karaoke = find('.karaoke');
    tabTo(karaoke);
    wait(SHOWN_MS);
    moveTo(find('.gap'));
    wait(SHOWN_MS);
    expect(seen()).toBe('Karaoke');

    moveTo(find('.lyrics'));
    expect(seen()).toBe('Lyrics');
    expect(drawnOpacity()).toBe(1);
    // Focus leaving the first control no longer touches the pointer's.
    karaoke.blur();
    expect(seen()).toBe('Lyrics');
    expect(drawnOpacity()).toBe(1);
  });

  it('reads the title of the control the pointer rests on though it is lent, and keeps it lent meanwhile', () => {
    build(
      '<button type="button" class="repeat" title="Repeat">R</button>' +
        '<button type="button" class="crossfade" title="Crossfade">C</button>',
    );
    const repeat = find('.repeat');
    const crossfade = find('.crossfade');
    moveTo(crossfade);
    wait(SHOWN_MS);
    expect(seen()).toBe('Crossfade');

    tabTo(crossfade);
    wait(SHOWN_MS);
    expect(seen()).toBe('Crossfade');
    expect(crossfade).toHaveAttribute('title', '');
    expect(systemTooltip()).toBe('');

    tabTo(repeat);
    wait(SHOWN_MS);
    expect(seen()).toBe('Repeat');
    expect(systemTooltip()).toBe('');

    // Focus gone, the pointer still on the control a key put away.
    repeat.blur();
    wait(SHOWN_MS);
    expect(seen()).toBeUndefined();
    expect(systemTooltip()).toBe('');
    leaveWindow();
    expect(crossfade).toHaveAttribute('title', 'Crossfade');
  });
});

describe('where it stands', () => {
  it('stands centred just under a small control, and drops into place from it', () => {
    build('<button type="button" title="Mute">M</button>');
    const button = find('button');
    layOut(button, 100, 100, 32, 32);
    moveTo(button, { x: 110, y: 110 });
    wait(SHOWN_MS);
    expect(tooltip()?.style.left).toBe('56px');
    expect(tooltip()?.style.top).toBe('138px');
    expect(lastEntrance()?.keyframes[0].transform).toBe(
      'translateY(-3px) scale(0.98)',
    );
  });

  it('stands above a control too near the bottom of the window, and rises into place', () => {
    build('<button type="button" title="Mute">M</button>');
    const button = find('button');
    layOut(button, 600, 770, 32, 24);
    moveTo(button, { x: 610, y: 780 });
    wait(SHOWN_MS);
    expect(tooltip()?.style.left).toBe('556px');
    expect(tooltip()?.style.top).toBe('736px');
    expect(lastEntrance()?.keyframes[0].transform).toBe(
      'translateY(3px) scale(0.98)',
    );
  });

  it("stays inside the window's sides", () => {
    build(
      '<button type="button" class="first" title="Back">‹</button>' +
        '<button type="button" class="last" title="Close">×</button>',
    );
    const first = find('.first');
    const last = find('.last');
    layOut(first, 0, 100, 24, 24);
    layOut(last, 1260, 100, 20, 24);
    moveTo(first);
    wait(SHOWN_MS);
    expect(tooltip()?.style.left).toBe('8px');
    moveTo(last);
    expect(tooltip()?.style.left).toBe(`${VIEW.width - 8 - TIP.width}px`);
  });

  it('describes a plot where the pointer came onto it, a cursor below, and stays there', () => {
    build(
      '<div class="plot" title="Drag a band to shape the curve">' +
        '<svg><path class="curve" d="M0 0L9 9"></path></svg>' +
        '</div>',
    );
    layOut(find('.plot'), 20, 40, 900, 300);
    moveTo(find('.plot'), { x: 450, y: 200 });
    wait(SHOWN_MS);
    expect(tooltip()?.style.left).toBe('390px');
    expect(tooltip()?.style.top).toBe('220px');

    moveTo(find<SVGPathElement>('.curve'), { x: 700, y: 260 });
    expect(tooltip()?.style.left).toBe('390px');
    expect(tooltip()?.style.top).toBe('220px');
  });
});
