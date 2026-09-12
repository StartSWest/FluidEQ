import { ipcMain } from 'electron';
import log from 'electron-log';
import { uid } from 'uid';
import ChannelEnum from '../../common/channels';
import { ErrorCode } from '../../common/errors';
import {
  cloneBandDesign,
  filtersFromBandDesign,
  isBandDesignName,
  snapshotBandDesign,
} from '../../common/bandDesigns';
import {
  deleteBandDesign,
  readBandDesigns,
  writeBandDesign,
} from '../bandDesignStore';
import type { IFiltersIpcDeps } from './filters';

interface IBandDesignDeps extends Pick<
  IFiltersIpcDeps,
  | 'state'
  | 'handleUpdateHelper'
  | 'handleError'
  | 'switchToParametricEditing'
  | 'captureCurrentLayout'
> {
  userDataDir: string;
}

const registerBandDesignsIpc = ({
  state,
  userDataDir,
  handleUpdateHelper,
  handleError,
  switchToParametricEditing,
  captureCurrentLayout,
}: IBandDesignDeps) => {
  ipcMain.on(ChannelEnum.GET_BAND_DESIGNS, (event) => {
    try {
      event.reply(ChannelEnum.GET_BAND_DESIGNS, {
        result: readBandDesigns(userDataDir),
      });
    } catch (error) {
      log.error('Could not read saved band designs', error);
      handleError(event, ChannelEnum.GET_BAND_DESIGNS, ErrorCode.FAILURE);
    }
  });
  ipcMain.on(ChannelEnum.SAVE_BAND_DESIGN, async (event, args: unknown) => {
    const channel = ChannelEnum.SAVE_BAND_DESIGN;
    const name: unknown = Array.isArray(args) ? args[0] : undefined;
    const id: unknown = Array.isArray(args) ? args[1] : undefined;
    if (
      !isBandDesignName(name) ||
      (id !== undefined && typeof id !== 'string')
    ) {
      handleError(event, channel, ErrorCode.INVALID_PARAMETER);
      return;
    }
    try {
      if (
        id !== undefined &&
        !readBandDesigns(userDataDir).some((design) => design.id === id)
      ) {
        handleError(event, channel, ErrorCode.INVALID_PARAMETER);
        return;
      }
      const design = {
        id: id ?? uid(),
        name: name.trim(),
        bands: snapshotBandDesign(state.filters),
      };
      writeBandDesign(userDataDir, design);
      state.eqBandDesign = cloneBandDesign(design);
      await handleUpdateHelper(event, channel, design, false, true);
    } catch (error) {
      log.error('Could not save band design', error);
      handleError(event, channel, ErrorCode.FAILURE);
    }
  });
  ipcMain.on(ChannelEnum.DELETE_BAND_DESIGN, async (event, args: unknown) => {
    const channel = ChannelEnum.DELETE_BAND_DESIGN;
    const id: unknown = Array.isArray(args) ? args[0] : undefined;
    if (typeof id !== 'string' || !id) {
      handleError(event, channel, ErrorCode.INVALID_PARAMETER);
      return;
    }
    try {
      const removed = deleteBandDesign(userDataDir, id);
      if (state.eqBandDesign?.id === id) {
        state.eqBandDesign = undefined;
      }
      await handleUpdateHelper(event, channel, removed, false, true);
    } catch (error) {
      log.error('Could not delete band design', error);
      handleError(event, channel, ErrorCode.FAILURE);
    }
  });
  ipcMain.on(ChannelEnum.APPLY_BAND_DESIGN, async (event, args: unknown) => {
    const channel = ChannelEnum.APPLY_BAND_DESIGN;
    const id: unknown = Array.isArray(args) ? args[0] : undefined;
    try {
      const design =
        typeof id === 'string'
          ? readBandDesigns(userDataDir).find((entry) => entry.id === id)
          : undefined;
      if (!design) {
        handleError(event, channel, ErrorCode.INVALID_PARAMETER);
        return;
      }
      captureCurrentLayout();
      switchToParametricEditing();
      state.filters = filtersFromBandDesign(design);
      state.eqBandDesign = cloneBandDesign(design);
      state.eqImport = undefined;
      state.isFlat = false;
      await handleUpdateHelper(event, channel, design, false, true);
    } catch (error) {
      log.error('Could not apply band design', error);
      handleError(event, channel, ErrorCode.FAILURE);
    }
  });
};

export default registerBandDesignsIpc;
