/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useId } from 'react';
import type { TranslationKey } from 'common/i18n';
import WindowColourFinder from '../components/WindowColourFinder';
import WindowColourSwatches from '../components/WindowColourSwatches';
import WindowColoursPreview from '../components/WindowColoursPreview';
import { useTranslation } from '../utils/I18nContext';
import { useRainbowStops } from '../utils/rainbowPalette';
import { useStudioAppColours } from '../utils/sceneAppColours';
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
  // What the window's colourful marks run through while the bench lends the
  // window its project, as `RainbowSource` decides it: the project's own
  // wave palette first; colours only measured off its picture never reach
  // them, which then wear the window's own pair - the stops worn now.
  const projectStops = useStudioAppColours();
  const liveStops = useRainbowStops();
  const isMeasured = !state.isNamed && state.sourceOf(state.editing) === 'auto';
  const run = projectStops ?? (isMeasured ? liveStops : undefined);
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
          <WindowColourSwatches
            colours={colours}
            own={state.own}
            named={state.isNamed}
            disabled={idle}
            onChange={state.change}
            onCommit={state.commit}
          />
          <WindowColourFinder
            finding={state.finder.finding}
            source={t(SOURCE[state.sourceOf(state.editing)])}
            disabled={idle || !state.finder.canFind}
            onFind={state.finder.find}
          />
          <WindowColoursPreview
            colours={colours}
            named={state.isNamed}
            run={run}
          />
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
