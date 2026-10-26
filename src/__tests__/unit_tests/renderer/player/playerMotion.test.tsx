/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Compact player folding up into its header before the window becomes
 * the one-line strip, and the strip stepping aside before it grows again
 * (Ivan, 2026-10-26: "I do want the amp ui to have that nice animation when
 * showing, whether is from one liner or from full app to this"). The window
 * changes height once, after the motion, and never while Animations is off.
 */

import '@testing-library/jest-dom';
import { act, render } from '@testing-library/react';
import { useRef } from 'react';
import {
  foldSectionsAway,
  stripStepsAside,
} from 'renderer/player/playerMotion';
import { usePlayerFold } from 'renderer/player/playerLayout';

const resizePlayerWindow = jest.fn<Promise<void>, [number]>();
const holdPlayerHeight = jest.fn();

jest.mock('renderer/player/windowModeStore', () => ({
  __esModule: true,
  resizePlayerWindow: (height: number) => resizePlayerWindow(height),
  holdPlayerHeight: (height: number | null, floor: number | null) =>
    holdPlayerHeight(height, floor),
  needPlayerWidth: () => undefined,
}));

interface IPlayed {
  target: HTMLElement;
  keyframes: Keyframe[];
  options: KeyframeAnimationOptions;
  finish: () => void;
  cancel: jest.Mock;
}

let played: IPlayed[] = [];

/** jsdom has no Web Animations; each animation finishes when told to. */
const fakeAnimate = function animate(
  this: HTMLElement,
  keyframes: Keyframe[],
  options: KeyframeAnimationOptions,
) {
  let finish = () => {};
  let fail = (_reason: unknown) => {};
  const finished = new Promise<void>((resolve, reject) => {
    finish = resolve;
    fail = reject;
  });
  const cancel = jest.fn(() =>
    fail(new DOMException('cancelled', 'AbortError')),
  );
  played.push({ target: this, keyframes, options, finish, cancel });
  return { finished, cancel } as unknown as Animation;
};

const realAnimate = HTMLElement.prototype.animate;

beforeEach(() => {
  played = [];
  resizePlayerWindow.mockReset();
  resizePlayerWindow.mockResolvedValue(undefined);
  holdPlayerHeight.mockClear();
  HTMLElement.prototype.animate = fakeAnimate as typeof realAnimate;
  document.documentElement.setAttribute('data-motion', 'full');
});

afterEach(() => {
  HTMLElement.prototype.animate = realAnimate;
  document.documentElement.removeAttribute('data-motion');
});

/** The amp's column as it is laid out: header, body's three, foot. */
const column = () => {
  const root = document.createElement('div');
  root.innerHTML = `
    <div class="player-title"></div>
    <div class="player-body">
      <div class="player-top"></div>
      <div class="player-eq player-sound"></div>
      <section class="player-shelf"></section>
    </div>
    <footer class="player-foot"></footer>`;
  document.body.appendChild(root);
  return root;
};

const finishAll = async () => {
  played.forEach((one) => one.finish());
  // The motion's own settling, then the fold's `then`.
  await act(async () => {
    await Promise.resolve();
  });
};

describe('the sections folding up into the header', () => {
  it('turns each section up, bottom first, and holds where it ends', () => {
    const root = column();
    foldSectionsAway(root);
    expect(played.map((one) => one.target.className)).toEqual([
      'player-foot',
      'player-shelf',
      'player-eq player-sound',
      'player-top',
    ]);
    const delays = played.map((one) => Number(one.options.delay));
    expect(delays).toEqual([...delays].sort((a, b) => a - b));
    expect(played.every((one) => one.options.fill === 'forwards')).toBe(true);
    expect(played[1].keyframes[1]).toMatchObject({ opacity: 0 });
    expect(String(played[1].keyframes[1].transform)).toContain(
      'rotateX(-84deg)',
    );
    root.remove();
  });

  it('settles once every section has gone, and never rejects when called off', async () => {
    const root = column();
    const motion = foldSectionsAway(root);
    let isDone = false;
    // The rejection, should there be one, is the `await` below's to report.
    motion.finished.then(
      () => {
        isDone = true;
        return undefined;
      },
      () => undefined,
    );
    played.slice(0, 3).forEach((one) => one.finish());
    await Promise.resolve();
    expect(isDone).toBe(false);
    motion.cancel();
    await motion.finished;
    expect(isDone).toBe(true);
    expect(played.every((one) => one.cancel.mock.calls.length === 1)).toBe(
      true,
    );
    root.remove();
  });

  it('moves nothing with Animations off', async () => {
    document.documentElement.setAttribute('data-motion', 'reduced');
    const root = column();
    await foldSectionsAway(root).finished;
    await stripStepsAside(root).finished;
    expect(played).toHaveLength(0);
    root.remove();
  });
});

describe('the strip stepping aside', () => {
  it('fades the strip up and out, and only the strip', () => {
    const root = document.createElement('div');
    root.innerHTML = '<div class="player-fold"></div>';
    stripStepsAside(root);
    expect(played).toHaveLength(1);
    expect(played[0].target.className).toBe('player-fold');
    expect(played[0].keyframes[1]).toMatchObject({ opacity: 0 });
  });
});

/** The fold and unfold as the amp calls them, on a column of its own. */
const Fold = ({
  onReady,
}: {
  onReady: (fold: ReturnType<typeof usePlayerFold>) => void;
}) => {
  const root = useRef<HTMLDivElement>(null);
  onReady(usePlayerFold(root));
  return (
    <div ref={root}>
      <div className="player-body">
        <div className="player-top" />
        <div className="player-sound" />
        <section className="player-shelf" />
      </div>
      <footer className="player-foot" />
      <div className="player-fold" />
    </div>
  );
};

const mountFold = () => {
  let api: ReturnType<typeof usePlayerFold> | undefined;
  const view = render(
    <Fold
      onReady={(fold) => {
        api = fold;
      }}
    />,
  );
  if (!api) {
    throw new Error('the fold hook did not run');
  }
  return { view, api: () => api as ReturnType<typeof usePlayerFold> };
};

describe('folding the window', () => {
  it('asks for the strip only once the sections have gone up', async () => {
    const { api } = mountFold();
    act(() => api().fold());
    expect(played).toHaveLength(4);
    expect(resizePlayerWindow).not.toHaveBeenCalled();
    await finishAll();
    expect(holdPlayerHeight).toHaveBeenCalledWith(null, null);
    expect(resizePlayerWindow).toHaveBeenCalledWith(54);
  });

  it('asks at once with Animations off', async () => {
    document.documentElement.setAttribute('data-motion', 'reduced');
    const { api } = mountFold();
    act(() => api().fold());
    await act(async () => {
      await Promise.resolve();
    });
    expect(played).toHaveLength(0);
    expect(resizePlayerWindow).toHaveBeenCalledWith(54);
  });

  it('takes no second fold while the first is moving', async () => {
    const { api } = mountFold();
    act(() => api().fold());
    act(() => api().fold());
    expect(played).toHaveLength(4);
    await finishAll();
    expect(resizePlayerWindow).toHaveBeenCalledTimes(1);
  });

  it('asks for nothing once the player has left the window', async () => {
    const { api, view } = mountFold();
    act(() => api().fold());
    view.unmount();
    await finishAll();
    expect(resizePlayerWindow).not.toHaveBeenCalled();
  });

  it('puts the sections back when main refuses the height', async () => {
    resizePlayerWindow.mockRejectedValue(new Error('refused'));
    const { api } = mountFold();
    act(() => api().fold());
    await finishAll();
    await act(async () => {
      await Promise.resolve();
    });
    expect(played.every((one) => one.cancel.mock.calls.length === 1)).toBe(
      true,
    );
  });
});

describe('unfolding the window', () => {
  it('asks for the height only once the strip has stepped aside', async () => {
    const { api } = mountFold();
    act(() => api().unfold());
    expect(played).toHaveLength(1);
    expect(resizePlayerWindow).not.toHaveBeenCalled();
    await finishAll();
    expect(resizePlayerWindow).toHaveBeenCalledTimes(1);
  });
});
