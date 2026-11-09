/** @jest-environment node */
import { EventEmitter } from 'events';

const mockStart = jest.fn();
const mockApp = Object.assign(new EventEmitter(), {
  getPath: jest.fn((name: string) =>
    name === 'crashDumps' ? 'C:/Users/me/AppData/Roaming/FluidEQ/Crashpad' : '',
  ),
});
const mockLogError = jest.fn();
jest.mock('electron', () => ({
  app: mockApp,
  crashReporter: { start: (...args: unknown[]) => mockStart(...args) },
}));
jest.mock('electron-log', () => ({
  error: (...args: unknown[]) => mockLogError(...args),
  warn: jest.fn(),
  initialize: jest.fn(),
  transports: { file: { level: 'warn', getFile: () => ({ path: '' }) } },
}));
jest.mock('../../../main/asyncWriter', () => ({
  flushPendingWrites: jest.fn(),
}));
jest.mock('../../../main/tray', () => ({
  getTrayLocale: () => 'en',
  isAppQuitting: () => false,
}));

// eslint-disable-next-line import/first -- The Electron mock has to exist before the modules that import it.
import { startCrashDumps } from '../../../main/crashDumps';
// eslint-disable-next-line import/first -- As above.
import { installCrashLogging } from '../../../main/crashRecovery';

const DUMPS = 'C:/Users/me/AppData/Roaming/FluidEQ/Crashpad';

beforeEach(() => {
  mockStart.mockClear();
  mockLogError.mockClear();
  mockApp.removeAllListeners();
});

it('keeps every dump on this computer: Crashpad starts with uploads off and no address to send to', () => {
  startCrashDumps();
  expect(mockStart).toHaveBeenCalledTimes(1);
  expect(mockStart).toHaveBeenCalledWith({ uploadToServer: false });
});

// installCrashLogging also arms the main process's fatal-error handlers,
// which must not outlive this test inside Jest's own process.
const FATAL_EVENTS = ['uncaughtException', 'unhandledRejection'] as const;
const withoutFatalHandlers = (run: () => void) => {
  const before = FATAL_EVENTS.map((name) => process.listeners(name));
  try {
    run();
  } finally {
    FATAL_EVENTS.forEach((name, index) => {
      process
        .listeners(name)
        .filter((listener) => !before[index].includes(listener))
        .forEach((listener) => process.removeListener(name, listener));
    });
  }
};

it("names the dump folder beside the window's crash and a helper process's", () => {
  withoutFatalHandlers(installCrashLogging);
  const crash = { reason: 'crashed', exitCode: -1073741819 };
  mockApp.emit('render-process-gone', {}, { getType: () => 'window' }, crash);
  mockApp.emit('child-process-gone', {}, { ...crash, type: 'GPU' });
  expect(mockLogError).toHaveBeenNthCalledWith(
    1,
    'Render process gone (window): crashed',
    { ...crash, dumps: DUMPS },
  );
  expect(mockLogError).toHaveBeenNthCalledWith(
    2,
    'Child process gone (GPU): crashed',
    { ...crash, type: 'GPU', dumps: DUMPS },
  );
});
