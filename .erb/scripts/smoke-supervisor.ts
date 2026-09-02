/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The supervisor, against a real host process, outside Electron.
 *
 * Outside Electron on purpose: the supervisor is handed its executable rather
 * than looking it up, precisely so that the lifecycle can be exercised without
 * a window, a renderer or a packaged app in the way. The parts that do know
 * about Electron are in `hostPath.ts` and are four lines long.
 *
 * What is proven here cannot be proven by unit tests with a fake child: that a
 * handshake mismatch refuses rather than half-works, that a killed host is
 * reported once and brought back with its settings intact, and that a host
 * which will not stay up is eventually left alone.
 */
import { DspHostSupervisor } from '../../src/main/dspHost/supervisor';
import { findDspHostExecutable } from '../../src/main/dspHost/hostPath';
import { NATIVE_DSP_PARAMETERS } from '../../src/common/dsp/nativeParameters';
import { IDspDiagnosticEvent } from '../../src/common/dsp/diagnostics';
import {
  IHostAnalysis,
  IHostTelemetry,
} from '../../src/main/dspHost/wire';

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

/** Poll to a real deadline; these wait on a process doing genuine work. */
const waitFor = async (predicate: () => boolean, label: string) => {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (predicate()) {
      return true;
    }
    // eslint-disable-next-line no-await-in-loop -- polling is sequential.
    await sleep(10);
  }
  console.error(`supervisor smoke: gave up waiting for ${label}`);
  return false;
};

const PARAMETER_COUNT = NATIVE_DSP_PARAMETERS.length;

