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
import { ANALYSIS_HEADER_BYTES } from '../../common/dsp/analysisWire';
import {
  DSP_DIAGNOSTIC_CODES,
  DSP_DIAGNOSTIC_SCHEMA_VERSION,
  IDspDiagnosticEvent,
  TDspDiagnosticValue,
  TDspDiagnosticSeverity,
  TDspDiagnosticCode,
} from '../../common/dsp/diagnostics';
import { FrameReader } from './transport';
import {
  HOST_COMMANDS,
  encodeChainPayload,
  encodeNoiseProfilePayload,
  encodeCrossfadeTablePayload,
  encodeTrackGainsPayload,
  HOST_STATUS,
  HOST_WIRE_PROTOCOL_VERSION,
  IHostAck,
  IHostHandshake,
  IHostAnalysis,
  IHostStats,
  IHostTelemetry,
  THostCommand,
  encodeCommand,
  encodeSnapshotPayload,
} from './wire';

export type TDspHostState = 'stopped' | 'starting' | 'ready' | 'failed';

export interface IDspHostLifecycleEvent {
  event: string;
  values: Readonly<Record<string, TDspDiagnosticValue>>;
}

export interface IDspHostOptions {
  executablePath: string;
  /** How many parameters this build of the renderer knows about. */
  expectedParameterCount: number;
  onTelemetry?: (telemetry: IHostTelemetry) => void;
  /** Only ever set while a renderer has the DSP panel open. */
  onAnalysis?: (analysis: IHostAnalysis) => void;
  onDiagnostic?: (event: IDspDiagnosticEvent) => void;
  onStateChange?: (state: TDspHostState) => void;
  /** Structured process-boundary evidence written by Electron main. */
  onLifecycle?: (event: IDspHostLifecycleEvent) => void;
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
  child: ChildProcessWithoutNullStreams;
}

interface IChildLifecycle {
  generation: number;
  startedAt: number;
  analysisFrames: number;
  lastAnalysisAt: number;
  shutdownRequested: boolean;
}

export class DspHostSupervisor {
  private child: ChildProcessWithoutNullStreams | undefined;

  private state: TDspHostState = 'stopped';

  /**
   * The spawn currently handshaking, so concurrent callers share one answer
   * rather than one of them mistaking it for a failure. See `start`.
   */
  private starting: Promise<boolean> | undefined;

  private handshake: IHostHandshake | undefined;

  private nextRequestId = 1;

  private readonly pending = new Map<number, IPending>();

  private readonly stderrTail: string[] = [];

  /** A pipe chunk is not guaranteed to end at a line boundary. */
  private readonly stderrRemainders = new WeakMap<
    ChildProcessWithoutNullStreams,
    string
  >();

  /** Identity is per process, so a late exit cannot be mistaken for the new one. */
  private readonly childLifecycles = new WeakMap<
    ChildProcessWithoutNullStreams,
    IChildLifecycle
  >();

  private generation = 0;

  /**
   * The host's own memory and CPU, cleared with the process it described.
   *
   * A restart replaces the process, and the figures from the one that died
   * describe nothing that exists — showing them would put a stale number in
   * the one column somebody is watching for a change.
   */
  private stats: IHostStats | undefined;

  private restartTimes: number[] = [];

  /** What to restore after a restart, so a crash is not also a reset. */
  private lastSnapshot: readonly number[] | undefined;

  private lastRevision = 0;

  /** The whole chain, restored after a restart alongside the snapshot. */
  private lastChain: readonly number[] | undefined;

  private lastNoiseProfile: readonly number[] | undefined;

  private lastVoiceModel: readonly [string, string] | undefined;

  private deviceWanted = false;

  /** Restored after an unexpected restart, just like the chain and device. */
  private analysisWanted = false;

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

  /**
   * What the host process costs, or undefined before its first sample.
   *
   * Undefined and not zero: the app's process list draws a dash for a figure
   * it does not have, and a zero here would draw a measured zero for a process
   * that is plainly running.
   */
  getStats(): IHostStats | undefined {
    return this.stats;
  }

