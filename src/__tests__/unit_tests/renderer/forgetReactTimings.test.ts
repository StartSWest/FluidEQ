/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * React's development build writes a timing entry for DevTools on every
 * changed-props render and every state update, and never clears them; the
 * page keeps them all. In development the window lets each batch go as it
 * arrives, and outside development it installs nothing.
 */

import forgetReactTimings from '../../../renderer/utils/forgetReactTimings';

type TObserverCallback = () => void;

interface IFakeObserver {
  callback: TObserverCallback;
  options: PerformanceObserverInit | undefined;
}

const originalEnv = process.env.NODE_ENV;
const originalObserver = Object.getOwnPropertyDescriptor(
  globalThis,
  'PerformanceObserver',
);
const originalClear = performance.clearMeasures;

let observers: IFakeObserver[];
let clears: number;

/** A PerformanceObserver that records what it was asked to watch. */
const installObserver = (supported: readonly string[]) => {
  class FakeObserver {
    static supportedEntryTypes = supported;

    private readonly record: IFakeObserver;

    constructor(callback: TObserverCallback) {
      this.record = { callback, options: undefined };
      observers.push(this.record);
    }

    observe(options: PerformanceObserverInit) {
      this.record.options = options;
    }
  }
  Object.defineProperty(globalThis, 'PerformanceObserver', {
    configurable: true,
    writable: true,
    value: FakeObserver,
  });
};

beforeEach(() => {
  observers = [];
  clears = 0;
  performance.clearMeasures = () => {
    clears += 1;
  };
});

afterEach(() => {
  process.env.NODE_ENV = originalEnv;
  performance.clearMeasures = originalClear;
  if (originalObserver) {
    Object.defineProperty(globalThis, 'PerformanceObserver', originalObserver);
  } else {
    Reflect.deleteProperty(globalThis, 'PerformanceObserver');
  }
});

describe("React's development timing entries", () => {
  it('are cleared every time a batch of them arrives, in development', () => {
    process.env.NODE_ENV = 'development';
    installObserver(['mark', 'measure']);

    forgetReactTimings();

    expect(observers).toHaveLength(1);
    expect(observers[0].options).toEqual({ type: 'measure' });
    expect(clears).toBe(0);

    observers[0].callback();
    observers[0].callback();

    expect(clears).toBe(2);
  });

  it.each(['production', 'test'])(
    'are left alone in %s, where React writes none',
    (env) => {
      process.env.NODE_ENV = env;
      installObserver(['mark', 'measure']);

      forgetReactTimings();

      expect(observers).toHaveLength(0);
      expect(clears).toBe(0);
    },
  );

  it('ask nothing of a browser that cannot observe them', () => {
    process.env.NODE_ENV = 'development';
    installObserver(['mark']);

    forgetReactTimings();

    expect(observers).toHaveLength(0);
  });

  it('ask nothing of a page with no observer at all', () => {
    process.env.NODE_ENV = 'development';
    Reflect.deleteProperty(globalThis, 'PerformanceObserver');

    expect(() => forgetReactTimings()).not.toThrow();
    expect(clears).toBe(0);
  });
});
