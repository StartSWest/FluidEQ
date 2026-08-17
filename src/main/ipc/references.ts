/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { ipcMain } from 'electron';
import log from 'electron-log';
import {
  IFiltersMap,
  IOpraProduct,
  IOpraUpdateStatus,
  IPresetV2,
  IState,
  OPRA_SOURCE_ID,
  TApoLayer,
  describeBandShape,
} from '../../common/constants';
import { ErrorCode } from '../../common/errors';
import ChannelEnum from '../../common/channels';
import { getOpraPreset, getOpraProductList } from '../opra';
import { checkOpraUpdate, updateOpraDatabase } from '../opraUpdater';
import {
  downloadConvolution,
  getConvolutionCatalog,
} from '../convolutionCatalog';
import { getConfigPath } from '../registry';
import { TSuccess } from '../../renderer/utils/equalizerApi';

/**
 * Reference data: measurements and impulse responses, fetched and applied.
 *
 * Two hundred and ten lines of main.ts. Everything here brings something in
 * from outside — a headphone's published correction, a room's impulse response,
 * a refreshed OPRA database — or takes it back out again.
 *
 * The two clearing handlers belong with them rather than with the other layer
 * controls: clearing a headset or a convolution is undoing one of these
 * imports, and both have to put back what the reference replaced.
 */
export interface IReferencesIpcDeps {
  state: IState;
  session: { configPath: string; activeAudioDeviceId: string };

  /** Bounds a published curve so a bad measurement cannot silence the output. */
  shieldReferenceBands: (filters: IFiltersMap) => IFiltersMap;
  applyingLayer: (layer: TApoLayer) => void;

  handleError: (
    event: Electron.IpcMainEvent,
    channel: ChannelEnum | string,
    errorCode: ErrorCode,
    message?: string,
    action?: string,
  ) => void;
  handleUpdate: (
    event: Electron.IpcMainEvent,
    channel: ChannelEnum | string,
    syncActiveProfile?: boolean,
    useActiveSessionOverride?: boolean,
  ) => Promise<void>;
  handleUpdateHelper: <T>(
    event: Electron.IpcMainEvent,
    channel: ChannelEnum | string,
    response: T,
    syncActiveProfile?: boolean,
    useActiveSessionOverride?: boolean,
  ) => Promise<void>;
}

