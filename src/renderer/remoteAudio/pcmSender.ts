/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import type { ILanRemoteAudioChunk } from '../../common/remoteAudio';

interface ICaptureSource {
  context: AudioContext;
  source: MediaStreamAudioSourceNode;
}

type TSendChunk = (chunk: Omit<ILanRemoteAudioChunk, 'peerId'>) => void;

export interface IPcmSender {
  close(): void;
}

const CAPTURE_FRAMES = 1024;
const CAPTURE_CHANNELS = 2;

/**
 * Tap the existing system loopback and send its exact Float32 PCM samples.
 *
 * ScriptProcessor is intentionally used here instead of turning the stream
 * into a MediaRecorder/WebRTC track: those paths select a lossy audio codec.
 * The zero-gain tail keeps Chromium pulling this branch without playing the
 * local loopback through the speakers a second time.
 */
export const createPcmSender = (
  capture: ICaptureSource,
  sendChunk: TSendChunk,
): IPcmSender => {
  const processor = capture.context.createScriptProcessor(
    CAPTURE_FRAMES,
    CAPTURE_CHANNELS,
    1,
  );
  const mute = capture.context.createGain();
  mute.gain.value = 0;
  let sequence = 0;
  let isClosed = false;

  processor.onaudioprocess = (event) => {
    if (isClosed) {
      return;
    }
    const { inputBuffer } = event;
    const channels = Math.min(inputBuffer.numberOfChannels, CAPTURE_CHANNELS);
    const frames = inputBuffer.length;
    const interleaved = new Float32Array(frames * channels);
    for (let channel = 0; channel < channels; channel += 1) {
      const samples = inputBuffer.getChannelData(channel);
      for (let frame = 0; frame < frames; frame += 1) {
        interleaved[frame * channels + channel] = samples[frame];
      }
    }
    sendChunk({
      sequence,
      sampleRate: inputBuffer.sampleRate,
      channels,
      frames,
      pcm: interleaved.buffer,
    });
    sequence = sequence === 0xffff_ffff ? 0 : sequence + 1;
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
      processor.onaudioprocess = null;
      capture.source.disconnect(processor);
      processor.disconnect();
      mute.disconnect();
    },
  };
};
