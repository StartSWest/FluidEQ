/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The divider under the Studio's stage: how tall a drag makes the stage, how
 * far it may go, and that the shape it was left at is the one it comes back
 * with.
 *
 * jsdom lays nothing out, so the stage's box and its pane's height are given.
 */

import { act, renderHook } from '@testing-library/react';
import useStudioStageRatio, {
  GRAPH_STAGE_RATIO,
  stageAfterDrag,
} from '../../../renderer/studio/useStudioStageRatio';
import { PANE_MIN_HEIGHT } from '../../../renderer/utils/paneSizes';

const STORAGE_KEY = 'fluideq.studio.stageRatio';

describe('the stage after a drag', () => {
  const drag = { width: 800, height: 340, tallest: 600 };

  it('grows and shrinks by what the pointer moved, and says where it sits', () => {
    const taller = stageAfterDrag(drag, 100);
    expect(taller.ratio).toBeCloseTo(800 / 440, 6);
    expect(taller.percent).toBe(
      Math.round(((440 - PANE_MIN_HEIGHT) / (600 - PANE_MIN_HEIGHT)) * 100),
    );
  });

  it('stops at the shortest a pane may be and at the tallest its pane can show', () => {
    expect(stageAfterDrag(drag, -5000)).toEqual({
      ratio: 800 / PANE_MIN_HEIGHT,
      percent: 0,
    });
    expect(stageAfterDrag(drag, 5000)).toEqual({
      ratio: 800 / 600,
      percent: 100,
    });
  });

  it('holds a pane too short for any drag at the shortest, rather than inverting', () => {
    expect(
      stageAfterDrag({ width: 800, height: 120, tallest: 90 }, 40),
    ).toEqual({ ratio: 800 / PANE_MIN_HEIGHT, percent: 0 });
  });
});

describe('the divider', () => {
  /** The Studio's main pane with a stage area in it, as the bench lays it out. */
  const bench = (
    stageTop: number,
    stage: { width: number; height: number },
  ) => {
    const pane = document.createElement('div');
    pane.className = 'studio-bench__main';
    Object.defineProperty(pane, 'clientHeight', { value: 700 });
    pane.getBoundingClientRect = () => ({ top: 100 }) as DOMRect;
    const area = document.createElement('div');
    const well = document.createElement('div');
    well.getBoundingClientRect = () =>
      ({
        top: stageTop,
        bottom: stageTop + stage.height,
        width: stage.width,
        height: stage.height,
      }) as DOMRect;
    area.appendChild(well);
    pane.appendChild(area);
    document.body.appendChild(pane);
    return area;
  };

  beforeEach(() => {
    window.localStorage.clear();
    document.body.innerHTML = '';
  });

  it('starts at the graph’s own shape, or the one it was left at, never at a broken one', () => {
    const area = { current: bench(150, { width: 800, height: 340 }) };
    expect(
      renderHook(() => useStudioStageRatio(area)).result.current.style,
    ).toEqual({ '--studio-stage-ratio': String(GRAPH_STAGE_RATIO) });

    window.localStorage.setItem(STORAGE_KEY, '1.5');
    expect(
      renderHook(() => useStudioStageRatio(area)).result.current.style,
    ).toEqual({ '--studio-stage-ratio': '1.5' });

    window.localStorage.setItem(STORAGE_KEY, '0');
    expect(
      renderHook(() => useStudioStageRatio(area)).result.current.style,
    ).toEqual({ '--studio-stage-ratio': String(GRAPH_STAGE_RATIO) });
  });

  it('moves the stage under the pointer without rendering the bench, and keeps the shape it ends at', () => {
    const element = bench(150, { width: 800, height: 340 });
    const area = { current: element };
    let renders = 0;
    const { result } = renderHook(() => {
      renders += 1;
      return useStudioStageRatio(area);
    });
    const before = renders;

    act(() => result.current.resizer.onStart());
    expect(element.hasAttribute('data-resizing')).toBe(true);
    act(() => result.current.resizer.onDrag(60));
    act(() => result.current.resizer.onDrag(100));
    expect(element.style.getPropertyValue('--studio-stage-ratio')).toBe(
      String(800 / 440),
    );
    // Every move is written to the stage itself; nothing re-rendered for it.
    expect(renders).toBe(before);

    act(() => result.current.resizer.onEnd());
    expect(element.hasAttribute('data-resizing')).toBe(false);
    expect(result.current.style).toEqual({
      '--studio-stage-ratio': String(800 / 440),
    });
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe(String(800 / 440));
  });

  it('keeps the divider in sight: no taller than the pane shows below where the stage starts', () => {
    // The pane shows 100 to 800; the stage starts at 250.
    const element = bench(250, { width: 800, height: 340 });
    const { result } = renderHook(() =>
      useStudioStageRatio({ current: element }),
    );
    act(() => result.current.resizer.onStart());
    act(() => result.current.resizer.onDrag(5000));
    act(() => result.current.resizer.onEnd());
    // 800 - 250, less the room kept for the divider under it.
    expect(result.current.style).toEqual({
      '--studio-stage-ratio': String(800 / (800 - 250 - 44)),
    });
    expect(result.current.resizer.valuePercent).toBe(100);
  });

  it('does not make a stage already taller than that jump when it is taken hold of', () => {
    const element = bench(250, { width: 800, height: 640 });
    const { result } = renderHook(() =>
      useStudioStageRatio({ current: element }),
    );
    act(() => result.current.resizer.onStart());
    act(() => result.current.resizer.onDrag(0));
    expect(element.style.getPropertyValue('--studio-stage-ratio')).toBe(
      String(800 / 640),
    );
  });
});
