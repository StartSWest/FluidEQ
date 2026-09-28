/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useId, type ReactNode } from 'react';
import { SETTINGS_GROUP_TITLE } from 'common/settingsGroups';
import { useTranslation } from '../utils/I18nContext';
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
  /**
   * The scene's own settings (`StudioSettings.tsx`): its controls, how it
   * answers the music, its elements in the window.
   */
  settings: ReactNode;
}

/**
 * The Tune tab: what the whole app does with the scene while it is made,
 * where its wave stands on the graph, and the visualizer's own settings,
 * side by side under the stage instead of down a 248px column. The picture
 * and the visualizer keep the headings the graph's View menu gives them
 * (`common/settingsGroups.ts`), so a setting found here is found there by
 * the same name.
 */
export default function StudioTune({
  wave,
  onWave,
  onWaveCommit,
  onWaveReset,
  canResetWave,
  idle,
  settings,
}: IStudioTuneProps) {
  const { t } = useTranslation();
  const pictureId = useId();
  const visualizerId = useId();
  return (
    <div className={`studio-tune${idle ? ' is-idle' : ''}`}>
      <section className="studio-card studio-tune__box">
        <StudioTintSwitch />
        <StudioBrightness />
      </section>
      <section
        className="studio-card studio-tune__box"
        aria-labelledby={pictureId}
      >
        <span className="studio-card__eyebrow" id={pictureId}>
          {t(SETTINGS_GROUP_TITLE.picture)}
        </span>
        <StudioWaveControls
          wave={wave}
          onWave={onWave}
          onCommit={onWaveCommit}
          onReset={onWaveReset}
          canReset={canResetWave}
          idle={idle}
        />
      </section>
      <section
        className="studio-card studio-tune__box studio-tune__box--visualizer"
        aria-labelledby={visualizerId}
      >
        <span className="studio-card__eyebrow" id={visualizerId}>
          {t(SETTINGS_GROUP_TITLE.visualizer)}
        </span>
        {settings}
      </section>
    </div>
  );
}
