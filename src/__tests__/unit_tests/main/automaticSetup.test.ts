/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The one gate every automatic elevated run passes through.
 *
 * Two of the app's own repairs reaching the same conclusion from the same
 * facts, seconds apart, put two Windows prompts on screen and restarted every
 * stream on the machine twice for one user action; a prompt declined on the
 * first was no defence against the second. These pin the two rules that
 * stop that: one at a time, and once a session — with the two halves of the
 * Equalizer APO switch undoing each other's "once".
 */

import { createAutomaticSetup } from 'main/automaticSetup';

const pending = <T>() => {
  let finish!: (value: T) => void;
  const promise = new Promise<T>((resolve) => {
    finish = resolve;
  });
  return { promise, finish };
};

describe('the automatic setup gate', () => {
  it('runs a kind once a session, and says so afterwards', async () => {
    const gate = createAutomaticSetup();
    const work = jest.fn(async () => 'done');
    await expect(gate.attempt('install', work)).resolves.toBe('done');
    await expect(gate.attempt('install', work)).resolves.toBeUndefined();
    expect(work).toHaveBeenCalledTimes(1);
    expect(gate.wanted('install')).toBe(false);
  });

  it('lets nothing automatic start while another run is in flight', async () => {
    const gate = createAutomaticSetup();
    const slow = pending<string>();
    const first = gate.attempt('suspend-apo', () => slow.promise);
    const second = jest.fn(async () => 'ran');
    await expect(gate.attempt('install', second)).resolves.toBeUndefined();
    expect(second).not.toHaveBeenCalled();
    expect(gate.wanted('install')).toBe(false);
    slow.finish('ok');
    await expect(first).resolves.toBe('ok');
    // Free again once the first has ended.
    await expect(gate.attempt('install', second)).resolves.toBe('ran');
  });

  it('lets a switch back and forth switch Equalizer APO off again', async () => {
    const gate = createAutomaticSetup();
    const off = jest.fn(async () => 'off');
    const on = jest.fn(async () => 'on');
    await gate.attempt('suspend-apo', off);
    await expect(gate.attempt('suspend-apo', off)).resolves.toBeUndefined();
    await gate.attempt('restore-apo', on);
    await expect(gate.attempt('suspend-apo', off)).resolves.toBe('off');
    expect(off).toHaveBeenCalledTimes(2);
    expect(on).toHaveBeenCalledTimes(1);
  });

  it('frees the gate when the work throws', async () => {
    const gate = createAutomaticSetup();
    await expect(
      gate.attempt('install', async () => {
        throw new Error('the helper is missing');
      }),
    ).rejects.toThrow('missing');
    // Still once a session — a failed try is a try — but nothing is stuck.
    expect(gate.wanted('install')).toBe(false);
    expect(gate.wanted('suspend-apo')).toBe(true);
  });
});
