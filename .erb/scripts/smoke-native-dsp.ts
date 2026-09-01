/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Drive the real host process the way Electron main will.
 *
 * The C++ unit tests prove the engine; this proves the pipe. They are separate
 * runs on purpose — a transport and an engine debugged together give every
 * failure two possible homes, and the frame layouts are written twice (once in
 * C, once in TypeScript) precisely where a silent mismatch would produce
 * plausible-looking garbage rather than an error.
 */
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';
import {
  HOST_COMMANDS,
  HOST_STATUS,
  HOST_WIRE_PROTOCOL_VERSION,
  IHostTelemetry,
  decodeAck,
  decodeHandshake,
  decodeTelemetry,
  encodeCommand,
  encodeSnapshotPayload,
  frameLengthFor,
} from '../../src/main/dspHost/wire';
import { NATIVE_DSP_PARAMETERS } from '../../src/common/dsp/nativeParameters';

const ROOT = path.join(__dirname, '..', '..');
const HOST = path.join(
  ROOT,
  'native',
  '.build',
  'bin',
  process.platform === 'win32' ? 'FluidEQ-DSP.exe' : 'FluidEQ-DSP',
);

let failures = 0;
const check = (condition: boolean, what: string) => {
  console.log(`  ${condition ? 'ok  ' : 'FAIL'} ${what}`);
  if (!condition) {
    failures += 1;
  }
};

