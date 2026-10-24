/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import createGuestProbe from '../../../renderer/video/guestProbe';

const deferred = () => {
  let settle: (value: unknown) => void = () => undefined;
  let fail: (error: Error) => void = () => undefined;
  const promise = new Promise<unknown>((resolve, reject) => {
    settle = resolve;
    fail = reject;
  });
  return { promise, resolve: settle, reject: fail };
};

it('coalesces navigation bursts and publishes only the latest page answer', async () => {
  const first = deferred();
  const latest = deferred();
  const read = jest
    .fn()
    .mockReturnValueOnce(first.promise)
    .mockReturnValueOnce(latest.promise);
  const accept = jest.fn();
  const probe = createGuestProbe(read, accept);
  for (let event = 0; event < 30; event += 1) {
    probe.refresh();
  }
  expect(read).toHaveBeenCalledTimes(1);
  first.resolve('old page');
  await first.promise;
  expect(read).toHaveBeenCalledTimes(2);
  expect(accept).not.toHaveBeenCalled();
  latest.resolve('current page');
  await latest.promise;
  expect(accept).toHaveBeenCalledWith('current page');
  expect(read).toHaveBeenCalledTimes(2);
});

it('drops an outstanding answer and queued reads when its view closes', async () => {
  const first = deferred();
  const read = jest.fn(() => first.promise);
  const accept = jest.fn();
  const probe = createGuestProbe(read, accept);
  probe.refresh();
  probe.refresh();
  probe.dispose();
  probe.refresh();
  first.resolve('closed page');
  await first.promise;
  expect(read).toHaveBeenCalledTimes(1);
  expect(accept).not.toHaveBeenCalled();
});

it('still reads the new document when the old one rejects its script', async () => {
  const first = deferred();
  const read = jest
    .fn()
    .mockReturnValueOnce(first.promise)
    .mockResolvedValueOnce('new document');
  const accept = jest.fn();
  const probe = createGuestProbe(read, accept);
  probe.refresh();
  probe.refresh();
  first.reject(new Error('document replaced'));
  await first.promise.catch(() => undefined);
  await Promise.resolve();
  expect(read).toHaveBeenCalledTimes(2);
  expect(accept).toHaveBeenCalledWith('new document');
});