export const registerReferencesIpc = ({
  applyingLayer,
  handleError,
  handleUpdate,
  handleUpdateHelper,
  session,
  shieldReferenceBands,
  state,
}: IReferencesIpcDeps) => {
  ipcMain.on(ChannelEnum.GET_OPRA_PRODUCT_LIST, async (event) => {
    const channel = ChannelEnum.GET_OPRA_PRODUCT_LIST;
    log.info(`Getting OPRA product list`);

    try {
      const products: IOpraProduct[] = getOpraProductList();
      log.info(`Fetched ${products.length} products`);
      const reply: TSuccess<IOpraProduct[]> = { result: products };
      event.reply(channel, reply);
    } catch (e) {
      log.error('Failed to get products');
      log.error(e);
      handleError(event, channel, ErrorCode.OPRA_READ_ERROR);
    }
  });

  ipcMain.on(ChannelEnum.LOAD_OPRA_PRESET, async (event, arg) => {
    const channel = ChannelEnum.LOAD_OPRA_PRESET;
    const [productId, curveId] = arg as [string, string, string?];

    try {
      const presetSettings: IPresetV2 = getOpraPreset(productId, curveId);
      /*
       * INTO ITS OWN LAYER, NOT INTO THE USER'S BANDS.
       *
       * This used to replace `state.filters` outright, which meant applying a
       * headphone reference threw away whatever tuning was there, clearing the EQ
       * threw the reference away in turn, and Smart EQ -- which measures the
       * output and cannot hear a transducer -- read the correction as error and
       * flattened it over a few passes. Three problems with one cause.
       *
       * As a layer it survives a clear, it is handed to the solver as something
       * not to correct, and the bands stay whatever the person made them.
       */
      state.headphone = {
        filters: shieldReferenceBands(presetSettings.filters),
        /*
         * No published curve here is a list of points.
         *
         * The GraphicEQ path is not gone — Squiglink exports and pasted APO text
         * still arrive that way, and the writer still prefers the curve to a fit
         * of it. OPRA simply does not publish one: every curve in the library is
         * parametric, so there is never anything to carry.
         */
        graphicEq: undefined,
        // Full strength on arrival. Somebody who wants half of a published
        // correction can say so; somebody who applied one and got half of it
        // would reasonably think it had not worked.
        intensity: 1,
      };
      // The preamp still comes from the measurement, because the correction it
      // belongs to is the one being applied. Everything else about the user's
      // stage is left alone.
      state.preAmp = presetSettings.preAmp;
      /*
       * Which curve these bands came from, and out of which database. Not
       * recoverable from the bands, and the difference between a curve you can
       * reason about and a set of numbers.
       *
       * Ids rather than the names shown on screen, because the names do not
       * identify anything: fifty-six products share a display name with another
       * product, and thirty-nine products have two curves whose descriptions read
       * identically. The picker resolves these back into names through the index
       * it already holds.
       */
      state.headset = productId;
      state.headsetTarget = curveId;
      state.headsetSource = OPRA_SOURCE_ID;
      state.headsetSignature = describeBandShape(state.headphone.filters);
      state.eqImport = undefined;
      applyingLayer('headphone');
      await handleUpdate(event, channel, false, true);
    } catch (ex) {
      log.info(`Failed to load OPRA curve ${curveId} for ${productId}`);
      log.info(ex);
      handleError(event, channel, ErrorCode.PRESET_FILE_ERROR);
    }
  });

  ipcMain.on(ChannelEnum.GET_CONVOLUTION_CATALOG, async (event, arg) => {
    const channel = ChannelEnum.GET_CONVOLUTION_CATALOG;
    try {
      const query = typeof arg?.[0] === 'string' ? arg[0] : '';
      const reply: TSuccess<Awaited<ReturnType<typeof getConvolutionCatalog>>> =
        {
          result: await getConvolutionCatalog(query),
        };
      event.reply(channel, reply);
    } catch (error) {
      log.error('Failed to get convolution catalogue', error);
      handleError(event, channel, ErrorCode.CONVOLUTION_CATALOG_ERROR);
    }
  });

  ipcMain.on(ChannelEnum.DOWNLOAD_CONVOLUTION, async (event, arg) => {
    const channel = ChannelEnum.DOWNLOAD_CONVOLUTION;
    const entryId = arg?.[0];
    if (typeof entryId !== 'string' || !entryId) {
      handleError(event, channel, ErrorCode.INVALID_PARAMETER);
      return;
    }
    try {
      if (!session.configPath) {
        session.configPath = await getConfigPath();
      }
      applyingLayer('convolution');
      state.convolution = await downloadConvolution(
        entryId,
        session.configPath,
      );
      await handleUpdate(event, channel, false, true);
    } catch (error) {
      log.error('Failed to download convolution profile', error);
      handleError(event, channel, ErrorCode.CONVOLUTION_CATALOG_ERROR);
    }
  });

  /**
   * Drop the reference, and with it the bands it produced.
   *
   * Applying a reference writes the measurement straight into the bands, so the
   * model is not a label sitting beside them — it is where every one of those
   * numbers came from. Keeping them after disclaiming their origin leaves a curve
   * nobody, the app included, can account for: not the user's tuning, not any
   * model's, just leftovers. A flat EQ is somewhere to start from; that is not.
   *
   * Deliberately the same reset as Clear EQ, down to leaving the voicing, the
   * driver correction, the measured Smart EQ curve and the convolution alone —
   * those were arrived at separately and the reference never spoke for them.
   */
  ipcMain.on(ChannelEnum.CLEAR_HEADSET, async (event) => {
    const channel = ChannelEnum.CLEAR_HEADSET;
    /*
     * CLEARS THE CORRECTION, NOT THE PERSON'S BANDS.
     *
     * It called `resetEqToDefaults`, which was right while a reference WAS the
     * bands: clearing one meant flattening them. Now that the correction is a
     * layer of its own the two have swapped places, and left alone this did
     * exactly the wrong thing in both directions at once — wiped a tuning it no
     * longer owns, and left the correction playing with nothing on screen naming
     * it.
     *
     * Found by the agent moving this button to its new page rather than by
     * anything here, which is worth recording: splitting a layer out leaves every
     * "clear it" path pointing at the old address.
     */
    applyingLayer('headphone');
    state.headphone = undefined;
    state.headset = undefined;
    state.headsetTarget = undefined;
    state.headsetSource = undefined;
    state.headsetSignature = undefined;
    // Replies with the new bands, the same as Clear EQ, so a caller that is not
    // about to re-read the whole state can adopt them: getDefaultFilters mints
    // fresh ids, and every id the renderer still holds has just stopped existing.
    await handleUpdateHelper<IFiltersMap>(
      event,
      channel,
      state.filters,
      false,
      true,
    );
  });

  ipcMain.on(ChannelEnum.CLEAR_CONVOLUTION, async (event) => {
    const channel = ChannelEnum.CLEAR_CONVOLUTION;
    applyingLayer('convolution');
    state.convolution = undefined;
    await handleUpdate(event, channel, false, true);
  });

  ipcMain.on(ChannelEnum.CHECK_OPRA_UPDATE, async (event) => {
    const channel = ChannelEnum.CHECK_OPRA_UPDATE;
    try {
      const reply: TSuccess<IOpraUpdateStatus> = {
        result: await checkOpraUpdate(),
      };
      event.reply(channel, reply);
    } catch (error) {
      log.warn('Unable to check for an OPRA database update', error);
      handleError(event, channel, ErrorCode.OPRA_READ_ERROR);
    }
  });

  ipcMain.on(ChannelEnum.UPDATE_OPRA_DATABASE, async (event) => {
    const channel = ChannelEnum.UPDATE_OPRA_DATABASE;
    try {
      const reply: TSuccess<IOpraUpdateStatus> = {
        result: await updateOpraDatabase(),
      };
      event.reply(channel, reply);
    } catch (error) {
      log.error('Unable to update the OPRA database', error);
      handleError(event, channel, ErrorCode.OPRA_READ_ERROR);
    }
  });
};
