/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import log from 'electron-log';
import ChannelEnum from '../../common/channels';
import { isPresetId } from '../../common/dsp/presetPick';
import { ErrorCode } from '../../common/errors';
import type { createPresetPicks } from '../presetPicks';
import { handleError } from '../updatePath';
import onWindowMessage from './windowMessages';

/**
 * A picker's pick, from the window: the preset's id, whether it is a pick
 * for the whole machine (`quick`), and the output the picker was showing,
 * so a pick made for one output never lands on the next one opened.
 */
const registerPresetPicksIpc = (
  picks: Pick<ReturnType<typeof createPresetPicks>, 'pick'>,
): (() => void) =>
  onWindowMessage(ChannelEnum.PICK_DSP_PRESET, async (event, arg: unknown) => {
    const channel = ChannelEnum.PICK_DSP_PRESET;
    const [id, quick, deviceId] = Array.isArray(arg) ? arg : [];
    if (
      !isPresetId(id) ||
      typeof quick !== 'boolean' ||
      typeof deviceId !== 'string'
    ) {
      handleError(event, channel, ErrorCode.INVALID_PARAMETER);
      return;
    }
    try {
      await picks.pick({ id, quick, deviceId }, event, channel);
    } catch (error) {
      log.error('Could not put the preset on', error);
      handleError(event, channel, ErrorCode.FAILURE);
    }
  });

export default registerPresetPicksIpc;