const main = async () => {
  if (!existsSync(HOST)) {
    console.error(`smoke: host not built at ${HOST}`);
    process.exit(1);
  }

  const host = spawn(HOST, [], { stdio: ['pipe', 'pipe', 'inherit'] });
  const acks: ReturnType<typeof decodeAck>[] = [];
  const telemetry: IHostTelemetry[] = [];
  let handshake: ReturnType<typeof decodeHandshake>;
  let desynchronised = false;

  let pending = Buffer.alloc(0);
  host.stdout.on('data', (chunk: Buffer) => {
    pending = Buffer.concat([pending, chunk]);
    // Length is discovered from the magic rather than assumed, because four
    // frame kinds of four different sizes share this stream.
    for (;;) {
      if (pending.length < 4) {
        return;
      }
      const magic = pending.readUInt32LE(0);
      const length = frameLengthFor(magic);
      if (length === 0) {
        desynchronised = true;
        return;
      }
      if (pending.length < length) {
        return;
      }
      const frame = pending.subarray(0, length);
      pending = pending.subarray(length);
      if (magic === 0x48514546) {
        handshake = decodeHandshake(frame);
      } else if (magic === 0x41514546) {
        acks.push(decodeAck(frame));
      } else if (magic === 0x54514546) {
        // Named rather than reached by falling through everything else: the
        // stats frame joined this stream and a decoder handed the wrong kind
        // returns undefined, so an `else` would have dropped telemetry
        // silently for whichever frame arrived next.
        const record = decodeTelemetry(frame);
        if (record) {
          telemetry.push(record);
        }
      }
    }
  });

  const exited = new Promise<number>((resolve) => {
    host.on('close', (code) => resolve(code ?? -1));
  });

  const sleep = (ms: number) =>
    new Promise<void>((resolve) => {
      setTimeout(resolve, ms);
    });

  /**
   * Bounded by a real deadline, because some of these wait on real work.
   *
   * An earlier version spun on `setImmediate` for a fixed number of attempts,
   * on the reasoning that a local pipe either answers or is dead. That held
   * while every command was answered from memory in microseconds. Opening a
   * WASAPI endpoint is tens of milliseconds of device negotiation, so the spin
   * exhausted itself before the first period and reported the device as
   * broken. Five seconds is not a delay hiding a race — it is longer than any
   * endpoint takes and shorter than anyone will wait for a hang.
   */
  const waitFor = async (predicate: () => boolean, label: string) => {
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      if (predicate()) {
        return true;
      }
      // eslint-disable-next-line no-await-in-loop -- polling is sequential.
      await sleep(5);
    }
    console.error(`smoke: gave up waiting for ${label}`);
    return false;
  };

  console.log('handshake');
  await waitFor(() => handshake !== undefined, 'handshake');
  check(handshake !== undefined, 'the host announces itself unprompted');
  check(
    handshake?.protocolVersion === HOST_WIRE_PROTOCOL_VERSION,
    `protocol version is ${HOST_WIRE_PROTOCOL_VERSION}`,
  );
  check(
    handshake?.parameterCount === NATIVE_DSP_PARAMETERS.length,
    `the host knows the same ${NATIVE_DSP_PARAMETERS.length} parameters as the renderer`,
  );
  check(
    (handshake?.coreVersion.length ?? 0) > 0,
    `core version is reported (${handshake?.coreVersion})`,
  );
  check(
    handshake?.architecture === 'x64' || handshake?.architecture === 'arm64',
    `architecture is reported (${handshake?.architecture})`,
  );

  console.log('control');
  host.stdin.write(
    encodeCommand({ command: HOST_COMMANDS.hello, requestId: 1 }),
  );
  await waitFor(() => acks.length >= 1, 'hello ack');
  check(acks[0]?.requestId === 1, 'an ack carries back its request id');
  check(acks[0]?.status === HOST_STATUS.applied, 'hello is applied');

  const gainId = NATIVE_DSP_PARAMETERS.find(
    (parameter) => parameter.path === 'eq.bands[].gainDb',
  )?.id;
  host.stdin.write(
    encodeCommand({
      command: HOST_COMMANDS.setParameter,
      requestId: 2,
      settingsRevision: 5,
      parameterId: gainId,
      parameterIndex: 3,
      value: -4.5,
    }),
  );
  await waitFor(() => acks.length >= 2, 'parameter ack');
  check(acks[1]?.status === HOST_STATUS.applied, 'a known parameter applies');
  check(acks[1]?.acceptedRevision === 5, 'the revision comes back');

  host.stdin.write(
    encodeCommand({
      command: HOST_COMMANDS.setParameter,
      requestId: 3,
      settingsRevision: 6,
      parameterId: 999999,
      value: 1,
    }),
  );
  await waitFor(() => acks.length >= 3, 'unknown parameter ack');
  check(
    acks[2]?.status === HOST_STATUS.rejected,
    'an unknown parameter id is refused rather than silently applied',
  );

  console.log('snapshot');
  const values = NATIVE_DSP_PARAMETERS.map(() => 0);
  host.stdin.write(
    encodeCommand({
      command: HOST_COMMANDS.applySnapshot,
      requestId: 4,
      settingsRevision: 11,
      parameterId: values.length,
    }),
  );
  host.stdin.write(encodeSnapshotPayload(values));
  await waitFor(() => acks.length >= 4, 'snapshot ack');
  check(acks[3]?.status === HOST_STATUS.applied, 'a full snapshot applies');

  console.log('telemetry');
  /**
   * Few enough blocks to fit the engine's telemetry ring.
   *
   * The engine reports roughly forty times a second of rendered audio and the
   * ring holds thirty-two records. An offline render is not paced by a device,
   * so it completes in microseconds and can push far more than that before
   * anything drains — at which point the drop counter is measuring the test's
   * own impatience rather than the engine.
   */
  host.stdin.write(
    encodeCommand({
      command: HOST_COMMANDS.runOfflineBlocks,
      requestId: 5,
      settingsRevision: 11,
      parameterId: 30,
    }),
  );
  await waitFor(() => acks.length >= 5, 'offline render ack');
  // Telemetry is drained by the host's own thread now, so it arrives shortly
  // after the ack rather than with it.
  await waitFor(() => telemetry.length > 0, 'offline telemetry');
  check(telemetry.length > 0, 'telemetry frames arrive from a real render');
  const last = telemetry[telemetry.length - 1];
  check(last?.appliedRevision === 11, 'telemetry reports the applied revision');
  check(last?.framesProcessed > 0, 'telemetry counts frames');
  check(last?.xruns === 0, 'an offline render reports no underruns');
  check(last?.drops === 0, 'no telemetry was dropped');
  check(
    last !== undefined && last.callbackP99Us >= last.callbackP50Us,
    `callback p99 (${last?.callbackP99Us}us) is at or above p50 (${last?.callbackP50Us}us)`,
  );

  console.log('device');
  const telemetryBefore = telemetry.length;
  host.stdin.write(
    encodeCommand({
      command: HOST_COMMANDS.start,
      requestId: 7,
      settingsRevision: 11,
    }),
  );
  await waitFor(() => acks.length >= 6, 'device start ack');
  const started = acks[5]?.status === HOST_STATUS.applied;
  check(started, 'the output endpoint opens');

  if (started) {
    check(
      handshake?.backend === 'wasapi-shared',
      `the compiled backend is reported (${handshake?.backend})`,
    );
    const negotiatedRate = acks[5]?.sanitizedValue ?? 0;
    check(
      negotiatedRate >= 44100,
      `the device negotiated a real rate (${negotiatedRate} Hz)`,
    );

    // Let the endpoint actually serve periods. This is a device running in
    // real time, so the wait is the thing being measured rather than a delay
    // covering a race — a shorter one would report "no underruns" having
    // given the device no chance to have any.
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 750);
    });

    const live = telemetry.slice(telemetryBefore);
    check(live.length > 0, `telemetry arrives while the device runs (${live.length} frames)`);
    const latest = live[live.length - 1];
    check(
      latest?.sampleRate === negotiatedRate,
      'telemetry reports the negotiated rate, not the requested one',
    );
    check((latest?.channels ?? 0) >= 1, `channels reported (${latest?.channels})`);
    check(latest?.xruns === 0, `no underruns in 750ms (${latest?.xruns})`);
    check(
      latest?.peak[0] === 0 && latest?.peak[1] === 0,
      'the default signal is silence — this test makes no sound',
    );
    check(
      latest !== undefined && latest.callbackP99Us > 0,
      `the callback was timed (p99 ${latest?.callbackP99Us}us)`,
    );

    host.stdin.write(
      encodeCommand({ command: HOST_COMMANDS.stop, requestId: 8 }),
    );
    await waitFor(() => acks.length >= 7, 'device stop ack');
    check(
      acks[6]?.status === HOST_STATUS.applied,
      'the endpoint is released rather than held open',
    );
  }

  console.log('shutdown');
  host.stdin.write(
    encodeCommand({ command: HOST_COMMANDS.shutdown, requestId: 9 }),
  );
  const code = await exited;
  check(code === 0, 'the host exits cleanly when asked');
  check(!desynchronised, 'the frame stream never desynchronised');

  if (failures === 0) {
    console.log('\nall checks passed');
    process.exit(0);
  }
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
};

main().catch((error: unknown) => {
  console.error('smoke: unexpected failure', error);
  process.exit(1);
});
