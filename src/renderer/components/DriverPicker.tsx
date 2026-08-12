/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>
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

import { useEffect, useMemo, useRef } from 'react';
import { ErrorDescription } from 'common/errors';
import {
  DRIVER_CATEGORY_LABELS,
  DRIVER_PROFILES,
  getDriverProfile,
} from 'common/driver';
import { NO_GAIN_FILTER_TYPES } from 'common/constants';
import DriverCurve from './DriverCurve';
import { useFluidEqContext } from '../utils/FluidEqContext';
import { useTranslation } from '../utils/I18nContext';
import { setDriver as setDriverApi } from '../utils/equalizerApi';
import Dropdown from '../widgets/Dropdown';
import SidebarSection from './SidebarSection';
import { IOptionEntry } from '../widgets/List';
import '../styles/DriverPicker.scss';

/**
 * How long to wait after the last change before writing.
 *
 * Long enough to coalesce a slider drag into one write, short enough that
 * letting go and listening feels immediate.
 */
const WRITE_DEBOUNCE_MS = 140;

/**
 * Driver compensation, chosen from a single combo on the EQ page.
 *
 * Deliberately one control rather than a card grid: unlike voicing, this is
 * something you set once when you plug a pair of headphones in and then leave
 * alone, so it should take up the space of a setting, not of a feature.
 */
const DriverPicker = () => {
  const { isBlockingError, isEnabled, driver, setDriver, setGlobalError } =
    useFluidEqContext();
  const { t } = useTranslation();

  const activeId = driver?.profileId ?? '';
  const intensity = driver?.intensity ?? 0.6;
  const activeProfile = getDriverProfile(activeId);

  /**
   * What the panel shows, which is not the same as what gets written.
   *
   * getDriverFilters drops anything whose scaled gain rounds to zero, because
   * an inert command has no business in the APO config. That is right for the
   * engine and wrong for the UI: at 0% strength the whole list vanished and
   * took the curve with it, so the bands a profile contains became invisible
   * exactly when you were deciding whether to turn it up. These keep their
   * shape at every strength and simply read 0 dB.
   */
  const displayFilters = useMemo(
    () =>
      (activeProfile?.filters ?? []).map((filter) => ({
        ...filter,
        gain: Math.round(filter.gain * intensity * 10) / 10,
      })),
    [activeProfile, intensity],
  );

  const options: IOptionEntry[] = useMemo(() => {
    const entries: IOptionEntry[] = [
      {
        value: '',
        label: t('driver.none'),
        display: (
          <div className="driver-option">
            <span>{t('driver.none')}</span>
            <small>{t('driver.none.hint')}</small>
          </div>
        ),
      },
    ];

    // Grouped by what you would actually be looking for, in the order the
    // profile list already declares — topology first, since it is both the
    // most common thing to know about your headphones and the most defensible
    // thing to correct from.
    DRIVER_PROFILES.forEach((profile) => {
      entries.push({
        value: profile.id,
        label: profile.name,
        group: DRIVER_CATEGORY_LABELS[profile.category],
        display: (
          <div className="driver-option">
            <span>{profile.name}</span>
            <small>{profile.tagline}</small>
          </div>
        ),
      });
    });
    return entries;
  }, [t]);

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
   * The UI updates immediately — the slider has to track the pointer. The IPC
   * write does not: dragging from 0 to 100 in 5% steps fired twenty of them,
   * each one rewriting the APO config and making Equalizer APO reload it. The
   * trailing write wins, so the file still ends up matching the control.
   */
  const apply = (profileId: string, nextIntensity: number) => {
    setDriver({
      profileId,
      intensity: nextIntensity,
      ...(profileId === driver?.profileId && driver.apoOverride
        ? { apoOverride: driver.apoOverride }
        : {}),
    });

    if (writeTimer.current !== undefined) {
      clearTimeout(writeTimer.current);
    }
    writeTimer.current = setTimeout(() => {
      writeTimer.current = undefined;
      setDriverApi(profileId, nextIntensity).catch((e) =>
        setGlobalError(e as ErrorDescription),
      );
    }, WRITE_DEBOUNCE_MS);
  };

  return (
    // The section lives here rather than in App because the combo has to stay
    // visible when the section is folded, and the combo's state lives here.
    <SidebarSection
      eyebrow={t('driver.eyebrow')}
      title={t('driver.title')}
      summary={
        // Deliberately not disabled on isBusy. Every step of a strength drag
        // starts and finishes a write, so gating the combo on that made it
        // flash between enabled and disabled the whole time the slider moved.
        // A local file write is not worth locking the control for.
        <Dropdown
          name={t('driver.title')}
          options={options}
          value={activeId}
          isDisabled={isBlockingError || !isEnabled}
          handleChange={(value) => apply(value, intensity)}
        />
      }
    >
      {activeProfile && (
        <div className="driver-picker__detail">
          {/* The shape first: it says more in one glance than the list below. */}
          <div className="driver-picker__preview">
            <DriverCurve filters={displayFilters} />
            <div className="driver-picker__scale" aria-hidden="true">
              <span>20 Hz</span>
              <span>1 kHz</span>
              <span>20 kHz</span>
            </div>
            {/* Naming the scale keeps the zoom from overstating the effect. */}
            <span className="driver-picker__range" aria-hidden="true">
              {t('driver.range')}
            </span>
          </div>

          <label htmlFor="driver-intensity">
            {t('driver.strength')}
            <output>{Math.round(intensity * 100)}%</output>
          </label>
          <input
            id="driver-intensity"
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

          {/* Every filter in plain sight, same as the voicing panel: this is a
              real APO command you could have typed yourself. */}
          <ul className="driver-picker__filters">
            {displayFilters.map((filter) => (
              <li key={`${filter.type}-${filter.frequency}`}>
                <span className="driver-filter__freq">
                  {filter.frequency >= 1000
                    ? `${Number((filter.frequency / 1000).toFixed(1))} kHz`
                    : `${filter.frequency} Hz`}
                </span>
                <span
                  className={`driver-filter__gain${
                    filter.gain < 0 ? ' is-cut' : ''
                  }`}
                >
                  {NO_GAIN_FILTER_TYPES.includes(filter.type)
                    ? filter.type
                    : `${filter.gain > 0 ? '+' : ''}${filter.gain} dB`}
                </span>
                <span className="driver-filter__reason">{filter.reason}</span>
              </li>
            ))}
          </ul>

          <p className="driver-picker__note">{activeProfile.note}</p>
        </div>
      )}
    </SidebarSection>
  );
};

export default DriverPicker;
