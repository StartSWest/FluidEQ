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

  // One flat panel on the menus' face, like the Karaoke's other popovers
  // (the mix and the text size): a heading line, then the rows standing
  // apart by space alone. It used to be a card inside the menu - an icon
  // tile, a chip round the state, the volume and the note each boxed - and
  // Ivan sent it back with every other floating panel (2026-11-16).
  return (
    <article
      className={`karaoke-microphone${isLive ? ' is-live' : ''}`}
      aria-labelledby="karaoke-microphone-title"
    >
      <header className="karaoke-microphone__head">
        <MenuIcon name="microphone" className="karaoke-microphone__glyph" />
        <h3 id="karaoke-microphone-title">{t('karaoke.mic.title')}</h3>
        <span className="karaoke-microphone__state" aria-live="polite">
          {t(STATUS_KEYS[status])}
        </span>
      </header>

      <div className="karaoke-microphone__input">
        <span className="karaoke-microphone__name">
          {t('karaoke.mic.select')}
        </span>
        <div className="karaoke-microphone__controls">
          <Dropdown
            name={t('karaoke.mic.select')}
            options={deviceOptions}
            value={selectedDeviceId}
            handleChange={selectDevice}
            isDisabled={isRequesting || isUnavailable}
            placement="down"
            menuClassName="karaoke-microphone-menu"
          />
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
      </div>

      <div className="karaoke-microphone__reading">
        <span className="karaoke-microphone__name">
          {t('karaoke.mic.level')}
        </span>
        <span className="karaoke-microphone__value">{levelPercent}%</span>
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
        className="karaoke-microphone__reading"
        htmlFor="karaoke-microphone-gain"
      >
        <span className="karaoke-microphone__name">
          {t('karaoke.mic.volume')}
        </span>
        <span className="karaoke-microphone__value">
          {Math.round(inputGain * 100)}%
        </span>
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
      </label>
      <p className="karaoke-microphone__note">
        <MenuIcon name="info" className="karaoke-button__icon" />
        <span>{t(isLive ? 'karaoke.mic.privacy' : 'karaoke.mic.hint')}</span>
      </p>
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
