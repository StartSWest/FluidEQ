/* FluidEQ — GPL-3.0-or-later */

export const REMOTE_AUDIO_PORT_CHANNEL = 'remote-audio-port';
/**
 * `playback` carries a remote sender's audio to the listener's worklet,
 * `analysis` the outgoing LAN capture to its spectrum worker, and `source` the
 * same process-loopback capture to Smart EQ's measurement — a port of its own,
 * because a port kind holds one MessagePort and the LAN meter and the
 * measurement can both be open at once.
 */
export type TRemoteAudioPortKind = 'playback' | 'analysis' | 'source';

export const isRemoteAudioPortKind = (
  value: unknown,
): value is TRemoteAudioPortKind =>
  value === 'playback' || value === 'analysis' || value === 'source';
