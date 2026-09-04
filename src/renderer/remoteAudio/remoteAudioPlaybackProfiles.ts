/* FluidEQ — GPL-3.0-or-later */

export interface IRemoteAudioPlaybackProfile {
  deadbandSeconds: number;
  maximumBufferSeconds: number;
  catchupThresholdSeconds?: number;
  recoveryDecaySeconds?: number;
  recoveryStepSeconds: number;
  startBufferSeconds: number;
}

export const REMOTE_AUDIO_PLAYBACK_PROFILES: Record<
  'music' | 'video',
  IRemoteAudioPlaybackProfile
> = {
  // A larger reservoir absorbs scheduler and Wi-Fi bursts. It changes delay,
  // never the Float32 samples, codec, or resampler quality.
  music: {
    deadbandSeconds: 0.02,
    maximumBufferSeconds: 0.6,
    recoveryStepSeconds: 0.06,
    startBufferSeconds: 0.24,
  },
  // Three capture packets at 48 kHz provide a 30 ms playout reservoir (not an
  // end-to-end latency claim). An underrun adds protection; after a stable
  // run that protection decays again instead of leaving the picture behind.
  video: {
    catchupThresholdSeconds: 0.02,
    deadbandSeconds: 0.005,
    maximumBufferSeconds: 0.09,
    recoveryDecaySeconds: 2,
    recoveryStepSeconds: 0.01,
    startBufferSeconds: 0.03,
  },
};
