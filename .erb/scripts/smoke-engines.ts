/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The two engines over the same song, compared in samples.
 *
 * "Does it sound the same" is the question the whole migration turns on, and
 * the honest way to answer it is not to ask somebody to listen — a listener
 * cannot hear a fifth of a decibel, cannot tell which of two takes was which
 * ten seconds later, and cannot check the eleventh format after checking ten.
 * They can hear a dropout, which is worth having, but they cannot certify a
 * port. Rendering both and subtracting can.
 *
 * The parity corpus already does this per stage and for the whole chain, but on
 * synthetic signals: a sweep, noise, an impulse train. Music is different in
 * ways that matter — correlated channels, dense spectra, real transients, and
 * long stretches near silence where a difference is loudest relative to what is
 * there. This runs the actual audio a person would play.
 *
 * What it cannot cover is the device itself. Nothing here opens an endpoint, so
 * a fault between the chain's output and the speaker — a wrong channel count, a
 * broken WASAPI conversion — would pass this and still be audible. That is the
 * one thing left for ears, and it is worth saying rather than implying.
 */
import { spawnSync } from 'child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { findDspHostExecutable } from '../../src/main/dspHost/hostPath';
import { DspHostSupervisor } from '../../src/main/dspHost/supervisor';
import { NATIVE_DSP_PARAMETERS } from '../../src/common/dsp/nativeParameters';
import { DSP_DEFAULTS, IEqSettings } from '../../src/common/dsp/chain';
import { encodeChainSettings } from '../../src/common/dsp/chainWire';
import { FilterTypeEnum } from '../../src/common/constants';
import { createWorkletHarness } from './lib/workletHarness';

let failures = 0;
const check = (condition: boolean, what: string) => {
  console.log(`  ${condition ? 'ok  ' : 'FAIL'} ${what}`);
  if (!condition) {
    failures += 1;
  }
};

/** Read a 16-bit or 32-bit float WAV into planar channels. */
const readWav = (file: string): { rate: number; channels: Float32Array[] } => {
  const bytes = readFileSync(file);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let at = 12;
  let format = 1;
  let channelCount = 2;
  let rate = 48_000;
  let bits = 16;
  let dataAt = 0;
  let dataBytes = 0;

  // Chunks walked rather than assumed: a WAV written by ffmpeg carries a LIST
  // chunk before its data, and a reader that skipped straight to byte 44 would
  // decode the tag text as audio.
  while (at + 8 <= bytes.length) {
    const id = bytes.toString('ascii', at, at + 4);
    const size = view.getUint32(at + 4, true);
    if (id === 'fmt ') {
      format = view.getUint16(at + 8, true);
      channelCount = view.getUint16(at + 10, true);
      rate = view.getUint32(at + 12, true);
      bits = view.getUint16(at + 22, true);
    } else if (id === 'data') {
      dataAt = at + 8;
      dataBytes = size;
      break;
    }
    at += 8 + size + (size % 2);
  }

  const bytesPerSample = bits / 8;
  const frames = Math.floor(dataBytes / (bytesPerSample * channelCount));
  const channels = Array.from(
    { length: channelCount },
    () => new Float32Array(frames),
  );
  for (let frame = 0; frame < frames; frame += 1) {
    for (let channel = 0; channel < channelCount; channel += 1) {
      const offset = dataAt + (frame * channelCount + channel) * bytesPerSample;
      channels[channel][frame] =
        format === 3
          ? view.getFloat32(offset, true)
          : view.getInt16(offset, true) / 32768;
    }
  }
  return { rate, channels };
};

/** A rack with enough going on that a difference has somewhere to show. */
const settings = () => ({
  ...DSP_DEFAULTS,
  eq: {
    ...DSP_DEFAULTS.eq,
    enabled: true,
    subsonicHz: 30,
    bands: [
      {
        enabled: true,
        dynamic: false,
        thresholdDb: -24,
        type: FilterTypeEnum.LSC,
        frequency: 100,
        gainDb: 4,
        quality: 0.707,
      },
      {
        enabled: true,
        dynamic: false,
        thresholdDb: -24,
        type: FilterTypeEnum.PK,
        frequency: 1_000,
        gainDb: -3,
        quality: 1.4,
      },
      {
        enabled: true,
        dynamic: false,
        thresholdDb: -24,
        type: FilterTypeEnum.HSC,
        frequency: 6_000,
        gainDb: 2.5,
        quality: 0.707,
      },
    ] as unknown as IEqSettings['bands'],
  },
  compressor: { ...DSP_DEFAULTS.compressor, enabled: true },
  maximizer: { ...DSP_DEFAULTS.maximizer, enabled: true },
});

