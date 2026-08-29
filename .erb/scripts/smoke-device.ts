/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A real endpoint, held open, counted for dropouts.
 *
 * This is the gap every other check in the suite leaves. The parity fixtures
 * hold the native chain to the worklet sample for sample and `smoke-engines`
 * proves the two agree on real music, but both of them render offline into a
 * buffer, and a buffer is never late. A crackle is not a wrong sample — it is a
 * right sample that did not arrive in time, and nothing computed offline can
 * see one.
 *
 * So this opens the actual device, holds it, and reads what only the device
 * thread can know: how many periods went unserved, and how long the callback
 * took at its worst. Those are the two numbers a listener is really reporting
 * when they say it crackles.
 *
 * It runs SILENT on purpose. The host's diagnostic signal defaults to silence
 * and no deck is loaded, so nothing audible comes out of the machine this runs
 * on — the callback still fires on the device's own clock, still runs the whole
 * chain, and still has exactly as long to do it. What is being measured is
 * whether the work fits in the time, and that is unchanged by whether the
 * samples add up to music. A test that made noise every time somebody ran the
 * suite would be turned off, and then measure nothing at all.
 *
 * What it still cannot answer: whether the sound is CORRECT once it reaches the
 * speaker. Zero dropouts and a wrong channel map is silence in one ear, and
 * this would call it perfect. `smoke-engines` covers the samples, this covers
 * their timing, and between them what is left for ears is small and worth
 * saying out loud rather than implying.
 */
import { findDspHostExecutable } from '../../src/main/dspHost/hostPath';
import { DspHostSupervisor } from '../../src/main/dspHost/supervisor';
import { IHostTelemetry } from '../../src/main/dspHost/wire';
import { NATIVE_DSP_PARAMETERS } from '../../src/common/dsp/nativeParameters';
import { DSP_DEFAULTS, IEqSettings } from '../../src/common/dsp/chain';
import { encodeChainSettings } from '../../src/common/dsp/chainWire';
import { FilterTypeEnum } from '../../src/common/constants';

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

/** How long the endpoint is held. Long enough for a slow drift to show. */
const HOLD_MS = 6_000;

/**
 * A deliberately expensive rack, because an idle chain proves nothing.
 *
 * Sixteen bands, four of them dynamic, plus the exciter, compressor and
 * maximizer. If the callback is going to run out of time it will do it here
 * rather than on the defaults, and a machine that holds this holds anything the
 * panel can ask for.
 */
const heavySettings = () => ({
  ...DSP_DEFAULTS,
  eq: {
    ...DSP_DEFAULTS.eq,
    enabled: true,
    subsonicHz: 30,
    bands: Array.from({ length: 16 }, (unused, index) => ({
      enabled: true,
      dynamic: index % 4 === 0,
      thresholdDb: -24,
      type: FilterTypeEnum.PK,
      frequency: 40 * 1.45 ** index,
      gainDb: index % 2 === 0 ? 3 : -3,
      quality: 1.2,
    })) as unknown as IEqSettings['bands'],
  },
  exciter: { ...DSP_DEFAULTS.exciter, enabled: true },
  compressor: { ...DSP_DEFAULTS.compressor, enabled: true },
  maximizer: { ...DSP_DEFAULTS.maximizer, enabled: true },
});

