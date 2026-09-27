/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useId, type RefObject } from 'react';
import type { TranslationKey } from 'common/i18n';
import { SETTINGS_GROUP_TITLE } from 'common/settingsGroups';
import LiveFigure from '../components/LiveFigure';
import ScenePerformanceMenu from '../graph/ScenePerformanceMenu';
import { useTranslation } from '../utils/I18nContext';
import { widestStudioReadings } from './useStudioReading';

interface IStudioDrawingProps {
  /** How the scene is running, when it is. */
  cost?: TranslationKey;
  percent: number;
  /**
   * What the frames are costing right now — written by the bench after every
   * frame, never through React.
   */
  readingRef: RefObject<HTMLSpanElement | null>;
}

/**
 * The Performance tab: how the scene is drawn, as the graph's menu draws it
 * (`common/scenePerformance.ts`), so a choice made here is the graph's and
 * the desktop's too — and under the choices, how the scene is keeping up
 * with them, the one live reading and the reason anybody opens this tab.
 */
export default function StudioDrawing({
  cost,
  percent,
  readingRef,
}: IStudioDrawingProps) {
  const { t } = useTranslation();
  const titleId = useId();
  return (
    <section className="studio-card studio-drawing" aria-labelledby={titleId}>
      <span className="studio-card__eyebrow" id={titleId}>
        {t(SETTINGS_GROUP_TITLE.drawing)}
      </span>
      <span className="studio-test__hint">{t('studio.performance.hint')}</span>
      {/* A group, not a menu: nothing here floats over anything, and the app
          draws an edge round every `[role="menu"]` (`Rainbow.scss`) — the box
          round these rows that Ivan asked to have taken off. The menu's own
          rows all the same, with their floating surface taken off
          (`.studio-performance__rows`). */}
      <div
        className="graph-view-menu__list studio-performance__rows"
        role="group"
        aria-label={t('studio.performance.title')}
      >
        <ScenePerformanceMenu />
      </div>
      {cost && (
        <span className={`studio-cost studio-cost--${cost.split('.').pop()}`}>
          <span className="studio-cost__dot" aria-hidden="true" />
          {t(cost, { percent })}
          <LiveFigure
            className="studio-cost__reading"
            widest={widestStudioReadings(t)}
            textRef={readingRef}
          />
        </span>
      )}
    </section>
  );
}
