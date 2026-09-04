/* FluidEQ — GPL-3.0-or-later */

import type { ILanRemoteAudioChunk } from '../../common/remoteAudio';
import type { TRemoteAudioMeterListener } from './meter';
import { measureRemoteAudioChunk } from './meter';
import type { IPcmMixer } from './pcmMixer';
import type { TRemoteAudioRole } from './remoteAudioState';

interface IRouteRemoteAudioChunk {
  chunk: ILanRemoteAudioChunk;
  connectedPeerIds: Set<string>;
  isStopping: boolean;
  mixer?: IPcmMixer;
  peerIds: ReadonlySet<string>;
  publishListenerState(): void;
  publishMeter: TRemoteAudioMeterListener;
  role?: TRemoteAudioRole;
  senderPeerId?: string;
}

const routeRemoteAudioChunk = ({
  chunk,
  connectedPeerIds,
  isStopping,
  mixer,
  peerIds,
  publishListenerState,
  publishMeter,
  role,
  senderPeerId,
}: IRouteRemoteAudioChunk) => {
  if (role === 'sender' && senderPeerId === chunk.peerId) {
    // This mirror comes straight from local loopback before any transport
    // work, so the sender graph never inherits network or codec latency.
    publishMeter(measureRemoteAudioChunk(chunk));
    return;
  }
  if (role !== 'listener' || isStopping || !peerIds.has(chunk.peerId)) {
    return;
  }
  connectedPeerIds.add(chunk.peerId);
  mixer?.push(chunk);
  publishListenerState();
};

export default routeRemoteAudioChunk;
