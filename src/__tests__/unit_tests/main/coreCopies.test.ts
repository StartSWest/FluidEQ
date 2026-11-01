/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The window handing the core its game profiles and saved chains, and once
 * the rack hold an older window kept: taken from the window's own top frame
 * only, checked, capped, and kept whole.
 */
import type { BrowserWindow, IpcMainEvent } from 'electron';
import { CORE_COPY_CHANNEL } from 'common/coreCopyChannels';
import { MAX_COPIED_ENTRIES } from 'common/coreCopies';
import registerCoreCopies from 'main/ipc/coreCopies';
import onWindowMessage from 'main/ipc/windowMessages';

jest.mock('main/ipc/windowMessages', () => ({
  __esModule: true,
  default: jest.fn(() => () => undefined),
}));

const mainFrame = {};
const webContents = { mainFrame };
const window = { webContents } as unknown as BrowserWindow;

const setUp = (held = '') => {
  (onWindowMessage as jest.Mock).mockClear();
  const games = { read: jest.fn(), keep: jest.fn(), onChange: jest.fn() };
  const dspPresets = { read: jest.fn(), keep: jest.fn(), onChange: jest.fn() };
  const rackHold = {
    read: jest.fn(() => held),
    keep: jest.fn(),
    onChange: jest.fn(),
  };
  registerCoreCopies({
    getMainWindow: () => window,
    games,
    dspPresets,
    rackHold,
  });
  const listeners = new Map(
    (onWindowMessage as jest.Mock).mock.calls.map(([channel, listener]) => [
      channel,
      listener as (event: IpcMainEvent, arg: unknown) => void,
    ]),
  );
  const send = (channel: string, arg: unknown, sender = webContents) =>
    listeners.get(channel)?.(
      { sender, senderFrame: sender.mainFrame } as unknown as IpcMainEvent,
      arg,
    );
  return { games, dspPresets, rackHold, send };
};

const profile = (id: string) => ({
  id,
  name: `Game ${id}`,
  path: `C:\\Games\\${id}.exe`,
  presetId: 'gaming',
  source: 'steam',
});

describe('the window’s lists, kept by the core', () => {
  it('keeps the game profiles and the switch, checked', () => {
    const { games, send } = setUp();
    send(CORE_COPY_CHANNEL.games, [
      { enabled: false, profiles: [profile('a'), { id: 'broken' }] },
    ]);

    expect(games.keep).toHaveBeenCalledWith({
      enabled: false,
      profiles: [expect.objectContaining({ id: 'a', presetId: 'gaming' })],
    });
  });

  it('keeps the saved chains, checked and clamped', () => {
    const { dspPresets, send } = setUp();
    send(CORE_COPY_CHANNEL.dspPresets, [
      [
        { id: 'user-chain:a', name: 'Mine', settings: { enabled: true } },
        { id: 'user-chain:b', name: 'No settings' },
      ],
    ]);

    const [[kept]] = dspPresets.keep.mock.calls;
    expect(kept).toHaveLength(1);
    expect(kept[0]).toEqual(
      expect.objectContaining({ id: 'user-chain:a', name: 'Mine' }),
    );
    expect(kept[0].settings.maximizer).toBeDefined();
  });

  it('keeps no more than a list ever holds', () => {
    const { games, send } = setUp();
    const many = Array.from({ length: MAX_COPIED_ENTRIES + 20 }, (_v, at) =>
      profile(String(at)),
    );
    send(CORE_COPY_CHANNEL.games, [{ enabled: true, profiles: many }]);

    expect(games.keep.mock.calls[0][0].profiles).toHaveLength(
      MAX_COPIED_ENTRIES,
    );
  });

  it('keeps the rack hold an older window handed over, checked, only where the core holds none', () => {
    const fresh = setUp();
    fresh.send(CORE_COPY_CHANNEL.rackHold, ['gaming']);
    expect(fresh.rackHold.keep).toHaveBeenCalledWith('gaming');

    const tooLong = setUp();
    tooLong.send(CORE_COPY_CHANNEL.rackHold, ['x'.repeat(200)]);
    expect(tooLong.rackHold.keep).toHaveBeenCalledWith('');

    // What the core holds is newer than anything a window kept before it.
    const holding = setUp('movie');
    holding.send(CORE_COPY_CHANNEL.rackHold, ['gaming']);
    expect(holding.rackHold.keep).not.toHaveBeenCalled();
  });

  it('takes nothing from anything but the window’s own top frame', () => {
    const { games, dspPresets, rackHold, send } = setUp();
    const stranger = { mainFrame: {} };
    send(CORE_COPY_CHANNEL.games, [{ profiles: [profile('a')] }], stranger);
    send(CORE_COPY_CHANNEL.dspPresets, [[]], stranger);
    send(CORE_COPY_CHANNEL.rackHold, ['gaming'], stranger);

    expect(games.keep).not.toHaveBeenCalled();
    expect(dspPresets.keep).not.toHaveBeenCalled();
    expect(rackHold.keep).not.toHaveBeenCalled();
  });

  it('takes nothing from a frame inside the window', () => {
    const { games, send } = setUp();
    const listeners = (onWindowMessage as jest.Mock).mock.calls;
    const fromSubFrame = listeners.find(
      ([channel]) => channel === CORE_COPY_CHANNEL.games,
    )?.[1] as (event: IpcMainEvent, arg: unknown) => void;
    fromSubFrame(
      { sender: webContents, senderFrame: {} } as unknown as IpcMainEvent,
      [{ profiles: [profile('a')] }],
    );
    // The control: the same message from the top frame is kept.
    send(CORE_COPY_CHANNEL.games, [{ profiles: [profile('b')] }]);

    expect(games.keep).toHaveBeenCalledTimes(1);
    expect(games.keep.mock.calls[0][0].profiles[0].id).toBe('b');
  });
});
