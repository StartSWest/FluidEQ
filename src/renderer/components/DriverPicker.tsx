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

import { useMemo, useState } from 'react';
import { ErrorDescription } from 'common/errors';
import {
  DRIVER_CATEGORY_LABELS,
  DRIVER_PROFILES,
  getDriverFilters,
  getDriverProfile,
} from 'common/driver';
import { NO_GAIN_FILTER_TYPES } from 'common/constants';
import { useAquaContext } from '../utils/AquaContext';
import { setDriver as setDriverApi } from '../utils/equalizerApi';
import Dropdown from '../widgets/Dropdown';
import { IOptionEntry } from '../widgets/List';
import '../styles/DriverPicker.scss';

/**
 * Driver compensation, chosen from a single combo on the EQ page.
 *
 * Deliberately one control rather than a card grid: unlike voicing, this is
 * something you set once when you plug a pair of headphones in and then leave
 * alone, so it should take up the space of a setting, not of a feature.
 */
const DriverPicker = () => {
  const { isBlockingError, isEnabled, driver, setDriver, setGlobalError } =
    useAquaContext();
  const [isBusy, setIsBusy] = useState(false);

  const activeId = driver?.profileId ?? '';
  const intensity = driver?.intensity ?? 0.6;
  const activeProfile = getDriverProfile(activeId);
  const activeFilters = getDriverFilters(driver);

  const options: IOptionEntry[] = useMemo(() => {
    const entries: IOptionEntry[] = [
      {
        value: '',
        label: 'No compensation',
        display: (
          <div className="driver-option">
            <span>No compensation</span>
            <small>Your bands and voicing only</small>
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
  }, []);

  const apply = async (profileId: string, nextIntensity: number) => {
    // Optimistic: the slider tracks the pointer and the write is a local file.
    setDriver({ profileId, intensity: nextIntensity });
    setIsBusy(true);
    try {
      await setDriverApi(profileId, nextIntensity);
    } catch (e) {
      setGlobalError(e as ErrorDescription);
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <section className="driver-picker" aria-labelledby="driver-picker-title">
      <div className="driver-picker__head">
        <span className="eyebrow" id="driver-picker-title">
          WHAT YOU LISTEN ON
        </span>
        <Dropdown
          name="Driver type"
          options={options}
          value={activeId}
          isDisabled={isBlockingError || !isEnabled || isBusy}
          handleChange={(value) => apply(value, intensity)}
        />
      </div>

      {activeProfile && (
        <div className="driver-picker__detail">
          <label htmlFor="driver-intensity">
            Strength
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
                <span>At 0% strength this does nothing.</span>
              </li>
            )}
          </ul>

          <p className="driver-picker__note">{activeProfile.note}</p>
        </div>
      )}
    </section>
  );
};

export default DriverPicker;
