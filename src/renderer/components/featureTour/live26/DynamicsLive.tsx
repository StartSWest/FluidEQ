/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { useId, useRef, useState } from 'react';
import { dynamicsPresetSettings } from '../../../../common/dsp/dynamicsPresets';
import { ProcessorCard } from '../../../dsp/DspControls';
import DspDynamicsControls from '../../../dsp/DspDynamicsControls';
import dynamicsGainDb, { mixedGainDb } from '../../../dsp/dynamicsCurve';
import { createDynamicsLive } from '../../../dsp/dynamicsLive';
import type {
  IDynamicsBus,
  IDynamicsFrame,
} from '../../../dsp/useDynamicsLive';
import useTourFrames from '../useTourFrames';
import { bandLevelsAt } from './madeUpMusic';

const SETTINGS = dynamicsPresetSettings('movie', true);
const nothing = () => undefined;
const LABEL_SECONDS = 0.25;

/**
 * The Dynamics card exactly as the DSP page draws it, on a factory profile,
 * its dots riding their curves to the made-up groove: the stage's own live
 * reader (`createDynamicsLive`) fed a report made the way the engine makes
 * one, each band's gain read off the profile's own curve
 * (`dynamicsGainDb`, the engine's `target_gain_db`). So a dot lands where
 * the engine would put it, and the readouts say what that band is doing.
 */
export default function DynamicsLive() {
  const id = useId();
  const [{ bus, publish, live }] = useState(() => {
    const listeners = new Set<(frame: IDynamicsFrame) => void>();
    let latest: IDynamicsFrame | undefined;
    const made: IDynamicsBus = {
      subscribe: (listener) => {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
      last: () => latest,
    };
    return {
      bus: made,
      live: createDynamicsLive(),
      publish: (frame: IDynamicsFrame) => {
        latest = frame;
        listeners.forEach((listener) => listener(frame));
      },
    };
  });

  // The figures four times a second, as the page refreshes them: the dots
  // move every frame, the numbers only as fast as they can be read.
  const labelledAt = useRef(Number.NEGATIVE_INFINITY);
  useTourFrames((seconds) => {
    const levelDb = bandLevelsAt(seconds);
    const heard = (band: 0 | 1 | 2) =>
      mixedGainDb(
        dynamicsGainDb(SETTINGS.bands[band], levelDb[band]),
        SETTINGS.makeupDb,
        SETTINGS.mix,
      );
    const labels =
      seconds - labelledAt.current >= LABEL_SECONDS || seconds === 0;
    if (labels) {
      labelledAt.current = seconds;
    }
    publish({
      bands: live.read(
        { active: true, levelDb, gainDb: [heard(0), heard(1), heard(2)] },
        true,
        SETTINGS,
        seconds * 1000,
      ),
      labels,
    });
  });

  return (
    <div className="dsp-panel tour-live26-dynamics">
      <ProcessorCard
        id={`tour-dynamics-${id}`}
        titleKey="dsp.dynamics.title"
        descriptionKey="dsp.dynamics.description"
        isEnabled
        onToggle={nothing}
      >
        <DspDynamicsControls
          bus={bus}
          dynamics={SETTINGS}
          onPatch={nothing}
          onCommit={nothing}
        />
      </ProcessorCard>
    </div>
  );
}