const main = async (): Promise<void> => {
  const executablePath = findDspHostExecutable();
  if (!executablePath) {
    console.error('device smoke: no host executable; run pnpm build first');
    process.exit(2);
  }

  const reports: IHostTelemetry[] = [];
  const host = new DspHostSupervisor({
    executablePath,
    expectedParameterCount: NATIVE_DSP_PARAMETERS.length,
    onTelemetry: (telemetry) => reports.push(telemetry),
  });

  console.log('a real endpoint, held open');
  check(await host.start(), 'the host starts');

  const backend = host.getHandshake()?.backend ?? '';
  if (backend !== 'wasapi-shared') {
    // Not a failure. A platform with no device backend compiled in has nothing
    // to measure here, and saying so beats a red check nobody can act on.
    console.log(`       no device backend on this platform (${backend}),`);
    console.log('       skipped');
    await host.stop();
    process.exit(0);
  }

  // The chain before the device, the same order the app engages in.
  check(
    await host.applyChain(encodeChainSettings(heavySettings())),
    'the heavy chain is accepted',
  );
  check(await host.openDevice(), 'the endpoint opens');

  await sleep(HOLD_MS);

  const last = reports.at(-1);
  check(last !== undefined, 'the device thread reported telemetry');
  if (!last) {
    await host.stop();
    process.exit(1);
  }

  const { sampleRate, channels, framesProcessed, xruns, callbackP99Us } = last;
  const seconds = framesProcessed / Math.max(sampleRate, 1);
  console.log(
    `       ${sampleRate} Hz · ${channels} ch · ${seconds.toFixed(1)} s rendered · ` +
      `${reports.length} reports`,
  );

  /**
   * The device actually ran, which is what makes a zero meaningful.
   *
   * An endpoint that opened and never called back reports zero dropouts too,
   * and so does one that was closed a millisecond later. Requiring most of the
   * hold to have been rendered is the positive control for every check below:
   * it fails loudly in exactly the case where the others would pass blind.
   */
  check(
    seconds > (HOLD_MS / 1000) * 0.8,
    'the endpoint rendered in real time for the whole hold',
  );
  check(channels >= 2, 'the endpoint is at least stereo');

  /**
   * The number a listener is reporting when they say it crackles.
   *
   * Zero, not "few". A period that went unserved is an audible hole, and there
   * is no budget of them worth spending on a machine sitting idle.
   */
  console.log(
    `       ${xruns} dropout(s) · callback p99 ${callbackP99Us.toFixed(0)} us`,
  );
  check(xruns === 0, 'no device period went unserved');

  /**
   * And how close it came, because zero dropouts at 95% of the budget is a
   * machine about to start dropping and a number worth seeing before a user
   * finds it. The period is the device's own; a shared-mode endpoint at 48 kHz
   * is typically 10 ms, and the callback has that long to return.
   */
  const periodUs = (last.latencyFrames / Math.max(sampleRate, 1)) * 1e6;
  // Checked rather than skipped when it is missing. This whole comparison sat
  // behind an `if` and quietly did not run, because the device never reported
  // its buffer size — which is exactly the shape of the bug the null-test rule
  // is about: a check that passes by not happening.
  check(periodUs > 0, 'the device reported its buffer, so a budget exists');
  if (periodUs > 0) {
    const headroom = (callbackP99Us / periodUs) * 100;
    console.log(
      `       worst callback used ${headroom.toFixed(1)}% of the ` +
        `${periodUs.toFixed(0)} us period (${last.latencyFrames} frames)`,
    );
    check(headroom < 50, 'the worst callback fits in half its period');
  }

  /**
   * Opening an endpoint that is already open, which a reload does every time.
   *
   * Main owns the supervisor and does not reload with the window, so a fresh
   * renderer finds a host that is already up and asks it to start again. That
   * used to rebuild the engine, the chain and the player — while the render
   * thread was inside them, because `open` returns early on an endpoint it
   * already holds and never stops the callback. A use-after-free, and what it
   * looked like from the window was the native engine going silent after an
   * app reload with no error anywhere.
   *
   * The frames counter is what proves it: a host that had freed its player
   * would stop advancing, or stop existing.
   */
  const beforeRestart = reports.at(-1)?.framesProcessed ?? 0;
  check(await host.openDevice(), 'opening an already-open endpoint is accepted');
  await sleep(400);
  check(host.getState() === 'ready', 'and the host is still alive afterwards');
  const afterRestart = reports.at(-1)?.framesProcessed ?? 0;
  console.log(
    `       frames ${beforeRestart} -> ${afterRestart} across the second open`,
  );
  check(
    afterRestart > beforeRestart,
    'and still rendering, so nothing was freed under the callback',
  );

  check(await host.closeDevice(), 'the endpoint closes');
  await host.stop();

  if (failures > 0) {
    console.error(`\n${failures} check(s) failed`);
    process.exit(1);
  }
  console.log('\nall checks passed');
  // The supervisor's stdio handles outlive `stop()`; see `smoke-playback.ts`.
  process.exit(0);
};

main().catch((error: unknown) => {
  console.error('device smoke failed', error);
  process.exit(1);
});
