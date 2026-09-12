import { act, render } from '@testing-library/react';
import SmartHeadroomEngine from 'renderer/SmartHeadroomEngine';
import { useCurrentEngine } from 'renderer/utils/audioEngineContext';
import { useFluidEqContext } from 'renderer/utils/FluidEqContext';
import { useLiveAudioControl } from 'renderer/audio/LiveAudioContext';
import { sendSmartHeadroomMeasurement } from 'renderer/utils/equalizerApi';

jest.mock('renderer/utils/audioEngineContext');
jest.mock('renderer/utils/FluidEqContext');
jest.mock('renderer/audio/LiveAudioContext');
jest.mock('renderer/utils/equalizerApi');

describe('background APO headroom tap', () => {
  const originalNode = global.AudioWorkletNode;
  const source = { connect: jest.fn(), disconnect: jest.fn() };
  const mute = {
    gain: { value: 1 },
    connect: jest.fn(),
    disconnect: jest.fn(),
  };
  const meter = {
    connect: jest.fn(),
    disconnect: jest.fn(),
    port: {
      onmessage: null as ((event: { data: unknown }) => void) | null,
      close: jest.fn(),
    },
  };
  const context = {
    currentTime: 0,
    state: 'running',
    destination: {},
    audioWorklet: { addModule: jest.fn().mockResolvedValue(undefined) },
    createMediaStreamSource: jest.fn(() => source),
    createGain: jest.fn(() => mute),
  };
  const cancel = jest.fn();
  const emit = () =>
    meter.port.onmessage?.({
      data: { peakDbfs: 0, durationMs: 100, startedAt: context.currentTime },
    });

  beforeEach(() => {
    jest.clearAllMocks();
    context.currentTime = 0;
    meter.port.onmessage = null;
    global.AudioWorkletNode = jest.fn(
      () => meter,
    ) as unknown as typeof AudioWorkletNode;
    jest.mocked(useCurrentEngine).mockReturnValue('apo');
    jest
      .mocked(useFluidEqContext)
      .mockReturnValue({ isAutoPreAmpOn: true, isEnabled: true } as ReturnType<
        typeof useFluidEqContext
      >);
    jest.mocked(useLiveAudioControl).mockReturnValue({
      isActive: true,
      capture: { context, source: { mediaStream: {} } },
    } as unknown as ReturnType<typeof useLiveAudioControl>);
    jest.mocked(sendSmartHeadroomMeasurement).mockReturnValue(cancel);
  });

  afterEach(() => {
    global.AudioWorkletNode = originalNode;
  });

  it('runs a muted measurement tap and waits for each write before sending more', async () => {
    const view = render(<SmartHeadroomEngine />);
    await act(async () => undefined);
    expect(mute.gain.value).toBe(0);
    expect(source.connect).toHaveBeenCalledWith(meter);
    expect(meter.connect).toHaveBeenCalledWith(mute);
    for (let frame = 0; frame < 100; frame += 1) {
      emit();
    }
    expect(sendSmartHeadroomMeasurement).toHaveBeenCalledTimes(1);
    const [programme, trim, acknowledge] = jest.mocked(
      sendSmartHeadroomMeasurement,
    ).mock.calls[0];
    expect(programme).toEqual([]);
    expect(trim).toBe(-0.5);
    context.currentTime = 5;
    acknowledge(true);
    for (let frame = 0; frame < 100; frame += 1) {
      meter.port.onmessage?.({
        data: { peakDbfs: 0, durationMs: 100, startedAt: 1 },
      });
    }
    expect(sendSmartHeadroomMeasurement).toHaveBeenCalledTimes(1);
    for (let frame = 0; frame < 20; frame += 1) {
      emit();
    }
    expect(sendSmartHeadroomMeasurement).toHaveBeenCalledTimes(2);
    view.unmount();
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(source.disconnect).toHaveBeenCalledTimes(1);
    expect(mute.disconnect).toHaveBeenCalledTimes(1);
    expect(meter.port.onmessage).toBeNull();
    expect(meter.port.close).toHaveBeenCalledTimes(1);
  });

  it('never starts the APO writer under Fluid', async () => {
    jest.mocked(useCurrentEngine).mockReturnValue('fluid');
    const view = render(<SmartHeadroomEngine />);
    await act(async () => undefined);
    expect(context.audioWorklet.addModule).not.toHaveBeenCalled();
    expect(sendSmartHeadroomMeasurement).not.toHaveBeenCalled();
    view.unmount();
  });

  it('does not connect after unmount while module loading is pending', async () => {
    let loaded: (() => void) | undefined;
    context.audioWorklet.addModule.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          loaded = resolve;
        }),
    );
    const view = render(<SmartHeadroomEngine />);
    view.unmount();
    await act(async () => loaded?.());
    expect(source.connect).not.toHaveBeenCalled();
  });

  it('clears a legacy moving-spectrum estimate once before listening', async () => {
    jest.mocked(useFluidEqContext).mockReturnValue({
      isAutoPreAmpOn: true,
      isEnabled: true,
      smartHeadroomTrimDb: -2,
      smartHeadroomProgramme: [{ frequency: 1000, gain: -10 }],
    } as ReturnType<typeof useFluidEqContext>);
    const view = render(<SmartHeadroomEngine />);
    await act(async () => undefined);
    for (let frame = 0; frame < 100; frame += 1) {
      emit();
    }
    expect(sendSmartHeadroomMeasurement).toHaveBeenCalledTimes(1);
    expect(sendSmartHeadroomMeasurement).toHaveBeenCalledWith(
      [],
      -2,
      expect.any(Function),
    );
    view.unmount();
  });
});
