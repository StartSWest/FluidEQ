/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Going into the Studio's full screen and back is one step each way (Ivan,
 * 2026-11-25: "make that transition better because the side pane opens and
 * makes things glitch"). Recorded in the Studio harness, the grid laid
 * itself out for full screen at the press, a few frames before the screen
 * filled, and back for the window at the press to leave, a few frames before
 * the screen emptied; the stage's box reached the canvas a task late; and the
 * bench, read as gone while its own grid filled the screen, gave the sound
 * panel back behind the scene and folded it again, visibly, on the way out.
 *
 * Each is held here by the order it now happens in, which is all a test can
 * see: the frames themselves are measured in the harness.
 */

import '@testing-library/jest-dom';
import { act, render, renderHook } from '@testing-library/react';
import { useRef } from 'react';
import useFullscreenShown from '../../../renderer/studio/useFullscreenShown';
import useStageBox from '../../../renderer/studio/useStageBox';
import useStudioBenchLayout from '../../../renderer/studio/useStudioBenchLayout';
import {
  resetSoundPaneForTesting,
  setSoundPaneFolded,
  useSoundPaneFolded,
} from '../../../renderer/utils/soundPane';

/** The element the browser reports as full. */
let full: Element | null = null;

const goFull = (element: Element | null) => {
  full = element;
  document.dispatchEvent(new Event('fullscreenchange'));
};

/** The microtasks queued so far, and those they queue, run. */
const microtasks = async () => {
  for (let turn = 0; turn < 5; turn += 1) {
    // eslint-disable-next-line no-await-in-loop -- one turn of the microtask queue each
    await Promise.resolve();
  }
};

beforeEach(() => {
  full = null;
  Object.defineProperty(document, 'fullscreenElement', {
    configurable: true,
    get: () => full,
  });
});

afterEach(() => {
  document.body.replaceChildren();
});

describe('what is laid out for full screen', () => {
  /** The grid, laid out by what the hook says. */
  const Grid = () => {
    const grid = useRef<HTMLDivElement>(null);
    const isFull = useFullscreenShown(grid);
    return (
      <div ref={grid} data-testid="grid" className={isFull ? 'is-full' : ''} />
    );
  };

  it('follows the screen, not the press', async () => {
    const view = render(<Grid />);
    const grid = view.getByTestId('grid');
    expect(grid).not.toHaveClass('is-full');
    // Something else filling the screen is not the grid's full screen.
    await act(async () => goFull(document.body));
    expect(grid).not.toHaveClass('is-full');
    await act(async () => goFull(grid));
    expect(grid).toHaveClass('is-full');
    await act(async () => goFull(null));
    expect(grid).not.toHaveClass('is-full');
  });

  describe('outside a test’s act, as in the window', () => {
    beforeEach(() => {
      (
        globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
      ).IS_REACT_ACT_ENVIRONMENT = false;
    });
    afterEach(() => {
      (
        globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
      ).IS_REACT_ACT_ENVIRONMENT = true;
    });

    // The microtasks after the browser's event are still inside the frame it
    // changed the screen in, before that frame's layout and paint; anything
    // waited for past them — the next frame, a task — is a frame painted
    // with the other screen's layout.
    it('changes in the microtasks after the browser says so, never a frame later', async () => {
      const view = render(<Grid />);
      await microtasks();
      const grid = view.getByTestId('grid');
      goFull(grid);
      await microtasks();
      expect(grid).toHaveClass('is-full');
      goFull(null);
      await microtasks();
      expect(grid).not.toHaveClass('is-full');
      view.unmount();
    });
  });
});

describe('the stage’s box', () => {
  /** Every observer watching the stage's frame, as a resize would call them. */
  let observers: (() => void)[] = [];
  const { ResizeObserver: inert } = globalThis;

  beforeEach(() => {
    observers = [];
    Object.assign(globalThis, {
      ResizeObserver: class {
        private readonly changed: () => void;

        constructor(changed: () => void) {
          this.changed = changed;
        }

        observe(element: Element) {
          if (element.classList.contains('frame')) {
            observers.push(this.changed);
          }
        }

        disconnect() {
          observers = observers.filter((changed) => changed !== this.changed);
        }
      },
    });
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = false;
  });

  afterEach(() => {
    Object.assign(globalThis, { ResizeObserver: inert });
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
  });

  /** The canvas's host, sized from the box as the stage sizes it. */
  const Stage = () => {
    const frame = useRef<HTMLDivElement>(null);
    const bar = useRef<HTMLDivElement>(null);
    const { box } = useStageBox(frame, bar);
    return (
      <div ref={frame} className="frame">
        <div ref={bar} />
        <div data-testid="host" style={{ width: box.width }} />
      </div>
    );
  };

  // The observer runs after the frame's layout and before its paint; the
  // canvas resized in it is resized in the same frame as the stage.
  it('reaches the canvas inside the observer that measured it', async () => {
    const view = render(<Stage />);
    await microtasks();
    const frame = view.container.querySelector('.frame');
    if (!(frame instanceof HTMLElement) || observers.length === 0) {
      throw new Error('the stage is not observed');
    }
    // jsdom lays nothing out: the box a full screen gives the stage.
    frame.getBoundingClientRect = () =>
      ({ width: 1464, height: 643 }) as DOMRect;
    observers.forEach((changed) => changed());
    // No await: still inside the observer's callback.
    expect(view.getByTestId('host')).toHaveStyle({ width: '1464px' });
    view.unmount();
  });
});

describe('the sound panel while the Studio fills the screen', () => {
  beforeEach(() => {
    window.localStorage.clear();
    // The member keeps it open; the Studio folds it while it is on screen.
    setSoundPaneFolded(false);
    resetSoundPaneForTesting();
  });

  /** The bench with its grid inside, and the panel as the shell reads it. */
  const benchWithGrid = () => {
    const bench = document.createElement('div');
    const grid = document.createElement('div');
    bench.append(grid);
    document.body.append(bench);
    const view = renderHook(() => {
      const ref = useRef<HTMLElement>(bench);
      useStudioBenchLayout(ref);
      return useSoundPaneFolded();
    });
    return { bench, grid, view };
  };

  it('stays folded while the Studio’s own grid fills the screen, and after', async () => {
    const { grid, view } = benchWithGrid();
    expect(view.result.current).toBe(true);
    await act(async () => goFull(grid));
    expect(view.result.current).toBe(true);
    await act(async () => goFull(null));
    expect(view.result.current).toBe(true);
    view.unmount();
  });

  it('control: is given back while something outside the bench fills the screen', async () => {
    const { view } = benchWithGrid();
    const elsewhere = document.createElement('div');
    document.body.append(elsewhere);
    await act(async () => goFull(elsewhere));
    expect(view.result.current).toBe(false);
    await act(async () => goFull(null));
    expect(view.result.current).toBe(true);
    view.unmount();
  });
});
