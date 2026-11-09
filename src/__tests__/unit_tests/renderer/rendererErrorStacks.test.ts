import { ERROR_STACK_FRAMES } from '../../../common/errorStacks';
import { installGlobalErrorHandlers } from '../../../renderer/utils/logger';

it('keeps deep error stacks in the window from the moment its error handlers are installed', () => {
  const original = Error.stackTraceLimit;
  Error.stackTraceLimit = 10;
  try {
    installGlobalErrorHandlers();
    expect(Error.stackTraceLimit).toBe(ERROR_STACK_FRAMES);
  } finally {
    Error.stackTraceLimit = original;
  }
});
