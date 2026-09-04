/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { TRemoteAudioPhase } from './remoteAudioState';

interface IListenerState {
  computers: { address?: string; id: string; name: string }[];
  connectedCount: number;
  phase: TRemoteAudioPhase;
}

const listenerState = (
  peerIds: Set<string>,
  peerNames: Map<string, string>,
  peerAddresses: Map<string, string>,
  connectedPeerIds: Set<string>,
  playbackBlocked: boolean,
): IListenerState => {
  const connectedCount = connectedPeerIds.size;
  let phase: TRemoteAudioPhase = 'waiting';
  if (playbackBlocked && connectedCount > 0) {
    phase = 'playback-blocked';
  } else if (connectedCount > 0) {
    phase = 'connected';
  } else if (peerIds.size > 0) {
    phase = 'connecting';
  }
  return {
    computers: [...peerIds].flatMap((id) => {
      const name = peerNames.get(id);
      return name ? [{ address: peerAddresses.get(id), id, name }] : [];
    }),
    connectedCount,
    phase,
  };
};

export default listenerState;
