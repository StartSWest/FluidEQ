/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import latestCall from 'common/latestCall';

/** It replaced a debounce and a throttle: nothing may be scheduled. */
const expectNothingScheduled = () => expect(jest.getTimerCount()).toBe(0);

/** A write that settles when the test says so. */
const controlledWrites = () => {
  const sent: number[] = [];
  const pending: { resolve: () => void; reject: (error: unknown) => void }[] =
    [];
  const writeValue = (value: number) => {
    sent.push(value);
    return new Promise<void>((resolve, reject) => {
      pending.push({ resolve, reject });
    });
  };
  const write = latestCall(writeValue);
  const settle = async (error?: unknown) => {
    const oldest = pending.shift();
    if (error === undefined) {
      oldest?.resolve();
    } else {
      oldest?.reject(error);
    }
    // The write's promise, the caller's, and the caller's own `then`.
    for (let turn = 0; turn < 5; turn += 1) {
      // eslint-disable-next-line no-await-in-loop -- one turn after another is the point
      await Promise.resolve();
    }
  };
  return { sent, write, settle };
};

describe('one write in flight, the newest waiting', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    expectNothingScheduled();
    jest.useRealTimers();
  });

  it('sends the first value at once and only the newest of the rest after it', async () => {
    const { sent, write, settle } = controlledWrites();
    const outcomes: string[] = [];
    write(1).then(() => outcomes.push('1'));
    write(2).then(() => outcomes.push('2'));
    write(3).then(() => outcomes.push('3'));
    expect(sent).toEqual([1]);

    // 2 was replaced while it waited, so it is done with at once — before 1
    // has even come back.
    await settle();
    expect(sent).toEqual([1, 3]);
    expect(outcomes).toEqual(['2', '1']);

    await settle();
    expect(outcomes).toEqual(['2', '1', '3']);
  });

  it('sends at once again once nothing is in flight', async () => {
    const { sent, write, settle } = controlledWrites();
    write(1);
    await settle();
    write(2);
    expect(sent).toEqual([1, 2]);
    await settle();
  });

  it('tells the caller whose value failed, and carries on with the newest', async () => {
    const { sent, write, settle } = controlledWrites();
    const failed = write(1).catch((error: unknown) => error);
    write(2);
    await settle(new Error('refused'));
    await expect(failed).resolves.toEqual(new Error('refused'));
    expect(sent).toEqual([1, 2]);
    await settle();
  });

  it('rejects a writer that throws before it returns a promise', async () => {
    const write = latestCall(() => {
      throw new Error('bridge refused');
    });
    await expect(write()).rejects.toThrow('bridge refused');
  });
});
