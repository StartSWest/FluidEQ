/** @jest-environment node */
import {
  ERROR_STACK_FRAMES,
  keepDeepErrorStacks,
} from '../../../common/errorStacks';

const original = Error.stackTraceLimit;
afterEach(() => {
  Error.stackTraceLimit = original;
});

/** An error thrown thirty calls down, and how many frames its stack kept. */
const framesThirtyDown = () => {
  const descend = (depth: number): Error =>
    depth === 0 ? new Error('deep') : descend(depth - 1);
  const stack = descend(30).stack ?? '';
  return stack.split('\n').filter((line) => line.trim().startsWith('at '))
    .length;
};

it("keeps a deep error's whole path, where V8's ten frames cut it off", () => {
  Error.stackTraceLimit = 10;
  // The control: at V8's default the caller thirty frames up is gone.
  expect(framesThirtyDown()).toBe(10);

  keepDeepErrorStacks();
  expect(Error.stackTraceLimit).toBe(ERROR_STACK_FRAMES);
  expect(framesThirtyDown()).toBeGreaterThan(30);
});
