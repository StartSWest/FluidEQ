/* FluidEQ — GPL-3.0-or-later */
// A 60 ms main-thread stall exceeded the receiver's 30 ms reservoir even
// though its native audio callback used MMCSS. Keep the complete PCM path
// here; main receives bounded UI snapshots and sends only control changes.
import { parentPort, workerData } from 'worker_threads';
import createLan from '../remoteAudioLan';
import { startNetworkCapture as startCapture } from '../remoteAudioCapture';
import { startNativeRemoteAudioPlayback as startPlayback } from '../nativeRemoteAudioPlayback';
import {
  leaseLanAudioHelper as leaseHelper,
  lanAudioHelperPid as helperPid,
  setLanAudioResources,
} from '../lanAudioHelper';
import { createAudioRuntime } from './runtime';
import { startAudioScheduling } from './scheduling';
import type { TAudioRequest } from './protocol';

interface IUtilityParent {
  postMessage(message: unknown): void;
  on(
    event: 'message',
    listener: (event: {
      data: TAudioRequest | { type: 'credit'; key: string };
    }) => void,
  ): void;
}
const utilityPort = (
  process as NodeJS.Process & { parentPort?: IUtilityParent }
).parentPort;
const port = parentPort ?? utilityPort;
if (!port) {
  throw new Error('Share Audio worker has no owner.');
}
setLanAudioResources(
  parentPort
    ? (workerData as { resourcesPath?: string })?.resourcesPath
    : process.argv[2] || undefined,
);
const scheduling = startAudioScheduling();
process.once('exit', scheduling.close);
const handle = createAudioRuntime({
  post: (message) => port.postMessage(message),
  createLan,
  startCapture,
  startPlayback,
  leaseHelper,
  helperPid,
  scheduling: scheduling.active,
  // In a Worker, exit ends this thread and its pipes. The host receives
  // failure and rejects pending controls; no unowned native stream remains.
  onFatal: () => process.exit(1),
});
if (parentPort) {
  parentPort.on('message', handle);
} else {
  utilityPort?.on('message', (event) => handle(event.data));
}
