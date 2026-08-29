/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A crossfade that is actually heard, rather than merely accepted.
 *
 * `smoke-playback` already checks that the host acknowledges the command, and
 * that check passed throughout the time the feature did not work — an ack says
 * the frame was understood, not that two decks mixed. Reported from the window
 * as "crossfade not working on native", which is exactly the gap between those
 * two statements.
 *
 * So this loads two decks with tones far enough apart to tell by spectrum
 * alone, fades between them, and measures how much of each is present at the
 * start, the middle and the end. A fade that did nothing leaves the first tone
 * at level throughout; a hard cut leaves no middle; a fade into a deck that has
 * not decoded yet leaves a hole. All three look identical in an ack.
 *
 * It also runs the fade the way the RENDERER drives it — load and fade in the
 * same breath, with no pause between — because that is the sequence the app
 * actually performs, and the difference between the two runs is the answer.
 *
 * Silent throughout: an offline render, no endpoint opened.
 */
import { spawnSync } from 'child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { findDspHostExecutable } from '../../src/main/dspHost/hostPath';
import { DspHostSupervisor } from '../../src/main/dspHost/supervisor';
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

const RATE = 48_000;
const LOW_HZ = 300;
const HIGH_HZ = 6_000;
const FADE_MS = 2_000;

/** A tone file, which is what makes the two decks tellable apart. */
const writeTone = (target: string, hz: number, seconds: number): boolean => {
  const result = spawnSync(
    'ffmpeg',
    ['-y', '-v', 'error', '-f', 'lavfi', '-i',
      `sine=frequency=${hz}:sample_rate=${RATE}:duration=${seconds}`,
      '-ac', '2', '-c:a', 'pcm_s16le', target],
    { windowsHide: true },
  );
  return result.status === 0 && existsSync(target);
};

/** The left channel of a 16-bit or float WAV, whichever it is. */
const readWavLeft = (file: string): Float32Array => {
  const bytes = readFileSync(file);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let at = 12;
  let dataAt = 0;
  let dataBytes = 0;
  let channels = 2;
  let format = 1;
  let bits = 16;
  while (at + 8 <= bytes.length) {
    const id = bytes.toString('ascii', at, at + 4);
    const size = view.getUint32(at + 4, true);
    if (id === 'fmt ') {
      format = view.getUint16(at + 8, true);
      channels = view.getUint16(at + 10, true);
      bits = view.getUint16(at + 22, true);
    } else if (id === 'data') {
      dataAt = at + 8;
      dataBytes = size;
      break;
    }
    at += 8 + size + (size % 2);
  }
  const width = bits / 8;
  const frames = Math.floor(dataBytes / (width * channels));
  const left = new Float32Array(frames);
  for (let frame = 0; frame < frames; frame += 1) {
    const offset = dataAt + frame * width * channels;
    left[frame] =
      format === 3
        ? view.getFloat32(offset, true)
        : view.getInt16(offset, true) / 32768;
  }
  return left;
};

const peakOf = (samples: Float32Array): number => {
  let peak = 0;
  for (let at = 0; at < samples.length; at += 1) {
    peak = Math.max(peak, Math.abs(samples[at]));
  }
  return peak;
};

/**
 * How much of `hz` is in `samples`, as a linear amplitude.
 *
 * A single-bin projection rather than a whole transform, taken over a whole
 * number of cycles so the window is exactly periodic — a partial cycle leaks
 * into every other bin and reports energy that is not there, which is the trap
 * that once made a -108 dB filter measure -39.
 */
const amountOf = (
  samples: Float32Array,
  from: number,
  span: number,
  hz: number,
): number => {
  const cycles = Math.floor((span * hz) / RATE);
  if (cycles < 1) {
    return 0;
  }
  const width = Math.round((cycles * RATE) / hz);
  let real = 0;
  let imaginary = 0;
  for (let at = 0; at < width; at += 1) {
    const phase = (2 * Math.PI * hz * at) / RATE;
    const sample = samples[from + at] ?? 0;
    real += sample * Math.cos(phase);
    imaginary += sample * Math.sin(phase);
  }
  return (2 * Math.hypot(real, imaginary)) / width;
};

