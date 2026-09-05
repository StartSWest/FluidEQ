/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import type { ILanRemoteAudioChunk } from '../../common/remoteAudio';
import workletUrl from './workletUrl';

interface ICaptureSource {
  context: AudioContext;
  source: MediaStreamAudioSourceNode;
}

type TSendChunkMessage = Omit<ILanRemoteAudioChunk, 'peerId'>;
type TSendChunk = (chunk: TSendChunkMessage) => void;

export interface IPcmSender {
  close(): void;
}

const PROCESSOR_NAME = 'fluideq-remote-audio-capture';

/**
 * Tap the existing system loopback and send its exact Float32 PCM samples.
 *
 * Capture runs on the audio thread so renderer work cannot punch holes between
 * chunks. MediaRecorder/WebRTC are deliberately avoided because those paths
 * select a lossy codec. The zero-gain tail keeps Chromium pulling this branch
 * without playing the local loopback through the speakers a second time.
 */
export const createPcmSender = async (
  capture: ICaptureSource,
  sendChunk: TSendChunk,
): Promise<IPcmSender> => {
  await capture.context.audioWorklet.addModule(workletUrl().href);
  const processor = new AudioWorkletNode(capture.context, PROCESSOR_NAME, {
    numberOfInputs: 1,
    numberOfOutputs: 1,
    outputChannelCount: [1],
  });
  const mute = capture.context.createGain();
  mute.gain.value = 0;
  let isClosed = false;

  processor.port.onmessage = ({ data }: MessageEvent<TSendChunkMessage>) => {
    if (!isClosed) {
      sendChunk(data);
    }
  };

  capture.source.connect(processor);
  processor.connect(mute);
  mute.connect(capture.context.destination);

  return {
    close: () => {
      if (isClosed) {
        return;
      }
      isClosed = true;
      processor.port.onmessage = null;
      capture.source.disconnect(processor);
      processor.disconnect();
      mute.disconnect();
    },
  };
};
