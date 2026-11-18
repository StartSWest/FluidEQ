/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { CSSProperties } from 'react';
import type { TranslationKey } from 'common/i18n';
import {
  WINDOW_TIMES,
  type TSceneDayColours,
  type TWindowColourSource,
  type TWindowTime,
} from '../utils/sceneDayColours';
import { useTranslation } from '../utils/I18nContext';

const TIME_NAME: Record<TWindowTime, TranslationKey> = {
  night: 'graph.sceneColours.night',
  day: 'graph.sceneColours.day',
};

/** A crescent and a sun, in the line weight of the app's own glyphs. */
function TimeGlyph({ time }: { time: TWindowTime }) {
  return time === 'night' ? (
    <svg viewBox="0 0 16 16" aria-hidden focusable="false">
      <path d="M10.6 2.2a6 6 0 1 0 3.2 9.6A5 5 0 0 1 10.6 2.2Z" />
    </svg>
  ) : (
    <svg viewBox="0 0 16 16" aria-hidden focusable="false">
      <circle cx="8" cy="8" r="3" />
      <path d="M8 1.5v1.8M8 12.7v1.8M1.5 8h1.8M12.7 8h1.8M3.4 3.4l1.3 1.3M11.3 11.3l1.3 1.3M3.4 12.6l1.3-1.3M11.3 4.7l1.3-1.3" />
    </svg>
  );
}

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
              <TimeGlyph time={time} />
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
