/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { CSSProperties } from 'react';
import {
  WINDOW_TIMES,
  type TSceneDayColours,
  type TWindowColourSource,
  type TWindowTime,
} from '../utils/sceneDayColours';
import { useTranslation } from '../utils/I18nContext';
import TIME_NAME from '../utils/windowTimeNames';
import WindowTimeGlyph from './WindowTimeGlyph';

interface IWindowColourTimesProps {
  sides: TSceneDayColours;
  editing: TWindowTime;
  /** Who or what each time's colours are by, in the words of the place. */
  sourceLabel: (
    time: TWindowTime,
    source: TWindowColourSource | undefined,
  ) => string;
  disabled?: boolean;
  onEdit: (time: TWindowTime) => void;
}

/**
 * The night's colours and the day's, side by side, the one being edited
 * pressed (Ivan, 2026-11-18, the night and day editing mockup): each with its
 * three colours and who chose them - a person, the scene, or the app on its
 * own - so a set still worked out by the app reads as automatic at a glance.
 */
export default function WindowColourTimes({
  sides,
  editing,
  sourceLabel,
  disabled = false,
  onEdit,
}: IWindowColourTimesProps) {
  const { t } = useTranslation();
  return (
    <div
      className="window-colour-times"
      role="group"
      aria-label={t('graph.sceneColours.times')}
    >
      {WINDOW_TIMES.map((time) => {
        const side = sides[time];
        const source = side?.source;
        const isAuto = source === 'measured' || source === 'palette';
        return (
          <button
            key={time}
            type="button"
            className="window-colour-time"
            aria-pressed={editing === time}
            disabled={disabled}
            onClick={() => onEdit(time)}
          >
            <span className="window-colour-time__glyph">
              <WindowTimeGlyph time={time} />
            </span>
            <span className="window-colour-time__text">
              <span className="window-colour-time__name">
                {t(TIME_NAME[time])}
              </span>
              <span
                className={`window-colour-time__source${isAuto ? ' is-auto' : ''}${source === 'chosen' ? ' is-yours' : ''}`}
              >
                {sourceLabel(time, source)}
              </span>
            </span>
            {side && (
              <span className="window-colour-time__dots" aria-hidden>
                {(['surface', 'accent', 'glow'] as const).map((role) => (
                  <span
                    key={role}
                    style={{ '--dot': side.colours[role] } as CSSProperties}
                  />
                ))}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
