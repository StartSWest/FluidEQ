/*
<FluidEQ: System-wide parametric audio equalizer interface>
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
import { APO_LAYERS, IState, TApoLayer } from '../../common/constants';
import { ErrorCode } from '../../common/errors';
import ChannelEnum from '../../common/channels';
import { getVoicingProfile } from '../../common/voicing';
import { getDriverProfile } from '../../common/driver';
import { sanitizeSmartEqSettings } from '../../common/smartEq';

/**
 * A smaller reach than the bands have, and that is worth seeing.
 *
 * These five channels set which named profile a layer is using and whether it
 * is bypassed. They never touch the layout machinery the band handlers need,
 * so they do not receive it.
 */
export interface ILayersIpcDeps {
  state: IState;
  handleUpdate: (
    event: Electron.IpcMainEvent,
    channel: ChannelEnum | string,
    syncActiveProfile?: boolean,
    useActiveSessionOverride?: boolean,
  ) => Promise<void>;
  handleError: (
    event: Electron.IpcMainEvent,
    channel: ChannelEnum | string,
    errorCode: ErrorCode,
    message?: string,
    action?: string,
  ) => void;
  /**
   * Take a layer back out of the bypass list, because it is being edited.
   *
   * Setting a profile on a bypassed layer means the user wants to hear it, so
   * the A/B switch lets go of it rather than silently discarding the change.
   */
  applyingLayer: (layer: TApoLayer) => void;
}

/**
 * Voicing, headphone, driver, Smart EQ, and the A/B bypass.
 *
 * The features stacked on top of the user's own bands. Each is one named
 * profile plus an intensity, and each writes its own Equalizer APO include —
 * which is why bypassing one is implemented by not writing it rather than by
 * zeroing it.
 */