interface IFadeResult {
  peak: number;
  lowEarly: number;
  highEarly: number;
  lowMiddle: number;
  highMiddle: number;
  lowLate: number;
  highLate: number;
}

/**
 * One fade, start to finish, on a host of its own.
 *
 * A fresh host per run rather than reusing decks, so the second measurement
 * cannot inherit a ring the first one filled — which is the very thing being
 * measured.
 */
const runFade = async (
  executablePath: string,
  lowFile: string,
  highFile: string,
  rendered: string,
  decodeWaitMs: number,
  renderSeconds: number,
): Promise<IFadeResult | undefined> => {
  const host = new DspHostSupervisor({
    executablePath,
    expectedParameterCount: NATIVE_DSP_PARAMETERS.length,
  });
  if (!(await host.start())) {
    return undefined;
  }
  // Flat: any processing would change the tones' levels and make this a
  // measurement of the chain rather than of the fade.
  await host.applyChain(
    encodeChainSettings({
      ...DSP_DEFAULTS,
      eq: { ...DSP_DEFAULTS.eq, enabled: false },
      master: { ...DSP_DEFAULTS.master, enabled: false },
    }),
  );
  await host.loadDeck(0, lowFile);
  await host.selectDeck(0);
  await host.setPlaying(true);
  // The OUTGOING deck always gets time to decode, in both runs. Only the
  // incoming one is the variable — otherwise the first moments are deck zero
  // filling its own ring and nothing to do with the fade.
  await sleep(600);
  await host.loadDeck(1, highFile);
  if (decodeWaitMs > 0) {
    await sleep(decodeWaitMs);
  }
  await host.crossfade(1, FADE_MS, 0);
  const ok = await host.renderToFile(RATE * renderSeconds, rendered);
  await host.stop();
  if (!ok) {
    return undefined;
  }

  const samples = readWavLeft(rendered);
  // Sampled well inside each third, so no window straddles the fade's ends.
  const window = Math.floor(RATE * 0.25);
  const early = Math.floor(RATE * 0.1);
  const middle = Math.floor(RATE * 1.0);
  // Measured near the end of whatever was rendered, so a longer run looks at
  // a later moment rather than the same one.
  const late = Math.floor(RATE * (renderSeconds - 0.5));
  return {
    peak: peakOf(samples),
    lowEarly: amountOf(samples, early, window, LOW_HZ),
    highEarly: amountOf(samples, early, window, HIGH_HZ),
    lowMiddle: amountOf(samples, middle, window, LOW_HZ),
    highMiddle: amountOf(samples, middle, window, HIGH_HZ),
    lowLate: amountOf(samples, late, window, LOW_HZ),
    highLate: amountOf(samples, late, window, HIGH_HZ),
  };
};

const report = (label: string, result: IFadeResult, level: number) => {
  const asFraction = (value: number) => (value / level).toFixed(2);
  console.log(
    `       ${label}: start ${asFraction(result.lowEarly)}/${asFraction(
      result.highEarly,
    )}  middle ${asFraction(result.lowMiddle)}/${asFraction(
      result.highMiddle,
    )}  end ${asFraction(result.lowLate)}/${asFraction(result.highLate)}`,
  );
};

