/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import '@testing-library/jest-dom';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import KaraokeMicrophone from '../../renderer/karaoke/KaraokeMicrophone';

describe('KaraokeMicrophone pitch analysis', () => {
  it('loads the worklet and publishes smoothed note data without audible gain', async () => {
    const track = {
      stop: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    } as unknown as MediaStreamTrack;
    const stream = {
      getTracks: () => [track],
      getAudioTracks: () => [track],
    } as unknown as MediaStream;
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        enumerateDevices: jest.fn(async () => []),
        getUserMedia: jest.fn(async () => stream),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      },
    });

    const source = {
      connect: jest.fn(),
      disconnect: jest.fn(),
    } as unknown as MediaStreamAudioSourceNode;
    const analyser = {
      fftSize: 0,
      smoothingTimeConstant: 0,
      getFloatTimeDomainData: jest.fn((samples: Float32Array) => {
        for (let index = 0; index < samples.length; index += 1) {
          samples[index] =
            0.35 * Math.sin((2 * Math.PI * 220 * index) / 48_000);
        }
      }),
      disconnect: jest.fn(),
    } as unknown as AnalyserNode;
    const inputGain = {
      gain: { value: 1 },
      connect: jest.fn(),
      disconnect: jest.fn(),
    } as unknown as GainNode;
    const silentGain = {
      gain: { value: 1 },
      connect: jest.fn(),
      disconnect: jest.fn(),
    } as unknown as GainNode;
    const addModule = jest.fn(async () => undefined);

    const context = {
      state: 'running' as AudioContextState,
      sampleRate: 48_000,
      audioWorklet: { addModule } as AudioWorklet,
      destination: {} as AudioDestinationNode,
      createMediaStreamSource: jest.fn(() => source),
      createAnalyser: jest.fn(() => analyser),
      createGain: jest
        .fn<GainNode, []>()
        .mockReturnValueOnce(inputGain)
        .mockReturnValueOnce(silentGain),
      resume: jest.fn(async () => undefined),
      close: jest.fn(async () => undefined),
    };
    const worklet = {
      port: {
        onmessage: null,
        close: jest.fn(),
      } as unknown as MessagePort,
      connect: jest.fn(),
      disconnect: jest.fn(),
    };
    const FakeAudioContext = jest.fn(() => context);
    const FakeAudioWorkletNode = jest.fn(() => worklet);

    Object.defineProperty(globalThis, 'AudioContext', {
      configurable: true,
      value: FakeAudioContext,
    });
    Object.defineProperty(globalThis, 'AudioWorkletNode', {
      configurable: true,
      value: FakeAudioWorkletNode,
    });
    let meterFrame: FrameRequestCallback | undefined;
    Object.defineProperty(globalThis, 'requestAnimationFrame', {
      configurable: true,
      value: jest.fn((callback: FrameRequestCallback) => {
        meterFrame ??= callback;
        return 1;
      }),
    });
    Object.defineProperty(globalThis, 'cancelAnimationFrame', {
      configurable: true,
      value: jest.fn(),
    });

    const onPitchChange = jest.fn();
    const { unmount } = render(
      <KaraokeMicrophone isActive onPitchChange={onPitchChange} />,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Turn on mic' }));

    await waitFor(() =>
      expect(addModule).toHaveBeenCalledWith('test-file-stub'),
    );
    expect(source.connect).toHaveBeenCalledWith(inputGain);
    expect(inputGain.connect).toHaveBeenCalledWith(analyser);
    expect(inputGain.connect).toHaveBeenCalledWith(worklet);
    expect(worklet.connect).toHaveBeenCalledWith(silentGain);
    expect(silentGain.gain.value).toBe(0);

    act(() => meterFrame?.(100));
    await waitFor(() =>
      expect(onPitchChange).toHaveBeenCalledWith(
        expect.objectContaining({ note: 'A3' }),
        'ready',
      ),
    );

    act(() => {
      worklet.port.onmessage?.call(
        worklet.port,
        new MessageEvent('message', {
          data: {
            frequencyHz: 440,
            confidence: 0.98,
            rms: 0.2,
            capturedAtMs: 10,
            processingMs: 1.2,
          },
        }),
      );
    });

    await waitFor(() =>
      expect(onPitchChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ note: 'A4', cents: 0 }),
        'ready',
      ),
    );
    unmount();
    expect(track.stop).toHaveBeenCalledTimes(1);
    expect(worklet.port.close).toHaveBeenCalledTimes(1);
  });
});
