/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { TranslationKey } from '../../../common/i18n';
import alpine from '../../../../assets/tour/scene-alpine.jpg';
import neonCity from '../../../../assets/tour/scene-neon-city.jpg';
import { useTranslation } from '../../utils/I18nContext';

/**
 * A visualizer on two monitors' desktops: on the first, the pointer crosses
 * the bare desktop and the scene answers it, leaning after it; the camera
 * key goes down and Reset view shows for as long as it is held. Each
 * monitor keeps its own time of day, its dial set apart from the other's.
 * Under them the camera's own settings, in the graph's View menu's words:
 * the key, the way it turns, Follow the mouse and Circle by itself.
 *
 * One loop of CSS (`_tour-release24b.scss`).
 */

interface ISetting {
  label: TranslationKey;
  options: readonly TranslationKey[];
  /** The option lit. */
  on: number;
}

const SETTINGS: readonly ISetting[] = [
  {
    label: 'graph.scene.camera.key',
    options: [
      'graph.scene.camera.key.ctrl',
      'graph.scene.camera.key.alt',
      'graph.scene.camera.key.shift',
      'graph.scene.camera.key.press',
    ],
    on: 0,
  },
  {
    label: 'graph.scene.camera.move',
    options: ['graph.scene.camera.move.drag', 'graph.scene.camera.move.move'],
    on: 0,
  },
  {
    label: 'graph.scene.camera.follow',
    options: ['graph.scene.camera.follow.off', 'graph.scene.camera.follow.on'],
    on: 1,
  },
  {
    label: 'graph.scene.camera.orbit',
    options: [
      'graph.scene.camera.orbit.off',
      'graph.scene.camera.orbit.slow',
      'graph.scene.camera.orbit.normal',
    ],
    on: 1,
  },
];

function Monitor({
  picture,
  number,
  dial,
  live,
}: {
  picture: string;
  number: number;
  /** Where its time of day stands, as a share of the dial. */
  dial: number;
  live?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <span className={`camera-visual__monitor${live ? ' is-live' : ''}`}>
      <span className="camera-visual__screen">
        <span className="camera-visual__world">
          <img src={picture} alt="" />
        </span>
        <span className="camera-visual__icons">
          <i />
          <i />
          <i />
        </span>
        {live && (
          <>
            <span className="camera-visual__glow" />
            <span className="camera-visual__pointer" />
            <span className="camera-visual__reset">
              {t('graph.scene.resetView')}
            </span>
          </>
        )}
        <span className="camera-visual__tag">
          <strong>{t('wallpaper.monitor.name', { number })}</strong>
          <span className="camera-visual__day">
            {t('wallpaper.daylight')}
            <span className="camera-visual__dial">
              <i style={{ left: `${dial * 100}%` }} />
            </span>
          </span>
        </span>
      </span>
      <span className="camera-visual__foot" />
    </span>
  );
}

export default function CameraVisual() {
  const { t } = useTranslation();
  return (
    <div
      className="camera-visual"
      role="img"
      aria-label={t('tour.camera.imageAlt')}
    >
      <div className="camera-visual__desk">
        <Monitor picture={alpine} number={1} dial={0.82} live />
        <Monitor picture={neonCity} number={2} dial={0.35} />
        <span className="camera-visual__key">
          {t('graph.scene.camera.key.ctrl')}
        </span>
      </div>

      <div className="camera-visual__settings">
        {SETTINGS.map((setting) => (
          <span key={setting.label} className="camera-visual__setting">
            <span className="camera-visual__label">{t(setting.label)}</span>
            <span className="camera-visual__options">
              {setting.options.map((option, index) => (
                <span
                  key={option}
                  className={`camera-visual__option${
                    index === setting.on ? ' is-on' : ''
                  }`}
                >
                  {t(option)}
                </span>
              ))}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
