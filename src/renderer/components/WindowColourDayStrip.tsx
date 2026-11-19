/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useMemo, type CSSProperties } from 'react';
import type { TranslationKey } from 'common/i18n';
import {
  SCENE_WINDOW_COLOUR_ROLES,
  type TSceneWindowColourRole,
} from 'common/sceneWindowColours';
import { usePageDaylight } from '../graph/sceneDaylight';
import {
  coloursAtHour,
  hourOfStop,
  isKeyframe,
  setsOfSides,
  WINDOW_COLOUR_STOPS,
  type TSceneStopColours,
  type TWindowColourStop,
} from '../utils/sceneDayColours';
import { useTranslation } from '../utils/I18nContext';
import { DARK_END_SHADE, lightWindowOf } from '../utils/themeShade';

/**
 * The hours each lane is drawn through: every fourth, enough for an OKLCH
 * turn to read smooth, and the two either side of the line where the window
 * turns white, so the surface's lane turns there as sharply as the window.
 */
const HOURS = [
  ...new Set([
    ...Array.from({ length: 26 }, (_, step) => step * 4),
    DARK_END_SHADE,
    DARK_END_SHADE + 1,
  ]),
].sort((left, right) => left - right);

/** Each band's name, the swatch's own above it. */
const ROLE_NAME: Record<TSceneWindowColourRole, TranslationKey> = {
  surface: 'graph.sceneColours.surface',
  accent: 'graph.sceneColours.accent',
  glow: 'graph.sceneColours.glow',
};

interface IWindowColourDayStripProps {
  /** Every point's colours, the one being picked as it is picked. */
  sides: TSceneStopColours;
  editing: TWindowColourStop;
}

/**
 * The three colours through the day: a lane each, from the 0 point at the
 * left to the 100 point at the right, in the blend the window wears
 * (`coloursAtHour`), with each of the five points marked - filled where the
 * point is somebody's choice, open where it is the app's - and a line where
 * the scene's hour stands now. The surface's lane is the white window's from
 * the Brightness where the window turns white (Ivan, 2026-11-18: "plus 100%
 * which is the white one"). It is what tells points that cross from points
 * that turn cleanly.
 */
export default function WindowColourDayStrip({
  sides,
  editing,
}: IWindowColourDayStripProps) {
  const { t } = useTranslation();
  const hour = Math.round(usePageDaylight());
  const lanes = useMemo(() => {
    const sets = setsOfSides(sides);
    const at = HOURS.map((step) => ({
      step,
      colours: coloursAtHour(sets, step),
    }));
    return SCENE_WINDOW_COLOUR_ROLES.map((role) => {
      const stops = at.flatMap(({ step, colours }) => {
        if (!colours) {
          return [];
        }
        const white =
          role === 'surface'
            ? lightWindowOf(step)?.tokens['--surface-panel']
            : undefined;
        return [`${white ?? colours[role]} ${step}%`];
      });
      return {
        role,
        background:
          stops.length > 0
            ? `linear-gradient(90deg, ${stops.join(', ')})`
            : undefined,
      };
    });
  }, [sides]);
  // Read as a slider it said nothing (Ivan, 2026-11-18: "I don't really
  // understand this slider"): it is a picture, so it says what it shows - a
  // title, each band's colour by name beside it, and the line marked Now.
  return (
    <div
      className="window-colour-day"
      role="img"
      aria-label={t('graph.sceneColours.throughDay', { hour })}
      style={{ '--hour': String(hour) } as CSSProperties}
    >
      <span className="window-colour-day__head" aria-hidden>
        <span className="window-colour-day__title">
          {t('graph.sceneColours.dayStrip')}
        </span>
        <span className="window-colour-day__now-tag">
          {t('graph.sceneColours.nowAt', { hour })}
        </span>
      </span>
      <div className="window-colour-day__rows" aria-hidden>
        <span className="window-colour-day__names">
          {lanes.map((lane) => (
            <span key={lane.role} className={`is-${lane.role}`}>
              {t(ROLE_NAME[lane.role])}
            </span>
          ))}
        </span>
        <div className="window-colour-day__lanes">
          {lanes.map((lane) => (
            <span
              key={lane.role}
              className={`window-colour-day__lane is-${lane.role}`}
              style={{ background: lane.background }}
            />
          ))}
          <span className="window-colour-day__now" />
        </div>
        {/* Under the bands, each point at its own hour. */}
        <span className="window-colour-day__points">
          {WINDOW_COLOUR_STOPS.map((stop) => (
            <span
              key={stop}
              className={`window-colour-day__point${isKeyframe(sides[stop]) ? ' is-key' : ''}${stop === editing ? ' is-open' : ''}`}
              style={{ '--at': String(hourOfStop(stop)) } as CSSProperties}
            >
              {stop}
            </span>
          ))}
        </span>
      </div>
    </div>
  );
}
