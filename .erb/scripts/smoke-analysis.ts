/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The panel's measurements, out of a real host process and onto a real pipe.
 *
 * Both halves of this are already tested alone: `meters_test` proves the C++
 * measures where the energy actually is, and `dspHostAnalysisWire` proves the
 * variable-length framing survives being cut into arbitrary chunks. Neither
 * proves they meet. Between them sit a command the host has to recognise, a
 * frame it has to assemble, twelve kilobytes it has to write in one call, and a
 * reader that has to find the next frame exactly where this one ends — and
 * every one of those is a place where two correct halves make a broken whole.
 *
 * Silent by construction. The chain runs through an offline render rather than
 * an open endpoint, so this measures real music through the real chain without
 * making a sound on the machine that runs the suite.
 */
import { spawnSync } from 'child_process';
import { existsSync, mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { findDspHostExecutable } from '../../src/main/dspHost/hostPath';
import { DspHostSupervisor } from '../../src/main/dspHost/supervisor';
import { IHostAnalysis } from '../../src/common/dsp/analysisWire';
import { NATIVE_DSP_PARAMETERS } from '../../src/common/dsp/nativeParameters';
import { DSP_DEFAULTS } from '../../src/common/dsp/chain';
import { encodeChainSettings } from '../../src/common/dsp/chainWire';

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

/** The loudest bin in a spectrum, which is where the programme is. */
const loudest = (bins: Float32Array): number => {
  let peak = -Infinity;
  for (let at = 0; at < bins.length; at += 1) {
    peak = Math.max(peak, bins[at]);
  }
  return peak;
};

/**
 * Render in slices, pausing between them, because an offline render is not
 * real time and the meters are.
 *
 * The host publishes a window every 2048 samples and its control thread drains
 * one per stage per pass. Played, that is about twenty-three windows a second
 * against a drain running faster, so every window is seen. Rendered offline,
 * three seconds of audio is produced in a burst and the drain sees exactly one
 * — and the spectrum's 0.8 smoothing then gets a single step, which is 1.9 dB.
 *
 * Slicing gives the drain the same number of chances it would have in
 * playback. Nothing about the engine changes; this is the test learning to
 * observe something that is published on a clock.
 */
const renderSliced = async (
  host: DspHostSupervisor,
  target: string,
  slices: number,
): Promise<void> => {
  for (let slice = 0; slice < slices; slice += 1) {
    // eslint-disable-next-line no-await-in-loop -- the slices are sequential by
    // construction; that is the point of them.
    await host.renderToFile(24_000, target);
    // eslint-disable-next-line no-await-in-loop
    await sleep(60);
  }
};

const main = async (): Promise<void> => {
  const executablePath = findDspHostExecutable();
  if (!executablePath) {
    console.error('analysis smoke: no host executable; run pnpm build first');
    process.exit(2);
  }

  const scratch = mkdtempSync(path.join(tmpdir(), 'fluideq-analysis-'));
  const source = path.resolve(__dirname, '../..', 'karaoke_instrumental.mp3');
  const decoded = path.join(scratch, 'music.wav');
  const rendered = path.join(scratch, 'out.wav');

  const ffmpeg = spawnSync(
    'ffmpeg',
        // Longer than the sliced render below consumes: 24 slices of 24000 frames
    // is twelve seconds, and a deck that runs dry mid-test measures the silence
    // after the music rather than the music.
    ['-y', '-v', 'error', '-i', source, '-t', '20', '-ar', '48000', '-ac', '2',
      '-c:a', 'pcm_s16le', decoded],
    { windowsHide: true },
  );
  if (ffmpeg.status !== 0 || !existsSync(decoded)) {
    console.log('analysis smoke: no ffmpeg to decode the fixture, skipped');
    rmSync(scratch, { recursive: true, force: true });
    process.exit(0);
  }

  const frames: IHostAnalysis[] = [];
  const host = new DspHostSupervisor({
    executablePath,
    expectedParameterCount: NATIVE_DSP_PARAMETERS.length,
    onAnalysis: (analysis) => frames.push(analysis),
  });

  console.log('measurements, through a real host');
  check(await host.start(), 'the host starts');

  /**
   * Nothing at all until it is asked for.
   *
   * The DSP tab is one of several and is usually closed, so three transforms
   * and a scope window per block must not be work the app does by default. A
   * frame arriving here would mean every user pays for a panel they never open.
   */
  await host.applyChain(encodeChainSettings({ ...DSP_DEFAULTS }));
  await host.loadDeck(0, decoded);
  await host.setPlaying(true);
  await host.renderToFile(48_000 * 2, rendered);
  await sleep(200);
  check(frames.length === 0, 'nothing is measured until the panel asks');

  check(await host.setAnalysis(true), 'the host accepts the analysis command');

  await host.seekDeck(0, 0);
  // The transforms happen on the host's control thread and are published on
  // its own interval, so the frames follow the render rather than arriving
  // with it — and the render has to be paced for them to all be seen.
  await renderSliced(host, rendered, 24);
  await sleep(300);

  check(frames.length > 0, 'frames arrive once it has');
  console.log(`       ${frames.length} frame(s) received`);

  const withEq = frames.filter((frame) => frame.spectra.eq !== undefined);
  const withMaster = frames.filter((frame) => frame.spectra.master !== undefined);
  check(withEq.length > 0, 'the EQ tap reports a spectrum');
  check(withMaster.length > 0, 'the master tap reports a spectrum');

  const music = withMaster.at(-1)?.spectra.master;
  check(music?.length === 1024, 'a spectrum is the agreed 1024 bins');

  const musicPeak = music ? loudest(music) : -Infinity;
  console.log(`       loudest bin over music: ${musicPeak.toFixed(1)} dB`);
  check(musicPeak > -60, 'and it carries real programme, not a floor');

  const scoped = frames.filter((frame) => frame.scatter !== undefined);
  check(scoped.length > 0, 'the goniometer gets its sample pairs');
  const peaks = frames.at(-1)?.peaks ?? [0, 0];
  console.log(
    `       correlation ${(frames.at(-1)?.correlation ?? 0).toFixed(3)}, ` +
      `peaks ${peaks[0].toFixed(3)} / ${peaks[1].toFixed(3)}`,
  );
  check(peaks[0] > 0.001, 'and the peaks are the music, not zero');

  /**
   * The positive control, and the reason every threshold above means anything.
   *
   * A host that sent a plausible constant would satisfy all of it. Taking the
   * music away has to take the reading away with it — so the deck is unloaded
   * and the same chain is rendered over silence.
   */
  frames.length = 0;
  await host.unloadDeck(0);
  await renderSliced(host, rendered, 24);
  await sleep(300);

  const silent = frames.filter((frame) => frame.spectra.master !== undefined);
  check(silent.length > 0, 'silence is still measured rather than not sent');
  const silentPeak = silent.at(-1)?.spectra.master
    ? loudest(silent.at(-1)?.spectra.master as Float32Array)
    : 0;
  console.log(`       loudest bin over silence: ${silentPeak.toFixed(1)} dB`);
  check(
    silentPeak < musicPeak - 30,
    'and reads far below the music, so the meter follows the audio',
  );

  /** Off again, and off means off. */
  check(await host.setAnalysis(false), 'the host accepts switching it off');
  frames.length = 0;
  await host.renderToFile(48_000, rendered);
  await sleep(300);
  check(frames.length === 0, 'and then nothing further is sent');

  await host.stop();
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
  console.error('analysis smoke failed', error);
  process.exit(1);
});
