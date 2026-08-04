/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>

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

import { useEffect, useRef } from 'react';
import { ErrorDescription } from 'common/errors';
import {
  VOICING_PROFILES,
  getVoicingFilters,
  getVoicingPeakBoost,
} from 'common/voicing';
import { NO_GAIN_FILTER_TYPES } from 'common/constants';
import VoicingIcon from './icons/VoicingIcon';
import { useAquaContext } from './utils/AquaContext';
import { useTranslation } from './utils/I18nContext';
import { setVoicing as setVoicingApi } from './utils/equalizerApi';
import './styles/Voicing.scss';

/** Coalesces a strength drag into a single config write. */
const WRITE_DEBOUNCE_MS = 140;

const VoicingPanel = () => {
  const { isBlockingError, isEnabled, setGlobalError, voicing, setVoicing } =
    useAquaContext();
  const { t } = useTranslation();

  const activeId = voicing?.profileId ?? '';
  const intensity = voicing?.intensity ?? 1;

  const writeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  useEffect(
    () => () => {
      if (writeTimer.current !== undefined) {
        clearTimeout(writeTimer.current);
      }
    },
    [],
  );

  /**
   * Apply a change, coalescing the writes behind it.
   *
   * The UI updates immediately — the slider has to track the pointer. The write
   * is deferred because dragging the strength across its range fired one IPC
   * call per step, each rewriting the APO config and making Equalizer APO
   * reload, and each toggling the busy flag that greyed out the cards. The
   * trailing write wins, so the file still matches the control.
   */
  const apply = (profileId: string, nextIntensity: number) => {
    setVoicing({ profileId, intensity: nextIntensity });

    if (writeTimer.current !== undefined) {
      clearTimeout(writeTimer.current);
    }
    writeTimer.current = setTimeout(() => {
      writeTimer.current = undefined;
      setVoicingApi(profileId, nextIntensity).catch((e) =>
        setGlobalError(e as ErrorDescription),
      );
    }, WRITE_DEBOUNCE_MS);
  };

  const activeProfile = VOICING_PROFILES.find(
    (profile) => profile.id === activeId,
  );
  const activeFilters = getVoicingFilters(voicing);
  const peakBoost = getVoicingPeakBoost(voicing);

  return (
    <section className="voicing-panel" aria-labelledby="voicing-title">
      <div className="voicing-panel__intro">
        <p className="eyebrow">{t('voicing.eyebrow')}</p>
        <h2 id="voicing-title">{t('voicing.title')}</h2>
        <p>{t('voicing.intro')}</p>
      </div>

      <div
        className="voicing-grid"
        role="radiogroup"
        aria-label={t('voicing.title')}
      >
        <button
          type="button"
          role="radio"
          aria-checked={activeId === ''}
          className={`voicing-card${activeId === '' ? ' is-active' : ''}`}
          disabled={isBlockingError || !isEnabled}
          onClick={() => apply('', intensity)}
        >
          <span className="voicing-card__icon">
            <VoicingIcon profileId="none" />
          </span>
          <strong>{t('voicing.none')}</strong>
          <small>{t('voicing.none.hint')}</small>
        </button>

        {VOICING_PROFILES.map((profile) => (
          <button
            key={profile.id}
            type="button"
            role="radio"
            aria-checked={activeId === profile.id}
            className={`voicing-card${
              activeId === profile.id ? ' is-active' : ''
            }`}
            disabled={isBlockingError || !isEnabled}
            onClick={() => apply(profile.id, intensity)}
          >
            <span className="voicing-card__icon">
              <VoicingIcon profileId={profile.id} />
            </span>
            <strong>{profile.name}</strong>
            <small>{profile.tagline}</small>
          </button>
        ))}
      </div>

      {activeProfile && (
        <>
          <div className="voicing-strength">
            <label htmlFor="voicing-intensity">
              {t('voicing.strength')}
              <output>{Math.round(intensity * 100)}%</output>
            </label>
            {/* The filled part of the track is painted from this variable —
                a range input gives no way to style the two halves apart. */}
            <input
              id="voicing-intensity"
              type="range"
              min={0}
              max={100}
              step={5}
              value={Math.round(intensity * 100)}
              disabled={isBlockingError || !isEnabled}
              style={
                {
                  '--fill': `${Math.round(intensity * 100)}%`,
                } as React.CSSProperties
              }
              onChange={(event) =>
                apply(activeProfile.id, Number(event.target.value) / 100)
              }
            />
            <div className="voicing-strength__scale" aria-hidden="true">
              <span>{t('voicing.off')}</span>
              <span>50%</span>
              <span>{t('voicing.full')}</span>
            </div>
          </div>

          {/* Showing the actual filters keeps this from being a mystery box:
              every one of them is a real APO command you could have typed. */}
          <ul className="voicing-detail">
            {activeFilters.map((filter) => (
              <li key={`${filter.type}-${filter.frequency}`}>
                <code>
                  {filter.frequency >= 1000
                    ? `${Number((filter.frequency / 1000).toFixed(1))} kHz`
                    : `${filter.frequency} Hz`}
                  {NO_GAIN_FILTER_TYPES.includes(filter.type)
                    ? ` ${filter.type}`
                    : ` ${filter.gain > 0 ? '+' : ''}${filter.gain} dB`}
                </code>
                <span>{filter.reason}</span>
              </li>
            ))}
            {activeFilters.length === 0 && (
              <li>
                <span>{t('voicing.inert')}</span>
              </li>
            )}
          </ul>

          {peakBoost > 0 && (
            <p className="voicing-headroom">
              {t('voicing.headroom', { peak: peakBoost })}
            </p>
          )}
        </>
      )}
    </section>
  );
};

export default VoicingPanel;
