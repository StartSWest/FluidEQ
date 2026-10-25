/** @jest-environment node */
/* FluidEQ — GPL-3.0-or-later */

import registerSystemMediaIpc from '../../../main/ipc/systemMedia';
import { forwardGroupMediaCommand } from '../../../main/groupMediaKeys';
import { systemMediaSourceFor } from '../../../main/systemMediaSource';

type THandler = (event: unknown, action: unknown) => unknown;
const handlers = new Map<string, THandler>();
const sendTransportKey = jest.fn(async (_action: unknown) => undefined);

jest.mock('electron', () => ({
  app: { on: jest.fn() },
  ipcMain: {
    handle: (channel: string, handler: THandler) =>
      handlers.set(channel, handler),
  },
}));
jest.mock('../../../main/groupMediaKeys', () => ({
  forwardGroupMediaCommand: jest.fn(),
}));
jest.mock('../../../main/systemMediaSource', () => ({
  systemMediaSourceFor: jest.fn(() => ({ sendTransportKey })),
}));

const actions = [
  ['playPause', 'toggle'],
  ['next', 'next'],
  ['previous', 'previous'],
] as const;
const press = (action: unknown) => {
  const handler = handlers.get('media-transport');
  if (!handler) {
    throw new Error('The media transport handler was not registered.');
  }
  return handler(undefined, action);
};

describe.each(['darwin', 'win32'] as const)(
  '%s transport after main sync',
  (platform) => {
    const originalPlatform = process.platform;
    beforeEach(() => {
      Object.defineProperty(process, 'platform', { value: platform });
      jest.clearAllMocks();
      handlers.clear();
      jest.mocked(forwardGroupMediaCommand).mockReturnValue(false);
      registerSystemMediaIpc({ onMedia: async () => undefined });
    });
    afterEach(() => {
      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it.each(actions)(
      'forwards linked %s exactly once without a local key',
      async (action, command) => {
        jest.mocked(forwardGroupMediaCommand).mockReturnValue(true);
        await press(action);
        expect(forwardGroupMediaCommand).toHaveBeenCalledTimes(1);
        expect(forwardGroupMediaCommand).toHaveBeenCalledWith({ command });
        expect(sendTransportKey).not.toHaveBeenCalled();
      },
    );

    it.each(actions)(
      'keeps native %s on its platform when no group takes it',
      async (action) => {
        await press(action);
        expect(systemMediaSourceFor).toHaveBeenCalledWith(platform);
        expect(sendTransportKey).toHaveBeenCalledTimes(1);
        expect(sendTransportKey).toHaveBeenCalledWith(action);
      },
    );

    it('leaves invalid actions at the existing native validation boundary', async () => {
      await press('VolumeMute');
      expect(forwardGroupMediaCommand).not.toHaveBeenCalled();
      expect(sendTransportKey).toHaveBeenCalledWith('VolumeMute');
    });
  },
);
