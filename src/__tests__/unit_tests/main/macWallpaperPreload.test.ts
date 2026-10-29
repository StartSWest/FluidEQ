import { WALLPAPER } from 'common/wallpaper';

const mockSend = jest.fn();
const mockExpose = jest.fn();
jest.mock('electron', () => ({
  contextBridge: {
    exposeInMainWorld: (...args: unknown[]) => mockExpose(...args),
  },
  ipcRenderer: { send: (...args: unknown[]) => mockSend(...args) },
}));

it('reports native Mac visibility from the isolated preload without expanding the scene bridge', () => {
  const platform = Object.getOwnPropertyDescriptor(process, 'platform');
  const state = Object.getOwnPropertyDescriptor(document, 'visibilityState');
  const listeners: EventListenerOrEventListenerObject[] = [];
  const add = document.addEventListener.bind(document);
  jest
    .spyOn(document, 'addEventListener')
    .mockImplementation((name, callback, options) => {
      if (name === 'visibilitychange' && callback) {
        listeners.push(callback);
      }
      add(name, callback, options);
    });
  try {
    Object.defineProperty(process, 'platform', { value: 'darwin' });
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    });
    // eslint-disable-next-line global-require -- preload side effects must run under the Mac platform
    require('main/wallpaperPreload');
    window.dispatchEvent(new Event('DOMContentLoaded'));
    expect(mockSend).toHaveBeenLastCalledWith(WALLPAPER.visibility, true);
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'hidden',
    });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(mockSend).toHaveBeenLastCalledWith(WALLPAPER.visibility, false);
    const [, bridge] = mockExpose.mock.calls[0];
    expect(Object.keys(bridge).sort()).toEqual([
      'bootstrap',
      'drawn',
      'failed',
      'onState',
      // A value, not a capability: the page lays itself out for the Mac.
      'platform',
      'requestAudio',
    ]);
  } finally {
    if (platform) {
      Object.defineProperty(process, 'platform', platform);
    }
    if (state) {
      Object.defineProperty(document, 'visibilityState', state);
    } else {
      Reflect.deleteProperty(document, 'visibilityState');
    }
    listeners.forEach((listener) =>
      document.removeEventListener('visibilitychange', listener),
    );
    jest.restoreAllMocks();
  }
});
