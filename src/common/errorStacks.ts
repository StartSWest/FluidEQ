/* FluidEQ — GPL-3.0-or-later */

/**
 * How many frames an error's stack keeps, in the window and in main.
 *
 * V8 keeps ten, and ten is where the evidence stopped: on 2026-11-09 the
 * Studio's window died on React's "Maximum update depth exceeded", and the
 * stack in the log ended at the chat's own setter. The caller, which decided
 * whether the chat or something beside it was looping, was the eleventh
 * frame. Fifty holds a React update path from the event or effect that
 * started it down to the store that threw. Errors are rare here, so the
 * extra frames cost nothing anyone can measure.
 */
export const ERROR_STACK_FRAMES = 50;

/** Set once per process, before anything that could throw is running. */
export const keepDeepErrorStacks = () => {
  Error.stackTraceLimit = ERROR_STACK_FRAMES;
};
