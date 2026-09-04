/* FluidEQ — GPL-3.0-or-later */

import startRemoteAudioHostSession from '../../../main/remoteAudioHostSession';
import type {
  IRemoteAudioCredentialStore,
  TLanListenerCredentials,
} from '../../../main/remoteAudioCredentials';
import type {
  ILanHostSession,
  IRemoteAudioLan,
} from '../../../main/remoteAudioLanTypes';

const session = (port: number, secret: string): ILanHostSession => ({
  credentials: { port, secret },
  details: { deviceName: 'HEADSET-PC', options: [] },
});

const lanWithHost = (startHost: jest.Mock): IRemoteAudioLan => ({
  join: jest.fn(),
  restoreJoin: jest.fn(),
  sendAudio: jest.fn(),
  sendSignal: jest.fn(),
  setStreamMode: jest.fn(),
  startHost,
  stop: jest.fn(),
});

const storeWith = (
  listener: TLanListenerCredentials,
): IRemoteAudioCredentialStore => ({
  activate: jest.fn(),
  clear: jest.fn(),
  read: jest.fn(() => listener),
  readListener: jest.fn(() => listener),
  readSender: jest.fn(),
  role: jest.fn(),
  write: jest.fn(),
});

describe('durable LAN audio listener identity', () => {
  it('reuses the saved pairing secret after an app or PC restart', async () => {
    const saved = {
      port: 49_100,
      role: 'listener' as const,
      secret: 's'.repeat(43),
    };
    const startHost = jest
      .fn()
      .mockResolvedValue(session(saved.port, saved.secret));

    await startRemoteAudioHostSession(
      lanWithHost(startHost),
      storeWith(saved),
      false,
    );

    expect(startHost).toHaveBeenCalledWith(saved);
  });

  it('keeps the saved identity when its old port is no longer available', async () => {
    const saved = {
      port: 49_100,
      role: 'listener' as const,
      secret: 's'.repeat(43),
    };
    const recovered = session(49_300, saved.secret);
    const startHost = jest
      .fn()
      .mockRejectedValueOnce(new Error('port in use'))
      .mockResolvedValueOnce(recovered);

    await expect(
      startRemoteAudioHostSession(
        lanWithHost(startHost),
        storeWith(saved),
        false,
      ),
    ).resolves.toBe(recovered);
    expect(startHost).toHaveBeenLastCalledWith({
      port: 0,
      secret: saved.secret,
    });
  });

  it('creates a new identity only when the user requests a new code', async () => {
    const saved = {
      port: 49_100,
      role: 'listener' as const,
      secret: 's'.repeat(43),
    };
    const replacement = session(49_400, 'n'.repeat(43));
    const startHost = jest.fn().mockResolvedValue(replacement);

    await expect(
      startRemoteAudioHostSession(
        lanWithHost(startHost),
        storeWith(saved),
        true,
      ),
    ).resolves.toBe(replacement);
    expect(startHost).toHaveBeenCalledWith();
  });
});
