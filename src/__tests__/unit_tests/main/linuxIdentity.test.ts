/** @jest-environment node */
/* FluidEQ — GPL-3.0-or-later */

const mockApp = { isPackaged: false, setDesktopName: jest.fn() };

jest.mock('electron', () => ({ app: mockApp }));

// eslint-disable-next-line import/first
import applyLinuxIdentity, {
  DEV_DESKTOP_NAME,
} from '../../../main/linuxIdentity';

describe('FluidEQ’s name on Linux', () => {
  const originalPlatform = process.platform;
  const originalTitle = process.title;
  const setPlatform = (value: string) =>
    Object.defineProperty(process, 'platform', { value });

  afterEach(() => {
    setPlatform(originalPlatform);
    process.title = originalTitle;
    mockApp.isPackaged = false;
    mockApp.setDesktopName.mockClear();
  });

  it('calls the development build FluidEQ, window and process', () => {
    setPlatform('linux');
    applyLinuxIdentity();

    expect(process.title).toBe('FluidEQ');
    expect(mockApp.setDesktopName).toHaveBeenCalledWith(DEV_DESKTOP_NAME);
  });

  it('leaves a release’s window to the launcher its package installs', () => {
    setPlatform('linux');
    mockApp.isPackaged = true;
    applyLinuxIdentity();

    expect(process.title).toBe('FluidEQ');
    expect(mockApp.setDesktopName).not.toHaveBeenCalled();
  });

  it('touches nothing on Windows, which is named by its version resource', () => {
    setPlatform('win32');
    const before = process.title;
    applyLinuxIdentity();

    expect(process.title).toBe(before);
    expect(mockApp.setDesktopName).not.toHaveBeenCalled();
  });
});
