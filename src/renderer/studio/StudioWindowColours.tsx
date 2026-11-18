/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useId } from 'react';
import type { TranslationKey } from 'common/i18n';
import WindowColourDayStrip from '../components/WindowColourDayStrip';
import WindowColourSwatches from '../components/WindowColourSwatches';
import WindowColourTimes from '../components/WindowColourTimes';
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
 * the tuning mockup; 2026-11-18, the night and day editing mockup): the
 * night's colours and the day's, who chose each, the three of the open one,
 * the two through the day, a small window painted in the open set, and in
 * the head "Automatic" and "Reset" for the open time. What is chosen here is
 * written into the scene, so it is what the scene publishes with.
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
  const { colours, night, day } = state;
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
            Automatic gives the open time back to the app, Reset puts back
            what it had (Ivan, 2026-11-18). */}
        <span className="studio-window-colours__resets">
          <button
            type="button"
            className="studio-settings__reset"
            disabled={idle || !state.canAutomatic}
            onClick={state.automatic}
          >
            {t('studio.windowColours.automatic')}
          </button>
          <button
            type="button"
            className="studio-settings__reset"
            disabled={idle || !state.canReset}
            onClick={state.reset}
          >
            {t('studio.settings.reset')}
          </button>
        </span>
      </div>
      {colours && night && day ? (
        <>
          <WindowColourTimes
            sides={state.sides}
            editing={state.editing}
            sourceLabel={(time) => t(SOURCE[state.sourceOf(time)])}
            disabled={idle}
            onEdit={state.setEditing}
          />
          <WindowColourSwatches
            colours={colours}
            own={state.own}
            disabled={idle}
            onChange={state.change}
            onCommit={state.commit}
          />
          <WindowColourDayStrip night={night} day={day} />
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
