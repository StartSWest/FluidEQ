/* FluidEQ — GPL-3.0-or-later */

import { render, waitFor } from '@testing-library/react';
import { useRef } from 'react';
import {
  createPcmMixer,
  type IPcmMixer,
} from '../../../renderer/remoteAudio/pcmMixer';
import useSelectedRemoteAudioOutput from '../../../renderer/remoteAudio/useSelectedRemoteAudioOutput';

const resolveSelectedOutputSinkId = jest.fn();
const directSetSinkId = jest.fn<Promise<void>, [string]>();
const resumeAudioContext = jest.fn<Promise<void>, []>();
const audioPort = { close: jest.fn() };
jest.mock('../../../renderer/remoteAudio/openRemoteAudioPort', () => ({
  __esModule: true,
  default: jest.fn(() => Promise.resolve(audioPort)),
}));

jest.mock('../../../renderer/remoteAudio/selectedOutput', () => ({
  __esModule: true,
  default: (...args: unknown[]) => resolveSelectedOutputSinkId(...args),
}));

class FakeWorkletNode {
  connect = jest.fn();

  disconnect = jest.fn();

  port = { onmessage: null, postMessage: jest.fn() };
}

const sink = {
  autoplay: false,
  pause: jest.fn(),
  play: jest.fn().mockResolvedValue(undefined),
  setSinkId: jest.fn<Promise<void>, [string]>(),
  srcObject: null,
  volume: 0,
};

/**
 * The app's fader, as a graph node.
 *
 * A sender's audio is PCM played by a worklet, so there is no media element to
 * turn down — the level has to be a gain stage of its own, and this is what
 * the tests watch it through.
 */
const fader = {
  connect: jest.fn(),
  gain: { setTargetAtTime: jest.fn(), value: 0 },
};

const installAudioFakes = (
  directOutput = false,
  state: AudioContextState = 'running',
) => {
  Object.defineProperty(globalThis, 'AudioContext', {
    configurable: true,
    value: jest.fn(() => {
      const context = {
        audioWorklet: { addModule: jest.fn().mockResolvedValue(undefined) },
        close: jest.fn().mockResolvedValue(undefined),
        createGain: jest.fn(() => fader),
        createMediaStreamDestination: jest.fn(() => ({
          stream: { getTracks: () => [] },
        })),
        currentTime: 0,
        destination: {},
        resume: resumeAudioContext,
        state,
      };
      return directOutput
        ? { ...context, setSinkId: directSetSinkId }
        : context;
    }),
  });
  Object.defineProperty(globalThis, 'AudioWorkletNode', {
    configurable: true,
    value: FakeWorkletNode,
  });
  Object.defineProperty(globalThis, 'Audio', {
    configurable: true,
    value: jest.fn(() => sink),
  });
};

