/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useId } from 'react';
import type { TranslationKey } from 'common/i18n';
import WindowColourDayStrip from '../components/WindowColourDayStrip';
import WindowColourFinder from '../components/WindowColourFinder';
import WindowColourStops from '../components/WindowColourStops';
import WindowColourSwatches from '../components/WindowColourSwatches';
import WindowColoursPreview from '../components/WindowColoursPreview';
import { useTranslation } from '../utils/I18nContext';
import StudioInfo from './StudioInfo';
import type useStudioWindowColours from './useStudioWindowColours';
import type { TWindowColoursSource } from './useStudioWindowColours';

const SOURCE: Record<TWindowColoursSource, TranslationKey> = {
  ai: 'studio.windowColours.sourceAi',
  member: 'studio.windowColours.sourceYou',
  palette: 'graph.sceneColours.sourcePalette',
  auto: 'graph.sceneColours.sourceAuto',
};

/**
 * The Tune tab's Window colours card (Ivan, 2026-11-14: "implement that",
 * the tuning mockup; 2026-11-18: "we need 4 breakpoints plus 100% which is
 * the white one"): the five points through the day, who chose each, the
 * three of the open one with Automatic under them, which finds the scene's
 * own colours at that point as often as it is pressed (2026-11-19), the
 * five through the day, a small window painted in the open set, and Reset
 * for the open point in the head. What is chosen here is written into the
 * scene, so it is what the scene publishes with.
 */
export default function StudioWindowColours({
  state,
  idle,
}: {
  state: ReturnType<typeof useStudioWindowColours>;
  idle: boolean;
}) {
  const { t } = useTranslation();
  const titleId = useId();
  const { colours } = state;
  return (
    <section
      className="studio-card studio-tune__box studio-window-colours"
      aria-labelledby={titleId}
    >
      <div className="studio-tune__head">
        <span className="studio-card__eyebrow" id={titleId}>
          {t('studio.windowColours.title')}
        </span>
        <StudioInfo text={t('studio.windowColours.note')} />
        {/* At the far end, as every block on the Tune tab has its Reset:
            it puts back what the open point had (Ivan, 2026-11-18). */}
        <button
          type="button"
          className="studio-settings__reset"
          disabled={idle || !state.canReset}
          data-tooltip={t('studio.windowColours.resetHint')}
          onClick={state.reset}
        >
          {t('studio.settings.reset')}
        </button>
      </div>
      {colours ? (
        <>
          <WindowColourStops
            sides={state.sides}
            editing={state.editing}
            sourceLabel={(stop) => t(SOURCE[state.sourceOf(stop)])}
            disabled={idle}
            onEdit={state.setEditing}
          />
          <WindowColourSwatches
            colours={colours}
            own={state.own}
            editing={state.editing}
            disabled={idle}
            onChange={state.change}
            onCommit={state.commit}
          />
          <WindowColourFinder
            finding={state.finder.finding}
            disabled={idle || !state.finder.canFind}
            onFind={state.finder.find}
          />
          <WindowColourDayStrip sides={state.sides} editing={state.editing} />
          <WindowColoursPreview colours={colours} named={state.isNamed} />
        </>
      ) : (
        <p className="studio-window-colours__empty">
          {t('studio.windowColours.none')}
        </p>
      )}
      {/* The note that the colours travel with the scene is the "i"'s; only
          a save that failed is news worth a line of its own. */}
      {state.saving === 'failed' && (
        <p className="studio-window-colours__failed" role="alert">
          {t('studio.windowColours.failed')}
        </p>
      )}
    </section>
  );
}
