/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import { snapPercent } from '../graph/GraphViewMenu';
import { useTranslation } from '../utils/I18nContext';
import { Setting } from './StudioSettings';
import { STUDIO_WAVE_MIN_HEIGHT, type IStudioWave } from './studioWave';

interface IStudioWaveControlsProps {
  wave: IStudioWave;
  onWave: (wave: IStudioWave) => void;
  /** Letting the slider go: saved into the scene, like every other setting. */
  onCommit: () => void;
  /** Back to the wave the scene was published with, or opened with. */
  onReset: () => void;
  canReset: boolean;
  /** Nothing is on the stage: the sliders wait, unlit, where they will be. */
  idle: boolean;
}

/**
 * Where the scene wants the wave: its height and its position, set on the
 * stage and saved into the scene.
 *
 * The same two sliders as the graph's View menu, with its range and its
 * quarters on the height, because they are the settings a member's audience
 * will actually move — full screen over a film, a low wave under the bands —
 * and a scene has to hold its shape under all of them. What is settled on
 * here is published with the scene (`sceneWave.ts`), so a listener sees it as
 * its author meant it; their own change still wins, and is remembered for
 * that scene alone.
 */
export default function StudioWaveControls({
  wave,
  onWave,
  onCommit,
  onReset,
  canReset,
  idle,
}: IStudioWaveControlsProps) {
  const { t } = useTranslation();
  const disabled = idle;
  const heightSpan = 1 - STUDIO_WAVE_MIN_HEIGHT;
  const percent = (value: number) =>
    t('studio.settings.percent', { percent: Math.round(value * 100) });

  return (
    <section className="studio-wave" aria-label={t('studio.wave.title')}>
      <div className="studio-wave__head">
        <span className="studio-card__eyebrow">{t('studio.wave.title')}</span>
        <button
          type="button"
          className="studio-settings__reset"
          disabled={disabled || !canReset}
          onClick={onReset}
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
        onCommit={onCommit}
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
        onCommit={onCommit}
        onPosition={(position) =>
          onWave({ ...wave, position: Math.round(position * 100) / 100 })
        }
      />
      <span className="studio-test__hint studio-wave__hint">
        {t('studio.wave.hint')}
      </span>
    </section>
  );
}