  /** The host's own stderr, kept apart from the renderer's log. */
  getStderrTail(): readonly string[] {
    return this.stderrTail;
  }

  /**
   * The host, started once however many callers ask at once.
   *
   * A SECOND CALLER ARRIVING DURING A STARTUP USED TO BE TOLD "NOT READY", and
   * that one word is what made every fast track change a process churn. The
   * check returned `this.state === 'ready'`, which is `false` while a spawn is
   * still handshaking — so the caller read a healthy, half-open host as a
   * failure, and `engage` answers a failed start by calling `stop`. The
   * incoming controller therefore killed the very process it had just asked
   * for, then started another, which the next change killed in turn.
   *
   * From the app's own lifecycle trace, on an ordinary track change:
   *
   *   start-requested        the incoming controller
   *   start-reused           handed the outgoing one's process — and told false
   *   device-open-requested
   *   stop-requested         the loser tearing down the shared host
   *   device-open-complete   state=stopped
   *
   * The open still acked, from a process already shutting down, so the panel
   * read ON over an engine that was gone. Two symptoms come out of this one
   * line: engines multiplying, and the elements handed the audio back mid-flight
   * so the same track plays twice a few milliseconds apart — which is a comb
   * filter, and is heard as the bass going out of the music.
   *
   * So a caller that arrives mid-startup now WAITS for that startup and gets
   * its real answer. One in-flight promise, shared: the supervisor owns one
   * process and callers are told about that one process.
   */
  async start(): Promise<boolean> {
    this.trace('start-requested');
    if (this.state === 'ready') {
      this.trace('start-reused');
      return true;
    }
    if (this.starting) {
      // Not a second spawn — the same one, awaited. Whatever it resolves to is
      // the truth for every caller holding it.
      this.trace('start-joined');
      return this.starting;
    }
    this.reportedFailure = false;
    const pending = this.spawnAndHandshake();
    this.starting = pending;
    try {
      return await pending;
    } finally {
      // Cleared only if it is still ours: a `stop` and a fresh `start` can both
      // have happened while this one was in flight.
      if (this.starting === pending) {
        this.starting = undefined;
      }
    }
  }

