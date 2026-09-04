/* FluidEQ — GPL-3.0-or-later */
/** @jest-environment node */

import fs from 'fs';
import path from 'path';
import vm from 'vm';
import type { ISenderSpectrum } from '../../../renderer/remoteAudio/senderSpectrum';

it('runs the shipped spectrum worker on demand and clears idle capture', () => {
  const frames: ISenderSpectrum[] = [];
  const scope = {
    onmessage: (_event: { data: unknown }) => undefined,
    postMessage: (frame: ISenderSpectrum) => frames.push(frame),
  };
  vm.runInNewContext(
    fs.readFileSync(
      path.resolve('release/app/dist/renderer/sender-spectrum.js'),
      'utf8',
    ),
    scope,
  );
  const port = {
    onmessage: (_event: { data: unknown }) => undefined,
    close: jest.fn(),
  };
  scope.onmessage({ data: { kind: 'attach', port } });
  scope.onmessage({ data: { kind: 'read' } });
  expect(frames).toHaveLength(0);
  const pcm = new Float32Array(960).fill(0.25);
  for (let sequence = 0; sequence < 12; sequence += 1) {
    port.onmessage({
      data: {
        peerId: 'sender',
        sequence,
        channels: 2,
        frames: 480,
        sampleRate: 48000,
        pcm: pcm.buffer,
      },
    });
  }
  // Audio arrival updates only the rolling window after the first outstanding
  // display request. It must never create a queue of unsolicited FFT results.
  expect(frames).toHaveLength(1);
  expect(frames[0].peaks).toEqual([0.25, 0.25]);
  scope.onmessage({ data: { kind: 'read' } });
  expect(frames).toHaveLength(2);
  expect(frames[1].peaks).toEqual([0.25, 0.25]);
  scope.onmessage({ data: { kind: 'read' } });
  expect(frames[2].peaks).toEqual([0, 0]);
  expect(Math.max(...frames[2].frequency)).toBeLessThan(-95);
  port.onmessage({ data: { kind: 'reset' } });
  scope.onmessage({ data: { kind: 'read' } });
  expect(frames).toHaveLength(3);
});
