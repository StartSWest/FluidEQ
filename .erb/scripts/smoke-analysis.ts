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
import { DSP_DEFAULTS, IEqSettings } from '../../src/common/dsp/chain';
import { FilterTypeEnum } from '../../src/common/constants';
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
    [
      '-y',
      '-v',
      'error',
      '-i',
      source,
      '-t',
      '20',
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
  // One dynamic band, because a static rack reports 1.0 for everything and
  // would pass a check that never watched anything move.
  await host.applyChain(
    encodeChainSettings({
      ...DSP_DEFAULTS,
      eq: {
        ...DSP_DEFAULTS.eq,
        enabled: true,
        bands: [
          {
            enabled: true,
            dynamic: true,
            thresholdDb: -30,
            type: FilterTypeEnum.PK,
            frequency: 1000,
            gainDb: -8,
            quality: 1.2,
          },
        ] as unknown as IEqSettings['bands'],
      },
      exciter: {
        ...DSP_DEFAULTS.exciter,
        enabled: true,
        organic: {
          ...DSP_DEFAULTS.exciter.organic,
          enabled: true,
          amount: 0.6,
        },
      },
      // Both bass stages wide open, because their meters are fixed fields in
      // the header rather than a payload: a decoder reading them at the wrong
      // offset returns floats either way, and only a stage that is actually
      // generating makes the right offset distinguishable from a neighbour.
      bassForge: {
        ...DSP_DEFAULTS.bassForge,
        enabled: true,
        subAmount: 1,
        presenceAmount: 1,
        mix: 1,
      },
      bassPunch: {
        ...DSP_DEFAULTS.bassPunch,
        enabled: true,
        attack: 1,
        sustain: -1,
        duck: 1,
      },
    }),
  );
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
  const withMaster = frames.filter(
    (frame) => frame.spectra.master !== undefined,
  );
  check(withEq.length > 0, 'the EQ tap reports a spectrum');
  check(withMaster.length > 0, 'the master tap reports a spectrum');

  const music = withMaster.at(-1)?.spectra.master;
  check(music?.length === 1024, 'a spectrum is the agreed 1024 bins');

  const musicPeak = music ? loudest(music) : -Infinity;
  console.log(`       loudest bin over music: ${musicPeak.toFixed(1)} dB`);
  check(musicPeak > -60, 'and it carries real programme, not a floor');

  const scoped = frames.filter((frame) => frame.scatter !== undefined);
  check(scoped.length > 0, 'the goniometer gets its sample pairs');
  /**
   * The loudest frame of the run, not the last one.
   *
   * Frames keep arriving for a moment after the render stops, and those carry
   * the silence that follows it — so reading the final frame was reading the
   * gap after the music and calling the meter broken.
   */
  const loudestFrame = frames.reduce(
    (best, frame) => (frame.peaks[0] > best.peaks[0] ? frame : best),
    frames[0],
  );
  const peaks = loudestFrame?.peaks ?? [0, 0];
  console.log(
    `       correlation ${(loudestFrame?.correlation ?? 0).toFixed(3)}, ` +
      `peaks ${peaks[0].toFixed(3)} / ${peaks[1].toFixed(3)}`,
  );
  check(peaks[0] > 0.001, 'and the peaks are the music, not zero');

  /**
   * The dynamic band's own activity, which nothing else in the panel can infer.
   *
   * The curve is drawn at full strength and its at-rest twin at zero, and
   * neither moves when the threshold does — so this reading IS the display.
   * Reported by the worklet until the worklet stopped processing, at which
   * point the threshold dial went dead while the band went on working.
   */
  const banded = frames.filter((frame) => frame.bandAmounts.length > 0);
  check(banded.length > 0, 'the bands report their activity');
  const amounts = banded.map((frame) => frame.bandAmounts[0]);
  const lowest = Math.min(...amounts);
  const highest = Math.max(...amounts);
  console.log(
    `       band amount ranged ${lowest.toFixed(3)} to ${highest.toFixed(3)} over ` +
      `${banded.length} frames`,
  );
  check(lowest >= 0 && highest <= 1.0001, 'the amount stays within 0 to 1');

  /**
   * And it MOVED, which is the whole claim.
   *
   * A band reporting a constant would satisfy every bound above — including a
   * band pinned at 1.0, which is exactly what a static rack reports and exactly
   * what a broken reading looks like.
   */
  check(
    highest - lowest > 0.01,
    'and it moves with the music rather than sitting at a constant',
  );

  /**
   * The exciter, which has no transfer curve for the panel to draw.
   *
   * A nonlinear stage cannot be shown from its settings — what it did depends
   * on the material — so the three band contributions and the organic mix are
   * measured and sent, exactly as the worklet used to send them. Computed in
   * the C++ and thrown away in a local until now, which is why the exciter's
   * lights sat still while the stage worked.
   */
  const exciterPeak = frames.reduce(
    (best, frame) => Math.max(best, ...frame.exciterBands),
    0,
  );
  const organicPeak = frames.reduce(
    (best, frame) => Math.max(best, frame.exciterOrganic),
    0,
  );
  console.log(
    `       exciter bands peaked at ${exciterPeak.toFixed(4)}, organic at ` +
      `${organicPeak.toFixed(4)}`,
  );
  check(exciterPeak > 0, 'the exciter bands report what they contributed');
  check(organicPeak > 0, 'and the organic stage reports its mix');

  /**
   * The two bass stages, which is the whole of the header this work grew.
   *
   * Everything above them travels on offsets that predate this branch, so a
   * mistake in the new fields cannot show up as a wrong number in an old one —
   * the frame's length is computed from its own header and refused unless it
   * matches exactly, so drift on either side goes dead rather than plausible.
   * That is precisely why these have to be checked here: a dead panel and a
   * panel nobody wired up look identical from the renderer.
   */
  const forgeGap = frames.reduce((best, frame) => {
    const gaps = frame.bassForge.outputDb.map(
      (level, band) => level - frame.bassForge.inputDb[band],
    );
    return Math.max(best, ...gaps);
  }, -Infinity);
  const forgeLoudest = frames.reduce(
    (best, frame) => Math.max(best, ...frame.bassForge.inputDb),
    -Infinity,
  );
  console.log(
    `       forge dry band peaked at ${forgeLoudest.toFixed(1)} dB, ` +
      `forged run stood ${forgeGap.toFixed(1)} dB above it`,
  );
  check(
    frames.every(
      (frame) =>
        frame.bassForge.inputDb.length === 8 &&
        frame.bassForge.outputDb.length === 8,
    ),
    'Forge sends eight bands of dry and eight of forged',
  );
  check(forgeLoudest > -60, 'the dry run carries programme, not a floor');
  // The stage's claim is that it MAKES low end. Two identical runs would mean
  // the same buffer measured twice, which is the shape this bug takes.
  check(forgeGap > 1, 'and the forged run stands above it where it generated');

  /**
   * Each lane on its own, because a maximum across the three hides a dead one.
   *
   * That is not a hypothetical either. The transient is a few milliseconds
   * wide and the frames arrive about a quarter as often as the blocks that
   * measure it, so a stored reading came through at exactly 0.0 dB in every
   * frame of a run where the same signal read 7.6 dB per block — and a check
   * on the maximum passed anyway, on the strength of the sustain beside it.
   */
  const punchReach = frames.reduce(
    (best, frame) => ({
      transient: Math.max(best.transient, Math.abs(frame.bassPunch.transientGainDb)),
      sustain: Math.max(best.sustain, Math.abs(frame.bassPunch.sustainGainDb)),
      duck: Math.max(best.duck, Math.abs(frame.bassPunch.duckGainDb)),
    }),
    { transient: 0, sustain: 0, duck: 0 },
  );
  console.log(
    `       punch reached transient ${punchReach.transient.toFixed(2)}, ` +
      `sustain ${punchReach.sustain.toFixed(2)}, ` +
      `duck ${punchReach.duck.toFixed(2)} dB`,
  );
  check(
    punchReach.transient > 0.1,
    'the attack lane survives being sampled at the frame rate',
  );
  check(punchReach.sustain > 0.1, 'the sustain lane reports its own gain');
  check(punchReach.duck > 0.1, 'and the duck lane reports what it pulled down');

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

  // The same control for Forge: with no deck loaded the stage still runs, and
  // its two runs have to fall to the floor rather than holding the last note.
  const forgePeakOverSilence = frames.reduce(
    (best, frame) => Math.max(best, ...frame.bassForge.inputDb),
    -Infinity,
  );
  const lastForge = frames.at(-1)?.bassForge.inputDb;
  const silentForge = lastForge ? Math.max(...lastForge) : -Infinity;
  console.log(
    `       forge dry band over silence: ${silentForge.toFixed(1)} dB ` +
      `(peak across the decay ${forgePeakOverSilence.toFixed(1)} dB)`,
  );
  check(
    silentForge < forgeLoudest - 30,
    'and Forge stops reporting a band it can no longer hear',
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
