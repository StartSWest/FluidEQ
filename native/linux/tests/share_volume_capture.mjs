/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/
import assert from 'node:assert/strict';

export default function createCaptureReader({ pipewireServer, audio }) {
  // Keep each capture open through volume changes, like real connected PCs.
  // Reopening a monitor requests server rewinds and changes the audio clock.
  const readers = new Map();
  const measure = (target, index) => {
    const key = `${target}/${index}`;
    if (!readers.has(key)) {
      const child = pipewireServer
        ? audio('pw-record', [
            '--target',
            target,
            '--properties',
            `stream.capture.sink=${target !== 'fluideq_send'}`,
            '--raw',
            '--format',
            'f32',
            '--rate',
            '48000',
            '--channels',
            '2',
            '-',
          ])
        : audio('parec', [
            `--device=${target === 'fluideq_send' ? target : `${target}.monitor`}`,
            '--raw',
            '--format=float32le',
            '--rate=48000',
            '--channels=2',
            '--latency-msec=20',
          ]);
      const reader = { request: null, pending: Buffer.alloc(0) };
      child.on('error', (error) => reader.request?.reject(error));
      child.stdout.on('data', (chunk) => {
        reader.pending = Buffer.concat([reader.pending, chunk]);
        const length = reader.pending.length - (reader.pending.length % 8);
        for (let at = 0; at < length && reader.request; at += 8) {
          const r = reader.request;
          const value = reader.pending.readFloatLE(at);
          r.energy += value * value;
          for (let k = 0; k < 3; k++) {
            const angle = (2 * Math.PI * [440, 880, 1320][k] * r.frame) / 48000;
            r.sums[k] += value * Math.sin(angle);
            r.cosines[k] += value * Math.cos(angle);
          }
          if (++r.frame === 4800) {
            if (r.windows >= 10) r.total += r.energy;
            r.energy = 0;
            for (let k = 0; k < 3; k++) {
              if (r.windows >= 10)
                r.result[k] +=
                  (2 * Math.hypot(r.sums[k], r.cosines[k])) / r.frame;
              r.sums[k] = r.cosines[k] = 0;
            }
            r.frame = 0;
            if (++r.windows === 30) {
              const result = r.result.map((value) => value / 20);
              result.rms = Math.sqrt(r.total / 96000);
              reader.request = null;
              r.resolve(result);
            }
          }
        }
        reader.pending = reader.pending.subarray(length);
      });
      readers.set(key, reader);
    }
    return new Promise((resolve, reject) => {
      const reader = readers.get(key);
      assert.equal(reader.request, null);
      reader.request = {
        resolve,
        reject,
        frame: 0,
        windows: 0,
        sums: [0, 0, 0],
        cosines: [0, 0, 0],
        result: [0, 0, 0],
        energy: 0,
        total: 0,
      };
    });
  };
  return measure;
}
