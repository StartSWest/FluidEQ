/* FluidEQ — GPL-3.0-or-later */

export const REMOTE_AUDIO_PORT_CHANNEL = 'remote-audio-port';
export type TRemoteAudioPortKind = 'playback' | 'analysis';

export const isRemoteAudioPortKind = (
  value: unknown,
): value is TRemoteAudioPortKind =>
  value === 'playback' || value === 'analysis';
