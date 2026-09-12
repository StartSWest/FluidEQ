import { ipcMain } from 'electron';
import ChannelEnum from 'common/channels';
import { getDefaultState } from 'common/constants';
import { registerPreampIpc } from 'main/ipc/preamp';

jest.mock('electron', () => ({ ipcMain: { on: jest.fn() } }));
jest.mock('main/flush', () => ({ getResolvedPreAmp: jest.fn(() => -4) }));

describe('APO measurement write boundary', () => {
  it.each([true, false])(
    'a manual reset survives disabling again (native=%s)',
    async (native) => {
      const state = { ...getDefaultState(), preAmp: 0, isAutoPreAmpOn: false };
      jest.mocked(ipcMain.on).mockClear();
      registerPreampIpc({
        state,
        usesNativeHeadroom: () => native,
        canMeasureHeadroom: () => !native,
        handleUpdate: jest.fn(),
        handleUpdateHelper: jest.fn(),
        handleError: jest.fn(),
      });
      const toggle = jest
        .mocked(ipcMain.on)
        .mock.calls.find(
          ([channel]) => channel === ChannelEnum.SET_AUTO_PREAMP,
        )?.[1];
      if (!toggle) {
        throw new Error('Toggle missing');
      }
      await toggle({ reply: jest.fn() } as unknown as Electron.IpcMainEvent, [
        false,
      ]);
      expect(state.preAmp).toBe(0);
      await toggle({ reply: jest.fn() } as unknown as Electron.IpcMainEvent, [
        true,
      ]);
      expect(state.preAmp).toBe(native ? 0 : -4);
    },
  );
  const setup = (allowed: boolean, enabled = true) => {
    const state = {
      ...getDefaultState(),
      isAutoPreAmpOn: enabled,
      isEnabled: true,
    };
    const update = jest.fn().mockResolvedValue(undefined);
    jest.mocked(ipcMain.on).mockClear();
    registerPreampIpc({
      state,
      canMeasureHeadroom: () => allowed,
      usesNativeHeadroom: () => false,
      handleUpdate: update,
      handleUpdateHelper: update,
      handleError: jest.fn(),
    });
    const handler = jest
      .mocked(ipcMain.on)
      .mock.calls.find(
        ([channel]) => channel === ChannelEnum.SET_SMART_HEADROOM_MEASUREMENT,
      )?.[1];
    if (!handler) {
      throw new Error('Measurement handler missing');
    }
    return { state, update, handler };
  };

  it.each([
    [false, true],
    [true, false],
  ])(
    'rejects a late report when engine eligible=%s and auto=%s',
    async (allowed, enabled) => {
      const { state, update, handler } = setup(allowed, enabled);
      const before = { ...state };
      const event = { reply: jest.fn() };
      await handler(event as unknown as Electron.IpcMainEvent, [
        [],
        -0.5,
        'request',
      ]);
      expect(state).toEqual(before);
      expect(update).not.toHaveBeenCalled();
      expect(event.reply).toHaveBeenCalledWith(
        ChannelEnum.SET_SMART_HEADROOM_MEASUREMENT,
        { result: { requestId: 'request', applied: false } },
      );
    },
  );

  it('writes one bounded trim without saving profiles and correlates its acknowledgment', async () => {
    const { state, update, handler } = setup(true);
    const event = { reply: jest.fn() };
    await handler(event as unknown as Electron.IpcMainEvent, [
      [],
      -0.5,
      'request',
    ]);
    expect(state.smartHeadroomTrimDb).toBe(-0.5);
    expect(state.smartHeadroomProgramme).toBeUndefined();
    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith(
      event,
      ChannelEnum.SET_SMART_HEADROOM_MEASUREMENT,
      { requestId: 'request', applied: true },
      false,
      false,
    );
  });
});
