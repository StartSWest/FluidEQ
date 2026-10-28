/* FluidEQ — GPL-3.0-or-later */
import { createAudioLeasePool } from '../../../main/shareAudio/leasePool';

it('shares one physical audio owner across overlapping UI leases', async () => {
  const close = jest.fn();
  const value = { push: jest.fn() };
  const start = jest.fn(async () => value);
  const pool = createAudioLeasePool(start, close);
  await Promise.all([pool.acquire(1), pool.acquire(2)]);
  expect(start).toHaveBeenCalledTimes(1);
  expect(pool.get(2)).toBe(value);
  await pool.release(1);
  expect(close).not.toHaveBeenCalled();
  await pool.release(2);
  expect(close).toHaveBeenCalledTimes(1);
});

it('finishes an old close before opening a replacement', async () => {
  let releaseClose: () => void = () => undefined;
  const closed = new Promise<void>((resolve) => {
    releaseClose = resolve;
  });
  const start = jest.fn(async () => ({}));
  const pool = createAudioLeasePool(start, () => closed);
  await pool.acquire(1);
  const closing = pool.release(1);
  const replacement = pool.acquire(2);
  await Promise.resolve();
  await Promise.resolve();
  expect(start).toHaveBeenCalledTimes(1);
  releaseClose();
  await closing;
  await replacement;
  expect(start).toHaveBeenCalledTimes(2);
});

it('bounds leases, reports failed opens and permits a fresh recovery', async () => {
  const start = jest
    .fn()
    .mockRejectedValueOnce(new Error('device unavailable'))
    .mockResolvedValue({});
  const pool = createAudioLeasePool(start, () => undefined);
  await expect(pool.acquire(1)).rejects.toThrow('device unavailable');
  await Promise.all(
    Array.from({ length: 16 }, (_, index) => pool.acquire(index + 2)),
  );
  await expect(pool.acquire(99)).rejects.toThrow('limit');
  expect(() => pool.get(1)).toThrow('closed');
});