describe('remote audio output following', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // `clearAllMocks` resets the calls, not a plain property.
    fader.gain.value = 0;
    sink.setSinkId.mockResolvedValue(undefined);
    directSetSinkId.mockResolvedValue(undefined);
    resumeAudioContext.mockResolvedValue(undefined);
    installAudioFakes();
  });

  it('uses Chromium direct output instead of an extra playback queue', async () => {
    installAudioFakes(true);
    const mixer = await createPcmMixer('default', jest.fn(), jest.fn(), 1);

    await mixer.setOutput('speakers-direct');

    expect(directSetSinkId).toHaveBeenCalledWith('speakers-direct');
    expect(globalThis.Audio).not.toHaveBeenCalled();
    await mixer.close();
  });

  /**
   * A SENDER'S AUDIO USED TO IGNORE THE FADER ENTIRELY.
   *
   * It was the one sound this app makes that played at full scale whatever the
   * bar said, because there is no media element in this path to turn down — the
   * PCM goes straight from the worklet to the output.
   */
  it('opens at the level the app is already at', async () => {
    const mixer = await createPcmMixer('default', jest.fn(), jest.fn(), 0.35);

    expect(fader.gain.value).toBe(0.35);
    await mixer.close();
  });

  it.each([
    ['the direct sink path', true],
    ['the media-element path', false],
  ])('puts the fader before %s', async (_label, directOutput) => {
    installAudioFakes(directOutput);
    const mixer = await createPcmMixer('default', jest.fn(), jest.fn(), 1);

    // The worklet reaches the output through the fader and never around it.
    expect(fader.connect).toHaveBeenCalledTimes(1);
    await mixer.close();
  });

  it('follows the fader while a sender is playing', async () => {
    const mixer = await createPcmMixer('default', jest.fn(), jest.fn(), 1);

    mixer.setVolume(0.4);

    // Ramped rather than assigned: a step change in gain is a discontinuity in
    // the waveform, and a fader dragged across its travel is a hundred of them.
    expect(fader.gain.setTargetAtTime).toHaveBeenCalledWith(0.4, 0, 0.01);
    await mixer.close();
  });

  it('holds the fader inside its travel', async () => {
    const mixer = await createPcmMixer('default', jest.fn(), jest.fn(), 1);

    mixer.setVolume(1.8);
    mixer.setVolume(-0.5);

    expect(fader.gain.setTargetAtTime).toHaveBeenNthCalledWith(1, 1, 0, 0.01);
    expect(fader.gain.setTargetAtTime).toHaveBeenNthCalledWith(2, 0, 0, 0.01);
    await mixer.close();
  });

  it('ignores the fader once the session is closed', async () => {
    const mixer = await createPcmMixer('default', jest.fn(), jest.fn(), 1);
    await mixer.close();

    mixer.setVolume(0.2);

    expect(fader.gain.setTargetAtTime).not.toHaveBeenCalled();
  });

  it('keeps the listener usable while playback waits for a user gesture', async () => {
    installAudioFakes(true, 'suspended');
    let allowPlayback: (() => void) | undefined;
    resumeAudioContext.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          allowPlayback = resolve;
        }),
    );
    const onBlocked = jest.fn();
    const mixer = await createPcmMixer('default', onBlocked, jest.fn(), 1);
    expect(onBlocked).toHaveBeenLastCalledWith(true);
    expect(allowPlayback).toBeDefined();
    allowPlayback?.();
    await waitFor(() => expect(onBlocked).toHaveBeenLastCalledWith(false));
    await mixer.close();
  });

  it('serializes output changes and recovers after one device rejects', async () => {
    const mixer = await createPcmMixer('default', jest.fn(), jest.fn(), 1);
    const pending: {
      reject(error: Error): void;
      resolve(): void;
      sinkId: string;
    }[] = [];
    sink.setSinkId.mockImplementation(
      (sinkId) =>
        new Promise<void>((resolve, reject) => {
          pending.push({ reject, resolve, sinkId });
        }),
    );
    const first = mixer.setOutput('speakers-a');
    const second = mixer.setOutput('speakers-b');
    await waitFor(() =>
      expect(pending.map(({ sinkId }) => sinkId)).toEqual(['speakers-a']),
    );

    pending[0].resolve();
    await first;
    await waitFor(() =>
      expect(pending.map(({ sinkId }) => sinkId)).toEqual([
        'speakers-a',
        'speakers-b',
      ]),
    );
    pending[1].reject(new Error('device disappeared'));
    await expect(second).rejects.toThrow('device disappeared');

    const third = mixer.setOutput('speakers-c');
    await waitFor(() => expect(pending[2]?.sinkId).toBe('speakers-c'));
    pending[2].resolve();
    await third;
    await mixer.close();
  });

  it('uses the default output if the selected sink disappears', async () => {
    const mixer: IPcmMixer = {
      close: jest.fn(),
      push: jest.fn(),
      removePeer: jest.fn(),
      resume: jest.fn(),
      setOutput: jest
        .fn()
        .mockRejectedValueOnce(new Error('missing'))
        .mockResolvedValueOnce(undefined),
      setPeerMode: jest.fn(),
      setVolume: jest.fn(),
    };
    const outputRef = { current: 'previous-output' };
    resolveSelectedOutputSinkId.mockResolvedValue('new-output');

    const Harness = () => {
      const mixerRef = useRef<IPcmMixer | undefined>(mixer);
      useSelectedRemoteAudioOutput('device-a', mixerRef, outputRef);
      return null;
    };
    render(<Harness />);

    await waitFor(() => expect(outputRef.current).toBe('default'));
    expect(mixer.setOutput).toHaveBeenNthCalledWith(1, 'new-output');
    expect(mixer.setOutput).toHaveBeenNthCalledWith(2, 'default');
  });

  it('keeps the last confirmed output when both switches fail', async () => {
    const mixer: IPcmMixer = {
      close: jest.fn(),
      push: jest.fn(),
      removePeer: jest.fn(),
      resume: jest.fn(),
      setOutput: jest.fn().mockRejectedValue(new Error('missing')),
      setPeerMode: jest.fn(),
      setVolume: jest.fn(),
    };
    const outputRef = { current: 'working-output' };
    resolveSelectedOutputSinkId.mockResolvedValue('new-output');

    const Harness = () => {
      const mixerRef = useRef<IPcmMixer | undefined>(mixer);
      useSelectedRemoteAudioOutput('device-b', mixerRef, outputRef);
      return null;
    };
    render(<Harness />);

    await waitFor(() => expect(mixer.setOutput).toHaveBeenCalledTimes(2));
    expect(outputRef.current).toBe('working-output');
  });
});