const main = async (): Promise<void> => {
  const executablePath = findDspHostExecutable();
  if (!executablePath) {
    console.error('crossfade smoke: no host executable; run pnpm build first');
    process.exit(2);
  }

  const scratch = mkdtempSync(path.join(tmpdir(), 'fluideq-crossfade-'));
  const lowFile = path.join(scratch, 'low.wav');
  const highFile = path.join(scratch, 'high.wav');
  const rendered = path.join(scratch, 'out.wav');

  if (!writeTone(lowFile, LOW_HZ, 12) || !writeTone(highFile, HIGH_HZ, 12)) {
    console.log('crossfade smoke: no ffmpeg to build the tones, skipped');
    rmSync(scratch, { recursive: true, force: true });
    process.exit(0);
  }

  /**
   * The tones' own level, measured rather than assumed.
   *
   * ffmpeg's `sine` source is not full scale — it lands near 0.088 — and
   * thresholds written against 1.0 failed a crossfade that was in fact perfect:
   * the shape was textbook and every absolute number sat twenty decibels below
   * where the test was looking. Everything below is a fraction of this.
   */
  const level = peakOf(readWavLeft(lowFile));
  console.log('a crossfade, measured');
  console.log(`       source tones peak at ${level.toFixed(3)}`);
  check(level > 0.01, 'the tones carry signal at all');

  const waited = await runFade(
    executablePath, lowFile, highFile, rendered, 600, 3,
  );
  check(waited !== undefined, 'a fade runs with the incoming deck decoded');
  if (!waited) {
    rmSync(scratch, { recursive: true, force: true });
    process.exit(1);
  }
  report('decoded ', waited, level);

  check(waited.lowEarly > level * 0.5, 'the outgoing track plays at the start');
  check(waited.highEarly < waited.lowEarly * 0.5, 'and the incoming one has not begun');
  /**
   * Both present part-way through, which is the entire definition of a fade.
   *
   * A hard cut satisfies every other check here: it starts on one tone and ends
   * on the other, and only this moment tells the two apart.
   */
  check(
    waited.lowMiddle > level * 0.1 && waited.highMiddle > level * 0.1,
    'both tracks are audible together part-way through',
  );
  check(waited.highLate > level * 0.5, 'the incoming track plays at the end');
  check(waited.lowLate < waited.highLate * 0.5, 'and the outgoing one has gone');
  check(
    waited.peak > level * 0.5,
    'and the level holds rather than collapsing',
  );

  /**
   * Now the sequence the renderer actually performs.
   *
   * `createNativeMirror.crossfade` loads the incoming deck and issues the fade
   * with nothing in between — no wait, no check that anything has been decoded.
   * A deck's read-ahead ring is empty the moment it is loaded and the decoder
   * thread fills it in the background, so if that matters at all it shows up
   * here as a fade into silence while the ring catches up.
   *
   * If this passes, the host is not the problem and the fault is further up.
   * Either answer is worth having; guessing between them is not.
   */
  const immediate = await runFade(
    /**
     * Rendered for longer than the decoded run, deliberately.
     *
     * The fade is held until the incoming deck can supply a block, and in a
     * burst render the decoder thread competes with a loop producing audio far
     * faster than real time — so the wait is longer here than it would ever be
     * in playback. Three seconds was enough to see the hole was gone and not
     * always enough to see the fade finish, which made the completion check
     * flap. Eight gives it room without weakening what it asserts.
     */
    executablePath, lowFile, highFile, rendered, 0, 8,
  );
  check(immediate !== undefined, 'a fade runs with no decode pause at all');
  if (immediate) {
    report('immediate', immediate, level);
    /**
     * The regression guard, and it is about the HOLE rather than the timing.
     *
     * Before the player gated the fade on the incoming deck having audio, this
     * run measured 0.00/0.00 at the start and through the middle: the outgoing
     * track ducked away on schedule into a deck that had nothing to give. Now
     * the outgoing one simply keeps playing until there is something to fade
     * to, so at every moment SOMETHING is audible.
     *
     * The fade therefore starts later here than in the decoded run, and that is
     * the correct trade: a transition that begins a few blocks late is
     * inaudible, and one that begins into silence is the fault that was
     * reported.
     */
    check(
      immediate.lowEarly + immediate.highEarly > level * 0.5,
      'something is audible at the start rather than a hole',
    );
    check(
      immediate.lowMiddle + immediate.highMiddle > level * 0.5,
      'and part-way through, where the fade used to be mixing toward nothing',
    );
    check(
      immediate.highLate > level * 0.3,
      'and the incoming track does arrive',
    );
  }

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
  console.error('crossfade smoke failed', error);
  process.exit(1);
});
