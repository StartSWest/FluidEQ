/* FluidEQ — GPL-3.0-or-later */

import type { ILanRemoteAudioChunk } from './remoteAudio';

/** A main-frame-owned native audio tap. This channel never captures video. */
export const MAC_AUDIO_CAPTURE_PORT = 'mac-audio-capture-port';

export type TMacAudioCaptureMessage =
  | { kind: 'ready' | 'failed' | 'lost' }
  | ({ kind: 'push' } & ILanRemoteAudioChunk);
