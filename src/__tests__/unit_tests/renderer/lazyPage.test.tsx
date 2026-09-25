/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import '@testing-library/jest-dom';
import { act, cleanup, render, screen } from '@testing-library/react';
import { Suspense, useEffect, useState } from 'react';
import lazyPage from '../../../renderer/utils/lazyPage';

/** A page whose code arrives when the test says so. */
const deferredPage = () => {
  const mounts: string[] = [];
  const Real = ({ label }: { label: string }) => {
    const [count, setCount] = useState(0);
    useEffect(() => {
      mounts.push(label);
    }, [label]);
    return (
      <button type="button" onClick={() => setCount((n) => n + 1)}>
        {label} {count}
      </button>
    );
  };
  let arrive: () => void = () => undefined;
  let fail: (error: Error) => void = () => undefined;
  const load = jest.fn(
    () =>
      new Promise<{ default: typeof Real }>((resolve, reject) => {
        arrive = () => resolve({ default: Real });
        fail = reject;
      }),
  );
  return {
    page: lazyPage(load),
    load,
    mounts,
    arrive: () => arrive(),
    fail: (error: Error) => fail(error),
  };
};

afterEach(cleanup);

describe('lazyPage', () => {
  it('draws a page fetched ahead of time in the same frame, without waiting', async () => {
    const { page, arrive } = deferredPage();
    const preloaded = page.preload();
    expect(page.isLoaded()).toBe(false);
    arrive();
    await act(async () => preloaded);
    expect(page.isLoaded()).toBe(true);

    render(
      <Suspense fallback={<span>waiting</span>}>
        <page.Page label="eq" />
      </Suspense>,
    );
    // Synchronously: no fallback frame between the press and the page.
    expect(screen.getByRole('button', { name: 'eq 0' })).toBeInTheDocument();
    expect(screen.queryByText('waiting')).toBeNull();
  });

  it('waits in its boundary when drawn early, and keeps its state once there', async () => {
    const { page, arrive, mounts } = deferredPage();
    const view = render(
      <Suspense fallback={<span>waiting</span>}>
        <page.Page label="dsp" />
      </Suspense>,
    );
    expect(screen.getByText('waiting')).toBeInTheDocument();
    await act(async () => arrive());
    const button = screen.getByRole('button', { name: 'dsp 0' });
    await act(async () => button.click());
    expect(screen.getByRole('button', { name: 'dsp 1' })).toBeInTheDocument();

    // A later render of the same mount, now that the code is here, must not
    // swap the waiting wrapper for the loaded component: that would be a new
    // element type, and the page would start again at 0.
    view.rerender(
      <Suspense fallback={<span>waiting</span>}>
        <page.Page label="dsp" />
      </Suspense>,
    );
    expect(screen.getByRole('button', { name: 'dsp 1' })).toBeInTheDocument();
    expect(mounts).toEqual(['dsp']);
  });

  it('fetches once for every hover, focus and press', async () => {
    const { page, arrive, load } = deferredPage();
    const first = page.preload();
    const second = page.preload();
    arrive();
    await act(async () => Promise.all([first, second]));
    await page.preload();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('asks again after a failed fetch instead of keeping the failure', async () => {
    const { page, fail, load } = deferredPage();
    const failed = page.preload();
    fail(new Error('chunk missing'));
    await expect(failed).rejects.toThrow('chunk missing');
    expect(page.isLoaded()).toBe(false);

    const retried = page.preload();
    // The positive control: a second fetch really was made.
    expect(load).toHaveBeenCalledTimes(2);
    retried.catch(() => undefined);
  });
});
