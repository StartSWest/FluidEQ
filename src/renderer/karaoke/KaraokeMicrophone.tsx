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

import { CSSProperties, useEffect, useMemo } from 'react';
import { TranslationKey } from 'common/i18n';
import { useTranslation } from '../utils/I18nContext';
import MenuIcon from '../icons/MenuIcon';
import Dropdown from '../widgets/Dropdown';
import '../styles/Button.scss';
import {
  IKaraokeLivePitch,
  TKaraokePitchAnalysisStatus,
  TKaraokeMicrophoneController,
  TKaraokeMicrophoneStatus,
  useKaraokeMicrophone,
} from './useKaraokeMicrophone';

const STATUS_KEYS: Record<TKaraokeMicrophoneStatus, TranslationKey> = {
  off: 'karaoke.mic.off',
  requesting: 'karaoke.mic.requesting',
  live: 'karaoke.mic.live',
  denied: 'karaoke.mic.denied',
  unavailable: 'karaoke.mic.unavailable',
  disconnected: 'karaoke.mic.disconnected',
  error: 'karaoke.mic.error',
};

interface IKaraokeMicrophoneProps {
  isActive: boolean;
  onPitchChange?: (
    pitch: IKaraokeLivePitch | undefined,
    status: TKaraokePitchAnalysisStatus,
  ) => void;
}

interface IKaraokeMicrophoneSettingsProps {
  microphone: TKaraokeMicrophoneController;
}

export const KaraokeMicrophoneSettings = ({
  microphone,
}: IKaraokeMicrophoneSettingsProps) => {
  const { t } = useTranslation();
  const {
    devices,
    selectedDeviceId,
    status,
    level,
    inputGain,
    selectDevice,
    setInputGain,
    toggle,
  } = microphone;
  const isLive = status === 'live';
  const isRequesting = status === 'requesting';
  const isUnavailable = status === 'unavailable';
  const levelPercent = Math.round(level * 100);
  const gainPosition = Math.max(0, Math.min(100, inputGain * 50));
  const deviceOptions = useMemo(
    () =>
      devices.map((device, index) => {
        const label =
          device.label ||
          (device.deviceId === 'default'
            ? t('karaoke.mic.default')
            : t('karaoke.mic.unnamed', { number: index }));
        return {
          value: device.deviceId,
          label,
          // A block gives the shared trigger one shrinkable child. Its arrow
          // then keeps the same fixed position at the far right even when a
          // long Windows device name has to be truncated.
          display: <div title={label}>{label}</div>,
        };
      }),
    [devices, t],
  );

  return (
    <article
      className={`karaoke-microphone${isLive ? ' is-live' : ''}`}
      aria-labelledby="karaoke-microphone-title"
    >
      <div className="karaoke-workspace__card-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <path d="M12 15a4 4 0 0 0 4-4V6a4 4 0 0 0-8 0v5a4 4 0 0 0 4 4Z" />
          <path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6" />
        </svg>
      </div>
      <div className="karaoke-microphone__body">
        <div className="karaoke-workspace__card-title">
          <h3 id="karaoke-microphone-title">{t('karaoke.mic.title')}</h3>
          <span className={isLive ? 'is-live' : ''} aria-live="polite">
            {t(STATUS_KEYS[status])}
          </span>
        </div>

        <div className="karaoke-microphone__controls">
          <div className="karaoke-microphone__input">
            <span>{t('karaoke.mic.select')}</span>
            <Dropdown
              name={t('karaoke.mic.select')}
              options={deviceOptions}
              value={selectedDeviceId}
              handleChange={selectDevice}
              isDisabled={isRequesting || isUnavailable}
              placement="down"
              menuClassName="karaoke-microphone-menu"
            />
          </div>
          <button
            type="button"
            className={`button small karaoke-microphone__toggle${
              isLive ? ' subtle' : ''
            }`}
            onClick={toggle}
            disabled={isUnavailable}
            aria-pressed={isLive}
          >
            <MenuIcon name="microphone" className="karaoke-button__icon" />
            {isRequesting
              ? t('karaoke.mic.requesting')
              : t(isLive ? 'karaoke.mic.turnOff' : 'karaoke.mic.turnOn')}
          </button>
        </div>

        <div className="karaoke-microphone__level">
          <div className="karaoke-microphone__level-heading">
            <span>{t('karaoke.mic.level')}</span>
            <strong>{levelPercent}%</strong>
          </div>
          <div
            className="karaoke-microphone__meter"
            role="meter"
            aria-label={t('karaoke.mic.level')}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={levelPercent}
            aria-valuetext={t('karaoke.mic.levelValue', {
              percent: levelPercent,
            })}
          >
            <span style={{ transform: `scaleX(${level})` }} />
          </div>
        </div>
        <label
          className="karaoke-microphone__gain"
          htmlFor="karaoke-microphone-gain"
        >
          <span>{t('karaoke.mic.volume')}</span>
          <input
            id="karaoke-microphone-gain"
            type="range"
            min="0"
            max="200"
            step="1"
            value={Math.round(inputGain * 100)}
            onChange={(event) => setInputGain(Number(event.target.value) / 100)}
            style={
              {
                '--karaoke-gain-position': `${gainPosition}%`,
              } as CSSProperties
            }
            aria-label={t('karaoke.mic.volume')}
            aria-valuetext={t('karaoke.mic.volumeValue', {
              percent: Math.round(inputGain * 100),
            })}
          />
          <strong>{Math.round(inputGain * 100)}%</strong>
        </label>
        <div className="karaoke-microphone__privacy">
          <MenuIcon name="info" className="karaoke-button__icon" />
          <p>{t(isLive ? 'karaoke.mic.privacy' : 'karaoke.mic.hint')}</p>
        </div>
      </div>
    </article>
  );
};

const KaraokeMicrophone = ({
  isActive,
  onPitchChange,
}: IKaraokeMicrophoneProps) => {
  const microphone = useKaraokeMicrophone(isActive);
  const { pitch, pitchAnalysisStatus } = microphone;

  useEffect(() => {
    onPitchChange?.(pitch, pitchAnalysisStatus);
  }, [onPitchChange, pitch, pitchAnalysisStatus]);

  return <KaraokeMicrophoneSettings microphone={microphone} />;
};

export default KaraokeMicrophone;
