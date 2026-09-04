/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  DeviceMatchEnum,
  type IMediaOutputDevice,
  resolveMirrorSinkId,
} from '../../common/audioDeviceBridge';
import { getAudioDevices } from '../utils/equalizerApi';

const DEFAULT_SINK_ID = 'default';

/**
 * Resolve FluidEQ's right-pane Windows endpoint to Chromium's output id.
 *
 * The IDs come from different systems and cannot be converted directly. The
 * existing exact-name bridge is reused here so an active LAN stream can move
 * with the selected output without being stopped or rebuilt. When Chromium
 * withholds labels, `default` is correct because that same right-pane action
 * has already made the endpoint Windows' default.
 */
const resolveSelectedOutputSinkId = async (
  activeDeviceId: string,
): Promise<string> => {
  if (!activeDeviceId || !navigator.mediaDevices?.enumerateDevices) {
    return DEFAULT_SINK_ID;
  }
  const [devices, mediaDevices] = await Promise.all([
    getAudioDevices(),
    navigator.mediaDevices.enumerateDevices(),
  ]);
  const active = devices.find((device) => device.id === activeDeviceId);
  if (!active) {
    return DEFAULT_SINK_ID;
  }
  const outputs: IMediaOutputDevice[] = mediaDevices
    .filter((device) => device.kind === 'audiooutput')
    .map((device) => ({
      deviceId: device.deviceId,
      groupId: device.groupId,
      label: device.label,
    }));
  const match = resolveMirrorSinkId(active.guid, devices, outputs);
  return match?.status === DeviceMatchEnum.MATCHED && match.sinkId
    ? match.sinkId
    : DEFAULT_SINK_ID;
};

export default resolveSelectedOutputSinkId;
