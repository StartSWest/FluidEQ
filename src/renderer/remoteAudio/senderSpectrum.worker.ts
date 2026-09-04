/* FluidEQ — GPL-3.0-or-later */

import type { ILanRemoteAudioChunk } from '../../common/remoteAudio';
import {
  createSenderSpectrum,
  SENDER_SPECTRUM_SIZE,
  type ISenderSpectrum,
} from './senderSpectrum';

const scope = globalThis as unknown as {
  onmessage: (
    event: MessageEvent<{ kind: string; port?: MessagePort }>,
  ) => void;
  postMessage(value: ISenderSpectrum, transfer: Transferable[]): void;
};
const spectrum = createSenderSpectrum();
let requested = false;
let fresh = false;
let format: { sampleRate: number; channels: number } | undefined;
let input: MessagePort | undefined;
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
    format = { sampleRate: frame.sampleRate, channels: frame.peaks.length };
    scope.postMessage(frame, [frame.frequency.buffer]);
  }
};

scope.onmessage = ({ data }) => {
  if (data.kind === 'attach' && data.port) {
    input?.close();
    input = data.port;
    input.onmessage = ({
      data: chunk,
    }: MessageEvent<ILanRemoteAudioChunk | { kind: 'reset' }>) => {
      if ('kind' in chunk) {
        spectrum.reset();
        fresh = false;
        format = undefined;
      } else {
        spectrum.push(chunk);
        fresh = true;
        publish();
      }
    };
  } else if (data.kind === 'read') {
    requested = true;
    publish();
  }
};
