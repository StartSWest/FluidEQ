/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The graph out of sight while the window changes size for full screen, and
 * back once the window's own answer and a frame at the new size say so (Ivan,
 * 2026-09-26: "needs to appear smooth fading in, no moving animation like
 * when exiting full screen").
 */

import { holdGraphUntil, isGraphArriving } from 'renderer/graph/graphArrival';

const deferred = () => {
  let settle: (error?: Error) => void = () => undefined;
  const promise = new Promise<void>((resolve, reject) => {
    settle = (error) => (error ? reject(error) : resolve());
  });
  return {
    promise,
    resolve: () => settle(),
    reject: (error: Error) => settle(error),
  };
};

const flush = () =>
  new Promise<void>((resolve) => {
    queueMicrotask(resolve);
  });

const marked = () =>
  document.documentElement.hasAttribute('data-graph-arriving');

describe('the graph arriving', () => {
  it('is marked from the request until the window has answered', async () => {
    const settled = deferred();
    holdGraphUntil(settled.promise);
    expect(isGraphArriving()).toBe(true);
    expect(marked()).toBe(true);
    settled.resolve();
    await flush();
    expect(isGraphArriving()).toBe(false);
    expect(marked()).toBe(false);
  });

  // A window that refused or failed still gives the graph back: a mark left
  // behind is a graph nobody can see.
  it('comes back when the window fails to answer as asked', async () => {
    const settled = deferred();
    holdGraphUntil(settled.promise);
    settled.reject(new Error('refused'));
    await flush();
    expect(marked()).toBe(false);
  });

  it('ends on the last request when two overlap', async () => {
    const first = deferred();
    const second = deferred();
    holdGraphUntil(first.promise);
    holdGraphUntil(second.promise);
    first.resolve();
    await flush();
    expect(marked()).toBe(true);
    second.resolve();
    await flush();
    expect(marked()).toBe(false);
  });
});
