/* FluidEQ — GPL-3.0-or-later */

import type { ILanRemoteAudioNetworkStats } from '../common/remoteAudio';

interface ITransferWindow {
  bytes: number;
  startedAt: bigint;
}

const REPORT_INTERVAL_NS = 250_000_000n;

const createRemoteAudioNetworkMeter = (
  emit: (stats: ILanRemoteAudioNetworkStats) => void,
  now: () => bigint = process.hrtime.bigint,
) => {
  const windows = new Map<string, ITransferWindow>();

  const record = (
    peerId: string,
    direction: ILanRemoteAudioNetworkStats['direction'],
    bytes: number,
    queuedBytes: number,
    queuedAudioMilliseconds = 0,
  ) => {
    const key = `${direction}:${peerId}`;
    const recordedAt = now();
    const current = windows.get(key) ?? { bytes: 0, startedAt: recordedAt };
    current.bytes += bytes;
    const elapsed = recordedAt - current.startedAt;
    if (elapsed < REPORT_INTERVAL_NS) {
      windows.set(key, current);
      return;
    }
    const bytesPerSecond = Math.round(
      (current.bytes * 1_000_000_000) / Number(elapsed),
    );
    emit({
      bytesPerSecond,
      direction,
      peerId,
      queuedBytes,
      queuedMilliseconds: Math.round(
        queuedAudioMilliseconds +
          (queuedBytes / Math.max(1, bytesPerSecond)) * 1_000,
      ),
    });
    windows.set(key, { bytes: 0, startedAt: recordedAt });
  };

  return { clear: () => windows.clear(), record };
};

export default createRemoteAudioNetworkMeter;
