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

import {
  FilterTypeEnum,
  IFiltersMap,
  getDefaultFilterWithId,
  isBandEnabled,
} from '../../common/constants';
import { FilterAction, FilterActionEnum } from './fluidEqContextTypes';
import { cloneFilters } from '../../common/utils';

// The bands as the window holds them, and how each band edit changes them.

type IFilterReducer = (
  filters: IFiltersMap,
  action: FilterAction,
) => IFiltersMap;

const filterReducer: IFilterReducer = (
  filters: IFiltersMap,
  action: FilterAction,
) => {
  switch (action.type) {
    case FilterActionEnum.INIT:
      // An EQ with no bands is not a state this editor has.
      //
      // A flat chain is written to Equalizer APO as a preamp and no filter
      // lines, because a band at 0 dB does nothing and there is no reason to
      // spend a line on it. Read back, that is indistinguishable from "there
      // are no bands" — so pulling every gain to zero, pressing Clear EQ, or
      // applying a reference that corrects nothing emptied the slider row
      // completely and left the Parametric EQ section as a box with a dB scale
      // beside it.
      //
      // Nothing was broken underneath: APO had been told to apply no
      // correction, which is what was asked for. What was wrong is that "no
      // correction" was being drawn as "no equaliser".
      //
      // The bands already on screen are what stands in, and that distinction
      // is the whole fix: somebody with thirty-one bands at their own
      // frequencies who pulls them all to zero still has thirty-one bands, and
      // handing them back a default ten would be a layout they never asked for
      // and cannot undo.
      //
      // Guarded in the reducer rather than at any one caller because three
      // separate paths reach here with a band set from the main process —
      // refreshState, Clear EQ, and the fixed-band layouts — and a flat config
      // reads as empty through all of them. One guard where they converge
      // cannot be forgotten by the fourth.
      return Object.keys(action.filters).length > 0 ? action.filters : filters;
    case FilterActionEnum.FREQUENCY: {
      const filtersCloned = cloneFilters(filters);
      filtersCloned[action.id].frequency = action.newValue;
      return filtersCloned;
    }
    case FilterActionEnum.GAIN: {
      const filtersCloned = cloneFilters(filters);
      filtersCloned[action.id].gain = action.newValue;
      return filtersCloned;
    }
    case FilterActionEnum.GAINS: {
      // Bands that are no longer here are dropped rather than resurrected:
      // this lands after an await and the set may have lost one meanwhile.
      // Bands already sitting on their value are dropped too, so a batch that
      // asks for nothing returns the map it was given and nothing downstream
      // re-renders over it.
      const landing = action.bands.filter(
        (band) => filters[band.id] && filters[band.id].gain !== band.gain,
      );
      if (landing.length === 0) {
        return filters;
      }
      const filtersCloned = cloneFilters(filters);
      landing.forEach((band) => {
        filtersCloned[band.id].gain = band.gain;
      });
      return filtersCloned;
    }
    case FilterActionEnum.EDITS: {
      // Same defence as GAINS: this lands after an await, so a band named in
      // the batch may have been deleted meanwhile, and a batch that asks for
      // nothing returns the map it was given rather than a new one nothing
      // downstream can tell apart from a real change.
      const landing = action.edits.filter((edit) => {
        const filter = filters[edit.id];
        return (
          filter &&
          ((edit.frequency !== undefined &&
            edit.frequency !== filter.frequency) ||
            (edit.gain !== undefined && edit.gain !== filter.gain) ||
            (edit.quality !== undefined && edit.quality !== filter.quality) ||
            (edit.type !== undefined && edit.type !== filter.type) ||
            // Compared through the helper, not against the raw field: a band
            // that has never been switched off stores nothing, so
            // `false !== undefined` would report a change on every batch that
            // merely restates "on".
            (edit.isEnabled !== undefined &&
              edit.isEnabled !== isBandEnabled(filter)))
        );
      });
      if (landing.length === 0) {
        return filters;
      }
      // A new map, and a new object for each band edited and no other: a
      // band nothing touched keeps the object it had, so a memoised band on
      // the page does not draw again for another band's drag (`FrequencyBand`).
      const filtersCloned: IFiltersMap = { ...filters };
      landing.forEach((edit) => {
        const filter = { ...filtersCloned[edit.id] };
        filtersCloned[edit.id] = filter;
        if (edit.frequency !== undefined) {
          filter.frequency = edit.frequency;
        }
        if (edit.gain !== undefined) {
          filter.gain = edit.gain;
        }
        if (edit.quality !== undefined) {
          filter.quality = edit.quality;
        }
        if (edit.type !== undefined) {
          filter.type = edit.type;
        }
        if (edit.isEnabled !== undefined) {
          filter.isEnabled = edit.isEnabled;
        }
      });
      return filtersCloned;
    }
    case FilterActionEnum.QUALITY: {
      const filtersCloned = cloneFilters(filters);
      filtersCloned[action.id].quality = action.newValue;
      return filtersCloned;
    }
    case FilterActionEnum.TYPE: {
      const filtersCloned = cloneFilters(filters);
      filtersCloned[action.id].type = action.newValue;
      return filtersCloned;
    }
    case FilterActionEnum.ADD: {
      const filtersCloned = cloneFilters(filters);
      filtersCloned[action.id] = {
        ...getDefaultFilterWithId(),
        id: action.id,
        frequency: action.frequency,
      };
      return filtersCloned;
    }
    case FilterActionEnum.REMOVE: {
      const filtersCloned = cloneFilters(filters);
      delete filtersCloned[action.id];
      return filtersCloned;
    }
    case FilterActionEnum.CLEAR_GAINS: {
      // Mirrors the main process: band pass, notch and the pass filters still
      // shape the signal at 0 dB, so clearing also restores the band type.
      const filtersCloned = cloneFilters(filters);
      Object.values(filtersCloned).forEach((f) => {
        f.gain = 0;
        f.type = FilterTypeEnum.PK;
      });
      return filtersCloned;
    }
    default:
      // This throw does not actually do anything because
      // we are in a reducer
      throw new Error('Unhandled action type should not occur');
  }
};

export default filterReducer;
