/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Put an audible tone through the native output path.
 *
 * Deliberately its own script and not part of the smoke test. The smoke test
 * runs on demand and in CI and must never make a sound on somebody's machine;
 * this one exists precisely to, and so it is only ever run by a person who
 * typed its name.
 *
 *   pnpm tone:native-dsp            440 Hz for 3 seconds
 *   pnpm tone:native-dsp 1000 5     1 kHz for 5 seconds
 *
 * What it proves that no test can: that the endpoint the host opened is the
 * one you are listening to, that the engine passes signal through unchanged,
 * and that the result is clean rather than crackling.
 */
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';
import {
  DIAGNOSTIC_SIGNALS,
  HOST_COMMANDS,
  decodeTelemetry,
  encodeCommand,
  frameLengthFor,
  MAGIC_TELEMETRY,
} from '../../src/main/dspHost/wire';

const ROOT = path.join(__dirname, '..', '..');
const HOST = path.join(
  ROOT,
  'native',
  '.build',
  'bin',
  process.platform === 'win32' ? 'FluidEQ-DSP.exe' : 'FluidEQ-DSP',
);

const frequency = Number(process.argv[2] ?? 440);
const seconds = Number(process.argv[3] ?? 3);

const main = async () => {
  if (!existsSync(HOST)) {
    console.error(`tone: host not built. Run "pnpm build:native-dsp" first.`);
    process.exit(1);
  }
  if (!Number.isFinite(frequency) || frequency <= 0 || frequency >= 20000) {
    console.error('tone: frequency must be between 1 and 20000 Hz');
    process.exit(1);
  }

  const host = spawn(HOST, [], { stdio: ['pipe', 'pipe', 'inherit'] });
  let peak = 0;
  let underruns = 0;
  let rate = 0;
  let frames = 0;

  let pending = Buffer.alloc(0);
  host.stdout.on('data', (chunk: Buffer) => {
    pending = Buffer.concat([pending, chunk]);
    for (;;) {
      if (pending.length < 4) {
        return;
      }
      const length = frameLengthFor(pending.readUInt32LE(0));
      if (length === 0 || pending.length < length) {
        return;
      }
      const frame = pending.subarray(0, length);
      pending = pending.subarray(length);
      if (frame.readUInt32LE(0) === MAGIC_TELEMETRY) {
        const record = decodeTelemetry(frame);
        if (record) {
          peak = Math.max(peak, record.peak[0], record.peak[1]);
          underruns = record.xruns;
          rate = record.sampleRate;
          frames = record.framesProcessed;
        }
      }
    }
  });

  const sleep = (ms: number) =>
    new Promise<void>((resolve) => {
      setTimeout(resolve, ms);
    });

  host.stdin.write(
    encodeCommand({ command: HOST_COMMANDS.start, requestId: 1 }),
  );
  await sleep(300);
  host.stdin.write(
    encodeCommand({
      command: HOST_COMMANDS.setDiagnosticSignal,
      requestId: 2,
      parameterId: DIAGNOSTIC_SIGNALS.sine,
      value: frequency,
    }),
  );
  console.log(`tone: ${frequency} Hz at -12 dBFS for ${seconds}s`);

  // The duration the person asked to hear. Not a delay covering a race.
  await sleep(seconds * 1000);

  host.stdin.write(
    encodeCommand({
      command: HOST_COMMANDS.setDiagnosticSignal,
      requestId: 3,
      parameterId: DIAGNOSTIC_SIGNALS.silence,
    }),
  );
  host.stdin.write(encodeCommand({ command: HOST_COMMANDS.stop, requestId: 4 }));
  host.stdin.write(
    encodeCommand({ command: HOST_COMMANDS.shutdown, requestId: 5 }),
  );
  await new Promise<void>((resolve) => {
    host.on('close', () => resolve());
  });

  const peakDb = peak > 0 ? 20 * Math.log10(peak) : -Infinity;
  console.log(
    `tone: ${rate} Hz, ${frames} frames, peak ${peakDb.toFixed(1)} dBFS, ` +
      `${underruns} underrun(s)`,
  );
  // -12 dBFS is what the generator writes. A peak that is not close to it
  // means the path between the generator and the meter is not unity, which is
  // the one thing an identity engine is supposed to guarantee.
  if (Math.abs(peakDb + 12.0) > 0.5) {
    console.error('tone: the output level is not what the generator wrote');
    process.exit(1);
  }
  process.exit(0);
};

main().catch((error: unknown) => {
  console.error('tone: unexpected failure', error);
  process.exit(1);
});
