/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { CSSProperties } from 'react';
import type { TranslationKey } from 'common/i18n';
import { SCENE_WINDOW_COLOUR_ROLES } from 'common/sceneWindowColours';
import {
  hourOfStop,
  isKeyframe,
  stopColoursAt,
  WINDOW_COLOUR_STOPS,
  type TSceneStopColours,
  type TWindowColourSource,
  type TWindowColourStop,
} from '../utils/sceneDayColours';
import { useTranslation } from '../utils/I18nContext';
import { lightWindowOf, THEME_SHADE_MAX } from '../utils/themeShade';
import { WINDOW_STOP_NAME } from '../utils/windowTimeNames';

/** The name under a point's hour, for the three that have one. */
const STOP_WORD: Partial<Record<TWindowColourStop, TranslationKey>> = {
  '0': 'graph.sceneColours.night',
  '75': 'graph.sceneColours.day',
  '100': 'graph.sceneColours.white',
};

interface IWindowColourStopsProps {
  /** Every point's colours as the window wears them, a picked one included. */
  sides: TSceneStopColours;
  editing: TWindowColourStop;
  /**
   * Who or what a point's colours are by, in the words of the place;
   * undefined `source` for a point with no set of its own, which shows the
   * blend of its neighbours.
   */
  sourceLabel: (
    stop: TWindowColourStop,
    source: TWindowColourSource | undefined,
  ) => string;
  disabled?: boolean;
  onEdit: (stop: TWindowColourStop) => void;
}

/**
 * The five points of a scene's window colours in one row (Ivan, 2026-11-18:
 * "0, 25, 50 and 75 ... plus 100% which is the white one ... so we have 5
 * break points for all colors"), the open one pressed: each with its hour,
 * its three colours and who chose them - a person, the scene, or the app on
 * its own - so a point still worked out by the app reads as automatic at a
 * glance. A point with no set of its own shows the blend the window wears
 * there; the 100 point's surface is the white window's, whatever its set
 * says. Pressing one moves the scene's hour onto it (`useEditedStop`).
 */
export default function WindowColourStops({
  sides,
  editing,
  sourceLabel,
  disabled = false,
  onEdit,
}: IWindowColourStopsProps) {
  const { t } = useTranslation();
  const whitePane = lightWindowOf(THEME_SHADE_MAX)?.tokens['--surface-panel'];
  // The longest word any card shows, in letters: the row keeps five cards
  // only while each can hold it whole (`WindowColourStops.scss`), so
  // Russian's "Автоматически" steps the row to three and two where it would
  // otherwise break mid-word, and English keeps five in less room.
  const longestWord = Math.max(
    1,
    ...WINDOW_COLOUR_STOPS.flatMap((stop) => {
      const word = STOP_WORD[stop];
      return [sourceLabel(stop, sides[stop]?.source), word ? t(word) : ''];
    })
      .flatMap((text) => text.split(' '))
      .map((part) => Array.from(part).length),
  );
  return (
    <div
      className="window-colour-stops"
      role="group"
      aria-label={t('graph.sceneColours.times')}
      style={{ '--stop-word-chars': String(longestWord) } as CSSProperties}
    >
      {WINDOW_COLOUR_STOPS.map((stop) => {
        const side = sides[stop];
        const source = side?.source;
        const isAuto = !isKeyframe(side);
        const colours = side?.colours ?? stopColoursAt(sides, hourOfStop(stop));
        const word = STOP_WORD[stop];
        return (
          <button
            key={stop}
            type="button"
            className={`window-colour-stop${isAuto ? ' is-auto' : ''}`}
            aria-pressed={editing === stop}
            aria-label={`${t(WINDOW_STOP_NAME[stop])}, ${sourceLabel(stop, source)}`}
            disabled={disabled}
            onClick={() => onEdit(stop)}
          >
            <span className="window-colour-stop__label" aria-hidden>
              <span className="window-colour-stop__hour">{stop}</span>
              {word && (
                <span className="window-colour-stop__word">{t(word)}</span>
              )}
            </span>
            <span className="window-colour-stop__dots" aria-hidden>
              {colours &&
                SCENE_WINDOW_COLOUR_ROLES.map((role) => (
                  <span
                    key={role}
                    style={
                      {
                        '--dot':
                          role === 'surface' && stop === '100' && whitePane
                            ? whitePane
                            : colours[role],
                      } as CSSProperties
                    }
                  />
                ))}
            </span>
            <span
              className={`window-colour-stop__source${source === 'chosen' ? ' is-yours' : ''}`}
              aria-hidden
            >
              {sourceLabel(stop, source)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
