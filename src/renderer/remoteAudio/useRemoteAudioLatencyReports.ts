/* FluidEQ — GPL-3.0-or-later */
import { useEffect } from 'react';
import type { IEngineHealth } from '../../common/engineHealth';
import { normaliseEndpointGuid } from '../../common/engineHealth';
import { readKnownAudioDevices } from '../utils/equalizerApi';
import type { TRemoteAudioMeterListener } from './meter';

/** Read existing display meters, once a second per peer. No PCM crosses IPC
 * and no audio callback awaits a report or React render. */
const useRemoteAudioLatencyReports = (
  subscribe: (listener: TRemoteAudioMeterListener) => () => void,
  output: { current: string },
  activeDeviceId: string,
  active: boolean,
) => {
  useEffect(() => {
    if (!active) {
      return undefined;
    }
    const api = window.electron?.ipcRenderer;
    const last = new Map<string, number>();
    let health: IEngineHealth | undefined;
    let defaultGuid: string | undefined;
    let live = true;
    let revision = 0;
    const acceptHealth = (next: IEngineHealth) => {
      revision += 1;
      health = next;
    };
    const stopHealth = api?.onEngineHealth?.(acceptHealth);
    const requested = revision;
    api
      ?.getEngineHealth?.()
      .then((next) => {
        if (live && requested === revision) {
          health = next;
        }
        return undefined;
      })
      .catch(() => undefined);
    readKnownAudioDevices()
      .then((devices) => {
        if (live) {
          defaultGuid = (
            devices.find((device) => device.id === activeDeviceId) ??
            devices.find((device) => device.isDefault)
          )?.guid;
        }
        return undefined;
      })
      .catch(() => undefined);
    const stopMeter = subscribe((meter) => {
      if (!meter.sourceId || meter.playbackMs === undefined) {
        return;
      }
      const at = performance.now();
      if (at - (last.get(meter.sourceId) ?? -Infinity) < 1_000) {
        return;
      }
      last.set(meter.sourceId, at);
      const guid = output.current === 'default' ? defaultGuid : output.current;
      const endpoint = guid ? normaliseEndpointGuid(guid) : undefined;
      const engine = health?.outputs.find(
        (entry) =>
          entry.endpoint === endpoint &&
          entry.locked &&
          entry.carried !== false,
      );
      const processing = engine?.processing ? engine.latency : undefined;
      const processingMs =
        processing && processing.rate > 0
          ? (processing.frames * 1_000) / processing.rate
          : 0;
      api?.reportRemoteAudioPlaybackLatency?.(
        meter.sourceId,
        meter.playbackMs + processingMs,
      );
    });
    return () => {
      live = false;
      stopHealth?.();
      stopMeter();
    };
  }, [subscribe, output, activeDeviceId, active]);
};

export default useRemoteAudioLatencyReports;
