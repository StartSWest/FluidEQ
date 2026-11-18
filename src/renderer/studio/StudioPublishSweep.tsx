/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useCallback, useId, useRef, useState, type RefObject } from 'react';
import {
  hasSceneDaylight,
  SCENE_DAYLIGHT_MAX,
  SCENE_DAYLIGHT_MIN,
} from 'common/sceneDaylight';
import type { IScenePack } from 'common/scenePacks';
import { useTranslation } from '../utils/I18nContext';
import Switch from '../widgets/Switch';
import { PREVIEW_DURATION_MS } from './previewVideo';
import type { TPublishVideoState } from './usePublishVideo';

/**
 * NIGHT TO DAY IN THE PREVIEW CLIP (Ivan, 2026-11-17: "I want the video
 * recorder to record the scenes from night to day in the 10 seconds, from 0
 * to 100"). For a scene with a time of day, the clip's hour is the take's
 * own clock: night (0) until its first frame, then a straight line to full
 * day (100) at its last. The take's clock is the recorder's (`elapsedMs`,
 * which leaves out every second the take was held), never the wall's, so a
 * pause over a quiet moment holds the hour where it was and the line comes
 * out even in the clip. Only the take reads it: the dialog's own Time of
 * day slider, the window's Brightness and the scene's own Daylight are left
 * as they were, and the slider's hour comes back the moment the take ends.
 *
 * Answers the hour the stage should draw at now, or `undefined` while no
 * sweeping take is running.
 */
export const sweepDaylight = (
  state: TPublishVideoState,
): number | undefined => {
  if (state.phase === 'waiting' || state.phase === 'preparing') {
    // Night before the first kept frame: the frame that starts the take is
    // one the stage drew already, so it has to be drawn at night too.
    return SCENE_DAYLIGHT_MIN;
  }
  if (state.phase === 'recording' || state.phase === 'paused') {
    const through = Math.min(
      1,
      Math.max(0, state.elapsedMs / PREVIEW_DURATION_MS),
    );
    return (
      SCENE_DAYLIGHT_MIN + through * (SCENE_DAYLIGHT_MAX - SCENE_DAYLIGHT_MIN)
    );
  }
  return undefined;
};

/**
 * The stage's per-frame read of the hour: the take's while `sweeping` (the
 * scene has a time of day, the choice is on and a Normal-view take is
 * running), the dialog slider's (`chosen`) otherwise. Stable, and backed by
 * refs, so the stage's read never waits on a render.
 */
export function useDaylightSweep(
  sweeping: boolean,
  state: TPublishVideoState,
  chosen: RefObject<number>,
) {
  const hour = useRef<number | undefined>(undefined);
  hour.current = sweeping ? sweepDaylight(state) : undefined;
  return useCallback(() => hour.current ?? chosen.current, [chosen]);
}

export interface INightToDay {
  /** Only a scene with a time of day can sweep; others record as before. */
  shown: boolean;
  isOn: boolean;
  /**
   * Shown and on. The take's key carries it in place of the slider's hour:
   * a sweeping clip runs through every hour, so letting the slider go
   * records nothing again.
   */
  sweeping: boolean;
  toggle: () => void;
}

/** The dialog's own Night to day choice, on by default. */
export function useNightToDay(pack: IScenePack): INightToDay {
  const [isOn, setOn] = useState(true);
  const shown = hasSceneDaylight(pack);
  const toggle = useCallback(() => setOn((on) => !on), []);
  return { shown, isOn, sweeping: shown && isOn, toggle };
}

interface INightToDayProps {
  choice: INightToDay;
  disabled: boolean;
  hint?: string;
}

/** The choice beside the Time of day slider; nothing for a scene without
 * a time of day. */
export function NightToDaySwitch({ choice, disabled, hint }: INightToDayProps) {
  const { t } = useTranslation();
  const id = useId();
  if (!choice.shown) {
    return null;
  }
  const { isOn, toggle: onToggle } = choice;
  return (
    <div
      className="studio-setting studio-setting--switch"
      title={hint ?? t('studio.publish.nightToDayHint')}
    >
      <span className="studio-setting__head">
        <label className="studio-setting__label" htmlFor={id}>
          {t('studio.publish.nightToDay')}
        </label>
        <Switch
          id={id}
          ariaLabel={t('studio.publish.nightToDay')}
          isOn={isOn}
          isDisabled={disabled}
          handleToggle={onToggle}
        />
      </span>
    </div>
  );
}
