/* FluidEQ — GPL-3.0-or-later */

export interface IRemoteAudioPlaybackProfile {
  deadbandSeconds: number;
  maximumBufferSeconds: number;
  catchupThresholdSeconds?: number;
  recoveryDecaySeconds?: number;
  recoveryStepSeconds: number;
  startBufferSeconds: number;
}

/**
 * A computer whose `stream-mode` word has not arrived yet. It is the
 * reservoir the `music` profile had before that word became the Fluid
 * switch, kept apart from it so that a stream starting before its word plays
 * as it always did, with Fluid off on both ends.
 */
export const UNANNOUNCED_PLAYBACK_PROFILE: IRemoteAudioPlaybackProfile = {
  deadbandSeconds: 0.02,
  maximumBufferSeconds: 0.6,
  recoveryStepSeconds: 0.06,
  startBufferSeconds: 0.24,
};

export const REMOTE_AUDIO_PLAYBACK_PROFILES: Record<
  'music' | 'video',
  IRemoteAudioPlaybackProfile
> = {
  // Smooth playback: a larger reservoir rides out scheduler and Wi-Fi
  // stalls, and one that keeps stalling grows to 2 s and never shrinks back,
  // as the Windows helper's does. It changes delay, never the Float32
  // samples, codec, or resampler quality.
  music: {
    deadbandSeconds: 0.02,
    maximumBufferSeconds: 2,
    recoveryStepSeconds: 0.15,
    startBufferSeconds: 0.3,
  },
  // Ten capture packets at 48 kHz provide a 100 ms playout reservoir (not an
  // end-to-end latency claim). An underrun adds protection; after a stable
  // run that protection decays again instead of leaving the picture behind.
  video: {
    catchupThresholdSeconds: 0.02,
    deadbandSeconds: 0.005,
    maximumBufferSeconds: 0.2,
    recoveryDecaySeconds: 2,
    recoveryStepSeconds: 0.01,
    startBufferSeconds: 0.1,
  },
};
