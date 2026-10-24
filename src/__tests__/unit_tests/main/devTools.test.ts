/* FluidEQ — GPL-3.0-or-later */
import { toggleWindowDevTools } from '../../../main/devTools';

const original = Object.getOwnPropertyDescriptor(process, 'platform');
afterEach(() => {
  if (original) {
    Object.defineProperty(process, 'platform', original);
  }
});

it('keeps Linux menu reopenings detached as well as the initial inspector', () => {
  Object.defineProperty(process, 'platform', { value: 'linux' });
  let opened = false;
  const inspector = {
    isDevToolsOpened: () => opened,
    openDevTools: jest.fn(() => {
      opened = true;
    }),
    closeDevTools: jest.fn(() => {
      opened = false;
    }),
    toggleDevTools: jest.fn(),
  };
  toggleWindowDevTools(inspector);
  toggleWindowDevTools(inspector);
  toggleWindowDevTools(inspector);
  expect(inspector.openDevTools.mock.calls).toEqual([
    [{ mode: 'detach' }],
    [{ mode: 'detach' }],
  ]);
  expect(inspector.closeDevTools).toHaveBeenCalledTimes(1);
  expect(inspector.toggleDevTools).not.toHaveBeenCalled();
});

it.each(['win32', 'darwin'] as const)(
  'preserves the native toggle on %s',
  (platform) => {
    Object.defineProperty(process, 'platform', { value: platform });
    const inspector = {
      isDevToolsOpened: jest.fn(),
      openDevTools: jest.fn(),
      closeDevTools: jest.fn(),
      toggleDevTools: jest.fn(),
    };
    toggleWindowDevTools(inspector);
    expect(inspector.toggleDevTools).toHaveBeenCalledWith();
    expect(inspector.openDevTools).not.toHaveBeenCalled();
  },
);
