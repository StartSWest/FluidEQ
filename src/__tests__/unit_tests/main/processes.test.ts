/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

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
// eslint-disable-next-line import/first
import {
  LIBRARY_SCAN_PROCESS_NAME,
  MODEL_PROCESS_NAME,
} from '../../../main/utilityProcessNames';

const metric = (over: Record<string, unknown>) => ({
  serviceName: undefined,
  name: undefined,
  memory: { workingSetSize: 10_240 },
  cpu: { percentCPUUsage: 0, cumulativeCPUUsage: 1.5 },
  ...over,
});

const rowsFor = (metrics: unknown[]) => {
  getAppMetrics.mockReturnValue(metrics);
  const window = {
    webContents: { getOSProcessId: () => 1 },
  } as unknown as BrowserWindow;
  registerProcessIpc({
    getMainWindow: () => window,
    getNativeHostPid: () => undefined,
    getNativeHostStats: () => undefined,
  });
  return handlers.get('app-processes')?.() as Array<Record<string, unknown>>;
};

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

  it("names the app's own forks by the name they were given, not their shared service", () => {
    const rows = rowsFor([
      metric({
        pid: 21,
        type: 'Utility',
        serviceName: 'node.mojom.NodeService',
        name: MODEL_PROCESS_NAME,
      }),
      metric({
        pid: 22,
        type: 'Utility',
        serviceName: 'node.mojom.NodeService',
        name: LIBRARY_SCAN_PROCESS_NAME,
      }),
      // The control: a fork of the same service under another name stays a
      // helper, and says which one it is.
      metric({
        pid: 23,
        type: 'Utility',
        serviceName: 'node.mojom.NodeService',
        name: 'Storage Service',
      }),
    ]);
    expect(
      rows.map(({ pid, role, detail }) => ({ pid, role, detail })),
    ).toEqual([
      { pid: 21, role: 'models', detail: undefined },
      { pid: 22, role: 'libraryScan', detail: undefined },
      { pid: 23, role: 'helper', detail: 'Storage Service' },
    ]);
  });

  it('calls the video-capture service a device list, and keeps the fixed order', () => {
    const rows = rowsFor([
      metric({
        pid: 31,
        type: 'Utility',
        serviceName: 'video_capture.mojom.VideoCaptureService',
      }),
      metric({
        pid: 32,
        type: 'Utility',
        serviceName: 'network.mojom.NetworkService',
      }),
      metric({
        pid: 33,
        type: 'Utility',
        serviceName: 'node.mojom.NodeService',
        name: LIBRARY_SCAN_PROCESS_NAME,
      }),
      metric({ pid: 34, type: 'GPU' }),
      metric({ pid: 1, type: 'Tab' }),
    ]);
    expect(rows.map((entry) => entry.role)).toEqual([
      'window',
      'graphics',
      'libraryScan',
      'network',
      'devices',
    ]);
  });

  it("hands on each Electron process's running CPU total", () => {
    const [row] = rowsFor([metric({ pid: 1, type: 'Tab' })]);
    expect(row).toMatchObject({ cpuSeconds: 1.5, memoryMb: 10 });
  });
});
