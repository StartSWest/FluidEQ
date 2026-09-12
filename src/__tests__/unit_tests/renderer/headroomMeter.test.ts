import fs from 'fs';
import path from 'path';
import vm from 'vm';

it('measures both channels without playing the loopback back or requiring UI frames', () => {
  const messages: Array<{ peakDbfs: number; durationMs: number }> = [];
  interface IMeter {
    process(inputs: Float32Array[][], outputs: Float32Array[][]): boolean;
  }
  let create: (() => IMeter) | undefined;
  vm.runInNewContext(
    fs.readFileSync(
      path.join(__dirname, '../../../renderer/audio/headroom-meter.worklet'),
      'utf8',
    ),
    {
      sampleRate: 48000,
      currentTime: 0,
      AudioWorkletProcessor: class {
        port = {
          postMessage: (data: { peakDbfs: number; durationMs: number }) =>
            messages.push(data),
        };
      },
      registerProcessor: (_name: string, Processor: new () => IMeter) => {
        create = () => new Processor();
      },
    },
  );
  if (!create) {
    throw new Error('Meter was not registered');
  }
  const meter = create();
  const silentOutput = new Float32Array(480);
  for (let block = 0; block < 10; block += 1) {
    expect(
      meter.process(
        [[new Float32Array(480).fill(0.5), new Float32Array(480).fill(-0.5)]],
        [[silentOutput]],
      ),
    ).toBe(true);
  }
  expect(messages).toHaveLength(1);
  expect(messages[0].peakDbfs).toBeCloseTo(-6.0206, 3);
  expect(messages[0].durationMs).toBe(100);
  expect(silentOutput.every((sample) => sample === 0)).toBe(true);
  for (let block = 0; block < 10; block += 1) {
    meter.process([[new Float32Array(480)]], [[silentOutput]]);
  }
  expect(messages[1].peakDbfs).toBe(-240);
});
