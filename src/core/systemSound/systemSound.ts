/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What the speakers play, heard once and handed to everyone who asks.
 *
 * The graph, the meters, the visualizers, the desk lights, the desktop
 * backgrounds and Auto normalize on Equalizer APO all move to the same sound:
 * the output's own loopback, after every effect. A platform hears it its own
 * way (`ISystemSoundSource`, under `platform/`); this keeps one of it running
 * while anybody listens, and none while nobody does, because a loopback holds
 * the output awake — a DAC or a headset kept out of its low-power state hums
 * in the room while every meter reads silence.
 */

/** One block of interleaved Float32 PCM, in the format it was heard in. */
export interface ISystemSoundBlock {
  sampleRate: number;
  channels: number;
  frames: number;
  sequence: number;
  pcm: ArrayBuffer;
}

/**
 * Why a source stopped by itself. `output-changed` is Windows moving the
 * default output, or taking away the one being heard: the same thing heard
 * again on the new output, at once. Anything else is `failed`, and waits for
 * somebody to ask again.
 */
export type TSystemSoundEnd = 'output-changed' | 'failed';

export interface ISystemSoundHandlers {
  /** The sound has started; blocks follow. */
  ready(): void;
  audio(block: ISystemSoundBlock): void;
  /** Ended without being told to. Never called after `stop`. */
  ended(why: TSystemSoundEnd): void;
}

/** One platform's way of hearing the output. */
export interface ISystemSoundSource {
  start(handlers: ISystemSoundHandlers): { stop(): void };
}

export interface ISystemSoundListener {
  ready(): void;
  audio(block: ISystemSoundBlock): void;
  /** It cannot be heard, or stopped being heard; nothing follows. */
  lost(): void;
}

export interface ISystemSound {
  /** Listens until the returned function is called. */
  listen(listener: ISystemSoundListener): () => void;
}

export const createSystemSound = (
  source: ISystemSoundSource | undefined,
): ISystemSound => {
  const listeners = new Set<ISystemSoundListener>();
  /** The run in progress, and the token its callbacks are checked against. */
  let running: { token: object; run: { stop(): void } } | undefined;
  let heard = false;

  // Taken out of the set before they are told: `lost` promises nothing
  // follows, and a listener still in it would hear the next run somebody
  // else starts.
  const loseEveryone = () => {
    const lost = [...listeners];
    listeners.clear();
    lost.forEach((listener) => listener.lost());
  };

  const start = (from: ISystemSoundSource) => {
    heard = false;
    // A run's callbacks are its own: once another has replaced it, or it was
    // stopped, whatever it still says is about sound nobody is waiting for.
    const token = {};
    const isCurrent = () => running?.token === token;
    const handlers: ISystemSoundHandlers = {
      ready: () => {
        if (isCurrent()) {
          heard = true;
          [...listeners].forEach((listener) => listener.ready());
        }
      },
      audio: (block) => {
        if (isCurrent()) {
          listeners.forEach((listener) => listener.audio(block));
        }
      },
      ended: (why) => {
        if (!isCurrent()) {
          return;
        }
        running = undefined;
        heard = false;
        if (why === 'output-changed' && listeners.size > 0) {
          start(from);
          return;
        }
        loseEveryone();
      },
    };
    // Current before `start` returns, so a source that answers at once is
    // heard; the real handle replaces the placeholder only if nothing has
    // ended or replaced this run meanwhile.
    running = { token, run: { stop: () => undefined } };
    try {
      const run = from.start(handlers);
      if (isCurrent()) {
        running = { token, run };
      } else {
        run.stop();
      }
    } catch {
      if (isCurrent()) {
        running = undefined;
        loseEveryone();
      }
    }
  };

  return {
    listen: (listener) => {
      if (!source) {
        listener.lost();
        return () => undefined;
      }
      listeners.add(listener);
      if (!running) {
        start(source);
      } else if (heard) {
        listener.ready();
      }
      let isListening = true;
      return () => {
        if (!isListening) {
          return;
        }
        isListening = false;
        listeners.delete(listener);
        if (listeners.size === 0 && running) {
          const { run } = running;
          running = undefined;
          heard = false;
          run.stop();
        }
      };
    },
  };
};
