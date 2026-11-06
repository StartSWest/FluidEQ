/** @jest-environment node */
import fs from 'fs';
import os from 'os';
import path from 'path';
import createAppUpdates from '../../../main/appUpdates';
import { isDspHostPlaying } from '../../../main/ipc/dspHost';
import { isRemoteAudioActive } from '../../../main/ipc/remoteAudio';
import { setUpReleaseAutoUpdates } from '../../../main/signedAutoUpdates';

jest.mock('electron', () => ({
  app: { isPackaged: true },
  Notification: jest.fn(),
}));
jest.mock('../../../common/i18n', () => ({ translate: jest.fn() }));
jest.mock('../../../main/appVersion', () => ({ appVersion: () => '2.3.0' }));
jest.mock('../../../main/ipc/dspHost', () => ({
  isDspHostPlaying: jest.fn(),
}));
jest.mock('../../../main/ipc/remoteAudio', () => ({
  isRemoteAudioActive: jest.fn(),
}));
jest.mock('../../../main/signedAutoUpdates', () => ({
  setUpReleaseAutoUpdates: jest.fn(),
}));
jest.mock('../../../main/nativeUpdatePrompt', () => ({
  isWindowOnScreen: () => false,
  createNativeUpdatePrompt: () => ({
    handleStatus: jest.fn(),
    notifyInstallFailed: jest.fn(),
  }),
}));
jest.mock('../../../main/tray', () => ({
  beginQuit: jest.fn(),
  getTrayLocale: () => 'en',
  revealMainWindow: jest.fn(),
  setTrayUpdateReady: jest.fn(),
  setTrayUpdatesEnabled: jest.fn(),
}));

let directory = '';
const installer = {
  installsUnattended: true,
  quitAndInstall: jest.fn(),
  isReadyToInstall: () => true,
  checkNow: jest.fn(),
  checkIfDue: jest.fn(),
};
const settleInstall = () =>
  new Promise<void>((resolve) => {
    setImmediate(resolve);
  });
const startUpdates = async () => {
  const updates = createAppUpdates({
    getMainWindow: () => null,
    unattendedRestartMarkerPath: path.join(directory, 'restart.json'),
  });
  await updates.setUpAutoUpdates();
  return updates;
};

beforeEach(() => {
  jest.clearAllMocks();
  installer.installsUnattended = true;
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-update-audio-'));
  jest.mocked(isDspHostPlaying).mockReturnValue(false);
  jest.mocked(isRemoteAudioActive).mockReturnValue(false);
  jest.mocked(setUpReleaseAutoUpdates).mockResolvedValue(installer);
});
afterEach(() => fs.rmSync(directory, { recursive: true, force: true }));

it.each(['Library', 'Share Audio'])(
  'defers an unattended install during %s and permits it when playback ends',
  async (source) => {
    const playing = jest.mocked(
      source === 'Library' ? isDspHostPlaying : isRemoteAudioActive,
    );
    playing.mockReturnValue(true);
    const updates = await startUpdates();
    updates.applyUpdateIfUnattended('window hidden during playback');
    await settleInstall();
    expect(installer.quitAndInstall).not.toHaveBeenCalled();
    expect(fs.existsSync(path.join(directory, 'restart.json'))).toBe(false);

    playing.mockReturnValue(false);
    updates.applyUpdateIfUnattended('window hidden after playback');
    await settleInstall();
    expect(installer.quitAndInstall).toHaveBeenCalledTimes(1);
    expect(installer.quitAndInstall).toHaveBeenCalledWith(true, true);
    expect(fs.existsSync(path.join(directory, 'restart.json'))).toBe(true);
  },
);

it('still allows a deliberate restart while Share Audio is active', async () => {
  jest.mocked(isRemoteAudioActive).mockReturnValue(true);
  const updates = await startUpdates();
  updates.installActiveUpdate();
  expect(installer.quitAndInstall).toHaveBeenCalledWith(true, true);
});

it('keeps a Debian password prompt behind a deliberate install, even while idle', async () => {
  installer.installsUnattended = false;
  const updates = await startUpdates();
  updates.applyUpdateIfUnattended('window hidden while idle');
  await settleInstall();
  expect(installer.quitAndInstall).not.toHaveBeenCalled();
  expect(fs.existsSync(path.join(directory, 'restart.json'))).toBe(false);

  updates.installActiveUpdate();
  expect(installer.quitAndInstall).toHaveBeenCalledWith(true, true);
});
