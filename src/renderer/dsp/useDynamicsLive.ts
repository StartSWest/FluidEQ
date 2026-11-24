/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useRef, useState } from 'react';
import {
  DYNAMICS_DEFAULTS,
  type IDynamicsSettings,
} from '../../common/dsp/dynamicsStage';
import { readDspDynamicsReport } from './dynamicsTelemetry';
import { createDynamicsLive, type IDynamicsBandLive } from './dynamicsLive';
import { startGraphLoop } from './graphLoop';
import { readDspAnalysisLive } from './store';

export interface IDynamicsFrame {
  bands: readonly IDynamicsBandLive[];
  /**
   * Whether the readouts' figures are refreshed on this frame: the dots move
   * every frame, the numbers four times a second, which is as fast as one
   * can be read. A change of state is never held back.
   */
  labels: boolean;
}

type TListener = (frame: IDynamicsFrame) => void;

/** One frame's news, handed to whichever parts of the card draw it. */
export interface IDynamicsBus {
  subscribe: (listener: TListener) => () => void;
  /** The frame last handed out, for a part that mounts between frames. */
  last: () => IDynamicsFrame | undefined;
}

const LABEL_MS = 250;

const RESTING: IDynamicsFrame = {
  bands: createDynamicsLive().read(undefined, false, DYNAMICS_DEFAULTS, 0),
  labels: true,
};

/**
 * A bus that never moves: for a drawing of the controls on example
 * settings (Help's figure), where the engine's live readings belong to the
 * user's own settings and would ride a curve that is not theirs.
 */
export const RESTING_DYNAMICS: IDynamicsBus = {
  subscribe: () => () => undefined,
  last: () => RESTING,
};

const createBus = () => {
  const listeners = new Set<TListener>();
  let latest: IDynamicsFrame | undefined;
  const bus: IDynamicsBus = {
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    last: () => latest,
  };
  const publish = (frame: IDynamicsFrame) => {
    latest = frame;
    listeners.forEach((listener) => listener(frame));
  };
  return { bus, publish };
};

/**
 * The stage's live readings for the card's curves and readouts, read once
 * per frame from the window's one meter store and handed out without a
 * React render: a render per audio block across three curves is the cost
 * the DSP page's graphs were built to avoid.
 */
const useDynamicsLive = (settings: IDynamicsSettings): IDynamicsBus => {
  const current = useRef(settings);
  current.current = settings;
  const redraw = useRef<(() => void) | undefined>(undefined);
  // The first frame is read as the card renders, so the readouts and the
  // hint are what the music says from the first paint rather than a frame
  // of "no sound" that the loop corrects a frame later.
  const [{ bus, publish, live }] = useState(() => {
    const made = { ...createBus(), live: createDynamicsLive() };
    const isLive = readDspAnalysisLive();
    made.publish({
      bands: made.live.read(
        isLive ? readDspDynamicsReport() : undefined,
        isLive,
        settings,
        performance.now(),
      ),
      labels: true,
    });
    return made;
  });

  useEffect(() => {
    let labelledAt = Number.NEGATIVE_INFINITY;
    let states = '';
    const loop = startGraphLoop(
      () => {
        const now = performance.now();
        const isLive = readDspAnalysisLive();
        const bands = live.read(
          isLive ? readDspDynamicsReport() : undefined,
          isLive,
          current.current,
          now,
        );
        const next = bands.map((band) => band.state).join();
        const labels = next !== states || now - labelledAt >= LABEL_MS;
        if (labels) {
          labelledAt = now;
          states = next;
        }
        publish({ bands, labels });
      },
      { onEngineGone: live.reset },
    );
    redraw.current = loop.schedule;
    return () => {
      redraw.current = undefined;
      loop.stop();
    };
  }, [live, publish]);

  // A settings change moves the curve under a dot that may be standing
  // still: one frame redraws it there, playing or not.
  useEffect(() => {
    redraw.current?.();
  }, [settings]);

  return bus;
};

export default useDynamicsLive;
