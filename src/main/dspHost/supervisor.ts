/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Electron main's ownership of the native host process.
 *
 * Main is the only side trusted with the executable, the media paths and the
 * device; the renderer asks main, and main asks the host. That boundary is the
 * reason the host has no endpoint to authenticate — its stdio belongs to its
 * parent and to nothing else on the machine.
 *
 * The policy that matters most here is what happens when the host dies. A
 * supervisor that restarts on every exit turns one reproducible crash into an
 * endless loop of them, burning CPU and filling a log with the same stack
 * while the user watches an app that never works. So: a bounded budget, a
 * single diagnostic, and then a stop. A failure that is reported once and left
 * alone can be fixed; a failure buried under nine hundred identical retries
 * cannot.
 */
import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import {
  DSP_DIAGNOSTIC_CODES,
  DSP_DIAGNOSTIC_SCHEMA_VERSION,
  IDspDiagnosticEvent,
  TDspDiagnosticCode,
} from '../../common/dsp/diagnostics';
import { FrameReader } from './transport';
import {
  HOST_COMMANDS,
  HOST_STATUS,
  HOST_WIRE_PROTOCOL_VERSION,
  IHostAck,
  IHostHandshake,
  IHostTelemetry,
  THostCommand,
  encodeCommand,
  encodeSnapshotPayload,
} from './wire';

export type TDspHostState = 'stopped' | 'starting' | 'ready' | 'failed';

export interface IDspHostOptions {
  executablePath: string;
  /** How many parameters this build of the renderer knows about. */
  expectedParameterCount: number;
  onTelemetry?: (telemetry: IHostTelemetry) => void;
  onDiagnostic?: (event: IDspDiagnosticEvent) => void;
  onStateChange?: (state: TDspHostState) => void;
}

/**
 * Real deadlines on a real pipe, not delays covering a race.
 *
 * Each one answers "how long before this is a hang rather than slow work".
 * The device one is longest because opening an endpoint is genuine hardware
 * negotiation and a busy machine can take a moment over it.
 */
const HANDSHAKE_DEADLINE_MS = 5_000;
const ACK_DEADLINE_MS = 5_000;
const SHUTDOWN_DEADLINE_MS = 2_000;

/**
 * Three restarts inside a minute, and then the supervisor stops trying.
 *
 * Chosen so that a transient fault — a device yanked mid-open, a driver
 * reloading — recovers without anybody noticing, while a host that cannot
 * start at all is reported once instead of forever.
 */
const RESTART_BUDGET = 3;
const RESTART_WINDOW_MS = 60_000;

/** Enough of the host's stderr to put in a bug report, and no more. */
const STDERR_TAIL_LINES = 50;

interface IPending {
  resolve: (ack: IHostAck) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

export class DspHostSupervisor {
  private child: ChildProcessWithoutNullStreams | undefined;

  private state: TDspHostState = 'stopped';

  private handshake: IHostHandshake | undefined;

  private nextRequestId = 1;

  private readonly pending = new Map<number, IPending>();

  private readonly stderrTail: string[] = [];

  private restartTimes: number[] = [];

  /** What to restore after a restart, so a crash is not also a reset. */
  private lastSnapshot: readonly number[] | undefined;

  private lastRevision = 0;

  private deviceWanted = false;

  /** Set once a fatal condition is reported, so it is reported only once. */
  private reportedFailure = false;

  private readonly options: IDspHostOptions;

  constructor(options: IDspHostOptions) {
    this.options = options;
  }

  getState(): TDspHostState {
    return this.state;
  }

  getHandshake(): IHostHandshake | undefined {
    return this.handshake;
  }

  /**
   * The running host's process id, for a support report.
   *
   * Which process was serving audio is not answerable after the fact from
   * anything else the app records, and a crash dump on the machine is only
   * matchable to a session by this number.
   */
  getPid(): number | undefined {
    return this.child?.pid;
  }

  /** The host's own stderr, kept apart from the renderer's log. */
  getStderrTail(): readonly string[] {
    return this.stderrTail;
  }

  async start(): Promise<boolean> {
    if (this.state === 'ready' || this.state === 'starting') {
      return this.state === 'ready';
    }
    this.reportedFailure = false;
    return this.spawnAndHandshake();
  }

