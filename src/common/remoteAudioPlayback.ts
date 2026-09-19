/* FluidEQ — GPL-3.0-or-later */

/** Receiver telemetry excludes the endpoint's EQ/DSP and hardware latency. */
export interface IRemotePlaybackMeter {
  sourceId: string;
  bufferedMs: number;
  peak: number;
  rms: number;
  waveform: Float32Array;
}

export type TRemotePlaybackEvent =
  | { session: number; kind: 'meter'; meter: IRemotePlaybackMeter }
  | { session: number; kind: 'failed' };

export const REMOTE_PLAYBACK_EVENT = 'remote-audio-playback-event';
