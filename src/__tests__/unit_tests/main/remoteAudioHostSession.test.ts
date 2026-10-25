/* FluidEQ — GPL-3.0-or-later */

import startRemoteAudioHostSession from '../../../main/remoteAudioHostSession';
import type {
  ILanIdentity,
  IRemoteAudioCredentialStore,
} from '../../../main/remoteAudioCredentials';
import type {
  ILanHostSession,
  IRemoteAudioLan,
} from '../../../main/remoteAudioLanTypes';

const session = (port: number, secret: string): ILanHostSession => ({
  credentials: { port, secret },
  details: { deviceName: 'HEADSET-PC', computerId: 'x'.repeat(32) },
});

const lanWithStart = (start: jest.Mock): IRemoteAudioLan => ({
  start,
  join: jest.fn(),
  unlink: jest.fn(),
  retry: jest.fn(),
  sendAudio: jest.fn(),
  sendSignal: jest.fn(),
  setStreamMode: jest.fn(),
  stop: jest.fn(),
});

const storeWith = (identity?: ILanIdentity): IRemoteAudioCredentialStore => ({
  read: jest.fn(() => ({
    ...(identity ? { identity } : {}),
    joins: [],
    revoked: [],
  })),
  writeIdentity: jest.fn(),
  addJoin: jest.fn(),
  removeJoin: jest.fn(),
  revoke: jest.fn(),
  unrevoke: jest.fn(),
  clear: jest.fn(),
  saveGroupLink: jest.fn(),
  removeGroupLink: jest.fn(),
});

const saved = { port: 49_100, secret: 's'.repeat(43) };

describe('durable LAN audio identity', () => {
  it('reuses the saved pairing secret after an app or PC restart', async () => {
    const start = jest
      .fn()
      .mockResolvedValue(session(saved.port, saved.secret));

    await startRemoteAudioHostSession(lanWithStart(start), storeWith(saved));

    expect(start).toHaveBeenCalledWith(saved);
  });

  it('makes a code for a computer that has none yet', async () => {
    const fresh = session(49_400, 'n'.repeat(43));
    const start = jest.fn().mockResolvedValue(fresh);

    await expect(
      startRemoteAudioHostSession(lanWithStart(start), storeWith()),
    ).resolves.toBe(fresh);
    expect(start).toHaveBeenCalledWith();
  });

  it('keeps the saved identity when its old port is no longer available', async () => {
    const recovered = session(49_300, saved.secret);
    const addressInUse = Object.assign(new Error('port in use'), {
      code: 'EADDRINUSE',
    });
    const start = jest
      .fn()
      .mockRejectedValueOnce(addressInUse)
      .mockResolvedValueOnce(recovered);

    await expect(
      startRemoteAudioHostSession(lanWithStart(start), storeWith(saved)),
    ).resolves.toBe(recovered);
    expect(start).toHaveBeenLastCalledWith({ port: 0, secret: saved.secret });
  });

  it('does not restart a listener after its pending start was stopped', async () => {
    const stopped = Object.assign(new Error('listener stopped'), {
      code: 'ERR_SERVER_NOT_RUNNING',
    });
    const start = jest.fn().mockRejectedValue(stopped);

    await expect(
      startRemoteAudioHostSession(lanWithStart(start), storeWith(saved)),
    ).rejects.toBe(stopped);
    expect(start).toHaveBeenCalledTimes(1);
  });
});
