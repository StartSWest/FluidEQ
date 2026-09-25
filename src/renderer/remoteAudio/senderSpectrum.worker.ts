/* FluidEQ — GPL-3.0-or-later */

import type { ILanRemoteAudioChunk } from '../../common/remoteAudio';
import {
  createSenderSpectrum,
  SENDER_SPECTRUM_SIZE,
  type ISenderSpectrum,
} from './senderSpectrum';

const scope = globalThis as unknown as {
  onmessage: (
    event: MessageEvent<{ kind: string; port?: MessagePort; stream?: boolean }>,
  ) => void;
  postMessage(value: ISenderSpectrum, transfer: Transferable[]): void;
};
const spectrum = createSenderSpectrum();
let requested = false;
let fresh = false;
let format: { sampleRate: number; channels: number } | undefined;
let input: MessagePort | undefined;
/**
 * Whether a window of fresh audio is published as soon as it is complete,
 * rather than when a display asks.
 *
 * The LAN meter pulls: a display request consumes the latest window and a
 * hidden window asks for nothing. A measurement is the opposite case — it
 * wants every window the audio produces, whether or not anything is drawn,
 * and it wants them at the audio's own pace. So the audio is the clock here:
 * once `SENDER_SPECTRUM_SIZE` new samples have arrived since the last frame,
 * the next one goes out, and nothing samples on a timer.
 */
let stream = false;
let sinceLast = 0;
const publish = () => {
  if (!requested) {
    return;
  }
  // Loopback can stop delivering packets when the last source becomes idle.
  // A display request consumes the latest snapshot; never replay an old FFT
  // forever or spend CPU transforming the same stopped audio again.
  let frame = fresh ? spectrum.read() : undefined;
  if (!fresh && format) {
    frame = {
      sampleRate: format.sampleRate,
      frequency: new Float32Array(SENDER_SPECTRUM_SIZE / 2).fill(-200),
      peaks: new Array<number>(format.channels).fill(0),
      waveform: new Array<number>(96).fill(0),
    };
  }
  if (frame) {
    requested = false;
    fresh = false;
    sinceLast = 0;
    format = { sampleRate: frame.sampleRate, channels: frame.peaks.length };
    scope.postMessage(frame, [frame.frequency.buffer]);
  }
};

scope.onmessage = ({ data }) => {
  if (data.kind === 'attach' && data.port) {
    input?.close();
    input = data.port;
    stream = data.stream === true;
    sinceLast = 0;
    input.onmessage = ({
      data: chunk,
    }: MessageEvent<ILanRemoteAudioChunk | { kind: 'reset' }>) => {
      if ('kind' in chunk) {
        spectrum.reset();
        fresh = false;
        format = undefined;
        sinceLast = 0;
      } else {
        spectrum.push(chunk);
        fresh = true;
        sinceLast += chunk.frames;
        if (stream && sinceLast >= SENDER_SPECTRUM_SIZE) {
          requested = true;
        }
        publish();
      }
    };
  } else if (data.kind === 'read') {
    requested = true;
    publish();
  }
};
