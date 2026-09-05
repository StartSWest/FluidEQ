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

export type TMirrorMode = 'video' | 'music';

export const MIRROR_MODES: readonly TMirrorMode[] = ['video', 'music'];

export const isMirrorMode = (value: unknown): value is TMirrorMode =>
  value === 'video' || value === 'music';

/**
 * How much sound is held back before it plays, per mode.
 *
 * Smaller than the LAN listener's, because there is no link in the way: the
 * only jitter is the two audio devices' callbacks against each other, which at
 * the 10 ms Windows hands Chromium is about 20 ms peak to peak. Below that the
 * reservoir runs dry on ordinary scheduling; well above it the picture drifts
 * ahead of the sound.
 *
 * Video starts at 30 ms, which with the 5 ms capture blocks and the device's
 * own buffer keeps a screen within roughly a twentieth of a second of its
 * speaker. A starvation adds 10 ms of protection; two stable seconds take it
 * back. Once it is more than 30 ms over target the stale prefix is crossfaded
 * out at the original pitch, so a stall never becomes permanent delay.
 *
 * Music starts at 100 ms and has no catch-up: every sample is kept, a stall
 * costs 50 ms more reservoir, and the sound is allowed to sit up to half a
 * second behind rather than ever break.
 */
export const MIRROR_PLAYBACK_PROFILES: Record<
  TMirrorMode,
  IRemoteAudioPlaybackProfile
> = {
  video: {
    catchupThresholdSeconds: 0.03,
    deadbandSeconds: 0.005,
    maximumBufferSeconds: 0.12,
    recoveryDecaySeconds: 2,
    recoveryStepSeconds: 0.01,
    startBufferSeconds: 0.03,
  },
  music: {
    deadbandSeconds: 0.02,
    maximumBufferSeconds: 0.5,
    recoveryStepSeconds: 0.05,
    startBufferSeconds: 0.1,
  },
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

const CAPTURE_PROCESSOR = 'fluideq-remote-audio-capture';
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
    // The worklet reports a level meter forty-odd times a second and nothing
    // here reads it. Starting the port without a listener lets those messages
    // be discarded; left unstarted they would queue for the life of the mirror.
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
  mode: TMirrorMode;
  /** Starting level, 0 to 1. Applied before the first sample plays. */
  volume?: number;
  /** Injectable purely so the tests can watch what happens. */
  engine?: IMirrorEngine;
}

export interface IOutputMirror {
  readonly sinkId: string;
  readonly mode: TMirrorMode;
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
  mode,
  volume = MAX_MIRROR_VOLUME,
  engine = audioMirrorEngine,
}: IOutputMirrorOptions): Promise<IOutputMirror> => {
  if (guid) {
    return startNativeMirror(
      guid,
      mode,
      clampMirrorVolume(volume),
      onFailure,
      signal,
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
    profile: MIRROR_PLAYBACK_PROFILES[mode],
    volume: clampMirrorVolume(volume),
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
    mode,
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
