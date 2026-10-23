/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import type { ICaptureGraph } from '../graph/useLiveOutputSpectrum';
import type { TOutputDelayCallback } from '../../common/outputDelay';
import type { IRemoteAudioPlaybackProfile } from '../remoteAudio/remoteAudioPlaybackProfiles';
import workletUrl from '../remoteAudio/workletUrl';
import { reportError } from '../utils/logger';
import { startNativeMirror } from './nativeOutputMirror';

/**
 * Windows mirrors use pre-endpoint process capture and playback in one native
 * helper. Its playback is excluded from capture, so A's EQ and the mirrored
 * signal never enter B's source. See nativeOutputMirror and remoteAudioCapture.
 *
 * Other platforms retain the shared-stream Web Audio fallback below. It owns
 * its source node and routes through a worklet to an explicit sink; no hidden
 * media player adds a second playback queue.
 */

/**
 * How much sound is held back before it plays: one automatic profile, the
 * same idea as the Windows helper's (`mirror_output.h`) and Share Audio's
 * playback — start 30 ms behind, add 10 ms after a dropout up to 160 ms,
 * give a step back only after a quiet minute, and never skip to catch up.
 *
 * There were two, Game/Video and Music, and a picker between them; Ivan
 * asked for the automatic one (2026-10-02). Smaller than the LAN's start,
 * because no link is in the way: the only jitter is the two devices'
 * callbacks against each other.
 */
export const MIRROR_PLAYBACK_PROFILE: IRemoteAudioPlaybackProfile = {
  deadbandSeconds: 0.005,
  maximumBufferSeconds: 0.16,
  recoveryDecaySeconds: 60,
  recoveryStepSeconds: 0.01,
  startBufferSeconds: 0.03,
};

/**
 * Frames per block on the way across. 256 at 48 kHz is just over 5 ms, which
 * is what the first sample waits before it can leave; the network's 1,024
 * would be 21 ms of delay for nothing, since there is no packet overhead to
 * amortise here.
 */
export const MIRROR_BLOCK_FRAMES = 256;

/** The one source the playback worklet files these samples under. */
const MIRROR_PEER_ID = 'second-output';

/** The processor that hands the capture's blocks over (`pcmCapture.worklet.ts`). */
export const CAPTURE_PROCESSOR = 'fluideq-remote-audio-capture';
const PLAYBACK_PROCESSOR = 'fluideq-remote-audio';

/**
 * How loud one mirrored output plays, as a fraction of the source.
 *
 * 0 to 1, because above unity a mirror would be amplifying audio that has
 * already been through the primary device's preamp, with no headroom left to
 * do it in. Turning a speaker *down* is what this is for — the far room does
 * not need to match the desk.
 */
export const MIN_MIRROR_VOLUME = 0;
export const MAX_MIRROR_VOLUME = 1;

export const clampMirrorVolume = (value: number): number => {
  if (!Number.isFinite(value)) {
    return MAX_MIRROR_VOLUME;
  }
  return Math.min(MAX_MIRROR_VOLUME, Math.max(MIN_MIRROR_VOLUME, value));
};

/** The capture-side worklet: cuts the loopback into blocks for one mirror. */
export interface IMirrorTap {
  /** Send the blocks down this port from now on. */
  attach(port: MessagePort): void;
  close(): void;
}

/** A context opened on the chosen device, playing whatever is attached. */
export interface IMirrorOutput {
  /** Receive blocks on this port from now on. */
  attach(port: MessagePort): void;
  setVolume(value: number): void;
  close(): Promise<void>;
}

export interface IMirrorChannel {
  port1: MessagePort;
  port2: MessagePort;
}

export interface IMirrorTapOptions {
  capture: ICaptureGraph;
  peerId: string;
  blockFrames: number;
}

export interface IMirrorOutputOptions {
  /** A Chromium sink id from the name bridge. Never `default`. */
  sinkId: string;
  peerId: string;
  profile: IRemoteAudioPlaybackProfile;
  /** 0 to 1, applied before the first sample plays. */
  volume: number;
  /** How far behind it plays, in milliseconds, as its buffer reports. */
  onDelay?: TOutputDelayCallback;
}

