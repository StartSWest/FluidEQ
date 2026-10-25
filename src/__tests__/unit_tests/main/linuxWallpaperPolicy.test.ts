/** @jest-environment node */
/* FluidEQ — GPL-3.0-or-later */

const mockReport = jest.fn();
const mockMonitor = { x: 0, y: 0, width: 1536, height: 960 };
const mockSession = {
  isLocked: false,
  connect: jest.fn(),
  disconnect: jest.fn(),
};

jest.mock('gi://Clutter', () => ({}), { virtual: true });
jest.mock('gi://Meta', () => ({ TabList: { NORMAL_ALL: 0 } }), {
  virtual: true,
});
jest.mock(
  'gi://GLib',
  () => ({ Variant: jest.fn((_type: string, value: unknown) => value) }),
  { virtual: true },
);
jest.mock(
  'gi://Gio',
  () => ({
    DBus: { session: {} },
    DBusExportedObject: {
      wrapJSObject: () => ({
        export: jest.fn(),
        unexport: jest.fn(),
        get_connection: () => ({ emit_signal: mockReport }),
      }),
    },
    BusNameOwnerFlags: { NONE: 0 },
    bus_own_name_on_connection: jest.fn(),
    bus_unown_name: jest.fn(),
    bus_unwatch_name: jest.fn(),
  }),
  { virtual: true },
);
jest.mock(
  'resource:///org/gnome/shell/extensions/extension.js',
  () => ({ Extension: jest.fn() }),
  { virtual: true },
);
jest.mock(
  'resource:///org/gnome/shell/ui/main.js',
  () => ({
    layoutManager: {
      monitors: [mockMonitor],
      connect: jest.fn(),
      disconnect: jest.fn(),
    },
    sessionMode: mockSession,
  }),
  { virtual: true },
);

class Signals {
  private listeners = new Map<
    number,
    { signal: string; callback: () => void }
  >();

  private next = 0;

  connect(signal: string, callback: () => void) {
    this.next += 1;
    this.listeners.set(this.next, { signal, callback });
    return this.next;
  }

  disconnect(id: number) {
    this.listeners.delete(id);
  }

  emit(signal: string) {
    this.listeners.forEach((listener) => {
      if (listener.signal === signal) {
        listener.callback();
      }
    });
  }
}

const mockDisplay = Object.assign(new Signals(), {
  get_tab_list: () => mockWindows,
});
const mockWorkspace = Object.assign(new Signals(), {
  get_active_workspace: () => ({}),
});
let mockWindows: ReturnType<typeof coveringWindow>[] = [];
const coveringWindow = (pid = 456, x = 0) => ({
  minimized: false,
  workspaceVisible: true,
  get_pid: () => pid,
  get_frame_rect: () => ({ ...mockMonitor, x }),
  showing_on_its_workspace() {
    return this.workspaceVisible;
  },
});

const { default: Desktop } = jest.requireActual<
  typeof import('../../../../native/linux/wallpaper/gnome-extension/extension')
>('../../../../native/linux/wallpaper/gnome-extension/extension');

const savedGlobals = new Map<string, PropertyDescriptor | undefined>();
beforeAll(() => {
  Object.entries({
    display: mockDisplay,
    window_manager: new Signals(),
    workspace_manager: mockWorkspace,
  }).forEach(([key, value]) => {
    savedGlobals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, value });
  });
});
afterAll(() => {
  savedGlobals.forEach((descriptor, key) => {
    if (descriptor) {
      Object.defineProperty(globalThis, key, descriptor);
    } else {
      Reflect.deleteProperty(globalThis, key);
    }
  });
});

let desktop: InstanceType<typeof Desktop>;
const expectReport = (report: string, sender = ':wallpaper') =>
  expect(mockReport).toHaveBeenLastCalledWith(
    sender,
    expect.any(String),
    expect.any(String),
    'Report',
    [report],
  );

beforeEach(() => {
  jest.clearAllMocks();
  mockSession.isLocked = false;
  mockWindows = [];
  desktop = new Desktop();
  desktop.enable();
  if (!desktop.entries) {
    throw new Error('The desktop adapter did not initialize its surfaces.');
  }
  desktop.entries.set(':wallpaper', {
    sender: ':wallpaper',
    pid: 123,
    actor: {},
    monitor: 0,
    visible: true,
    cover: null,
    signals: [],
    container: { visible: true, destroy: jest.fn() },
  });
  desktop.policy();
  expectReport('active');
  mockReport.mockClear();
});
afterEach(() => desktop.disable());

it('pauses for another app covering the monitor, then resumes on exit or minimize', () => {
  const window = coveringWindow();
  mockWindows = [window];
  mockDisplay.emit('in-fullscreen-changed');
  expectReport('paused');
  mockDisplay.emit('restacked');
  expect(mockReport).toHaveBeenCalledTimes(1);

  mockWindows = [];
  mockDisplay.emit('in-fullscreen-changed');
  expectReport('active');

  mockWindows = [window];
  mockDisplay.emit('in-fullscreen-changed');
  expectReport('paused');
  window.minimized = true;
  mockDisplay.emit('restacked');
  expectReport('active');
  expect(desktop.entries?.size).toBe(1);
});

it('keeps drawing for a partial window, another monitor or an inactive workspace', () => {
  mockWindows = [coveringWindow(456, 100)];
  mockDisplay.emit('restacked');
  mockWindows = [coveringWindow(456, 1536)];
  mockDisplay.emit('in-fullscreen-changed');
  const window = coveringWindow();
  window.workspaceVisible = false;
  mockWindows = [window];
  mockWorkspace.emit('active-workspace-changed');
  expect(mockReport).not.toHaveBeenCalled();
});

it('distinguishes FluidEQ covering the screen from another app covering it', () => {
  mockWindows = [coveringWindow(123)];
  mockDisplay.emit('in-fullscreen-changed');
  expectReport('paused-owner');
  mockWindows.push(coveringWindow());
  mockDisplay.emit('restacked');
  expectReport('paused');
  expect(mockReport).toHaveBeenCalledTimes(2);
});
