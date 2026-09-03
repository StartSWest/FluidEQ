/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

export interface IRemoteAudioOutput {
  id: string;
  label: string;
}

export const listRemoteAudioOutputs = async (): Promise<
  IRemoteAudioOutput[]
> => {
  if (!navigator.mediaDevices?.enumerateDevices) {
    return [];
  }
  const devices = await navigator.mediaDevices.enumerateDevices();
  const seen = new Set<string>();
  return devices
    .filter(
      (device) =>
        device.kind === 'audiooutput' &&
        device.deviceId !== 'default' &&
        !seen.has(device.deviceId) &&
        seen.add(device.deviceId),
    )
    .map((device) => ({ id: device.deviceId, label: device.label }));
};
