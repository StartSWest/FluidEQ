/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  createSceneGpuClock,
  SCENE_FRAMES_IN_FLIGHT,
} from '../../../renderer/graph/sceneGpuClock';

/**
 * A WebGL2 context reduced to what the clock touches: fences that signal when
 * the test says so, and timer queries that answer when the test says so.
 * Nothing here draws; the clock's job is bookkeeping, and this is the book.
 */
const fakeContext = (withTimer: boolean) => {
  let nextId = 1;
  const signaled = new Set<number>();
  const available = new Map<number, number>();
  let disjoint = false;
  const deleted = { syncs: 0, queries: 0 };
  const gl = {
    SYNC_GPU_COMMANDS_COMPLETE: 0x9117,
    SYNC_STATUS: 0x9114,
    SIGNALED: 0x9119,
    UNSIGNALED: 0x9118,
    QUERY_RESULT_AVAILABLE: 0x8867,
    QUERY_RESULT: 0x8866,
    getExtension: (name: string) =>
      name === 'EXT_disjoint_timer_query_webgl2' && withTimer
        ? { TIME_ELAPSED_EXT: 0x88bf, GPU_DISJOINT_EXT: 0x8fbb }
        : null,
    createQuery: () => {
      nextId += 1;
      return { id: nextId };
    },
    deleteQuery: () => {
      deleted.queries += 1;
    },
    beginQuery: jest.fn(),
    endQuery: jest.fn(),
    fenceSync: () => {
      nextId += 1;
      return { id: nextId };
    },
    deleteSync: () => {
      deleted.syncs += 1;
    },
    flush: jest.fn(),
    getSyncParameter: (sync: { id: number }) =>
      signaled.has(sync.id) ? gl.SIGNALED : gl.UNSIGNALED,
    getQueryParameter: (query: { id: number }, what: number) =>
      what === gl.QUERY_RESULT_AVAILABLE
        ? available.has(query.id)
        : available.get(query.id),
    getParameter: () => {
      const was = disjoint;
      disjoint = false;
      return was;
    },
  };
  return {
    gl: gl as unknown as WebGL2RenderingContext,
    /** The GPU finishes the frames submitted so far. */
    finishAll: (costNs: number) => {
      for (let id = 1; id <= nextId; id += 1) {
        signaled.add(id);
        available.set(id, costNs);
      }
    },
    signalOnly: () => {
      for (let id = 1; id <= nextId; id += 1) {
        signaled.add(id);
      }
    },
    disturb: () => {
      disjoint = true;
    },
    deleted,
    calls: gl,
  };
};

const frame = (clock: ReturnType<typeof createSceneGpuClock>) => {
  clock.begin();
  clock.end();
};

describe('the scene GPU clock', () => {
  it('wraps each frame in a timer query and reports its cost once it is in', () => {
    const fake = fakeContext(true);
    const clock = createSceneGpuClock(fake.gl);
    frame(clock);
    expect(fake.calls.beginQuery).toHaveBeenCalledTimes(1);
    expect(fake.calls.endQuery).toHaveBeenCalledTimes(1);
    expect(fake.calls.flush).toHaveBeenCalledTimes(1);
    // Still on the GPU: no cost yet, one frame in flight.
    expect(clock.poll(1)).toEqual({ costMs: undefined, behind: 1 });
    fake.finishAll(2_500_000);
    expect(clock.poll(2)).toEqual({ costMs: 2.5, behind: 0 });
  });

  /** The scene and its finishing are timed apart: the controller decides them differently. */
  it('times the finishing passes on their own when a frame is marked', () => {
    const fake = fakeContext(true);
    const clock = createSceneGpuClock(fake.gl);
    clock.begin();
    clock.mark();
    clock.end();
    expect(fake.calls.beginQuery).toHaveBeenCalledTimes(2);
    expect(fake.calls.endQuery).toHaveBeenCalledTimes(2);
    // Both queries answer the same 3 ms in this fake: 6 in all, 3 finishing.
    fake.finishAll(3_000_000);
    expect(clock.poll(1)).toEqual({ costMs: 6, postMs: 3, behind: 0 });
    // Unmarked, the frame's whole cost is the scene's.
    clock.begin();
    clock.end();
    fake.finishAll(2_000_000);
    expect(clock.poll(2)).toEqual({ costMs: 2, postMs: undefined, behind: 0 });
  });

  it('reports how many frames the GPU still holds', () => {
    const fake = fakeContext(true);
    const clock = createSceneGpuClock(fake.gl);
    frame(clock);
    frame(clock);
    expect(clock.poll(1).behind).toBe(SCENE_FRAMES_IN_FLIGHT);
    fake.finishAll(1_000_000);
    expect(clock.poll(2)).toEqual({ costMs: 1, behind: 0 });
  });

  it('never blocks on a fence, and never lets go of one with no result yet', () => {
    const fake = fakeContext(true);
    const clock = createSceneGpuClock(fake.gl);
    frame(clock);
    // Signalled, but the query's answer is not readable until a task later.
    fake.signalOnly();
    expect(clock.poll(1)).toEqual({ costMs: undefined, behind: 1 });
    fake.finishAll(4_000_000);
    expect(clock.poll(2)).toEqual({ costMs: 4, behind: 0 });
  });

  it('answers with no cost, and the pipeline alone, on a driver without timer queries', () => {
    const fake = fakeContext(false);
    const clock = createSceneGpuClock(fake.gl);
    frame(clock);
    expect(fake.calls.beginQuery).not.toHaveBeenCalled();
    expect(clock.poll(1)).toEqual({ costMs: undefined, behind: 1 });
    fake.signalOnly();
    expect(clock.poll(2)).toEqual({ costMs: undefined, behind: 0 });
  });

  it('throws away a reading the GPU was disturbed during', () => {
    const fake = fakeContext(true);
    const clock = createSceneGpuClock(fake.gl);
    frame(clock);
    fake.finishAll(9_000_000);
    fake.disturb();
    expect(clock.poll(1)).toEqual({ costMs: undefined, behind: 0 });
  });

  it('says how long the oldest unfinished frame has been on the GPU', () => {
    const fake = fakeContext(true);
    const nowSpy = jest.spyOn(performance, 'now').mockReturnValue(100);
    const clock = createSceneGpuClock(fake.gl);
    expect(clock.oldestInFlightMs(100)).toBe(0);
    frame(clock);
    expect(clock.oldestInFlightMs(700)).toBe(600);
    nowSpy.mockRestore();
  });

  it('frees every fence and query on dispose', () => {
    const fake = fakeContext(true);
    const clock = createSceneGpuClock(fake.gl);
    frame(clock);
    frame(clock);
    fake.finishAll(1);
    clock.poll(1);
    frame(clock);
    clock.dispose();
    expect(fake.deleted.syncs).toBe(3);
    // Only two queries were ever made: the third frame reused a retired one.
    expect(fake.deleted.queries).toBe(2);
  });
});
