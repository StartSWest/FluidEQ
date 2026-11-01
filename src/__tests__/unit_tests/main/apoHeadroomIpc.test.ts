import { ipcMain } from 'electron';
import ChannelEnum from 'common/channels';
import { getDefaultState } from 'common/constants';
import { registerPreampIpc } from 'main/ipc/preamp';
import type { TReplySink } from 'main/updatePath';

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
        tellWindowPreAmp: jest.fn(),
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

  /** The writer, standing in for the update path; `refuse` answers an error. */
  const setup = (allowed: boolean, enabled = true, refuse = false) => {
    const state = {
      ...getDefaultState(),
      isAutoPreAmpOn: enabled,
      isEnabled: true,
    };
    const update = jest.fn(async (sink: TReplySink, channel: string) => {
      sink.reply(
        channel,
        refuse ? { error: 'failure' } : { result: undefined },
      );
    });
    const tellWindowPreAmp = jest.fn();
    jest.mocked(ipcMain.on).mockClear();
    const { applyHeadroomTrim } = registerPreampIpc({
      state,
      canMeasureHeadroom: () => allowed,
      usesNativeHeadroom: () => false,
      tellWindowPreAmp,
      handleUpdate: jest.fn(),
      handleUpdateHelper: update,
      handleError: jest.fn(),
    });
    return { state, update, tellWindowPreAmp, applyHeadroomTrim };
  };

  it.each([
    [false, true],
    [true, false],
  ])(
    'refuses a late trim when engine eligible=%s and auto=%s',
    async (allowed, enabled) => {
      const { state, update, tellWindowPreAmp, applyHeadroomTrim } = setup(
        allowed,
        enabled,
      );
      const before = { ...state };

      await expect(applyHeadroomTrim(-0.5)).resolves.toBe(false);
      expect(state).toEqual(before);
      expect(update).not.toHaveBeenCalled();
      expect(tellWindowPreAmp).not.toHaveBeenCalled();
    },
  );

  it('writes one bounded trim without saving profiles, and tells the window its preamp', async () => {
    const { state, update, tellWindowPreAmp, applyHeadroomTrim } = setup(true);
    state.smartHeadroomProgramme = [{ frequency: 100, gain: -3 }];

    await expect(applyHeadroomTrim(-0.5)).resolves.toBe(true);
    expect(state.smartHeadroomTrimDb).toBe(-0.5);
    expect(state.smartHeadroomProgramme).toBeUndefined();
    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith(
      expect.anything(),
      'apoHeadroom',
      undefined,
      false,
      false,
    );
    expect(tellWindowPreAmp).toHaveBeenCalledWith(-4);
  });

  it('never writes a trim that adds level', async () => {
    const { state, applyHeadroomTrim } = setup(true);

    await applyHeadroomTrim(3);
    expect(state.smartHeadroomTrimDb).toBe(0);
  });

  it('says a refused write was not applied, and tells the window nothing', async () => {
    const { tellWindowPreAmp, applyHeadroomTrim } = setup(true, true, true);

    await expect(applyHeadroomTrim(-1)).resolves.toBe(false);
    expect(tellWindowPreAmp).not.toHaveBeenCalled();
  });
});
