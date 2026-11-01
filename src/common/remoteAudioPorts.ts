/* FluidEQ — GPL-3.0-or-later */

export const REMOTE_AUDIO_PORT_CHANNEL = 'remote-audio-port';
/**
 * `playback` carries a remote sender's audio to the listener's worklet, and
 * `analysis` the outgoing LAN capture to its spectrum worker. Smart EQ's
 * measurement hears the same process-loopback capture in the core, where it
 * runs (`main/smartEq/rawSourceFrames.ts`).
 */
export type TRemoteAudioPortKind = 'playback' | 'analysis';

export const isRemoteAudioPortKind = (
  value: unknown,
): value is TRemoteAudioPortKind =>
  value === 'playback' || value === 'analysis';
