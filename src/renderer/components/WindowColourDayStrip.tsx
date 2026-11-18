/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useMemo, type CSSProperties } from 'react';
import {
  SCENE_WINDOW_COLOUR_ROLES,
  type ISceneWindowColours,
} from 'common/sceneWindowColours';
import { usePageDaylight } from '../graph/sceneDaylight';
import { blendWindowColours } from '../utils/sceneDayColours';
import { useTranslation } from '../utils/I18nContext';

/** Points each lane is drawn through: enough for an OKLCH turn to read smooth. */
const STEPS = 12;

interface IWindowColourDayStripProps {
  night: ISceneWindowColours;
  day: ISceneWindowColours;
}

/**
 * The three colours through the day: a lane each, from the night's at the
 * left to the day's at the right, in the blend the window wears
 * (`blendWindowColours`), with a mark where the scene's hour stands now. It
 * is what tells two sets that cross at dusk from two that turn cleanly.
 */
export default function WindowColourDayStrip({
  night,
  day,
}: IWindowColourDayStripProps) {
  const { t } = useTranslation();
  const hour = Math.round(usePageDaylight());
  const lanes = useMemo(
    () =>
      SCENE_WINDOW_COLOUR_ROLES.map((role) => {
        const stops = Array.from({ length: STEPS + 1 }, (_, step) => {
          const colours = blendWindowColours(night, day, (step / STEPS) * 100);
          return `${colours[role]} ${((step / STEPS) * 100).toFixed(1)}%`;
        });
        return {
          role,
          background: `linear-gradient(90deg, ${stops.join(', ')})`,
        };
      }),
    [night, day],
  );
  return (
    <div className="window-colour-day">
      <div
        className="window-colour-day__lanes"
        role="img"
        aria-label={t('graph.sceneColours.throughDay', { hour })}
        style={{ '--hour': String(hour) } as CSSProperties}
      >
        {lanes.map((lane) => (
          <span
            key={lane.role}
            className={`window-colour-day__lane is-${lane.role}`}
            style={{ background: lane.background }}
          />
        ))}
        <span className="window-colour-day__now" aria-hidden />
      </div>
      <div className="window-colour-day__legend" aria-hidden>
        <span>{t('graph.sceneColours.night')}</span>
        <span>{t('graph.sceneColours.throughDay', { hour })}</span>
        <span>{t('graph.sceneColours.day')}</span>
      </div>
    </div>
  );
}
