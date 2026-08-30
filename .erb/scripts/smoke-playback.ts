/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A real file, decoded, resampled, EQ'd and metered, through the native host.
 *
 * Everything below the host has its own tests: the chain against the worklet,
 * the resampler against a tone, the player against a generated decoder. None
 * of them can see the wiring — a command decoded into the wrong field, a
 * player built but never rendered from, a chain configured after the callback
 * had already read it. This runs the actual executable over an actual WAV and
 * asks whether audio came out the far end.
 *
 * Offline rather than through a device. A test that opened the machine's real
 * output would be a test that fails on a laptop with headphones unplugged, and
 * the render path is the same either way — `RUN_OFFLINE_BLOCKS` drives the
 * exact callback the device would.
 */
import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { findDspHostExecutable } from '../../src/main/dspHost/hostPath';
import { DspHostSupervisor } from '../../src/main/dspHost/supervisor';
import { NATIVE_DSP_PARAMETERS } from '../../src/common/dsp/nativeParameters';
import { IHostTelemetry } from '../../src/main/dspHost/wire';

let failures = 0;
const check = (condition: boolean, what: string) => {
  console.log(`  ${condition ? 'ok  ' : 'FAIL'} ${what}`);
  if (!condition) {
    failures += 1;
  }
};

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

/**
 * A 16-bit stereo WAV of a sine, written by hand.
 *
 * By hand because the decoder under test is the only WAV writer in the
 * project, and generating the fixture with the thing being tested would make
 * a matched pair of bugs invisible.
 */
const writeWav = (
  file: string,
  rate: number,
  seconds: number,
  hz: number,
  amplitude: number,
): void => {
  const frames = Math.round(rate * seconds);
  const data = Buffer.alloc(frames * 4);
  for (let at = 0; at < frames; at += 1) {
    const value = Math.round(
      Math.sin((2 * Math.PI * hz * at) / rate) * amplitude * 32767,
    );
    data.writeInt16LE(value, at * 4);
    data.writeInt16LE(value, at * 4 + 2);
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(2, 22); // stereo
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * 4, 28);
  header.writeUInt16LE(4, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(data.length, 40);
  writeFileSync(file, Buffer.concat([header, data]));
};

/**
 * A chain with one loud EQ band, in the flat layout the host decodes.
 *
 * Built here rather than imported from the fixture generator, because that
 * generator's job is to describe the TypeScript worklet's settings and this
 * one's is to describe the wire. They agree on the layout by construction —
 * `CHAIN_PARAM_LEAD` is asserted on both sides — and disagreeing about it is
 * exactly what this would catch.
 */
const chainValues = (eqEnabled: boolean, gainDb: number): number[] => {
  const values: number[] = [
    1, // enabled
    1, // output safety
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0, // exciter head
  ];
  for (let band = 0; band < 3; band += 1) {
    values.push(0, 1000, 0.5, 1, 0, 0); // exciter band
  }
  values.push(
    eqEnabled ? 1 : 0,
    0, // isolate
    0, // model: clean
    1, // model amount
    0, // engine: serial
    0, // phase: minimum
    0, // stereo
    0, // mono below
    1, // oversample
    0, // subsonic
    0, // fuzz
    0, // compressor enabled
    200,
    3000,
  );
  for (let band = 0; band < 3; band += 1) {
    values.push(-18, 2, 10, 120, 0);
  }
  values.push(
    0, // maximizer enabled
    0, // maximizer drive
    -0.1,
    5,
    150,
    0, // master enabled
    0,
    0,
    -14,
    -1,
    2000,
    1, // one EQ band
  );
  // Peaking, 1 kHz, the gain under test, Q 1.
  values.push(1, 0, 1000, gainDb, 1, 0, -24);
  return values;
};

const main = async (): Promise<void> => {
  const executable = findDspHostExecutable();
  if (!executable) {
    console.error('playback smoke: no host executable; run pnpm build first');
    process.exit(2);
  }
  const scratch = mkdtempSync(path.join(tmpdir(), 'fluideq-playback-'));
  // 44.1 kHz on purpose: the host runs at 48 offline, so the deck has to
  // convert. A player that ignored the file's rate would still make sound.
  const wav = path.join(scratch, 'tone.wav');
  writeWav(wav, 44_100, 4, 1_000, 0.5);

  const telemetry: IHostTelemetry[] = [];
  const host = new DspHostSupervisor({
    executablePath: executable,
    expectedParameterCount: NATIVE_DSP_PARAMETERS.length,
    onTelemetry: (frame) => telemetry.push(frame),
  });

  console.log('playback');
  check(await host.start(), 'the host starts');

  check(await host.applyChain(chainValues(false, 0)), 'a chain applies');
  check(await host.loadDeck(0, wav), 'a WAV loads into deck 0');
  check(
    !(await host.loadDeck(1, path.join(scratch, 'missing.wav'))),
    'a file that is not there is refused rather than played as silence',
  );
  check(await host.setPlaying(true), 'the transport starts');

  // Let the decoder thread fill the deck before anything is rendered.
  await sleep(500);

  const peakOf = async (label: string): Promise<number> => {
    telemetry.length = 0;
    await host.runOfflineBlocks(400);
    await sleep(200);
    let peak = 0;
    telemetry.forEach((frame) => {
      peak = Math.max(peak, frame.peak[0], frame.peak[1]);
    });
    console.log(`       ${label}: peak ${peak.toFixed(4)}`);
    return peak;
  };

  const flat = await peakOf('flat');
  check(flat > 0.4 && flat < 0.6, 'the file plays through at its own level');

  /**
   * The same audio with a +12 dB band on it, which is the wiring under test.
   *
   * A host that accepted the chain command and never handed it to the chain
   * would pass every check above and fail this one. So would a chain built
   * after the callback had already captured a pointer to the old one.
   */
  check(await host.applyChain(chainValues(true, 12)), 'a loud EQ band applies');
  await host.seekDeck(0, 0);
  await sleep(300);
  const boosted = await peakOf('+12 dB at 1 kHz');
  const boostDb = 20 * Math.log10(boosted / Math.max(flat, 1e-9));
  console.log(`       measured boost: ${boostDb.toFixed(2)} dB`);
  check(
    boostDb > 10 && boostDb < 13,
    'and the tone comes back that much louder',
  );

  check(await host.seekDeck(0, 2), 'a seek is accepted');
  check(await host.crossfade(1, 500, 0), 'a crossfade is accepted');
  check(await host.setTrackGains(-6, 0, true), 'the track gains apply');
  check(await host.setPlaying(false), 'the transport stops');

  await host.stop();
  rmSync(scratch, { recursive: true, force: true });
  if (failures > 0) {
    console.error(`\n${failures} check(s) failed`);
    process.exit(1);
  }
  console.log('\nall checks passed');
  /**
   * Explicit, because `stop()` does not close the loop behind it.
   *
   * The supervisor kills the host and forgets it, but the stdio it was spawned
   * with is still holding active handles afterwards — measured: two
   * ChildProcess and six Socket handles remain once every check has run. Node
   * then sits there with nothing left to do, and inside `test:native-dsp` that
   * is not a slow script, it is a suite that never reaches the next one. It
   * cost a full run before it was noticed, because a `timeout` in front of the
   * pipeline reported the exit code of the `grep` at the end of it.
   *
   * `smoke-supervisor.ts` has ended this way from the start, for the same
   * reason. Everything this script owns is already torn down above.
   */
  process.exit(0);
};

main().catch((error: unknown) => {
  console.error('playback smoke failed', error);
  process.exit(1);
});
