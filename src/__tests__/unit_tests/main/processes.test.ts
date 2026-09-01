const handlers = new Map<string, () => unknown>();
const getAppMetrics = jest.fn();

jest.mock('electron', () => ({
  app: { getAppMetrics: () => getAppMetrics() },
  ipcMain: {
    handle: (channel: string, handler: () => unknown) =>
      handlers.set(channel, handler),
  },
}));

// eslint-disable-next-line import/first -- Electron must be mocked before import.
import type { BrowserWindow } from 'electron';
// eslint-disable-next-line import/first
import { registerProcessIpc } from '../../../main/ipc/processes';

describe('process diagnostics IPC', () => {
  beforeEach(() => {
    handlers.clear();
    getAppMetrics.mockReset();
  });

  it('returns process rows in a production build', () => {
    const previousEnvironment = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    getAppMetrics.mockReturnValue([
      {
        pid: 42,
        type: 'Tab',
        serviceName: undefined,
        memory: { workingSetSize: 131_072 },
        cpu: { percentCPUUsage: 2.34 },
      },
    ]);

    const window = {
      webContents: { getOSProcessId: () => 42 },
    } as unknown as BrowserWindow;
    registerProcessIpc({
      getMainWindow: () => window,
      getNativeHostPid: () => 99,
      getNativeHostStats: () => ({
        workingSetBytes: 64 * 1024 * 1024,
        cpuPercent: 1.25,
      }),
    });

    try {
      expect(handlers.get('app-processes')?.()).toEqual([
        {
          pid: 42,
          role: 'window',
          detail: undefined,
          memoryMb: 128,
          cpuPercent: 2.3,
        },
        {
          pid: 99,
          role: 'engine',
          memoryMb: 64,
          cpuPercent: 1.3,
        },
      ]);
    } finally {
      if (previousEnvironment === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = previousEnvironment;
      }
    }
  });
});
