/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ReactNode } from 'react';
import StudioBrightness from './StudioBrightness';
import StudioTintSwitch from './StudioTintSwitch';
import StudioWaveControls from './StudioWaveControls';
import type { IStudioWave } from './studioWave';

interface IStudioTuneProps {
  wave: IStudioWave;
  onWave: (wave: IStudioWave) => void;
  /** Letting a wave slider go saves it into the scene, as every setting does. */
  onWaveCommit: () => void;
  /** Back to the wave the scene was published with, or opened with. */
  onWaveReset: () => void;
  canResetWave: boolean;
  /** Nothing is on the stage: the controls stay where they will be, unlit. */
  idle: boolean;
  /** The colours the scene lends the window (`StudioWindowColours.tsx`). */
  windowColours: ReactNode;
  /**
   * The scene's own settings (`StudioSettings.tsx`): its controls, how it
   * answers the music, its elements in the window.
   */
  settings: ReactNode;
}

/**
 * The Tune tab: what the whole app does with the scene while it is made, the
 * colours it lends the window, where its wave stands on the graph, and the
 * scene's own groups of settings - every one a block of its own, flowing in
 * even columns across the panel (Ivan, 2026-11-17: "a lot of waste", his pick
 * of the even grid). It was three cards on a 1fr 1fr 2fr grid: the wave took
 * the 2fr track and stretched two sliders to 900px, and the whole scene fell
 * into a 1fr track on the next row, three groups of 140px sliders crammed
 * side by side under two nearly empty cards. The scene's groups join the
 * flow themselves (`StudioSettings`'s wrappers do not box them,
 * `StudioWork.scss`), so a scene with seven controls and one with none
 * both fill the width.
 */
export default function StudioTune({
  wave,
  onWave,
  onWaveCommit,
  onWaveReset,
  canResetWave,
  idle,
  windowColours,
  settings,
}: IStudioTuneProps) {
  return (
    <div className={`studio-tune${idle ? ' is-idle' : ''}`}>
      <div className="studio-card studio-tune__box">
        <StudioTintSwitch />
        <StudioBrightness />
      </div>
      {windowColours}
      <div className="studio-card studio-tune__box">
        <StudioWaveControls
          wave={wave}
          onWave={onWave}
          onCommit={onWaveCommit}
          onReset={onWaveReset}
          canReset={canResetWave}
          idle={idle}
        />
      </div>
      {settings}
    </div>
  );
}