const main = async (): Promise<void> => {
  const executable = findDspHostExecutable();
  if (!executable) {
    console.error('engine smoke: no host executable; run pnpm build first');
    process.exit(2);
  }

  const scratch = mkdtempSync(path.join(tmpdir(), 'fluideq-engines-'));
  const source = path.resolve(__dirname, '../..', 'karaoke_instrumental.mp3');
  const decoded = path.join(scratch, 'music.wav');

  /**
   * Decoded to 48 kHz once, and both engines are fed that same file.
   *
   * The native player would happily take the MP3 and resample it, but then the
   * two sides would differ by a resampler the TypeScript one does not have, and
   * the comparison would measure that instead of the chain.
   */
  const ffmpeg = spawnSync(
    'ffmpeg',
    [
      '-y',
      '-v',
      'error',
      '-i',
      source,
      '-t',
      '10',
      '-ar',
      '48000',
      '-ac',
      '2',
      '-c:a',
      'pcm_s16le',
      decoded,
    ],
    { windowsHide: true },
  );
  if (ffmpeg.status !== 0 || !existsSync(decoded)) {
    console.log('engine smoke: no ffmpeg to decode the fixture, skipped');
    rmSync(scratch, { recursive: true, force: true });
    process.exit(0);
  }

  const music = readWav(decoded);
  console.log('two engines, one song');
  check(music.rate === 48_000, 'the fixture decoded at the rate both run at');

  // The TypeScript chain, in the same worklet the browser runs.
  const harness = createWorkletHarness(48_000, settings());
  const expected = harness.render(music.channels);

  // The native chain, through the host, from the same file.
  const host = new DspHostSupervisor({
    executablePath: executable,
    expectedParameterCount: NATIVE_DSP_PARAMETERS.length,
  });
  await host.start();
  await host.applyChain(encodeChainSettings(settings()));
  check(await host.loadDeck(0, decoded), 'the native deck takes the fixture');
  await host.setPlaying(true);
  // Long enough for the decoder thread to fill the read-ahead ring, so the
  // render is not measuring a cold start.
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 800);
  });

  const rendered = path.join(scratch, 'native.wav');
  const frames = Math.min(expected[0].length, 48_000 * 8);
  check(
    await host.renderToFile(frames, rendered),
    'the native engine renders it to a file',
  );
  await host.stop();

  const actual = readWav(rendered);
  check(actual.channels.length === 2, 'the render came back in stereo');

  /**
   * Compared from a second in, and only where the reference has signal.
   *
   * The first moments are both engines' filters settling from silence, which
   * differ for a reason that is not a defect. Everything after is the thing
   * being asked about.
   */
  const skip = 48_000;
  const span = Math.min(frames, actual.channels[0].length) - skip;
  let worst = 0;
  let sumSquared = 0;
  let referenceSquared = 0;
  for (let channel = 0; channel < 2; channel += 1) {
    for (let at = 0; at < span; at += 1) {
      const reference = expected[channel][skip + at];
      const difference = actual.channels[channel][skip + at] - reference;
      worst = Math.max(worst, Math.abs(difference));
      sumSquared += difference * difference;
      referenceSquared += reference * reference;
    }
  }
  const differenceDb =
    10 *
    Math.log10(Math.max(sumSquared, 1e-30) / Math.max(referenceSquared, 1e-30));
  console.log(
    `       ${(span / 48_000).toFixed(1)} s compared · worst sample ${worst.toExponential(2)} · residual ${differenceDb.toFixed(1)} dB`,
  );

  /**
   * Below -60 dB, which is the honest threshold rather than an ambitious one.
   *
   * The two engines are not bit-identical and should not be expected to be:
   * one accumulates in JavaScript doubles throughout, the other rounds to
   * float at every buffer boundary the C++ chain writes. Sixty decibels down
   * is a millionth of the power and far below the noise floor of any material
   * this will play — while a stage in the wrong order, a missing filter or a
   * mismatched gain lands tens of decibels above it.
   */
  check(
    differenceDb < -60,
    'the two engines agree on real music, below -60 dB',
  );

  /**
   * The positive control, and the reason the number above means anything.
   *
   * A comparison of two silences is perfect, and so is a comparison of a
   * buffer with itself. `-332 dB` is exactly what a test that measured nothing
   * would report, so two things are checked before it is believed: that the
   * reference actually carries music, and that a chain which IS different
   * lands far above the threshold rather than under it.
   */
  let referenceRms = 0;
  for (let at = 0; at < span; at += 1) {
    referenceRms += expected[0][skip + at] * expected[0][skip + at];
  }
  referenceRms = Math.sqrt(referenceRms / span);
  console.log(
    `       reference RMS ${(20 * Math.log10(referenceRms)).toFixed(1)} dBFS`,
  );
  check(
    referenceRms > 0.01,
    'the reference carries real music, so agreement means something',
  );

  const detuned = settings();
  // One band moved by 6 dB. Small enough that a listener might argue about it,
  // enormous next to a millionth of the power.
  detuned.eq.bands[1].gainDb = 3;
  let differs = 0;
  const detunedRender = createWorkletHarness(48_000, detuned).render(
    music.channels,
  );
  for (let at = 0; at < span; at += 1) {
    differs = Math.max(
      differs,
      Math.abs(detunedRender[0][skip + at] - expected[0][skip + at]),
    );
  }
  let detunedSquared = 0;
  for (let at = 0; at < span; at += 1) {
    const difference = detunedRender[0][skip + at] - expected[0][skip + at];
    detunedSquared += difference * difference;
  }
  const detunedDb =
    10 *
    Math.log10(
      Math.max(detunedSquared, 1e-30) / Math.max(referenceSquared / 2, 1e-30),
    );
  console.log(
    `       control: one band moved 6 dB reads ${detunedDb.toFixed(1)} dB`,
  );
  check(
    detunedDb > -60,
    'a chain that IS different is caught, so the comparison is not blind',
  );

  rmSync(scratch, { recursive: true, force: true });
  if (failures > 0) {
    console.error(`\n${failures} check(s) failed`);
    process.exit(1);
  }
  console.log('\nall checks passed');
  // The supervisor's stdio handles outlive `stop()`; see `smoke-playback.ts`.
  process.exit(0);
};

main().catch((error: unknown) => {
  console.error('engine smoke failed', error);
  process.exit(1);
});