export const registerLayersIpc = ({
  state,
  handleUpdate,
  handleError,
  applyingLayer,
}: ILayersIpcDeps) => {
  ipcMain.on(ChannelEnum.SET_VOICING, async (event, arg) => {
    const channel = ChannelEnum.SET_VOICING;
    const profileId: string = arg[0];
    const intensity: number = arg[1];

    const isExistingApoOverride =
      state.voicing?.profileId === profileId &&
      Boolean(state.voicing.apoOverride);
    if (
      typeof profileId !== 'string' ||
      (profileId !== '' &&
        !getVoicingProfile(profileId) &&
        !isExistingApoOverride) ||
      !Number.isFinite(intensity)
    ) {
      handleError(event, channel, ErrorCode.INVALID_PARAMETER);
      return;
    }

    applyingLayer('voicing');
    // The voicing is a layer of its own, so this never touches state.filters.
    state.voicing = {
      profileId,
      intensity: Math.min(1, Math.max(0, intensity)),
      ...(isExistingApoOverride
        ? { apoOverride: state.voicing?.apoOverride }
        : {}),
    };

    await handleUpdate(event, channel, false, true);
  });

  /*
   * How much of the published correction to apply, and whether to keep it.
   *
   * Only the strength travels, never the filters: those arrive once when a
   * measurement is applied and are not something the renderer should be able to
   * rewrite. Undefined clears the layer outright, which is what the chip's X
   * means — and unlike the old behaviour it takes nothing of the user's with it.
   */
  ipcMain.on(ChannelEnum.SET_HEADPHONE, async (event, arg) => {
    const channel = ChannelEnum.SET_HEADPHONE;
    const intensity: unknown = arg?.[0];

    if (intensity === undefined || intensity === null) {
      applyingLayer('headphone');
      state.headphone = undefined;
      state.headset = undefined;
      state.headsetTarget = undefined;
      state.headsetSource = undefined;
      state.headsetSignature = undefined;
      await handleUpdate(event, channel, false, true);
      return;
    }

    if (typeof intensity !== 'number' || !Number.isFinite(intensity)) {
      handleError(event, channel, ErrorCode.INVALID_PARAMETER);
      return;
    }
    if (!state.headphone) {
      handleError(event, channel, ErrorCode.INVALID_PARAMETER);
      return;
    }

    applyingLayer('headphone');
    state.headphone = {
      ...state.headphone,
      intensity: Math.min(1, Math.max(0, intensity)),
    };

    await handleUpdate(event, channel, false, true);
  });

  ipcMain.on(ChannelEnum.SET_DRIVER, async (event, arg) => {
    const channel = ChannelEnum.SET_DRIVER;
    const profileId: string = arg[0];
    const intensity: number = arg[1];

    const isExistingApoOverride =
      state.driver?.profileId === profileId &&
      Boolean(state.driver.apoOverride);
    if (
      typeof profileId !== 'string' ||
      (profileId !== '' &&
        !getDriverProfile(profileId) &&
        !isExistingApoOverride) ||
      !Number.isFinite(intensity)
    ) {
      handleError(event, channel, ErrorCode.INVALID_PARAMETER);
      return;
    }

    applyingLayer('driver');
    // Its own layer, like the voicing: never touches state.filters, so the
    // user's bands survive switching driver types and switching back.
    state.driver = {
      profileId,
      intensity: Math.min(1, Math.max(0, intensity)),
      ...(isExistingApoOverride
        ? { apoOverride: state.driver?.apoOverride }
        : {}),
    };

    await handleUpdate(event, channel, false, true);
  });

  /**
   * Store what Smart EQ measured, as a layer of its own.
   *
   * Same contract as the voicing and the driver: this never touches
   * state.filters. Smart EQ used to write its answer straight into the user's
   * bands, which meant a measurement silently overwrote a tuning somebody had
   * built by hand and there was no way to undo one without losing the other. As a
   * layer the two are independent in both directions — clearing the reference
   * leaves the correction standing, and clearing the correction leaves the bands
   * and the reference alone.
   *
   * An empty or unusable payload removes the layer, which is how the "Also
   * applied" chip clears it.
   */
  ipcMain.on(ChannelEnum.SET_SMART_EQ, async (event, arg) => {
    const channel = ChannelEnum.SET_SMART_EQ;
    const settings = arg?.[0];

    if (
      settings !== undefined &&
      settings !== null &&
      typeof settings !== 'object'
    ) {
      handleError(event, channel, ErrorCode.INVALID_PARAMETER);
      return;
    }

    applyingLayer('smart');
    state.smartEq = sanitizeSmartEqSettings(settings);
    await handleUpdate(event, channel, false, true);
  });

  /**
   * Take a layer out of the config, or put it back, without touching its
   * settings.
   *
   * The whole of it is a list of feature names the writer skips. There is nothing
   * to stash and nothing to reconstruct, so there is no half-applied state to
   * land in — which is exactly what went wrong when the bands were switched off
   * by clearing them one at a time and restoring them one at a time.
   *
   * The preamp follows for free: it is measured over what was actually written,
   * so switching a boosting layer off gives its headroom straight back.
   */
  ipcMain.on(ChannelEnum.SET_LAYER_BYPASS, async (event, arg) => {
    const channel = ChannelEnum.SET_LAYER_BYPASS;
    const feature = arg?.[0];
    const isBypassed = arg?.[1];

    if (
      !APO_LAYERS.includes(feature as TApoLayer) ||
      typeof isBypassed !== 'boolean'
    ) {
      handleError(event, channel, ErrorCode.INVALID_PARAMETER);
      return;
    }

    // Rebuilt from APO_FEATURES rather than pushed onto, so the list keeps one
    // order and cannot collect duplicates however often the switch is pressed.
    const wanted = new Set(state.bypassed ?? []);
    if (isBypassed) {
      wanted.add(feature as TApoLayer);
    } else {
      wanted.delete(feature as TApoLayer);
    }
    const bypassed = APO_LAYERS.filter((entry) => wanted.has(entry));
    state.bypassed = bypassed.length ? [...bypassed] : undefined;

    await handleUpdate(event, channel, false, true);
  });
};
