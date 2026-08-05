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

import { useSyncExternalStore } from 'react';
import { GraphStyle, nextGraphStyle } from 'common/graphStyles';

/**
 * How the live spectrum is drawn, held outside React.
 *
 * A module store rather than a prop, because the two ends are far apart: the
 * legend that changes it sits in the graph's header, and the thing that reads
 * it is a `Line` three components down inside the chart. Threading a prop
 * through Chart and Curve would make every other curve carry a setting that
 * has nothing to do with it.
 *
 * Remembered, like the meter's style — it is a preference, not a mode.
 */
const STORAGE_KEY = 'fluideq-graph-style';

const listeners = new Set<() => void>();

let style: GraphStyle = 'line';
try {
  style = (window.localStorage.getItem(STORAGE_KEY) as GraphStyle) || 'line';
} catch {
  // Storage can be unavailable; the default is a perfectly good curve.
}

export const getGraphStyle = () => style;

export const cycleGraphStyle = () => {
  style = nextGraphStyle(style);
  try {
    window.localStorage.setItem(STORAGE_KEY, style);
  } catch {
    // Not worth failing a click over.
  }
  listeners.forEach((listener) => listener());
};

export const useGraphStyle = () =>
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => style,
    () => 'line' as GraphStyle,
  );