/**
 * The three Web Audio things a mirror is made of, behind an interface so the
 * rules of assembling them can be tested where there is no Web Audio at all.
 */
export interface IMirrorEngine {
  createTap(options: IMirrorTapOptions): Promise<IMirrorTap>;
  createOutput(options: IMirrorOutputOptions): Promise<IMirrorOutput>;
  createChannel(): IMirrorChannel;
}

interface IRoutableAudioContextOptions extends AudioContextOptions {
  sinkId?: string;
}

interface IRoutableAudioContext extends AudioContext {
  setSinkId?(sinkId: string): Promise<void>;
}

const createAudioTap = async ({
  capture,
  peerId,
  blockFrames,
}: IMirrorTapOptions): Promise<IMirrorTap> => {
  await capture.context.audioWorklet.addModule(workletUrl().href);
  const node = new AudioWorkletNode(capture.context, CAPTURE_PROCESSOR, {
    numberOfInputs: 1,
    numberOfOutputs: 1,
    outputChannelCount: [1],
  });
  // A zero-gain tail to the destination is what keeps Chromium pulling this
  // branch at all; a worklet nothing downstream asks for is never run. The
  // destination is the captured endpoint, and the gain is why this is not the
  // howl-round that connecting to it would otherwise be.
  const mute = capture.context.createGain();
  // The spectrum owner disconnects its source before publishing a replacement.
  // Own a source from the SAME stream so its cleanup cannot remove our edge.
  const source = capture.context.createMediaStreamSource(
    capture.source.mediaStream,
  );
  mute.gain.value = 0;
  source.connect(node);
  node.connect(mute);
  mute.connect(capture.context.destination);
  return {
    attach: (port) => {
      node.port.postMessage({ kind: 'attach', blockFrames, peerId, port }, [
        port,
      ]);
    },
    close: () => {
      node.port.postMessage({ kind: 'close' });
      source.disconnect();
      node.disconnect();
      mute.disconnect();
    },
  };
};

const createAudioOutput = async ({
  sinkId,
  peerId,
  profile,
  volume,
  onDelay,
}: IMirrorOutputOptions): Promise<IMirrorOutput> => {
  const options: IRoutableAudioContextOptions = {
    latencyHint: 'interactive',
    sinkId,
  };
  const context = new AudioContext(options) as IRoutableAudioContext;
  try {
    if (typeof context.setSinkId !== 'function') {
      throw new Error('This build cannot play audio to a chosen output.');
    }
    // Asked for twice on purpose. The constructor option is what stops the
    // context ever opening the default device — the very endpoint being
    // captured — and the explicit call is what rejects if the id is stale.
    // Even between the two nothing could leak: no source is attached until
    // this resolves, and the playback worklet renders silence without one.
    await context.setSinkId(sinkId);
    await context.audioWorklet.addModule(workletUrl().href);
    const receiver = new AudioWorkletNode(context, PLAYBACK_PROCESSOR, {
      numberOfInputs: 0,
      numberOfOutputs: 1,
      outputChannelCount: [2],
    });
    // The worklet reports a meter forty-odd times a second; only its buffer
    // is read, for the delay, with the device's own latency added. Started
    // either way, or the messages would queue for the life of the mirror.
    if (onDelay) {
      receiver.port.onmessage = (event: MessageEvent<unknown>) => {
        const { data } = event;
        if (
          typeof data === 'object' &&
          data !== null &&
          'kind' in data &&
          data.kind === 'meter' &&
          'bufferedMs' in data &&
          typeof data.bufferedMs === 'number'
        ) {
          const deviceSeconds = context.outputLatency || context.baseLatency;
          onDelay(data.bufferedMs + deviceSeconds * 1_000);
        }
      };
    }
    receiver.port.start();
    const gain = context.createGain();
    gain.gain.value = volume;
    receiver.connect(gain);
    gain.connect(context.destination);
    receiver.port.postMessage({ kind: 'configure', peerId, profile });
    await context.resume();
    if (context.state !== 'running') {
      throw new Error('The second output could not start playing.');
    }
    return {
      attach: (port) => {
        receiver.port.postMessage({ kind: 'attach', port }, [port]);
      },
      setVolume: (value) => {
        gain.gain.value = value;
      },
      close: async () => {
        receiver.port.postMessage({ kind: 'close' });
        receiver.disconnect();
        gain.disconnect();
        await context.close();
      },
    };
  } catch (error) {
    await context.close();
    throw error;
  }
};

