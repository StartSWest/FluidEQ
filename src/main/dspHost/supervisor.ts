/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  HOST_COMMANDS,
  HOST_DECKS,
  HOST_STATUS,
  IHostAck,
  THostDeckPurpose,
  encodeChainPayload,
  encodeCrossfadeTablePayload,
  encodeNoiseProfilePayload,
  encodeSnapshotPayload,
  encodeTrackGainsPayload,
} from './wire';
import { DspHostProcess } from './dspHostProcess';

export type {
  IDspHostLifecycleEvent,
  IDspHostOptions,
  TDspHostState,
} from './dspHostProcess';

/**
 * What the app asks of the native host: the device, the chain and its
 * parameters, the decks and their fades, analysis and volume — each a command
 * sent and acknowledged, and what a restart must restore remembered as it is
 * sent. The process these travel to is `DspHostProcess`.
 */
export class DspHostSupervisor extends DspHostProcess {
  /**
   * Did the last `openDevice` fail because this machine has no output at all?
   *
   * The host answers UNSUPPORTED for a machine with no render endpoint and
   * REJECTED for a device that exists and would not open — a fact about the
   * hardware against a defect. Both leave `openDevice` false, so a caller that
   * only needs "is there sound" is unaffected; this is for the ones that have
   * to tell a build agent from a broken install.
   */
  get noOutputEndpoint(): boolean {
    return this.endpointAbsent;
  }

  async openDevice(): Promise<boolean> {
    this.deviceWanted = true;
    this.endpointAbsent = false;
    this.trace('device-open-requested');
    try {
      const ack = await this.send(HOST_COMMANDS.start, {});
      const applied = ack.status === HOST_STATUS.applied;
      this.endpointAbsent = ack.status === HOST_STATUS.unsupported;
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
  async setRawSharing(enabled: boolean): Promise<boolean> {
    this.rawSharing = enabled;
    if (this.state !== 'ready') {
      return true;
    }
    const ack = await this.send(HOST_COMMANDS.setRawSharing, {
      parameterId: enabled ? 1 : 0,
    });
    return ack.status === HOST_STATUS.applied;
  }

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
   * A file onto the deck the host chooses, cued at `startSeconds`, and that
   * deck back — or undefined for the next track, whose deck is decided when
   * one is free, and for a file the host could not open.
   *
   * The renderer used to name the deck, alternating one per handoff, and
   * could only guess whether the host's fade had finished: a third track
   * clicked inside a fade went onto the deck still fading out, and the one
   * skipped past is what played (Ivan, 2026-09-23).
   */
  async loadDeckFor(
    purpose: THostDeckPurpose,
    path: string,
    startSeconds: number,
  ): Promise<number | undefined> {
    const payload = Buffer.from(path, 'utf8');
    const ack = await this.send(HOST_COMMANDS.loadDeck, {
      parameterIndex: HOST_DECKS[purpose],
      parameterId: payload.byteLength,
      value: startSeconds,
      payload,
    });
    return ack.status === HOST_STATUS.applied && ack.sanitizedValue >= 0
      ? ack.sanitizedValue
      : undefined;
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

  /**
   * Bring a replacement host back to where the last one was.
   *
   * Settings, yes. The transport, deliberately not: a crash mid-song should
   * not resume playback on its own. The decks come back empty and stopped, and
   * the renderer decides what happens next — it is the only side that knows
   * whether the user is still sitting there.
   */
  protected async replaySettings(): Promise<void> {
    await this.setRawSharing(this.rawSharing);
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
}