  async stop(): Promise<void> {
    this.deviceWanted = false;
    const { child } = this;
    if (!child) {
      this.setState('stopped');
      return;
    }
    // Asked to leave before being made to. The host closes its endpoint on the
    // way out, and a killed process does not — which leaves the device held by
    // a process that no longer exists until Windows notices.
    if (this.state === 'ready') {
      try {
        await this.send(HOST_COMMANDS.shutdown, {});
      } catch {
        // It was already going. Nothing to add.
      }
    }
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        child.kill();
        resolve();
      }, SHUTDOWN_DEADLINE_MS);
      child.once('close', () => {
        clearTimeout(timer);
        resolve();
      });
    });
    this.child = undefined;
    this.setState('stopped');
  }

  async openDevice(): Promise<boolean> {
    this.deviceWanted = true;
    const ack = await this.send(HOST_COMMANDS.start, {});
    return ack.status === HOST_STATUS.applied;
  }

  async closeDevice(): Promise<boolean> {
    this.deviceWanted = false;
    const ack = await this.send(HOST_COMMANDS.stop, {});
    return ack.status === HOST_STATUS.applied;
  }

  /**
   * One complete, already-clamped chain, applied at a single block boundary.
   *
   * Held so a restart can restore it. A host that comes back with a flat chain
   * is indistinguishable, from the panel, from an engine ignoring every
   * setting on it.
   */
  async applySnapshot(
    values: readonly number[],
    revision: number,
  ): Promise<boolean> {
    if (values.length !== this.options.expectedParameterCount) {
      return false;
    }
    this.lastSnapshot = values;
    this.lastRevision = revision;
    const ack = await this.send(HOST_COMMANDS.applySnapshot, {
      settingsRevision: revision,
      parameterId: values.length,
      payload: encodeSnapshotPayload(values),
    });
    return ack.status === HOST_STATUS.applied;
  }

  async setParameter(
    parameterId: number,
    index: number | undefined,
    value: number,
    revision: number,
  ): Promise<IHostAck> {
    return this.send(HOST_COMMANDS.setParameter, {
      settingsRevision: revision,
      parameterId,
      parameterIndex: index,
      value,
    });
  }

  private setState(next: TDspHostState): void {
    if (this.state === next) {
      return;
    }
    this.state = next;
    this.options.onStateChange?.(next);
  }

  private report(
    code: TDspDiagnosticCode,
    values: Record<string, string | number | boolean | null>,
  ): void {
    this.options.onDiagnostic?.({
      schemaVersion: DSP_DIAGNOSTIC_SCHEMA_VERSION,
      code,
      severity: 'error',
      origin: 'native',
      values,
    });
  }

  /** Fatal, and said once. Later repetitions of the same fault stay quiet. */
  private fail(
    code: TDspDiagnosticCode,
    values: Record<string, string | number | boolean | null>,
  ): void {
    this.setState('failed');
    if (this.reportedFailure) {
      return;
    }
    this.reportedFailure = true;
    this.report(code, values);
  }

  private async spawnAndHandshake(): Promise<boolean> {
    this.setState('starting');
    let child: ChildProcessWithoutNullStreams;
    try {
      child = spawn(this.options.executablePath, [], {
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
      });
    } catch (error: unknown) {
      this.fail(DSP_DIAGNOSTIC_CODES.hostSpawnFailed, {
        path: this.options.executablePath,
        message: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
    this.child = child;

    const handshakeArrived = new Promise<IHostHandshake | undefined>(
      (resolve) => {
        const timer = setTimeout(
          () => resolve(undefined),
          HANDSHAKE_DEADLINE_MS,
        );
        const reader = new FrameReader({
          onHandshake: (handshake) => {
            clearTimeout(timer);
            resolve(handshake);
          },
          onAck: (ack) => this.settle(ack),
          onTelemetry: (telemetry) => this.options.onTelemetry?.(telemetry),
          onDesynchronised: (magic) => {
            clearTimeout(timer);
            this.fail(DSP_DIAGNOSTIC_CODES.hostStreamDesynchronised, {
              magic,
            });
            child.kill();
            resolve(undefined);
          },
        });
        child.stdout.on('data', (chunk: Buffer) => reader.push(chunk));
      },
    );

    child.stderr.on('data', (chunk: Buffer) => this.captureStderr(chunk));
    child.on('close', (code) => this.onExit(code ?? -1));
    child.on('error', (error: Error) => {
      this.fail(DSP_DIAGNOSTIC_CODES.hostSpawnFailed, {
        path: this.options.executablePath,
        message: error.message,
      });
    });

    const handshake = await handshakeArrived;
    if (!handshake) {
      if (this.state !== 'failed') {
        this.fail(DSP_DIAGNOSTIC_CODES.hostHandshakeRejected, {
          reason: 'no handshake before the deadline',
        });
      }
      child.kill();
      return false;
    }

    const mismatch = this.handshakeMismatch(handshake);
    if (mismatch) {
      // Refused outright rather than discovered later on an unknown command.
      // A host and a renderer from different builds agree on enough to talk
      // and not enough to be right, which is the worst of the two failures.
      this.fail(DSP_DIAGNOSTIC_CODES.hostHandshakeRejected, {
        reason: mismatch,
        hostProtocol: handshake.protocolVersion,
        hostParameters: handshake.parameterCount,
        expectedProtocol: HOST_WIRE_PROTOCOL_VERSION,
        expectedParameters: this.options.expectedParameterCount,
      });
      child.kill();
      return false;
    }

    this.handshake = handshake;
    this.setState('ready');
    return true;
  }

  private handshakeMismatch(handshake: IHostHandshake): string | undefined {
    if (handshake.protocolVersion !== HOST_WIRE_PROTOCOL_VERSION) {
      return 'protocol version';
    }
    if (handshake.parameterCount !== this.options.expectedParameterCount) {
      return 'parameter count';
    }
    return undefined;
  }

  private captureStderr(chunk: Buffer): void {
    const lines = chunk.toString('utf8').split(/\r?\n/).filter(Boolean);
    this.stderrTail.push(...lines);
    // Bounded, because a host looping on a device error can produce a great
    // deal of it and main is not where a log file belongs.
    while (this.stderrTail.length > STDERR_TAIL_LINES) {
      this.stderrTail.shift();
    }
  }

  private settle(ack: IHostAck): void {
    const waiting = this.pending.get(ack.requestId);
    if (!waiting) {
      // A reply to a request from a previous host, arriving after a restart.
      // Dropped: applying it would act on state the new host has never seen.
      return;
    }
    clearTimeout(waiting.timer);
    this.pending.delete(ack.requestId);
    waiting.resolve(ack);
  }

  private onExit(code: number): void {
    this.child = undefined;
    this.pending.forEach((waiting) => {
      clearTimeout(waiting.timer);
      waiting.reject(new Error('the DSP host exited'));
    });
    this.pending.clear();

    if (this.state === 'stopped' || this.state === 'failed') {
      return;
    }

    this.report(DSP_DIAGNOSTIC_CODES.hostExited, { code });

    const now = Date.now();
    this.restartTimes = this.restartTimes.filter(
      (at) => now - at < RESTART_WINDOW_MS,
    );
    if (this.restartTimes.length >= RESTART_BUDGET) {
      this.fail(DSP_DIAGNOSTIC_CODES.hostRestartBudgetExhausted, {
        attempts: this.restartTimes.length,
        windowMs: RESTART_WINDOW_MS,
      });
      return;
    }
    this.restartTimes.push(now);
    // Caught rather than discarded: `restore` reopens a device, and a rejection
    // there is the difference between a host that came back silent and one
    // that came back working. The failure is already reported by whatever threw.
    this.restore().catch(() => undefined);
  }

  /** Bring a replacement host back to where the last one was. */
  private async restore(): Promise<void> {
    if (!(await this.spawnAndHandshake())) {
      return;
    }
    if (this.lastSnapshot) {
      await this.applySnapshot(this.lastSnapshot, this.lastRevision);
    }
    if (this.deviceWanted) {
      await this.openDevice();
    }
  }

  private send(
    command: THostCommand,
    request: {
      settingsRevision?: number;
      parameterId?: number;
      parameterIndex?: number;
      value?: number;
      payload?: Buffer;
    },
  ): Promise<IHostAck> {
    const { child } = this;
    if (!child || this.state === 'failed') {
      // Nothing is queued for a host that is not there. A command held for a
      // process that may never return is a command that arrives at the wrong
      // moment if it ever does.
      return Promise.reject(new Error('the DSP host is not running'));
    }
    const requestId = this.nextRequestId;
    this.nextRequestId += 1;

    return new Promise<IHostAck>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        reject(new Error(`the DSP host did not answer request ${requestId}`));
      }, ACK_DEADLINE_MS);
      this.pending.set(requestId, { resolve, reject, timer });

      child.stdin.write(
        encodeCommand({
          command,
          requestId,
          settingsRevision: request.settingsRevision,
          parameterId: request.parameterId,
          parameterIndex: request.parameterIndex,
          value: request.value,
        }),
      );
      if (request.payload) {
        // Written immediately after its frame and never interleaved with
        // another command: the host reads exactly this many bytes next.
        child.stdin.write(request.payload);
      }
    });
  }
}
