import { useId } from 'react';
import {
  WALLPAPER_MOTIONS,
  type IWallpaperWave,
  type TWallpaperMotion,
} from 'common/wallpaper';
import Glyph from '../community/Glyph';
import { MIN_GRAPH_WAVE_HEIGHT } from '../utils/graphOverlaySettings';
import { snapPercent } from '../utils/percentSnaps';
import { useTranslation } from '../utils/I18nContext';
import Switch from '../widgets/Switch';
import { MOTION_COPY } from './wallpaperCopy';

/**
 * The desktop dialog's choices under its monitors (`WallpaperDialog`): how
 * the visualizer moves, and the settings it keeps. Their own components,
 * handed their values, because Help draws the dialog too, for made-up
 * monitors (`help/live/desktopFigures`).
 */

interface IWallpaperMotionPickerProps {
  motion: TWallpaperMotion;
  onMotion: (motion: TWallpaperMotion) => void;
  disabled: boolean;
}

/** With the music, or calm: one of the two, each with what it does. */
export function WallpaperMotionPicker({
  motion,
  onMotion,
  disabled,
}: IWallpaperMotionPickerProps) {
  const { t } = useTranslation();
  const motionName = useId();
  return (
    <fieldset className="wallpaper-motion" disabled={disabled}>
      <legend className="eyebrow">{t('wallpaper.motion')}</legend>
      <div className="wallpaper-motion__options">
        {WALLPAPER_MOTIONS.map((entry) => {
          const copy = MOTION_COPY[entry];
          return (
            <label
              key={entry}
              htmlFor={`${motionName}-${entry}`}
              className={`wallpaper-motion__option wallpaper-motion__option--${entry}`}
            >
              <input
                id={`${motionName}-${entry}`}
                type="radio"
                name={motionName}
                value={entry}
                checked={motion === entry}
                onChange={() => onMotion(entry)}
              />
              <span className="wallpaper-motion__mark" aria-hidden="true">
                <Glyph name={copy.glyph} />
              </span>
              <span className="wallpaper-motion__copy">
                <span className="wallpaper-motion__name">{t(copy.name)}</span>
                <span className="wallpaper-motion__hint">{t(copy.hint)}</span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

interface IWallpaperDialogSettingsProps {
  wave: IWallpaperWave;
  onWave: (wave: IWallpaperWave) => void;
  follows: boolean;
  onFollows: (follows: boolean) => void;
  pauseOnBattery: boolean;
  onPauseOnBattery: (pause: boolean) => void;
  disabled: boolean;
}

/** The wave's height and place, following the graph, and battery power. */
export function WallpaperDialogSettings({
  wave,
  onWave,
  follows,
  onFollows,
  pauseOnBattery,
  onPauseOnBattery,
  disabled,
}: IWallpaperDialogSettingsProps) {
  const { t } = useTranslation();
  const waveHeightId = useId();
  const wavePositionId = useId();
  const followId = useId();
  const batteryId = useId();
  return (
    <div className="wallpaper-dialog__settings">
      <div className="wallpaper-dialog__setting wallpaper-wave">
        <label htmlFor={waveHeightId} title={t('graph.waveHeightHint')}>
          {t('graph.waveHeight')}
        </label>
        <input
          id={waveHeightId}
          type="range"
          min={MIN_GRAPH_WAVE_HEIGHT * 100}
          max={100}
          step={1}
          value={Math.round(wave.height * 100)}
          disabled={disabled}
          onChange={(event) =>
            onWave({
              ...wave,
              height: snapPercent(Number(event.target.value)) / 100,
            })
          }
        />
        <span className="wallpaper-wave__value">
          {t('graph.scene.percent', {
            percent: String(Math.round(wave.height * 100)),
          })}
        </span>
      </div>
      <div className="wallpaper-dialog__setting wallpaper-wave">
        <label htmlFor={wavePositionId} title={t('graph.wavePositionHint')}>
          {t('graph.wavePosition')}
        </label>
        <input
          id={wavePositionId}
          type="range"
          min={0}
          max={100}
          step={1}
          value={Math.round(wave.position * 100)}
          disabled={disabled}
          onChange={(event) =>
            onWave({
              ...wave,
              position: Number(event.target.value) / 100,
            })
          }
        />
        <span className="wallpaper-wave__value">
          {t('graph.scene.percent', {
            percent: String(Math.round(wave.position * 100)),
          })}
        </span>
      </div>
      <div className="wallpaper-dialog__setting">
        <span className="wallpaper-dialog__setting-copy">
          <label htmlFor={followId}>{t('wallpaper.follow')}</label>
          <span>{t('wallpaper.follow.choice')}</span>
        </span>
        <Switch
          id={followId}
          isOn={follows}
          isDisabled={disabled}
          ariaLabel={t('wallpaper.follow')}
          handleToggle={() => onFollows(!follows)}
        />
      </div>
      <div className="wallpaper-dialog__setting">
        <span className="wallpaper-dialog__setting-copy">
          <label htmlFor={batteryId}>{t('wallpaper.pauseOnBattery')}</label>
          <span>{t('wallpaper.pauseOnBattery.hint')}</span>
        </span>
        <Switch
          id={batteryId}
          isOn={pauseOnBattery}
          isDisabled={disabled}
          ariaLabel={t('wallpaper.pauseOnBattery')}
          handleToggle={() => onPauseOnBattery(!pauseOnBattery)}
        />
      </div>
    </div>
  );
}
