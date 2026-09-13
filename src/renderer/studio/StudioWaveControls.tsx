/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import { snapPercent } from '../graph/GraphViewMenu';
import { useTranslation } from '../utils/I18nContext';
import { Setting } from './StudioSettings';
import {
  DEFAULT_STUDIO_WAVE,
  STUDIO_WAVE_MIN_HEIGHT,
  type IStudioWave,
} from './studioWave';

interface IStudioWaveControlsProps {
  wave: IStudioWave;
  onWave: (wave: IStudioWave) => void;
  /** The scene reserves its own band, so the graph's two settings do nothing. */
  isFixedByScene: boolean;
  /** Nothing is on the stage: the sliders wait, unlit, where they will be. */
  idle: boolean;
}

/**
 * The graph's wave height and position, tried on the scene on the stage.
 *
 * The same two sliders as the graph's View menu, with its range and its
 * quarters on the height, because they are the settings a member's audience
 * will actually move — full screen over a film, a low wave under the bands —
 * and a scene has to hold its shape under all of them. Only tried here, never
 * saved: they belong to whoever watches the scene, not to the scene.
 */
export default function StudioWaveControls({
  wave,
  onWave,
  isFixedByScene,
  idle,
}: IStudioWaveControlsProps) {
  const { t } = useTranslation();
  const disabled = idle || isFixedByScene;
  const heightSpan = 1 - STUDIO_WAVE_MIN_HEIGHT;
  const isDefault =
    wave.height === DEFAULT_STUDIO_WAVE.height &&
    wave.position === DEFAULT_STUDIO_WAVE.position;
  const percent = (value: number) =>
    t('studio.settings.percent', { percent: Math.round(value * 100) });

  return (
    <section className="studio-wave" aria-label={t('studio.wave.title')}>
      <div className="studio-wave__head">
        <span className="studio-card__eyebrow">{t('studio.wave.title')}</span>
        <button
          type="button"
          className="studio-settings__reset"
          disabled={disabled || isDefault}
          onClick={() => onWave(DEFAULT_STUDIO_WAVE)}
        >
          {t('studio.settings.reset')}
        </button>
      </div>
      <Setting
        label={t('graph.waveHeight')}
        hint={t('graph.waveHeightHint')}
        value={percent(wave.height)}
        position={(wave.height - STUDIO_WAVE_MIN_HEIGHT) / heightSpan}
        disabled={disabled}
        onPosition={(position) =>
          onWave({
            ...wave,
            height:
              snapPercent(
                Math.round(
                  (STUDIO_WAVE_MIN_HEIGHT + position * heightSpan) * 100,
                ),
              ) / 100,
          })
        }
      />
      <Setting
        label={t('graph.wavePosition')}
        hint={t('graph.wavePositionHint')}
        value={percent(wave.position)}
        position={wave.position}
        disabled={disabled}
        onPosition={(position) =>
          onWave({ ...wave, position: Math.round(position * 100) / 100 })
        }
      />
      <span className="studio-test__hint studio-wave__hint">
        {t(isFixedByScene ? 'studio.wave.fixed' : 'studio.wave.hint')}
      </span>
    </section>
  );
}