  async stop(): Promise<void> {
    this.deviceWanted = false;
    /**
     * A startup this stop supersedes is no longer anybody's answer.
     *
     * Left in place, the next `start` would join a handshake for a process this
     * call is in the middle of killing, and be told `true` about an engine that
     * is already gone. The in-flight spawn still finishes and still cleans up
     * after itself — `spawnAndHandshake` owns that — this only stops it being
     * handed to a caller who asked after the stop.
     */
    this.starting = undefined;
    const { child } = this;
    if (!child) {
      this.setState('stopped');
      this.trace('stop-complete', undefined, { reason: 'no-child' });
      return;
    }
    const lifecycle = this.childLifecycles.get(child);
    if (lifecycle) {
      lifecycle.shutdownRequested = true;
    }
    this.trace('stop-requested', child);
    /**
     * Mark the exit as intentional before asking for it.
     *
     * The child closes between the shutdown acknowledgement and the promise
     * below resolving. Setting `stopped` afterwards let `onExit` see `ready`,
     * report a clean code-zero shutdown as a host crash, and start a replacement
     * while the renderer was tearing the engine down. That replacement then
     * lost the race with this method's final state write and left the DSP panel
     * reporting a failed engine. `send` permits commands in `stopped`, so the
     * polite shutdown still reaches the child while `onExit` can now identify
     * it correctly.
     */
    this.setState('stopped');
    // Asked to leave before being made to. The host closes its endpoint on the
    // way out, and a killed process does not — which leaves the device held by
    // a process that no longer exists until Windows notices.
    try {
      await this.send(HOST_COMMANDS.shutdown, {});
      this.trace('shutdown-acknowledged', child);
    } catch {
      this.trace('shutdown-command-failed', child);
    }
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        this.trace('shutdown-force-kill', child);
        child.kill();
        resolve();
      }, SHUTDOWN_DEADLINE_MS);
      child.once('close', () => {
        clearTimeout(timer);
        resolve();
      });
    });
    if (this.child === child) {
      this.child = undefined;
      this.stats = undefined;
    }
    this.trace('stop-complete', child);
  }

  async openDevice(): Promise<boolean> {
    this.deviceWanted = true;
    this.trace('device-open-requested');
    try {
      const ack = await this.send(HOST_COMMANDS.start, {});
      const applied = ack.status === HOST_STATUS.applied;
      this.trace('device-open-complete', undefined, {
        applied,
        sampleRate: ack.sanitizedValue,
      });
      return applied;
    } catch (error: unknown) {
      this.trace('device-open-failed', undefined, {
        message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async closeDevice(): Promise<boolean> {
    this.deviceWanted = false;
    this.trace('device-close-requested');
    try {
      const ack = await this.send(HOST_COMMANDS.stop, {});
      const applied = ack.status === HOST_STATUS.applied;
      this.trace('device-close-complete', undefined, { applied });
      return applied;
    } catch (error: unknown) {
      this.trace('device-close-failed', undefined, {
        message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
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

  /**
   * The whole chain, bands included, held so a restart can restore it.
   *
   * Separate from `applySnapshot` because they carry different things. The
   * snapshot is the flat parameter table: scalars addressed by a permanent
   * id, which is what one dragged control needs. This is the arrays too, and
   * a flat list of scalars cannot hold sixty-four bands without inventing an
   * indexing scheme both sides would then have to agree about forever.
   */
  async applyChain(values: readonly number[]): Promise<boolean> {
    this.lastChain = values;
    const ack = await this.send(HOST_COMMANDS.applyChain, {
      parameterId: values.length,
      payload: encodeChainPayload(values),
    });
    return ack.status === HOST_STATUS.applied;
  }

  /**
   * The measured floor for the track now playing, or undefined to clear it.
   *
   * Remembered for the same reason the chain is: a host that restarts mid-track
   * is handed the settings again, and a profile that was not replayed would
   * leave Denoise silently following the live floor on a track it had already
   * measured — a stage quietly doing something other than what the card says.
   */
  async setNoiseProfile(
    values: readonly number[] | undefined,
  ): Promise<boolean> {
    this.lastNoiseProfile = values;
    const ack = await this.send(HOST_COMMANDS.setNoiseProfile, {
      parameterId: values ? values.length : 0,
      payload: values ? encodeNoiseProfilePayload(values) : undefined,
    });
    return ack.status === HOST_STATUS.applied;
  }

  /**
   * Point the voice module at a model and a runtime, or clear both.
   *
   * Remembered and replayed for the same reason the chain and the profile are:
   * a host that restarts would otherwise come back with the module silently
   * unloaded while the card still shows it as ready.
   */
  async loadVoiceModel(
    modelPath: string | undefined,
    runtimePath: string | undefined,
  ): Promise<boolean> {
    this.lastVoiceModel =
      modelPath && runtimePath ? [modelPath, runtimePath] : undefined;
    const payload = this.lastVoiceModel
      ? Buffer.from(this.lastVoiceModel.join('\n'), 'utf8')
      : undefined;
    const ack = await this.send(HOST_COMMANDS.loadVoiceModel, {
      // Byte length, not character count: a path with an accent in it is
      // longer in UTF-8 than in JavaScript, and the host reads bytes.
      parameterId: payload ? payload.byteLength : 0,
      payload,
    });
    return ack.status === HOST_STATUS.applied;
  }

  async loadDeck(deck: number, path: string): Promise<boolean> {
    const payload = Buffer.from(path, 'utf8');
    const ack = await this.send(HOST_COMMANDS.loadDeck, {
      parameterIndex: deck,
      // Byte length, not character count: a path with an accent in it is
      // longer in UTF-8 than in JavaScript, and the host reads bytes.
      parameterId: payload.byteLength,
      payload,
    });
    return ack.status === HOST_STATUS.applied;
  }

  /**
   * Drive the render callback without a device, `blocks` times.
   *
   * The same path a device would drive, which is what makes it worth having:
   * an offline export and the end-to-end smoke test both need the whole chain
   * to run somewhere a machine with its headphones unplugged still counts.
   */
  async runOfflineBlocks(blocks: number): Promise<boolean> {
    const ack = await this.send(HOST_COMMANDS.runOfflineBlocks, {
      parameterId: blocks,
    });
    return ack.status === HOST_STATUS.applied;
  }

  /**
   * Render `frames` from the loaded deck to a 32-bit float WAV.
   *
   * The export path, and the only way to ask whether the two engines agree on
   * a real song and get an answer in samples rather than in an opinion.
   */
  async renderToFile(frames: number, target: string): Promise<boolean> {
    const payload = Buffer.from(target, 'utf8');
    const ack = await this.send(HOST_COMMANDS.renderToFile, {
      parameterIndex: 0,
      parameterId: frames,
      // Byte length, not character count: the host reads bytes, and a path
      // with an accent in it is longer in UTF-8 than in JavaScript.
      value: payload.byteLength,
      payload,
    });
    return ack.status === HOST_STATUS.applied;
  }

  async unloadDeck(deck: number): Promise<boolean> {
    const ack = await this.send(HOST_COMMANDS.unloadDeck, {
      parameterIndex: deck,
    });
    return ack.status === HOST_STATUS.applied;
  }

  async setPlaying(playing: boolean): Promise<boolean> {
    const ack = await this.send(HOST_COMMANDS.setPlaying, {
      parameterId: playing ? 1 : 0,
    });
    return ack.status === HOST_STATUS.applied;
  }

  async seekDeck(deck: number, seconds: number): Promise<boolean> {
    const ack = await this.send(HOST_COMMANDS.seekDeck, {
      parameterIndex: deck,
      value: seconds,
    });
    return ack.status === HOST_STATUS.applied;
  }

  async selectDeck(deck: number): Promise<boolean> {
    const ack = await this.send(HOST_COMMANDS.selectDeck, {
      parameterIndex: deck,
    });
    return ack.status === HOST_STATUS.applied;
  }

  async crossfade(
    toDeck: number,
    durationMs: number,
    curveIndex: number,
  ): Promise<boolean> {
    const ack = await this.send(HOST_COMMANDS.crossfade, {
      parameterIndex: toDeck,
      parameterId: curveIndex,
      value: durationMs,
    });
    return ack.status === HOST_STATUS.applied;
  }

  /**
   * The Custom curve's sampled shape, ahead of the fade that uses it.
   *
   * The host holds it pending and promotes it when a fade starts, so this is
   * never racing the mixer for the table it is reading.
   */
  async setCrossfadeTable(values: readonly number[]): Promise<boolean> {
    const ack = await this.send(HOST_COMMANDS.setCrossfadeTable, {
      payload: encodeCrossfadeTablePayload(values),
    });
    return ack.status === HOST_STATUS.applied;
  }

  /**
   * The whole-track gains from analysis, both at once.
   *
   * `snap` lands on them; without it they glide over two seconds. A direct
   * load has no audible predecessor and should snap; a completed deck handoff
   * is already audible and a step would be heard.
   */
  async setTrackGains(
    inputGainDb: number,
    masterLoudnessGainDb: number,
    snap: boolean,
  ): Promise<boolean> {
    const ack = await this.send(HOST_COMMANDS.setTrackGains, {
      parameterId: snap ? 1 : 0,
      payload: encodeTrackGainsPayload(inputGainDb, masterLoudnessGainDb),
    });
    return ack.status === HOST_STATUS.applied;
  }

  /**
   * Ask the host to measure what the panel draws, or to stop.
   *
   * Off is the default and the usual state. Three transforms and a scope window
   * per block is real work, and the DSP tab is one of several — a user who
   * never opens it should not pay for the graphs in it.
   */
  async setAnalysis(enabled: boolean): Promise<boolean> {
    this.analysisWanted = enabled;
    this.trace('analysis-requested', undefined, { enabled });
    try {
      const ack = await this.send(HOST_COMMANDS.setAnalysis, {
        parameterId: enabled ? 1 : 0,
      });
      const applied = ack.status === HOST_STATUS.applied;
      this.trace('analysis-request-complete', undefined, { enabled, applied });
      return applied;
    } catch (error: unknown) {
      this.trace('analysis-request-failed', undefined, {
        enabled,
        message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * The listener volume, 0 to 1.
   *
   * Mirrored at all because the elements are muted while the native engine is
   * audible: without it the fader moved and nothing happened.
   */
  async setVolume(volume: number): Promise<boolean> {
    const ack = await this.send(HOST_COMMANDS.setVolume, { value: volume });
    return ack.status === HOST_STATUS.applied;
  }

  private setState(next: TDspHostState): void {
    if (this.state === next) {
      return;
    }
    const previous = this.state;
    this.state = next;
    this.trace('state-changed', undefined, { previous, next });
    this.options.onStateChange?.(next);
  }

  /**
   * One structured record for every lifecycle boundary worth correlating.
   *
   * The old log only carried diagnostic code 3004 after the restart budget was
   * gone. It did not say which process left, whether that process had been asked
   * to stop, whether a replacement already existed, or whether analysis had
   * ever produced a frame. Those are the facts that distinguish a device fault,
   * a process crash and a stale-exit race, so they travel with every boundary.
   */
  private trace(
    event: string,
    child: ChildProcessWithoutNullStreams | undefined = this.child,
    values: Readonly<Record<string, TDspDiagnosticValue>> = {},
  ): void {
    const lifecycle = child ? this.childLifecycles.get(child) : undefined;
    this.options.onLifecycle?.({
      event,
      values: {
        pid: child?.pid ?? null,
        generation: lifecycle?.generation ?? this.generation,
        state: this.state,
        current: child ? this.child === child : this.child !== undefined,
        shutdownRequested: lifecycle?.shutdownRequested ?? false,
        deviceWanted: this.deviceWanted,
        analysisWanted: this.analysisWanted,
        analysisFrames: lifecycle?.analysisFrames ?? 0,
        restartAttempts: this.restartTimes.length,
        ...values,
      },
    });
  }

  /**
   * The host's own last words, for any diagnostic that needs a reason.
   *
   * The C++ side already writes real sentences — "the output device does not
   * mix in 32-bit float", "no default output device" — and they already reach
   * this process on stderr. They simply never travelled with the event, so a
   * support report arrived as `code: 3003, values: { code: 0 }`, which says
   * that something failed and nothing whatever about what.
   *
   * Trimmed and joined rather than sent as an array, because this ends up in a
   * log line and a nested array renders as `[Object]` in most of them.
   */
  private stderrDetail(): string {
    return this.stderrTail
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .join(' | ');
  }

  private report(
    code: TDspDiagnosticCode,
    values: Record<string, string | number | boolean | null>,
    severity: TDspDiagnosticSeverity = 'error',
    child: ChildProcessWithoutNullStreams | undefined = this.child,
  ): void {
    const lifecycle = child ? this.childLifecycles.get(child) : undefined;
    const detail = this.stderrDetail();
    this.options.onDiagnostic?.({
      schemaVersion: DSP_DIAGNOSTIC_SCHEMA_VERSION,
      code,
      severity,
      origin: 'native',
      // The host's own message, whenever it left one. Absent rather than an
      // empty string when it did not, so a log line does not carry a field
      // that says nothing.
      values: {
        ...values,
        pid: child?.pid ?? null,
        generation: lifecycle?.generation ?? this.generation,
        state: this.state,
        current: child ? this.child === child : this.child !== undefined,
        shutdownRequested: lifecycle?.shutdownRequested ?? false,
        deviceWanted: this.deviceWanted,
        analysisWanted: this.analysisWanted,
        analysisFrames: lifecycle?.analysisFrames ?? 0,
        lastAnalysisAgeMs:
          lifecycle && lifecycle.lastAnalysisAt > 0
            ? Date.now() - lifecycle.lastAnalysisAt
            : null,
        restartAttempts: this.restartTimes.length,
        ...(detail ? { detail } : {}),
      },
    });
  }

  /** Fatal, and said once. Later repetitions of the same fault stay quiet. */
  private fail(
    code: TDspDiagnosticCode,
    values: Record<string, string | number | boolean | null>,
    child: ChildProcessWithoutNullStreams | undefined = this.child,
  ): void {
    this.setState('failed');
    if (this.reportedFailure) {
      return;
    }
    this.reportedFailure = true;
    this.report(code, values, 'error', child);
  }

  private async spawnAndHandshake(): Promise<boolean> {
    this.setState('starting');
    this.generation += 1;
    const { generation } = this;
    let child: ChildProcessWithoutNullStreams;
    try {
      /**
       * The host is told whose child it is, so it can leave when we do.
       *
       * `stop()` asks it to go and kills it if it will not, and stdin closing
       * is a second net beneath that. Neither covers the case that actually
       * strands a process: Electron force-killed or crashed, so no shutdown is
       * sent and no `kill` runs, while the host sits inside a write to a stdout
       * pipe nobody is draining any more — a call that never returns. It then
       * holds an audio endpoint, and its memory, owned by nothing.
       *
       * With this the host waits on the parent's own process handle and exits
       * the moment it is signalled, for any reason at all.
       */
      child = spawn(
        this.options.executablePath,
        ['--parent-pid', String(process.pid)],
        {
          stdio: ['pipe', 'pipe', 'pipe'],
          windowsHide: true,
        },
      );
    } catch (error: unknown) {
      this.trace('spawn-failed', undefined, {
        generation,
        path: this.options.executablePath,
        message: error instanceof Error ? error.message : String(error),
      });
      this.fail(DSP_DIAGNOSTIC_CODES.hostSpawnFailed, {
        path: this.options.executablePath,
        message: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
    this.child = child;
    this.childLifecycles.set(child, {
      generation,
      startedAt: Date.now(),
      analysisFrames: 0,
      lastAnalysisAt: 0,
      shutdownRequested: false,
    });
    this.trace('spawned', child, { path: this.options.executablePath });

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
          onAck: (ack) => this.settle(child, ack),
          onTelemetry: (telemetry) => {
            if (this.child === child) {
              this.options.onTelemetry?.(telemetry);
            }
          },
          onAnalysis: (analysis) => {
            if (this.child !== child) {
              return;
            }
            const lifecycle = this.childLifecycles.get(child);
            if (lifecycle) {
              lifecycle.analysisFrames += 1;
              lifecycle.lastAnalysisAt = Date.now();
              if (lifecycle.analysisFrames === 1) {
                this.trace('analysis-first-frame', child);
              }
            }
            this.options.onAnalysis?.(analysis);
          },
          onStats: (stats) => {
            if (this.child === child) {
              this.stats = stats;
            }
          },
          onDesynchronised: (magic) => {
            clearTimeout(timer);
            if (this.child !== child) {
              this.trace('stale-desynchronisation-ignored', child, { magic });
              resolve(undefined);
              return;
            }
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

    child.stderr.on('data', (chunk: Buffer) =>
      this.captureStderr(child, chunk),
    );
    child.on('close', (code, signal) => this.onExit(child, code ?? -1, signal));
    child.on('error', (error: Error) => {
      if (this.child !== child) {
        this.trace('stale-process-error-ignored', child, {
          message: error.message,
        });
        return;
      }
      this.trace('process-error', child, { message: error.message });
      this.fail(DSP_DIAGNOSTIC_CODES.hostSpawnFailed, {
        path: this.options.executablePath,
        message: error.message,
      });
    });

    const handshake = await handshakeArrived;
    const lifecycle = this.childLifecycles.get(child);
    if (
      this.child !== child ||
      lifecycle?.shutdownRequested ||
      this.state === 'stopped'
    ) {
      this.trace('stale-handshake-ignored', child);
      return false;
    }
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
        hostAnalysisFrame: handshake.analysisFrameBytes,
        hostBuild: handshake.buildRevision,
        expectedProtocol: HOST_WIRE_PROTOCOL_VERSION,
        expectedParameters: this.options.expectedParameterCount,
        expectedAnalysisFrame: ANALYSIS_HEADER_BYTES,
      });
      child.kill();
      return false;
    }

    this.handshake = handshake;
    this.setState('ready');
    this.trace('handshake-ready', child, {
      protocolVersion: handshake.protocolVersion,
      parameterCount: handshake.parameterCount,
      analysisFrameBytes: handshake.analysisFrameBytes,
      buildRevision: handshake.buildRevision,
      backend: handshake.backend,
    });
    return true;
  }

  private handshakeMismatch(handshake: IHostHandshake): string | undefined {
    if (handshake.protocolVersion !== HOST_WIRE_PROTOCOL_VERSION) {
      return 'protocol version';
    }
    if (handshake.parameterCount !== this.options.expectedParameterCount) {
      return 'parameter count';
    }
    /**
     * The analysis frame is the one whose length is not fixed, and the only
     * one a mismatch can silently corrupt rather than simply misread.
     *
     * Every other frame here is a constant stride, so a host that disagreed
     * about one would be caught on the first bad magic. This one is a header
     * of `ANALYSIS_HEADER_BYTES` followed by a length computed from fields
     * inside it — get the header size wrong and the reader consumes part of
     * the NEXT frame as payload, permanently, until a magic happens to land
     * on a float that reads as garbage and the stream is declared lost.
     *
     * Which is what a stale host binary did: 160-byte frames read as 320,
     * `magic: 0` a few seconds in, the host killed, and the app silent while
     * still showing itself as playing. The protocol version did not move
     * because it is maintained by hand and the frame had grown four times
     * without it. This number is `sizeof` on the far side, so it moves on its
     * own, and it is checked before a single frame is decoded.
     */
    if (handshake.analysisFrameBytes !== ANALYSIS_HEADER_BYTES) {
      return 'analysis frame size';
    }
    return undefined;
  }

  private captureStderr(
    child: ChildProcessWithoutNullStreams,
    chunk: Buffer,
  ): void {
    const joined =
      (this.stderrRemainders.get(child) ?? '') + chunk.toString('utf8');
    const lines = joined.split(/\r?\n/);
    this.stderrRemainders.set(child, lines.pop() ?? '');
    lines.filter(Boolean).forEach((line) => this.recordStderr(child, line));
  }

  private recordStderr(
    child: ChildProcessWithoutNullStreams,
    line: string,
  ): void {
    const generation = this.childLifecycles.get(child)?.generation ?? 0;
    this.stderrTail.push(
      `[pid=${child.pid ?? 'unknown'} generation=${generation}] ${line}`,
    );
    this.trace('stderr', child, { line });
    // Bounded, because a host looping on a device error can produce a great
    // deal of it and main is not where a log file belongs.
    while (this.stderrTail.length > STDERR_TAIL_LINES) {
      this.stderrTail.shift();
    }
  }

  private settle(child: ChildProcessWithoutNullStreams, ack: IHostAck): void {
    const waiting = this.pending.get(ack.requestId);
    if (!waiting || waiting.child !== child) {
      // A reply to a request from a previous host, arriving after a restart.
      // Dropped: applying it would act on state the new host has never seen.
      this.trace('stale-ack-ignored', child, { requestId: ack.requestId });
      return;
    }
    clearTimeout(waiting.timer);
    this.pending.delete(ack.requestId);
    waiting.resolve(ack);
  }

  private onExit(
    child: ChildProcessWithoutNullStreams,
    code: number,
    signal: NodeJS.Signals | null,
  ): void {
    const remainder = this.stderrRemainders.get(child)?.trim();
    if (remainder) {
      this.recordStderr(child, remainder);
    }
    this.stderrRemainders.delete(child);

    const lifecycle = this.childLifecycles.get(child);
    const stateAtExit = this.state;
    const isCurrent = this.child === child;
    this.trace('exited', child, {
      code,
      signal: signal ?? 'none',
      stateAtExit,
      uptimeMs: lifecycle ? Date.now() - lifecycle.startedAt : 0,
    });

    /**
     * A replacement may already own the supervisor when an older child closes.
     *
     * `stop()` marks the old host stopped before awaiting its acknowledgement.
     * Playback can restart during that await and spawn a replacement. The old
     * close used to clear `this.child`, reject the replacement's commands and
     * count a clean code-zero exit against the crash budget. Three quick
     * play/pause handovers therefore produced diagnostic 3004 even though every
     * native process had shut down correctly.
     */
    if (!isCurrent) {
      this.trace('stale-exit-ignored', child, {
        code,
        signal: signal ?? 'none',
      });
      this.rejectPendingFor(child);
      return;
    }

    this.child = undefined;
    this.stats = undefined;
    this.rejectPendingFor(child);

    if (
      lifecycle?.shutdownRequested ||
      stateAtExit === 'stopped' ||
      stateAtExit === 'failed'
    ) {
      return;
    }

    /**
     * A clean exit is not a fault, and reporting it as one was misleading.
     *
     * Zero is what the host returns when its stdin closes, which is exactly
     * what happens every time the main process is replaced — an `electronmon`
     * restart in development, or an ordinary quit. That was arriving as
     * `severity: 'error'` with `code: 0`, so the panel showed its "the native
     * engine could not start" notice for a host that had shut down correctly.
     *
     * Non-zero still means the host died on its own, which is a real fault and
     * keeps its severity.
     */
    this.report(
      DSP_DIAGNOSTIC_CODES.hostExited,
      {
        code,
        signal: signal ?? 'none',
        uptimeMs: lifecycle ? Date.now() - lifecycle.startedAt : 0,
        stateAtExit,
      },
      code === 0 ? 'info' : 'error',
      child,
    );

    const now = Date.now();
    this.restartTimes = this.restartTimes.filter(
      (at) => now - at < RESTART_WINDOW_MS,
    );
    if (this.restartTimes.length >= RESTART_BUDGET) {
      this.trace('restart-budget-exhausted', child, {
        code,
        windowMs: RESTART_WINDOW_MS,
      });
      this.fail(
        DSP_DIAGNOSTIC_CODES.hostRestartBudgetExhausted,
        {
          attempts: this.restartTimes.length,
          windowMs: RESTART_WINDOW_MS,
        },
        child,
      );
      return;
    }
    this.restartTimes.push(now);
    this.trace('restart-scheduled', child, {
      code,
      attempt: this.restartTimes.length,
      windowMs: RESTART_WINDOW_MS,
    });
    // Caught rather than discarded: `restore` reopens a device, and a rejection
    // there is the difference between a host that came back silent and one
    // that came back working. The failure is already reported by whatever threw.
    this.restore().catch(() => undefined);
  }

  private rejectPendingFor(child: ChildProcessWithoutNullStreams): void {
    this.pending.forEach((waiting, requestId) => {
      if (waiting.child !== child) {
        return;
      }
      clearTimeout(waiting.timer);
      waiting.reject(new Error('the DSP host exited'));
      this.pending.delete(requestId);
    });
  }

  /**
   * Bring a replacement host back to where the last one was.
   *
   * Settings, yes. The transport, deliberately not: a crash mid-song should
   * not resume playback on its own. The decks come back empty and stopped, and
   * the renderer decides what happens next — it is the only side that knows
   * whether the user is still sitting there.
   */
  private async restore(): Promise<void> {
    if (!(await this.spawnAndHandshake())) {
      return;
    }
    if (this.lastSnapshot) {
      await this.applySnapshot(this.lastSnapshot, this.lastRevision);
    }
    // Before the device opens, so the first callback runs against the chain the
    // user is looking at rather than against defaults.
    if (this.lastChain) {
      await this.applyChain(this.lastChain);
    }
    // After the chain, because the chain rebuilds the Denoise stage and a
    // profile handed over first would be discarded by that rebuild.
    if (this.lastNoiseProfile) {
      await this.setNoiseProfile(this.lastNoiseProfile);
    }
    if (this.lastVoiceModel) {
      await this.loadVoiceModel(this.lastVoiceModel[0], this.lastVoiceModel[1]);
    }
    // The replacement defaults analysis to off. The DSP panel stays mounted
    // across a supervised crash, so it does not issue another request itself;
    // without restoring this flag every FX visualizer remains blank until the
    // panel is closed and opened again.
    if (this.analysisWanted) {
      await this.setAnalysis(true);
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
      this.pending.set(requestId, { resolve, reject, timer, child });

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
