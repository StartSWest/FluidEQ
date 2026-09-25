/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import ChannelEnum from '../../common/channels';
import {
  ITrebleDesigns,
  TTrebleDesign,
  TTrebleScope,
} from '../../common/filterDesign';
import { buildResponseHandler, sendRequest } from './ipcRequest';

const request = (
  channel: ChannelEnum,
  args: (TTrebleDesign | TTrebleScope)[] = [],
): Promise<ITrebleDesigns> =>
  sendRequest<ITrebleDesigns>(
    channel,
    args,
    buildResponseHandler<ITrebleDesigns>((result, resolve) => resolve(result)),
  );

export const getTrebleDesigns = (): Promise<ITrebleDesigns> =>
  request(ChannelEnum.GET_TREBLE_DESIGN);

export const setTrebleDesign = (
  choice: TTrebleDesign,
  scope: TTrebleScope,
): Promise<ITrebleDesigns> =>
  request(ChannelEnum.SET_TREBLE_DESIGN, [choice, scope]);
