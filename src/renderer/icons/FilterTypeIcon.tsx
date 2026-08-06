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

import { FilterTypeEnum, FilterTypeToLabelMap } from 'common/constants';

/**
 * The box every filter shape is drawn in: 0 dB at y=10, with a stroke's worth
 * of clearance at the top and the bottom.
 *
 * The clearance is the point. A 2px stroke centred on the path spills 1px past
 * whatever coordinate is written, so a curve taken all the way to the edge of
 * its box came back with its bottom shaved off — which is exactly the half of
 * the drawing that says "low pass" rather than "high pass".
 */
const ICON_WIDTH = 32;
const ICON_HEIGHT = 20;

/**
 * Every icon on the same axes: low frequency left, 0 dB at the middle line.
 *
 * They used to be drawn on two different baselines — Peak and Band Pass rose
 * from the floor, while the other five hung from a ceiling and fell. So a Low
 * Shelf, which boosts the bass, was a line starting high on the left and
 * dropping, which reads as cutting the treble; and next to a Peak rising off
 * the floor it looked like the set had been shuffled. Nothing was mismatched,
 * but with no shared zero line there was nothing to read them against.
 *
 * Now every curve leaves and returns to the same line, so a boost is above it,
 * a cut is below it, and the two members of each family are mirror images.
 */
const FILTER_PATHS: Record<FilterTypeEnum, { d: string; stroke: string }> = {
  // A bell above the line.
  [FilterTypeEnum.PK]: {
    d: 'M0 10H8C11 10 12.5 3 16 3C19.5 3 21 10 24 10H32',
    stroke: '#4F6EF7',
  },
  // The same bell below it.
  [FilterTypeEnum.NO]: {
    d: 'M0 10H8C11 10 12.5 17 16 17C19.5 17 21 10 24 10H32',
    stroke: '#F74F6E',
  },
  // Lifted at the left, where the bass is.
  [FilterTypeEnum.LSC]: {
    d: 'M0 4H7C11 4 13 10 17 10H32',
    stroke: '#F74FC2',
  },
  // The same shelf at the right.
  [FilterTypeEnum.HSC]: {
    d: 'M32 4H25C21 4 19 10 15 10H0',
    stroke: '#844FF7',
  },
  // Flat until it falls away: the lows pass, the highs do not.
  [FilterTypeEnum.LPQ]: {
    d: 'M0 10H12C17 10 19.5 12.5 21.5 15.5C23 17.6 23.5 18.2 23.5 18.5',
    stroke: '#F7844F',
  },
  // The mirror of it.
  [FilterTypeEnum.HPQ]: {
    d: 'M32 10H20C15 10 12.5 12.5 10.5 15.5C9 17.6 8.5 18.2 8.5 18.5',
    stroke: '#4FF7D8',
  },
  // Both roll-offs at once, with the band between them left alone.
  [FilterTypeEnum.BP]: {
    d: 'M2 18.5C2 18.2 2.5 17.6 4 15.5C6 12.5 8.5 10 13.5 10H18.5C23.5 10 26 12.5 28 15.5C29.5 17.6 30 18.2 30 18.5',
    stroke: '#4FF784',
  },
};

/**
 * The name without the word "Filter", for use beside the icon.
 *
 * The full label is still what the option carries — it is what the dropdown
 * searches and what a screen reader announces — but repeating "Filter" seven
 * times down a list of filters costs the width that tells Low Shelf and Low
 * Pass apart.
 */
export const FILTER_TYPE_SHORT_LABELS: Record<FilterTypeEnum, string> = {
  [FilterTypeEnum.PK]: 'Peak',
  [FilterTypeEnum.NO]: 'Notch',
  [FilterTypeEnum.LSC]: 'Low Shelf',
  [FilterTypeEnum.HSC]: 'High Shelf',
  [FilterTypeEnum.LPQ]: 'Low Pass',
  [FilterTypeEnum.HPQ]: 'High Pass',
  [FilterTypeEnum.BP]: 'Band Pass',
};

const FilterTypeIcon = ({ type }: { type: FilterTypeEnum }) => {
  const shape = FILTER_PATHS[type];
  if (!shape) {
    return null;
  }
  return (
    <svg
      width={ICON_WIDTH}
      height={ICON_HEIGHT}
      viewBox={`0 0 ${ICON_WIDTH} ${ICON_HEIGHT}`}
      fill="none"
      // Belt and braces with the clearance above: nothing here should reach
      // the edge, but a clipped icon is a silently wrong drawing rather than a
      // visibly broken one, and that is the failure worth ruling out.
      style={{ overflow: 'visible' }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>{FilterTypeToLabelMap[type]}</title>
      <path
        d={shape.d}
        stroke={shape.stroke}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export const FILTER_OPTIONS = Object.values(FilterTypeEnum).map(
  (filterType: FilterTypeEnum) => {
    return {
      value: filterType,
      label: FilterTypeToLabelMap[filterType],
      display: <FilterTypeIcon type={filterType} />,
    };
  },
);

/**
 * The same options with the name spelled out next to the drawing.
 *
 * Kept separate from FILTER_OPTIONS rather than replacing it, because the
 * other place this list appears is the dropdown inside a band column, which at
 * sixteen bands is narrower than the words are long. This one is for the
 * editor row under the bands, which has the room.
 */
export const LABELLED_FILTER_OPTIONS = Object.values(FilterTypeEnum).map(
  (filterType: FilterTypeEnum) => {
    return {
      value: filterType,
      label: FilterTypeToLabelMap[filterType],
      display: (
        <span className="filter-type-option">
          <FilterTypeIcon type={filterType} />
          <span className="filter-type-option__label">
            {FILTER_TYPE_SHORT_LABELS[filterType]}
          </span>
        </span>
      ),
    };
  },
);

export default FilterTypeIcon;
