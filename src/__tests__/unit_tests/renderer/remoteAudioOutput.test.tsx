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

const installAudioFakes = (directOutput = false) => {
  Object.defineProperty(globalThis, 'AudioContext', {
    configurable: true,
    value: jest.fn(() => {
      const context = {
        audioWorklet: { addModule: jest.fn().mockResolvedValue(undefined) },
        close: jest.fn().mockResolvedValue(undefined),
        createMediaStreamDestination: jest.fn(() => ({
          stream: { getTracks: () => [] },
        })),
        destination: {},
        resume: jest.fn().mockResolvedValue(undefined),
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
    directSetSinkId.mockResolvedValue(undefined);
    installAudioFakes();
  });

  it('uses Chromium direct output instead of an extra playback queue', async () => {
    installAudioFakes(true);
    const mixer = await createPcmMixer('default', jest.fn(), jest.fn());

    await mixer.setOutput('speakers-direct');

    expect(directSetSinkId).toHaveBeenCalledWith('speakers-direct');
    expect(globalThis.Audio).not.toHaveBeenCalled();
    await mixer.close();
  });

  it('serializes output changes and recovers after one device rejects', async () => {
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
    const mixer = await createPcmMixer('default', jest.fn(), jest.fn());

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
