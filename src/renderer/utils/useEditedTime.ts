/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useState } from 'react';
import { SCENE_DAYLIGHT_MAX, SCENE_DAYLIGHT_MIN } from 'common/sceneDaylight';
import { usePageDaylight } from '../graph/sceneDaylight';
import type { TWindowTime } from './sceneDayColours';

/** From here up the scene's hour is nearer its day than its night. */
const DAY_FROM = (SCENE_DAYLIGHT_MIN + SCENE_DAYLIGHT_MAX) / 2;

/** The time the scene's hour is nearer now: its night's or its day's. */
export function useNearerTime(): TWindowTime {
  return usePageDaylight() >= DAY_FROM ? 'day' : 'night';
}

/**
 * Which time's colours a window colour editor has open (Ivan, 2026-11-18:
 * "que el slider también seleccione el card de colores de día si paso a día
 * y así para si paso a noche"): the time the scene's hour is nearer, and
 * the other one the moment the Brightness - or the clock - carries the hour
 * across the middle of the day. A tab pressed by hand stays open until the
 * hour crosses again, so looking at the night's colours at noon is still a
 * click away.
 */
export default function useEditedTime(): [
  TWindowTime,
  (time: TWindowTime) => void,
] {
  const nearer = useNearerTime();
  const [editing, setEditing] = useState<TWindowTime>(nearer);
  const [followed, setFollowed] = useState<TWindowTime>(nearer);
  // Adjusted while rendering, as React has state follow a prop: in an
  // effect the editor would first draw the old time's colours for a frame.
  if (followed !== nearer) {
    setFollowed(nearer);
    setEditing(nearer);
  }
  return [editing, setEditing];
}