const main = async () => {
  const executablePath = findDspHostExecutable();
  console.log('discovery');
  check(executablePath !== undefined, `the host executable is found`);
  if (!executablePath) {
    process.exit(1);
  }

  const diagnostics: IDspDiagnosticEvent[] = [];
  const telemetry: IHostTelemetry[] = [];
  const analysis: IHostAnalysis[] = [];
  const states: string[] = [];

  const supervisor = new DspHostSupervisor({
    executablePath,
    expectedParameterCount: PARAMETER_COUNT,
    onDiagnostic: (event) => diagnostics.push(event),
    onTelemetry: (frame) => telemetry.push(frame),
    onAnalysis: (frame) => analysis.push(frame),
    onStateChange: (state) => states.push(state),
  });

  console.log('startup');
  check(await supervisor.start(), 'the host starts and hands over a handshake');
  check(supervisor.getState() === 'ready', 'the supervisor reports ready');
  check(
    supervisor.getHandshake()?.parameterCount === PARAMETER_COUNT,
    'the handshake agrees on the parameter table',
  );
  check(
    supervisor.getHandshake()?.backend === 'wasapi-shared',
    `the backend is reported (${supervisor.getHandshake()?.backend})`,
  );
  check(typeof supervisor.getPid() === 'number', 'the host pid is available');
  check(diagnostics.length === 0, 'a clean start reports no diagnostics');

  console.log('control');
  const values = NATIVE_DSP_PARAMETERS.map(() => 0);
  check(await supervisor.applySnapshot(values, 21), 'a snapshot applies');
  check(
    !(await supervisor.applySnapshot(values.slice(1), 22)),
    'a snapshot of the wrong length is refused before it is sent',
  );
  const gainId =
    NATIVE_DSP_PARAMETERS.find((p) => p.path === 'eq.bands[].gainDb')?.id ?? 0;
  const applied = await supervisor.setParameter(gainId, 2, -3.5, 23);
  check(applied.status === 0, 'a known parameter applies');
  const refused = await supervisor.setParameter(999999, undefined, 1, 24);
  check(refused.status === 1, 'an unknown parameter is refused');

  console.log('device');
  const deviceOpened = await supervisor.openDevice();
  /**
   * A machine with no sound card, which is a fact rather than a defect.
   *
   * The host answers UNSUPPORTED only when there is no render endpoint at
   * all — a device that exists and refuses still answers REJECTED and still
   * fails here. Everything below that does not need audio keeps running, which
   * is most of this script: the restart budget, the handshake refusal and the
   * orderly shutdown are supervisor behaviour and a build agent should still
   * be proving them.
   */
  const silentMachine = !deviceOpened && supervisor.noOutputEndpoint;
  if (silentMachine) {
    console.log('       no output endpoint on this machine; device skipped');
  } else {
    check(deviceOpened, 'the device opens through the supervisor');
  }
  // Both streams are produced by the device thread, so on a silent machine
  // they never arrive — measured, rather than assumed: with only the open and
  // close guarded, these four were the checks that failed and nothing else in
  // the script did.
  if (!silentMachine) {
    await waitFor(() => telemetry.length > 0, 'telemetry');
    check(telemetry.length > 0, 'telemetry reaches the supervisor');
    check(
      (telemetry[telemetry.length - 1]?.sampleRate ?? 0) >= 44100,
      `telemetry carries the negotiated rate (${telemetry[telemetry.length - 1]?.sampleRate})`,
    );
  }
  check(await supervisor.setAnalysis(true), 'analysis is enabled');
  if (!silentMachine) {
    await waitFor(() => analysis.length > 0, 'the first analysis frame');
    check(analysis.length > 0, 'analysis reaches the supervisor');
  }

  console.log('crash recovery');
  const before = supervisor.getPid();
  const analysisBeforeRestart = analysis.length;
  const diagnosticsBefore = diagnostics.length;
  process.kill(before ?? 0);
  await waitFor(
    () => supervisor.getState() === 'ready' && supervisor.getPid() !== before,
    'a replacement host',
  );
  check(supervisor.getState() === 'ready', 'a killed host is replaced');
  check(supervisor.getPid() !== before, 'the replacement is a new process');
  if (!silentMachine) {
    await waitFor(
      () => analysis.length > analysisBeforeRestart,
      'analysis from the replacement host',
    );
    check(
      analysis.length > analysisBeforeRestart,
      'the replacement restores the analysis stream',
    );
  }
  check(
    diagnostics
      .slice(diagnosticsBefore)
      .some((event) => event.code === 3003),
    'the exit is reported once as a diagnostic',
  );
  // The snapshot was re-sent by the supervisor, not by the caller. A host that
  // comes back flat looks exactly like an engine ignoring the panel.
  const afterRestart = await supervisor.setParameter(gainId, 2, -1.0, 25);
  check(afterRestart.status === 0, 'the replacement accepts commands');
  if (!silentMachine) {
    check(
      await supervisor.closeDevice(),
      'the device closes through the supervisor',
    );
  }

  console.log('restart budget');
  // Three restarts are allowed inside the window; the fourth exit gives up.
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const pid = supervisor.getPid();
    if (pid === undefined) {
      break;
    }
    process.kill(pid);
    // eslint-disable-next-line no-await-in-loop -- each kill must land first.
    await waitFor(
      () => supervisor.getPid() !== pid,
      `restart after kill ${attempt + 1}`,
    );
  }
  check(
    supervisor.getState() === 'failed',
    `a host that will not stay up is left alone (${supervisor.getState()})`,
  );
  check(
    diagnostics.some((event) => event.code === 3004),
    'the exhausted restart budget is reported',
  );
  const exhaustedReports = diagnostics.filter(
    (event) => event.code === 3004,
  ).length;
  check(exhaustedReports === 1, `it is reported once, not repeatedly (${exhaustedReports})`);

  let rejectedAfterFailure = false;
  try {
    await supervisor.setParameter(gainId, 0, 0, 26);
  } catch {
    rejectedAfterFailure = true;
  }
  check(rejectedAfterFailure, 'commands are refused once the host has failed');

  console.log('handshake mismatch');
  const mismatched = new DspHostSupervisor({
    executablePath,
    // A renderer from a different build, which agrees on enough to talk and
    // not enough to be right.
    expectedParameterCount: PARAMETER_COUNT + 1,
    onDiagnostic: (event) => diagnostics.push(event),
  });
  check(!(await mismatched.start()), 'a mismatched host is refused');
  check(
    mismatched.getState() === 'failed',
    'the supervisor reports the refusal as a failure',
  );
  check(
    diagnostics.some((event) => event.code === 3002),
    'the refusal names the handshake',
  );
  await mismatched.stop();

  console.log('orderly shutdown');
  const orderlyDiagnostics: IDspDiagnosticEvent[] = [];
  const orderly = new DspHostSupervisor({
    executablePath,
    expectedParameterCount: PARAMETER_COUNT,
    onDiagnostic: (event) => orderlyDiagnostics.push(event),
  });
  check(await orderly.start(), 'the host starts before an orderly shutdown');
  await orderly.stop();
  check(orderly.getState() === 'stopped', 'an orderly shutdown stays stopped');
  check(
    !orderlyDiagnostics.some((event) => event.code === 3003),
    'an orderly shutdown is not reported as a host crash',
  );

  console.log('overlapping stop and start');
  const overlapDiagnostics: IDspDiagnosticEvent[] = [];
  const overlap = new DspHostSupervisor({
    executablePath,
    expectedParameterCount: PARAMETER_COUNT,
    onDiagnostic: (event) => overlapDiagnostics.push(event),
  });
  check(await overlap.start(), 'the overlap host starts');
  const overlapBefore = overlap.getPid();
  const stopping = overlap.stop();
  check(
    await overlap.start(),
    'a replacement may start while the old host is still closing',
  );
  await stopping;
  check(
    overlap.getState() === 'ready' && overlap.getPid() !== overlapBefore,
    'the old clean exit does not clear or fail the replacement',
  );
  check(
    !overlapDiagnostics.some((event) => event.code === 3003),
    'the stale code-zero exit is not counted as a crash',
  );
  await overlap.stop();

  await supervisor.stop();

  if (failures === 0) {
    console.log(
      silentMachine
        ? '\nall checks passed — the device stream checks were skipped, no endpoint here'
        : '\nall checks passed',
    );
    process.exit(0);
  }
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
};

main().catch((error: unknown) => {
  console.error('supervisor smoke: unexpected failure', error);
  process.exit(1);
});