export const audioMirrorEngine: IMirrorEngine = {
  createTap: createAudioTap,
  createOutput: createAudioOutput,
  createChannel: () => new MessageChannel(),
};

export interface IOutputMirrorOptions {
  /** The capture the spectrum is already drawing from. Not a new one. */
  capture?: ICaptureGraph;
  /** Windows mirrors use the endpoint GUID and pre-APO native capture. */
  guid?: string;
  onFailure?: () => void;
  signal?: AbortSignal;
  /** A Chromium sink id from the name bridge. Never `default`. */
  sinkId: string;
  /** Starting level, 0 to 1. Applied before the first sample plays. */
  volume?: number;
  /** How far behind the second output plays, in milliseconds, as it
   * changes. */
  onDelay?: TOutputDelayCallback;
  /** Injectable purely so the tests can watch what happens. */
  engine?: IMirrorEngine;
}

export interface IOutputMirror {
  readonly sinkId: string;
  /** Change the level without restarting anything. */
  setVolume(value: number): void;
  stop(): void;
}

/**
 * Start mirroring, or throw without leaving anything running.
 *
 * The order is the safety argument: the output is opened on its device first,
 * so an id that no longer names anything fails before the capture graph has
 * been touched; the output is listening before the tap is told where to send,
 * so no block is ever posted into a port nobody holds.
 */
export const startOutputMirror = async ({
  capture,
  guid,
  onFailure,
  signal,
  sinkId,
  volume = MAX_MIRROR_VOLUME,
  onDelay,
  engine = audioMirrorEngine,
}: IOutputMirrorOptions): Promise<IOutputMirror> => {
  if (guid) {
    return startNativeMirror(
      guid,
      clampMirrorVolume(volume),
      onFailure,
      signal,
      onDelay,
    );
  }
  if (!capture) {
    throw new Error('System audio capture is unavailable.');
  }
  if (!sinkId) {
    // Refusing beats guessing. An empty sink id would play out of whatever
    // Windows currently calls default, which is the one endpoint that must
    // never be the target.
    throw new Error('No output was chosen to mirror to.');
  }

  const output = await engine.createOutput({
    sinkId,
    peerId: MIRROR_PEER_ID,
    profile: MIRROR_PLAYBACK_PROFILE,
    volume: clampMirrorVolume(volume),
    onDelay,
  });
  let tap: IMirrorTap | undefined;
  try {
    tap = await engine.createTap({
      capture,
      peerId: MIRROR_PEER_ID,
      blockFrames: MIRROR_BLOCK_FRAMES,
    });
    const { port1, port2 } = engine.createChannel();
    output.attach(port2);
    tap.attach(port1);
  } catch (error) {
    tap?.close();
    await output.close();
    throw error;
  }
  const startedTap = tap;
  // Disconnecting a node that is no longer connected throws, so a second
  // stop — the reconciler and the unmount cleanup can both reach one — must
  // find nothing left to do.
  let stopped = false;

  return {
    sinkId,
    setVolume: (value: number) => {
      output.setVolume(clampMirrorVolume(value));
    },
    stop: () => {
      if (stopped) {
        return;
      }
      stopped = true;
      startedTap.close();
      output
        .close()
        .catch((error: unknown) =>
          reportError('Could not close second output', error),
        );
    },
  };
};
